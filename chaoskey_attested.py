import cv2
import time
import os
import json
import hashlib
import hmac
import threading
import secrets
from typing import List, Tuple
from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives.serialization import (
    Encoding, PublicFormat, PrivateFormat, NoEncryption
)

# =========================
# Config
# =========================

DEVICE_ID = "CHAOSKEY-M3-001"
LEDGER_PATH = "chaoskey_ledger.jsonl"
CAMERA_INDEX = 0
FRAME_WIDTH = 640
FRAME_HEIGHT = 480
FPS = 15
FRAMES_PER_BLOCK = 8          # how many frames per entropy block
RAW_BITS_PER_BLOCK = 256 * 16 # target raw bits before hashing
HEALTH_MIN_VARIANCE = 5.0     # minimal variance to consider frame "alive"
HEALTH_MAX_RUN = 64           # max allowed run of identical bits
HKDF_OUTPUT_BYTES = 64        # default output size

DEVICE_KEY_PATH = "device_ed25519_private.pem"
DEVICE_PUB_PATH = "device_ed25519_public.pem"


# =========================
# Device keypair
# =========================

def load_or_create_device_keys():
    if os.path.exists(DEVICE_KEY_PATH):
        with open(DEVICE_KEY_PATH, "rb") as f:
            private_key = serialization.load_pem_private_key(f.read(), password=None)
    else:
        private_key = ed25519.Ed25519PrivateKey.generate()
        with open(DEVICE_KEY_PATH, "wb") as f:
            f.write(
                private_key.private_bytes(
                    encoding=Encoding.PEM,
                    format=PrivateFormat.PKCS8,
                    encryption_algorithm=NoEncryption(),
                )
            )
    public_key = private_key.public_key()
    with open(DEVICE_PUB_PATH, "wb") as f:
        f.write(
            public_key.public_bytes(
                encoding=Encoding.PEM,
                format=PublicFormat.SubjectPublicKeyInfo,
            )
        )
    return private_key, public_key

DEVICE_PRIVATE_KEY, DEVICE_PUBLIC_KEY = load_or_create_device_keys()


# =========================
# Utility: HKDF (SHA-512)
# =========================

def hkdf_extract(salt: bytes, ikm: bytes) -> bytes:
    return hmac.new(salt, ikm, hashlib.sha512).digest()

def hkdf_expand(prk: bytes, info: bytes, length: int) -> bytes:
    n = (length + 63) // 64
    okm = b""
    t = b""
    for i in range(1, n + 1):
        t = hmac.new(prk, t + info + bytes([i]), hashlib.sha512).digest()
        okm += t
    return okm[:length]

def hkdf(ikm: bytes, salt: bytes, info: bytes, length: int) -> bytes:
    prk = hkdf_extract(salt, ikm)
    return hkdf_expand(prk, info, length)


# =========================
# Ledger
# =========================

class LedgerBlock(BaseModel):
    block_id: int
    timestamp: float
    device_id: str
    health_state: str
    raw_hash_hex: str
    mixed_hash_hex: str
    prev_block_hash_hex: str
    signature_hex: str

def load_last_block() -> LedgerBlock | None:
    if not os.path.exists(LEDGER_PATH):
        return None
    with open(LEDGER_PATH, "rb") as f:
        try:
            f.seek(-4096, os.SEEK_END)
        except OSError:
            f.seek(0)
        lines = f.read().splitlines()
        if not lines:
            return None
        last = json.loads(lines[-1].decode("utf-8"))
        return LedgerBlock(**last)

def append_block(block: LedgerBlock):
    with open(LEDGER_PATH, "ab") as f:
        f.write((block.json() + "\n").encode("utf-8"))


# =========================
# Camera + entropy
# =========================

class ChaosCamera:
    def __init__(self, index: int):
        self.index = index
        self.cap = None
        self.lock = threading.Lock()
        self.running = False
        self.last_frame = None

    def start(self):
        with self.lock:
            if self.running:
                return
            self.cap = cv2.VideoCapture(self.index, cv2.CAP_DSHOW)
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)
            self.cap.set(cv2.CAP_PROP_FPS, FPS)
            if not self.cap.isOpened():
                raise RuntimeError("Failed to open camera")
            self.running = True

    def stop(self):
        with self.lock:
            self.running = False
            if self.cap is not None:
                self.cap.release()
                self.cap = None

    def grab_frame(self):
        with self.lock:
            if not self.running or self.cap is None:
                raise RuntimeError("Camera not running")
            ret, frame = self.cap.read()
            if not ret:
                raise RuntimeError("Failed to read frame")
            self.last_frame = frame
            return frame


camera = ChaosCamera(CAMERA_INDEX)


def frame_to_bits(prev_gray, curr_gray) -> Tuple[List[int], float]:
    diff = cv2.absdiff(prev_gray, curr_gray)
    variance = float(diff.var())
    small = cv2.resize(diff, (80, 60))
    bits = []
    for v in small.flatten():
        bits.append(v & 1)
    return bits, variance


def repetition_count_test(bits: List[int], max_run: int) -> bool:
    if not bits:
        return False
    last = bits[0]
    run = 1
    for b in bits[1:]:
        if b == last:
            run += 1
            if run > max_run:
                return False
        else:
            last = b
            run = 1
    return True


def adaptive_proportion_test(bits: List[int], window: int = 512, low: float = 0.2, high: float = 0.8) -> bool:
    if len(bits) < window:
        return True
    for i in range(0, len(bits) - window + 1, window // 2):
        chunk = bits[i:i+window]
        ones = sum(chunk)
        p = ones / len(chunk)
        if p < low or p > high:
            return False
    return True


def collect_entropy_block() -> Tuple[bytes, str, float]:
    raw_bits: List[int] = []
    variances: List[float] = []

    frame = camera.grab_frame()
    prev_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    while len(raw_bits) < RAW_BITS_PER_BLOCK:
        time.sleep(1.0 / FPS)
        frame = camera.grab_frame()
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        bits, var = frame_to_bits(prev_gray, gray)
        prev_gray = gray
        raw_bits.extend(bits)
        variances.append(var)

    raw_bits = raw_bits[:RAW_BITS_PER_BLOCK]

    avg_var = sum(variances) / len(variances)
    if avg_var < HEALTH_MIN_VARIANCE:
        health = "FAIL"
    elif not repetition_count_test(raw_bits, HEALTH_MAX_RUN):
        health = "FAIL"
    elif not adaptive_proportion_test(raw_bits):
        health = "FAIL"
    else:
        health = "OK"

    raw_bytes = bytearray()
    for i in range(0, len(raw_bits), 8):
        byte = 0
        for j in range(8):
            if i + j < len(raw_bits):
                byte = (byte << 1) | (raw_bits[i + j] & 1)
            else:
                byte <<= 1
        raw_bytes.append(byte)

    return bytes(raw_bytes), health, avg_var


# =========================
# Core entropy + ledger API
# =========================

def generate_block(output_len: int = HKDF_OUTPUT_BYTES, context: str = ""):
    raw_bytes, health, avg_var = collect_entropy_block()

    ts = time.time()
    meta = f"{DEVICE_ID}|{ts}|{health}|{avg_var}".encode("utf-8")
    h_raw = hashlib.sha512(raw_bytes + meta).digest()

    salt = secrets.token_bytes(32)
    info = f"ChaosKey+ v3|{DEVICE_ID}|{context}".encode("utf-8")
    out = hkdf(h_raw, salt, info, output_len)

    h_mixed = hashlib.sha512(out).digest()

    last = load_last_block()
    prev_hash_hex = last.mixed_hash_hex if last else "0" * 128
    block_id = (last.block_id + 1) if last else 0

    msg = f"{block_id}|{ts}|{DEVICE_ID}|{health}|{h_raw.hex()}|{h_mixed.hex()}|{prev_hash_hex}".encode("utf-8")
    signature = DEVICE_PRIVATE_KEY.sign(msg)

    block = LedgerBlock(
        block_id=block_id,
        timestamp=ts,
        device_id=DEVICE_ID,
        health_state=health,
        raw_hash_hex=h_raw.hex(),
        mixed_hash_hex=h_mixed.hex(),
        prev_block_hash_hex=prev_hash_hex,
        signature_hex=signature.hex(),
    )
    append_block(block)

    return out, block


# =========================
# FastAPI interface
# =========================

app = FastAPI()

class RandomRequest(BaseModel):
    length: int = HKDF_OUTPUT_BYTES
    context: str = ""

class RandomResponse(BaseModel):
    random_hex: str
    block_id: int
    health_state: str
    mixed_hash_hex: str
    signature_hex: str

class StatusResponse(BaseModel):
    device_id: str
    last_block_id: int | None
    last_health_state: str | None

class PubKeyResponse(BaseModel):
    device_id: str
    public_key_pem: str

@app.post("/get_random", response_model=RandomResponse)
def api_get_random(req: RandomRequest):
    out, block = generate_block(req.length, req.context)
    return RandomResponse(
        random_hex=out.hex(),
        block_id=block.block_id,
        health_state=block.health_state,
        mixed_hash_hex=block.mixed_hash_hex,
        signature_hex=block.signature_hex,
    )

@app.get("/status", response_model=StatusResponse)
def api_status():
    last = load_last_block()
    if last is None:
        return StatusResponse(
            device_id=DEVICE_ID,
            last_block_id=None,
            last_health_state=None,
        )
    return StatusResponse(
        device_id=DEVICE_ID,
        last_block_id=last.block_id,
        last_health_state=last.health_state,
    )

@app.get("/pubkey", response_model=PubKeyResponse)
def api_pubkey():
    with open(DEVICE_PUB_PATH, "rb") as f:
        pem = f.read().decode("utf-8")
    return PubKeyResponse(
        device_id=DEVICE_ID,
        public_key_pem=pem,
    )


# =========================
# Main
# =========================

if __name__ == "__main__":
    camera.start()
    try:
        uvicorn.run(app, host="127.0.0.1", port=8000)
    finally:
        camera.stop()
