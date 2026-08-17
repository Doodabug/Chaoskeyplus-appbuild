"""Iteration 4: Tests for /api/generate_tokens_bulk, /api/verify_token, and token binding on /api/generate_token."""
import os
import hashlib
import pytest
import requests
from pathlib import Path

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    env_path = Path("/app/frontend/.env")
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    ses = requests.Session()
    ses.headers.update({"Content-Type": "application/json"})
    return ses


# -------- generate_token binding --------
class TestTokenBinding:
    def test_bearer_has_hash_and_signature(self, s):
        r = s.post(f"{API}/generate_token", json={"type": "bearer"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "token_hash_hex" in d and "token_signature_hex" in d
        assert len(d["token_hash_hex"]) == 64
        assert d["token_hash_hex"] == hashlib.sha256(d["token"].encode()).hexdigest()
        assert len(d["token_signature_hex"]) == 128  # Ed25519 hex


# -------- Bulk --------
class TestBulk:
    def test_bulk_happy(self, s):
        r = s.post(f"{API}/generate_tokens_bulk",
                   json={"count": 3, "template": {"type": "bearer", "source": "system"}})
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d["tokens"]) == 3
        ids = [t["block_id"] for t in d["tokens"]]
        assert ids == sorted(ids) and len(set(ids)) == 3
        assert len({t["token"] for t in d["tokens"]}) == 3

    def test_bulk_count_zero_422(self, s):
        r = s.post(f"{API}/generate_tokens_bulk",
                   json={"count": 0, "template": {"type": "bearer"}})
        assert r.status_code == 422

    def test_bulk_count_21_422(self, s):
        r = s.post(f"{API}/generate_tokens_bulk",
                   json={"count": 21, "template": {"type": "bearer"}})
        assert r.status_code == 422

    def test_bulk_missing_template_422(self, s):
        r = s.post(f"{API}/generate_tokens_bulk", json={"count": 3})
        assert r.status_code == 422


# -------- Verify --------
class TestVerify:
    def test_verify_ok(self, s):
        r = s.post(f"{API}/generate_token", json={"type": "bearer"})
        assert r.status_code == 200
        d = r.json()
        v = s.post(f"{API}/verify_token", json={"token": d["token"], "block_id": d["block_id"]})
        assert v.status_code == 200, v.text
        vd = v.json()
        assert vd["valid"] is True
        assert vd["reason"] == "ok"
        assert vd["token_type"] == "bearer"
        assert vd["mixed_hash_hex"] == d["mixed_hash_hex"]
        assert vd["signature_hex"] == d["signature_hex"]
        assert "timestamp" in vd and vd["timestamp"]

    def test_verify_tampered_token(self, s):
        r = s.post(f"{API}/generate_token", json={"type": "bearer"}).json()
        v = s.post(f"{API}/verify_token", json={"token": r["token"] + "X", "block_id": r["block_id"]}).json()
        assert v["valid"] is False
        assert v["reason"] == "token_hash_mismatch"

    def test_verify_non_token_block(self, s):
        # block_id=0 was created by iteration 1 as system entropy (no token)
        v = s.post(f"{API}/verify_token", json={"token": "anything", "block_id": 0}).json()
        assert v["valid"] is False
        assert v["reason"] == "block_is_not_a_token_block"

    def test_verify_get_random_block(self, s):
        gr = s.post(f"{API}/get_random", json={"source": "system", "length": 32}).json()
        v = s.post(f"{API}/verify_token", json={"token": "any", "block_id": gr["block_id"]}).json()
        assert v["valid"] is False
        assert v["reason"] == "block_is_not_a_token_block"

    def test_verify_missing_block(self, s):
        v = s.post(f"{API}/verify_token", json={"token": "any", "block_id": 999999}).json()
        assert v["valid"] is False
        assert v["reason"] == "block_not_found"

    def test_verify_missing_token_422(self, s):
        r = s.post(f"{API}/verify_token", json={"block_id": 1})
        assert r.status_code == 422

    def test_verify_negative_block_id(self, s):
        r = s.post(f"{API}/verify_token", json={"token": "x", "block_id": -1})
        # should be graceful — either 422 or block_not_found style false
        assert r.status_code in (200, 400, 422)
        if r.status_code == 200:
            assert r.json()["valid"] is False


# -------- Regression --------
class TestRegression:
    def test_status(self, s):
        assert s.get(f"{API}/status").status_code == 200

    def test_pubkey(self, s):
        assert s.get(f"{API}/pubkey").status_code == 200

    def test_ledger(self, s):
        assert s.get(f"{API}/ledger").status_code == 200

    def test_get_random(self, s):
        assert s.post(f"{API}/get_random", json={"source": "system", "length": 32}).status_code == 200

    def test_simulate_universe(self, s):
        r = s.post(f"{API}/simulate_universe", json={"steps": 3, "initial_pop": 2, "source": "system"})
        assert r.status_code == 200

    @pytest.mark.parametrize("t", ["bearer", "password", "uuid", "totp", "otp", "session"])
    def test_all_token_types(self, s, t):
        r = s.post(f"{API}/generate_token", json={"type": t})
        assert r.status_code == 200, r.text
        assert "token_hash_hex" in r.json()
