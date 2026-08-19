"""Security-fix iteration tests (SEC-001..SEC-003):
key rotation + perms, frame_diffs_b64 size limits (413), simulate_universe cap,
CORS credentials default, repo hygiene (.gitignore / no tracked .pem).
"""
import os
import stat
import base64
import subprocess
from pathlib import Path

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    env_path = Path("/app/frontend/.env")
    for line in env_path.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
if not BASE_URL:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")

API = f"{BASE_URL}/api"

KEY_DIR = Path("/app/backend/keys")
PRIV = KEY_DIR / "device_ed25519_private.pem"
PUB = KEY_DIR / "device_ed25519_public.pem"

# Public key that was committed to git history (must NOT be the live key anymore)
OLD_COMMITTED_PUB = None


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def small_b64_list(n=5, size=64):
    return [base64.b64encode(os.urandom(size)).decode() for _ in range(n)]


# --- SEC-001: key file permissions / rotation ---
class TestKeyHygiene:
    def test_private_key_mode_0600(self):
        assert PRIV.exists(), "private key missing"
        mode = stat.S_IMODE(PRIV.stat().st_mode)
        assert mode == 0o600, f"private key mode is {oct(mode)}, expected 0o600"

    def test_public_key_readable(self):
        assert PUB.exists()
        mode = stat.S_IMODE(PUB.stat().st_mode)
        assert mode & stat.S_IRUSR, "public key not readable by owner"
        assert PUB.read_text().startswith("-----BEGIN PUBLIC KEY-----")

    def test_pubkey_endpoint_matches_rotated_key_on_disk(self, session):
        r = session.get(f"{API}/pubkey", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["algorithm"] == "Ed25519"
        assert data["public_key_pem"].strip() == PUB.read_text().strip()

    def test_live_pubkey_differs_from_committed_key(self, session):
        old = subprocess.run(
            ["git", "show", "c8445f3:backend/keys/device_ed25519_public.pem"],
            cwd="/app", capture_output=True, text=True,
        )
        if old.returncode != 0:
            pytest.skip("old committed key not found in git history")
        live = session.get(f"{API}/pubkey", timeout=30).json()["public_key_pem"]
        assert live.strip() != old.stdout.strip(), "public key was NOT rotated"

    def test_block_signature_verifies_with_rotated_pubkey(self, session):
        from cryptography.hazmat.primitives.serialization import load_pem_public_key
        from cryptography.exceptions import InvalidSignature

        pub = load_pem_public_key(
            session.get(f"{API}/pubkey", timeout=30).json()["public_key_pem"].encode()
        )
        device_id = session.get(f"{API}/", timeout=30).json()["device_id"]
        r = session.post(f"{API}/get_random", json={"length": 32, "source": "system", "context": "TEST_sig"}, timeout=60)
        assert r.status_code == 200, r.text
        b = r.json()
        msg = (
            f"{b['block_id']}|{b['timestamp']}|{device_id}|{b['health_state']}|"
            f"{b['raw_hash_hex']}|{b['mixed_hash_hex']}|{b['prev_block_hash_hex']}"
        ).encode()
        try:
            pub.verify(bytes.fromhex(b["signature_hex"]), msg)
        except InvalidSignature:
            pytest.fail("block signature did not verify against rotated public key")

    def test_no_pem_tracked_in_git(self):
        out = subprocess.run(["git", "ls-files"], cwd="/app", capture_output=True, text=True)
        assert out.returncode == 0, out.stderr
        pems = [f for f in out.stdout.splitlines() if f.endswith(".pem")]
        assert pems == [], f"pem files still tracked: {pems}"

    def test_keys_dir_gitignored(self):
        gi = Path("/app/.gitignore").read_text()
        assert "backend/keys/" in gi
        chk = subprocess.run(
            ["git", "check-ignore", "-v", "backend/keys/device_ed25519_private.pem"],
            cwd="/app", capture_output=True, text=True,
        )
        assert chk.returncode == 0, f"keys file is NOT ignored: {chk.stdout} {chk.stderr}"


# --- Core endpoints still work with rotated key ---
class TestCoreEndpoints:
    def test_status(self, session):
        r = session.get(f"{API}/status", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["chain_intact"] is True
        assert isinstance(d["total_blocks"], int)

    def test_get_random_system(self, session):
        r = session.post(f"{API}/get_random", json={"length": 32, "source": "system", "context": "TEST_sec"}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d["random_hex"]) == 64
        assert len(d["signature_hex"]) == 128
        assert d["health_state"] in ("OK", "SUSPECT", "FAIL")

    def test_get_random_with_normal_frame_diffs(self, session):
        r = session.post(f"{API}/get_random", json={
            "length": 32, "source": "camera", "context": "TEST_sec_cam",
            "frame_diffs_b64": small_b64_list(5, 128),
        }, timeout=60)
        assert r.status_code == 200, r.text
        assert r.json()["source"] == "camera"

    def test_simulate_universe(self, session):
        r = session.post(f"{API}/simulate_universe", json={"initial_pop": 5, "steps": 30}, timeout=180)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["steps_executed"] >= 1
        assert len(d["trajectory"]) >= 1
        assert len(d["initial_origins"]) == 5
        assert d["final_population"] <= 500


# --- SEC-002: size limits => 413 ---
class TestSizeLimits:
    OVERSIZE_ITEM = base64.b64encode(os.urandom(33 * 1024)).decode()  # > 32KB chars

    @pytest.mark.parametrize("endpoint,payload_extra", [
        ("get_random", {"length": 32}),
        ("simulate_universe", {"initial_pop": 1, "steps": 1}),
        ("generate_token", {"type": "bearer"}),
    ])
    def test_too_many_items_413(self, session, endpoint, payload_extra):
        payload = dict(payload_extra)
        payload["frame_diffs_b64"] = small_b64_list(129, 8)
        r = session.post(f"{API}/{endpoint}", json=payload, timeout=60)
        assert r.status_code == 413, f"{endpoint} -> {r.status_code}: {r.text[:200]}"

    @pytest.mark.parametrize("endpoint,payload_extra", [
        ("get_random", {"length": 32}),
        ("simulate_universe", {"initial_pop": 1, "steps": 1}),
        ("generate_token", {"type": "bearer"}),
    ])
    def test_oversize_item_413(self, session, endpoint, payload_extra):
        payload = dict(payload_extra)
        payload["frame_diffs_b64"] = [self.OVERSIZE_ITEM]
        r = session.post(f"{API}/{endpoint}", json=payload, timeout=60)
        assert r.status_code == 413, f"{endpoint} -> {r.status_code}: {r.text[:200]}"

    def test_boundary_128_items_accepted(self, session):
        r = session.post(f"{API}/get_random", json={
            "length": 32, "source": "camera", "frame_diffs_b64": small_b64_list(128, 8),
        }, timeout=90)
        assert r.status_code == 200, r.text

    def test_context_max_length_rejected(self, session):
        r = session.post(f"{API}/get_random", json={"length": 32, "context": "x" * 513}, timeout=30)
        assert r.status_code == 422, f"expected 422, got {r.status_code}"


# --- Token flows with rotated key ---
class TestTokens:
    TYPES = ["bearer", "password", "uuid", "totp", "otp", "session"]

    @pytest.mark.parametrize("ttype", TYPES)
    def test_generate_each_type(self, session, ttype):
        r = session.post(f"{API}/generate_token", json={"type": ttype, "source": "system"}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["type"] == ttype
        assert d["token"]
        assert len(d["token_signature_hex"]) == 128
        assert len(d["token_hash_hex"]) == 64
        if ttype == "totp":
            assert d["otpauth_uri"] and d["otpauth_uri"].startswith("otpauth://totp/")
        if ttype == "uuid":
            assert len(d["token"]) == 36

    def test_verify_newly_minted_token(self, session):
        g = session.post(f"{API}/generate_token", json={"type": "bearer", "source": "system"}, timeout=60)
        assert g.status_code == 200, g.text
        gd = g.json()
        v = session.post(f"{API}/verify_token", json={"token": gd["token"], "block_id": gd["block_id"]}, timeout=30)
        assert v.status_code == 200, v.text
        vd = v.json()
        assert vd["valid"] is True, vd
        assert vd["expired"] is False
        assert vd["token_type"] == "bearer"

    def test_verify_tampered_token_invalid(self, session):
        g = session.post(f"{API}/generate_token", json={"type": "session", "source": "system"}, timeout=60)
        gd = g.json()
        v = session.post(f"{API}/verify_token", json={"token": gd["token"] + "x", "block_id": gd["block_id"]}, timeout=30)
        assert v.status_code == 200, v.text
        assert v.json()["valid"] is False


# --- SEC-003: CORS ---
class TestCORS:
    def test_wildcard_origin_no_credentials(self, session):
        r = session.options(f"{API}/status", headers={
            "Origin": "https://evil.example.com",
            "Access-Control-Request-Method": "GET",
        }, timeout=30)
        assert r.status_code in (200, 204), r.status_code
        acao = r.headers.get("access-control-allow-origin")
        acac = r.headers.get("access-control-allow-credentials")
        if acao == "*":
            assert acac is None or acac.lower() == "false", f"credentials allowed with wildcard: {acac}"
