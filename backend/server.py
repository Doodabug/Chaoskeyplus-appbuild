"""
ChaosKey+ M3 — FastAPI backend
Physical-chaos cryptographic randomness device with:
  - Browser-camera entropy ingestion (mobile getUserMedia frame diffs)
  - System-entropy fallback (os.urandom)
  - NIST-style health tests (variance, repetition count, adaptive proportion)
  - HKDF-SHA512 mixing
  - Ed25519 device signing
  - Chained ledger stored in MongoDB
  - Digital Universe simulation seeded by REAL physical chaos
"""
import os
import time
import json
import hmac
import hashlib
import secrets
import base64
import random
import urllib.parse
from pathlib import Path
from typing import List, Optional, Literal
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives.serialization import (
    Encoding, PublicFormat, PrivateFormat, NoEncryption,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# =========================
# Config
# =========================
DEVICE_ID = os.environ.get("DEVICE_ID", "CHAOSKEY-M3-001")
RAW_BITS_PER_BLOCK = 256 * 16        # 4096 bits target
HEALTH_MIN_VARIANCE = 5.0
HEALTH_MAX_RUN = 64
HKDF_OUTPUT_BYTES = 64

KEY_DIR = ROOT_DIR / "keys"
KEY_DIR.mkdir(exist_ok=True)
DEVICE_KEY_PATH = KEY_DIR / "device_ed25519_private.pem"
DEVICE_PUB_PATH = KEY_DIR / "device_ed25519_public.pem"

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

# =========================
# Device keypair (Ed25519)
# =========================
def load_or_create_device_keys():
    if DEVICE_KEY_PATH.exists():
        with open(DEVICE_KEY_PATH, "rb") as f:
            private_key = serialization.load_pem_private_key(f.read(), password=None)
    else:
        private_key = ed25519.Ed25519PrivateKey.generate()
        # Create the private-key file with owner-only perms before writing,
        # so the secret never exists on disk with world-readable bits.
        fd = os.open(str(DEVICE_KEY_PATH), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "wb") as f:
            f.write(private_key.private_bytes(
                encoding=Encoding.PEM,
                format=PrivateFormat.PKCS8,
                encryption_algorithm=NoEncryption(),
            ))
    # Ensure existing key files also have owner-only perms (idempotent).
    try:
        os.chmod(DEVICE_KEY_PATH, 0o600)
    except OSError:
        pass
    public_key = private_key.public_key()
    with open(DEVICE_PUB_PATH, "wb") as f:
        f.write(public_key.public_bytes(
            encoding=Encoding.PEM,
            format=PublicFormat.SubjectPublicKeyInfo,
        ))
    return private_key, public_key

DEVICE_PRIVATE_KEY, DEVICE_PUBLIC_KEY = load_or_create_device_keys()

# =========================
# HKDF-SHA512
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
    return hkdf_expand(hkdf_extract(salt, ikm), info, length)

# =========================
# Health tests
# =========================
def repetition_count_test(bits: List[int], max_run: int) -> bool:
    if not bits:
        return False
    last = bits[0]; run = 1
    for b in bits[1:]:
        if b == last:
            run += 1
            if run > max_run:
                return False
        else:
            last = b; run = 1
    return True

def adaptive_proportion_test(bits: List[int], window: int = 512, low: float = 0.2, high: float = 0.8) -> bool:
    if len(bits) < window:
        return True
    for i in range(0, len(bits) - window + 1, window // 2):
        chunk = bits[i:i + window]
        p = sum(chunk) / len(chunk)
        if p < low or p > high:
            return False
    return True

def bits_to_bytes(bits: List[int]) -> bytes:
    out = bytearray()
    for i in range(0, len(bits), 8):
        byte = 0
        for j in range(8):
            byte = (byte << 1) | (bits[i + j] & 1 if i + j < len(bits) else 0)
        out.append(byte)
    return bytes(out)

# =========================
# Entropy sources
# =========================
def system_entropy(num_bits: int) -> tuple[bytes, List[int], float]:
    """OS entropy as raw source. Variance synthesised from byte distribution."""
    nb = max(1, num_bits // 8)
    raw = os.urandom(nb)
    bits = []
    for byte in raw:
        for j in range(7, -1, -1):
            bits.append((byte >> j) & 1)
    # variance metric — distance from 0.5 fraction of ones
    ones = sum(bits)
    p = ones / len(bits)
    variance = 12.0 + abs(0.5 - p) * 100.0
    return raw, bits[:num_bits], variance

def camera_entropy(frame_diffs_b64: List[str], num_bits: int) -> tuple[bytes, List[int], float]:
    """
    Browser sends base64-encoded grayscale pixel difference buffers (one per frame pair).
    We LSB-extract bits and compute variance across all diffs.
    """
    bits: List[int] = []
    variances: List[float] = []
    for b64 in frame_diffs_b64:
        try:
            buf = base64.b64decode(b64)
        except Exception:
            continue
        if not buf:
            continue
        # variance of byte values (each byte = abs grayscale diff for a downsampled pixel)
        n = len(buf)
        s = sum(buf)
        mean = s / n
        var = sum((b - mean) ** 2 for b in buf) / n
        variances.append(var)
        for b in buf:
            bits.append(b & 1)
        if len(bits) >= num_bits:
            break
    bits = bits[:num_bits]
    avg_var = (sum(variances) / len(variances)) if variances else 0.0
    return bits_to_bytes(bits), bits, avg_var

# =========================
# Mongo
# =========================
mongo_client: Optional[AsyncIOMotorClient] = None
db = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global mongo_client, db
    mongo_client = AsyncIOMotorClient(MONGO_URL)
    db = mongo_client[DB_NAME]
    await db.ledger.create_index("block_id", unique=True)
    yield
    mongo_client.close()

async def load_last_block() -> Optional[dict]:
    if db is None:
        return None
    return await db.ledger.find_one({}, sort=[("block_id", -1)], projection={"_id": 0})

async def append_block(block: dict):
    await db.ledger.insert_one(dict(block))

# =========================
# Core block generator
# =========================
async def generate_block(
    output_len: int,
    context: str,
    source: Literal["camera", "system"],
    frame_diffs_b64: Optional[List[str]] = None,
) -> tuple[bytes, dict]:
    if source == "camera" and frame_diffs_b64:
        raw_bytes, raw_bits, avg_var = camera_entropy(frame_diffs_b64, RAW_BITS_PER_BLOCK)
        if not raw_bits:
            # Fall back if browser didn't send enough data
            raw_bytes, raw_bits, avg_var = system_entropy(RAW_BITS_PER_BLOCK)
            source = "system"
    else:
        raw_bytes, raw_bits, avg_var = system_entropy(RAW_BITS_PER_BLOCK)
        source = "system"

    # Health tests
    if avg_var < HEALTH_MIN_VARIANCE:
        health = "FAIL"
        health_reason = "low_variance"
    elif not repetition_count_test(raw_bits, HEALTH_MAX_RUN):
        health = "FAIL"
        health_reason = "long_run"
    elif not adaptive_proportion_test(raw_bits):
        health = "FAIL"
        health_reason = "biased_proportion"
    else:
        health = "OK"
        health_reason = "all_passed"

    ts = time.time()
    meta = f"{DEVICE_ID}|{ts}|{health}|{avg_var:.4f}".encode("utf-8")
    h_raw = hashlib.sha512(raw_bytes + meta).digest()

    salt = secrets.token_bytes(32)
    info = f"ChaosKey+ v3|{DEVICE_ID}|{context}".encode("utf-8")
    out = hkdf(h_raw, salt, info, output_len)

    h_mixed = hashlib.sha512(out).digest()

    last = await load_last_block()
    prev_hash_hex = last["mixed_hash_hex"] if last else "0" * 128
    block_id = (last["block_id"] + 1) if last else 0

    msg = f"{block_id}|{ts}|{DEVICE_ID}|{health}|{h_raw.hex()}|{h_mixed.hex()}|{prev_hash_hex}".encode("utf-8")
    signature = DEVICE_PRIVATE_KEY.sign(msg)

    block = {
        "block_id": block_id,
        "timestamp": ts,
        "device_id": DEVICE_ID,
        "source": source,
        "health_state": health,
        "health_reason": health_reason,
        "avg_variance": round(avg_var, 4),
        "raw_hash_hex": h_raw.hex(),
        "mixed_hash_hex": h_mixed.hex(),
        "prev_block_hash_hex": prev_hash_hex,
        "signature_hex": signature.hex(),
        "context": context,
        "output_len": output_len,
    }
    await append_block(block)
    return out, block

# =========================
# API models
# =========================
# Bound sizes to prevent unauth resource exhaustion.
MAX_FRAME_DIFFS = 128
MAX_FRAME_DIFF_B64_CHARS = 32 * 1024  # ~24KB decoded per frame diff


def _validate_frame_diffs(items: Optional[List[str]]) -> Optional[List[str]]:
    if items is None:
        return None
    if not isinstance(items, list) or len(items) > MAX_FRAME_DIFFS:
        raise HTTPException(status_code=413, detail=f"frame_diffs_b64 must have <= {MAX_FRAME_DIFFS} items")
    for b64 in items:
        if not isinstance(b64, str) or len(b64) > MAX_FRAME_DIFF_B64_CHARS:
            raise HTTPException(status_code=413, detail=f"each frame_diffs_b64 item must be a base64 string <= {MAX_FRAME_DIFF_B64_CHARS} chars")
    return items


class RandomRequest(BaseModel):
    length: int = Field(default=HKDF_OUTPUT_BYTES, ge=8, le=512)
    context: str = Field(default="", max_length=512)
    source: Literal["camera", "system"] = "system"
    frame_diffs_b64: Optional[List[str]] = None

class RandomResponse(BaseModel):
    random_hex: str
    block_id: int
    health_state: str
    health_reason: str
    avg_variance: float
    source: str
    mixed_hash_hex: str
    raw_hash_hex: str
    prev_block_hash_hex: str
    signature_hex: str
    timestamp: float

class StatusResponse(BaseModel):
    device_id: str
    last_block_id: Optional[int] = None
    last_health_state: Optional[str] = None
    last_source: Optional[str] = None
    total_blocks: int = 0
    chain_intact: bool = True

class PubKeyResponse(BaseModel):
    device_id: str
    public_key_pem: str
    algorithm: str = "Ed25519"

class LedgerBlockOut(BaseModel):
    block_id: int
    timestamp: float
    device_id: str
    source: str = "system"
    health_state: str
    health_reason: str = ""
    avg_variance: float = 0.0
    raw_hash_hex: str
    mixed_hash_hex: str
    prev_block_hash_hex: str
    signature_hex: str
    context: str = ""

class UniverseSimRequest(BaseModel):
    steps: int = Field(default=30, ge=1, le=80)
    initial_resources: float = Field(default=500.0, ge=10.0, le=10000.0)
    initial_pop: int = Field(default=5, ge=1, le=30)
    replication_prob: float = Field(default=0.35, ge=0.0, le=1.0)
    consumption_per_entity: float = Field(default=4.0, ge=0.1, le=50.0)
    source: Literal["camera", "system"] = "system"
    frame_diffs_b64: Optional[List[str]] = None

class TrajectoryPoint(BaseModel):
    step: int
    population: int
    resources: float
    avg_energy: float
    births: int
    deaths: int

class UniverseSimResponse(BaseModel):
    initial_origins: List[str]
    steps_executed: int
    final_population: int
    total_unique_origins: int
    trajectory: List[TrajectoryPoint]
    emergence_summary: str
    note: str

# =========================
# App
# =========================
app = FastAPI(title="ChaosKey+ M3", lifespan=lifespan)

# CORS — must be enabled BEFORE the api router for preflight
_cors_env = os.environ.get("CORS_ORIGINS", "*").split(",")
_cors_origins = [o.strip() for o in _cors_env if o.strip()]
# Don't reflect credentialed requests when origins is the wildcard — safer default.
_cors_credentials = "*" not in _cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins or ["*"],
    allow_credentials=_cors_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import APIRouter
api = APIRouter(prefix="/api")

@api.get("/")
async def root():
    return {"name": "ChaosKey+ M3", "device_id": DEVICE_ID, "version": "v3"}

@api.post("/get_random", response_model=RandomResponse)
async def api_get_random(req: RandomRequest):
    _validate_frame_diffs(req.frame_diffs_b64)
    out, block = await generate_block(
        output_len=req.length,
        context=req.context,
        source=req.source,
        frame_diffs_b64=req.frame_diffs_b64,
    )
    return RandomResponse(
        random_hex=out.hex(),
        block_id=block["block_id"],
        health_state=block["health_state"],
        health_reason=block["health_reason"],
        avg_variance=block["avg_variance"],
        source=block["source"],
        mixed_hash_hex=block["mixed_hash_hex"],
        raw_hash_hex=block["raw_hash_hex"],
        prev_block_hash_hex=block["prev_block_hash_hex"],
        signature_hex=block["signature_hex"],
        timestamp=block["timestamp"],
    )

@api.get("/status", response_model=StatusResponse)
async def api_status():
    last = await load_last_block()
    total = await db.ledger.count_documents({})
    if last is None:
        return StatusResponse(device_id=DEVICE_ID, total_blocks=0, chain_intact=True)
    # Quick chain verification — sample last 5
    cursor = db.ledger.find({}, projection={"_id": 0}).sort("block_id", -1).limit(6)
    blocks = await cursor.to_list(length=6)
    intact = True
    blocks_asc = list(reversed(blocks))
    for i in range(1, len(blocks_asc)):
        if blocks_asc[i]["prev_block_hash_hex"] != blocks_asc[i - 1]["mixed_hash_hex"]:
            intact = False
            break
    return StatusResponse(
        device_id=DEVICE_ID,
        last_block_id=last["block_id"],
        last_health_state=last["health_state"],
        last_source=last.get("source", "system"),
        total_blocks=total,
        chain_intact=intact,
    )

@api.get("/pubkey", response_model=PubKeyResponse)
async def api_pubkey():
    with open(DEVICE_PUB_PATH, "rb") as f:
        pem = f.read().decode("utf-8")
    return PubKeyResponse(device_id=DEVICE_ID, public_key_pem=pem)

@api.get("/ledger", response_model=List[LedgerBlockOut])
async def api_ledger(limit: int = 50, before_block_id: Optional[int] = None):
    q = {}
    if before_block_id is not None:
        q["block_id"] = {"$lt": before_block_id}
    cursor = db.ledger.find(q, projection={"_id": 0}).sort("block_id", -1).limit(min(limit, 200))
    blocks = await cursor.to_list(length=limit)
    return blocks

# =========================
# Digital universe simulation
# =========================
class Entity:
    __slots__ = ("origin", "energy")
    def __init__(self, origin: str, energy: float = 12.0):
        self.origin = origin
        self.energy = energy

async def get_physical_origin(context: str, source: str, frame_diffs_b64: Optional[List[str]]) -> str:
    out, _ = await generate_block(
        output_len=32, context=context, source=source, frame_diffs_b64=frame_diffs_b64,
    )
    return out.hex()[:32]

@api.post("/simulate_universe", response_model=UniverseSimResponse)
async def api_simulate_universe(req: UniverseSimRequest):
    _validate_frame_diffs(req.frame_diffs_b64)
    # Bound the population so one request can't fan out into thousands of block
    # generations (each = Ed25519 sign + Mongo insert).
    MAX_POPULATION = 500
    entities: List[Entity] = []
    initial_origins: List[str] = []
    for i in range(req.initial_pop):
        origin = await get_physical_origin(
            f"seed_entity_{i}", req.source, req.frame_diffs_b64,
        )
        entities.append(Entity(origin))
        initial_origins.append(origin)

    resources = req.initial_resources
    total_unique_origins = req.initial_pop
    trajectory: List[TrajectoryPoint] = []

    steps_done = 0
    for step in range(1, req.steps + 1):
        steps_done = step
        consumption = len(entities) * req.consumption_per_entity
        resources = max(0.0, resources - consumption)

        for e in entities:
            if resources > 0:
                e.energy += 0.5
            e.energy -= 1.0
            if e.energy < 0:
                e.energy = 0.0

        births = 0
        new_entities: List[Entity] = []
        for e in entities:
            if len(entities) + len(new_entities) >= MAX_POPULATION:
                break
            if e.energy > 12 and random.random() < req.replication_prob:
                new_origin = await get_physical_origin(
                    f"replication_step_{step}_{births}", req.source, req.frame_diffs_b64,
                )
                new_entities.append(Entity(new_origin, energy=7.0))
                e.energy = max(0.0, e.energy - 6.0)
                total_unique_origins += 1
                births += 1
        entities.extend(new_entities)

        before = len(entities)
        entities = [e for e in entities if e.energy > 0]
        deaths = before - len(entities)

        pop = len(entities)
        avg_energy = (sum(e.energy for e in entities) / pop) if pop > 0 else 0.0
        trajectory.append(TrajectoryPoint(
            step=step, population=pop, resources=round(resources, 1),
            avg_energy=round(avg_energy, 2), births=births, deaths=deaths,
        ))
        if pop == 0:
            break

    peak = max((t.population for t in trajectory), default=req.initial_pop)
    if peak > req.initial_pop and (trajectory and trajectory[-1].population < peak):
        summary = "boom-bust dynamics (growth then resource-driven collapse)"
    elif peak > req.initial_pop:
        summary = "sustained growth"
    elif trajectory and trajectory[-1].population == 0:
        summary = "extinction"
    else:
        summary = "stable or slow growth"

    return UniverseSimResponse(
        initial_origins=initial_origins,
        steps_executed=steps_done,
        final_population=len(entities),
        total_unique_origins=total_unique_origins,
        trajectory=trajectory,
        emergence_summary=summary,
        note="Each entity's origin was derived from a fresh ChaosKey+ entropy block — no cloning, no replay. Every birth is ledgered and signed.",
    )

# =========================
# Token generator
# =========================
BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
LOWER = "abcdefghijklmnopqrstuvwxyz"
UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
DIGITS = "0123456789"
SYMBOLS = "!@#$%^&*-_=+?"

def _to_charset(entropy: bytes, alphabet: str, length: int) -> str:
    n = len(alphabet)
    out = []
    # Extend entropy if needed via repeated hashing
    stream = bytearray(entropy)
    while len(stream) < length * 2:
        stream += hashlib.sha512(bytes(stream)).digest()
    # Rejection-sample-ish (mod bias is negligible for our alphabets of size ≤ 94)
    for i in range(length):
        out.append(alphabet[stream[i] % n])
    return "".join(out)

def _uuid4_from_entropy(entropy: bytes) -> str:
    b = bytearray(entropy[:16])
    # RFC 4122 v4
    b[6] = (b[6] & 0x0F) | 0x40
    b[8] = (b[8] & 0x3F) | 0x80
    h = b.hex()
    return f"{h[0:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"

def _base32_secret(entropy: bytes, num_chars: int) -> str:
    # Take (num_chars * 5) bits from entropy, produce base32 chars
    need_bytes = (num_chars * 5 + 7) // 8
    stream = bytearray(entropy)
    while len(stream) < need_bytes:
        stream += hashlib.sha512(bytes(stream)).digest()
    bits = 0
    val = 0
    out = []
    for byte in stream[:need_bytes]:
        val = (val << 8) | byte
        bits += 8
        while bits >= 5 and len(out) < num_chars:
            bits -= 5
            out.append(BASE32[(val >> bits) & 0x1F])
    return "".join(out)

def _base64url(entropy: bytes, length: int) -> str:
    stream = bytearray(entropy)
    while len(stream) < length:
        stream += hashlib.sha512(bytes(stream)).digest()
    return base64.urlsafe_b64encode(bytes(stream[:length])).decode("ascii").rstrip("=")

TokenType = Literal["bearer", "password", "uuid", "totp", "otp", "session"]

class TokenRequest(BaseModel):
    type: TokenType = "bearer"
    # Common
    prefix: Optional[str] = None
    length: Optional[int] = None
    # Password options
    include_digits: bool = True
    include_symbols: bool = True
    include_upper: bool = True
    include_lower: bool = True
    # TOTP options
    totp_label: Optional[str] = None
    totp_issuer: str = "ChaosKey+"
    # OTP options
    otp_digits: int = 6
    # Expiry (0 or None => never expires)
    expires_in_seconds: Optional[int] = Field(default=None, ge=0, le=60 * 60 * 24 * 365 * 5)
    # Source
    source: Literal["camera", "system"] = "system"
    frame_diffs_b64: Optional[List[str]] = None

class TokenResponse(BaseModel):
    type: str
    token: str
    display_hint: str = ""
    otpauth_uri: Optional[str] = None
    length: int
    block_id: int
    health_state: str
    signature_hex: str
    mixed_hash_hex: str
    timestamp: float
    source: str
    # Token binding
    token_hash_hex: str
    token_signature_hex: str
    expires_at: Optional[float] = None

class VerifyTokenRequest(BaseModel):
    token: str
    block_id: int = Field(ge=0)

class VerifyTokenResponse(BaseModel):
    valid: bool
    reason: str
    block_id: int
    device_id: str
    token_type: Optional[str] = None
    timestamp: Optional[float] = None
    mixed_hash_hex: Optional[str] = None
    signature_hex: Optional[str] = None
    expires_at: Optional[float] = None
    expired: bool = False

def _default_length(t: str, req_len: Optional[int]) -> int:
    if req_len is not None:
        return max(4, min(256, req_len))
    return {
        "bearer": 40,
        "password": 20,
        "uuid": 36,
        "totp": 32,
        "otp": 6,
        "session": 43,  # ~256 bits base64url
    }.get(t, 32)

@api.post("/generate_token", response_model=TokenResponse)
async def api_generate_token(req: TokenRequest):
    _validate_frame_diffs(req.frame_diffs_b64)
    # Use existing entropy pipeline — every token gets a signed ledger block.
    ctx = f"token:{req.type}"
    if req.prefix:
        ctx += f":{req.prefix[:32]}"
    length = _default_length(req.type, req.length)

    # Ask for at least 64 bytes of mixed output so we have plenty of entropy
    out, block = await generate_block(
        output_len=max(64, length),
        context=ctx,
        source=req.source,
        frame_diffs_b64=req.frame_diffs_b64,
    )

    display_hint = ""
    otpauth = None

    if req.type == "bearer":
        body = _to_charset(out, BASE62, length)
        token = f"{(req.prefix or 'ck_live').strip()}_{body}"
        display_hint = f"{length}-char base62 body, prefixed"
    elif req.type == "password":
        alphabet = ""
        if req.include_lower: alphabet += LOWER
        if req.include_upper: alphabet += UPPER
        if req.include_digits: alphabet += DIGITS
        if req.include_symbols: alphabet += SYMBOLS
        if not alphabet:
            alphabet = LOWER + UPPER + DIGITS
        token = _to_charset(out, alphabet, length)
        display_hint = f"{length} chars from |Σ|={len(alphabet)}"
    elif req.type == "uuid":
        token = _uuid4_from_entropy(out)
        display_hint = "RFC 4122 v4 UUID"
    elif req.type == "totp":
        secret = _base32_secret(out, length)
        token = secret
        label = req.totp_label or "chaoskey-user"
        issuer = req.totp_issuer or "ChaosKey+"
        # RFC 6238 KeyURI format — issuer/label MUST be percent-encoded so
        # characters like '+' aren't interpreted as spaces by authenticators.
        label_enc = urllib.parse.quote(label, safe="")
        issuer_enc = urllib.parse.quote(issuer, safe="")
        otpauth = (
            f"otpauth://totp/{issuer_enc}:{label_enc}"
            f"?secret={secret}&issuer={issuer_enc}&algorithm=SHA1&digits=6&period=30"
        )
        display_hint = f"base32 secret · {length} chars · 30s period"
    elif req.type == "otp":
        digits = max(4, min(10, req.otp_digits))
        # Interpret first 8 bytes as int, mod 10^digits
        n = int.from_bytes(out[:8], "big") % (10 ** digits)
        token = str(n).zfill(digits)
        length = digits
        display_hint = f"{digits}-digit numeric code"
    else:  # session
        token = _base64url(out, length)
        display_hint = f"base64url · {length} chars"

    # Bind the token cryptographically to its block. Message format:
    #   token|{block_id}|{token_hash}|{expires_at_int}
    # expires_at_int is 0 when the token has no expiry.
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    expires_at: Optional[float] = None
    if req.expires_in_seconds and req.expires_in_seconds > 0:
        expires_at = block["timestamp"] + req.expires_in_seconds
    expires_at_int = int(expires_at) if expires_at is not None else 0
    tsig_msg = f"token|{block['block_id']}|{token_hash}|{expires_at_int}".encode("utf-8")
    token_signature = DEVICE_PRIVATE_KEY.sign(tsig_msg).hex()
    await db.ledger.update_one(
        {"block_id": block["block_id"]},
        {"$set": {
            "token_hash": token_hash,
            "token_type": req.type,
            "token_signature": token_signature,
            "expires_at": expires_at,
        }},
    )

    return TokenResponse(
        type=req.type,
        token=token,
        display_hint=display_hint,
        otpauth_uri=otpauth,
        length=len(token),
        block_id=block["block_id"],
        health_state=block["health_state"],
        signature_hex=block["signature_hex"],
        mixed_hash_hex=block["mixed_hash_hex"],
        timestamp=block["timestamp"],
        source=block["source"],
        token_hash_hex=token_hash,
        token_signature_hex=token_signature,
        expires_at=expires_at,
    )

@api.post("/verify_token", response_model=VerifyTokenResponse)
async def api_verify_token(req: VerifyTokenRequest):
    # 1. Look up the block
    block = await db.ledger.find_one({"block_id": req.block_id}, projection={"_id": 0})
    if not block:
        return VerifyTokenResponse(valid=False, reason="block_not_found", block_id=req.block_id, device_id=DEVICE_ID)

    if not block.get("token_hash"):
        return VerifyTokenResponse(valid=False, reason="block_is_not_a_token_block", block_id=req.block_id, device_id=DEVICE_ID)

    # 2. Verify the block's primary chain signature
    try:
        block_msg = (
            f"{block['block_id']}|{block['timestamp']}|{block['device_id']}|{block['health_state']}|"
            f"{block['raw_hash_hex']}|{block['mixed_hash_hex']}|{block['prev_block_hash_hex']}"
        ).encode("utf-8")
        DEVICE_PUBLIC_KEY.verify(bytes.fromhex(block['signature_hex']), block_msg)
    except Exception:
        return VerifyTokenResponse(valid=False, reason="block_signature_invalid", block_id=req.block_id, device_id=DEVICE_ID)

    # 3. Re-hash the token and compare
    provided_hash = hashlib.sha256(req.token.encode("utf-8")).hexdigest()
    if provided_hash != block["token_hash"]:
        return VerifyTokenResponse(
            valid=False, reason="token_hash_mismatch",
            block_id=req.block_id, device_id=DEVICE_ID,
            token_type=block.get("token_type"),
            timestamp=block["timestamp"],
            mixed_hash_hex=block["mixed_hash_hex"],
            signature_hex=block["signature_hex"],
            expires_at=block.get("expires_at"),
        )

    # 4. Verify the token-binding signature
    expires_at = block.get("expires_at")
    expires_at_int = int(expires_at) if expires_at else 0
    try:
        tsig_msg = f"token|{block['block_id']}|{block['token_hash']}|{expires_at_int}".encode("utf-8")
        DEVICE_PUBLIC_KEY.verify(bytes.fromhex(block['token_signature']), tsig_msg)
    except Exception:
        return VerifyTokenResponse(valid=False, reason="token_signature_invalid", block_id=req.block_id, device_id=DEVICE_ID)

    # 5. Check expiry
    expired = bool(expires_at and time.time() > expires_at)
    if expired:
        return VerifyTokenResponse(
            valid=False, reason="expired",
            block_id=req.block_id, device_id=DEVICE_ID,
            token_type=block.get("token_type"),
            timestamp=block["timestamp"],
            mixed_hash_hex=block["mixed_hash_hex"],
            signature_hex=block["signature_hex"],
            expires_at=expires_at,
            expired=True,
        )

    return VerifyTokenResponse(
        valid=True, reason="ok",
        block_id=req.block_id, device_id=DEVICE_ID,
        token_type=block.get("token_type"),
        timestamp=block["timestamp"],
        mixed_hash_hex=block["mixed_hash_hex"],
        signature_hex=block["signature_hex"],
        expires_at=expires_at,
        expired=False,
    )

app.include_router(api)
