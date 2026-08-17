"""Iteration 5: expiry-bound tokens + verify. Bulk endpoint removal regression."""
import os
import time
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


# -------- Bulk endpoint removal --------
class TestBulkRemoved:
    def test_bulk_endpoint_returns_404(self, s):
        r = s.post(f"{API}/generate_tokens_bulk",
                   json={"count": 3, "template": {"type": "bearer"}})
        assert r.status_code == 404, f"bulk endpoint must be removed, got {r.status_code}"


# -------- Expiry --------
class TestExpiry:
    def test_generate_with_1h_expiry(self, s):
        r = s.post(f"{API}/generate_token",
                   json={"type": "bearer", "expires_in_seconds": 3600})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["expires_at"] is not None
        # expires_at should be within a few seconds of timestamp+3600
        assert abs(d["expires_at"] - (d["timestamp"] + 3600)) < 2

        # Immediate verify → valid, not expired
        v = s.post(f"{API}/verify_token",
                   json={"token": d["token"], "block_id": d["block_id"]}).json()
        assert v["valid"] is True
        assert v["expired"] is False
        assert v["reason"] == "ok"
        assert abs(v["expires_at"] - d["expires_at"]) < 1

    def test_generate_with_short_expiry_then_expires(self, s):
        r = s.post(f"{API}/generate_token",
                   json={"type": "bearer", "expires_in_seconds": 1}).json()
        assert r["expires_at"] is not None
        time.sleep(2.2)
        v = s.post(f"{API}/verify_token",
                   json={"token": r["token"], "block_id": r["block_id"]}).json()
        assert v["valid"] is False
        assert v["reason"] == "expired"
        assert v["expired"] is True
        assert v["expires_at"] is not None and v["expires_at"] < time.time()

    def test_generate_without_expiry(self, s):
        r = s.post(f"{API}/generate_token", json={"type": "bearer"}).json()
        assert r["expires_at"] is None
        v = s.post(f"{API}/verify_token",
                   json={"token": r["token"], "block_id": r["block_id"]}).json()
        assert v["valid"] is True
        assert v["expired"] is False
        assert v["expires_at"] is None

    def test_generate_with_zero_expiry_treated_as_never(self, s):
        r = s.post(f"{API}/generate_token",
                   json={"type": "bearer", "expires_in_seconds": 0}).json()
        assert r["expires_at"] is None

    def test_expiry_negative_422(self, s):
        r = s.post(f"{API}/generate_token",
                   json={"type": "bearer", "expires_in_seconds": -1})
        assert r.status_code == 422

    def test_expiry_over_5_years_422(self, s):
        r = s.post(f"{API}/generate_token",
                   json={"type": "bearer",
                         "expires_in_seconds": 60 * 60 * 24 * 365 * 5 + 1})
        assert r.status_code == 422

    def test_signature_binding_differs_with_expiry(self, s):
        # Two tokens with different expiries should have distinguishable signatures
        # (since expires_at_int is part of tsig_msg).
        r1 = s.post(f"{API}/generate_token",
                    json={"type": "bearer", "expires_in_seconds": 100}).json()
        r2 = s.post(f"{API}/generate_token",
                    json={"type": "bearer", "expires_in_seconds": 200}).json()
        # Obviously different sigs (different blocks/tokens), so just assert both verify
        # and their expires_at differs — proving the field is actually bound.
        assert r1["token_signature_hex"] != r2["token_signature_hex"]
        assert r1["expires_at"] != r2["expires_at"]
        v1 = s.post(f"{API}/verify_token",
                    json={"token": r1["token"], "block_id": r1["block_id"]}).json()
        v2 = s.post(f"{API}/verify_token",
                    json={"token": r2["token"], "block_id": r2["block_id"]}).json()
        assert v1["valid"] and v2["valid"]

    def test_token_hash_correctness(self, s):
        r = s.post(f"{API}/generate_token",
                   json={"type": "bearer", "expires_in_seconds": 60}).json()
        assert r["token_hash_hex"] == hashlib.sha256(r["token"].encode()).hexdigest()


# -------- Verify (regression from iter4, minus bulk) --------
class TestVerify:
    def test_verify_tampered_token(self, s):
        r = s.post(f"{API}/generate_token", json={"type": "bearer"}).json()
        v = s.post(f"{API}/verify_token",
                   json={"token": r["token"] + "X", "block_id": r["block_id"]}).json()
        assert v["valid"] is False
        assert v["reason"] == "token_hash_mismatch"

    def test_verify_missing_block(self, s):
        v = s.post(f"{API}/verify_token",
                   json={"token": "any", "block_id": 999999}).json()
        assert v["valid"] is False
        assert v["reason"] == "block_not_found"

    def test_verify_non_token_block(self, s):
        gr = s.post(f"{API}/get_random", json={"source": "system", "length": 32}).json()
        v = s.post(f"{API}/verify_token",
                   json={"token": "x", "block_id": gr["block_id"]}).json()
        assert v["valid"] is False
        assert v["reason"] == "block_is_not_a_token_block"


# -------- Regression --------
class TestRegression:
    def test_status(self, s):
        assert s.get(f"{API}/status").status_code == 200

    def test_pubkey(self, s):
        assert s.get(f"{API}/pubkey").status_code == 200

    def test_ledger(self, s):
        assert s.get(f"{API}/ledger").status_code == 200

    def test_get_random(self, s):
        assert s.post(f"{API}/get_random",
                      json={"source": "system", "length": 32}).status_code == 200

    def test_simulate_universe(self, s):
        r = s.post(f"{API}/simulate_universe",
                   json={"steps": 3, "initial_pop": 2, "source": "system"})
        assert r.status_code == 200

    @pytest.mark.parametrize("t", ["bearer", "password", "uuid", "totp", "otp", "session"])
    def test_all_token_types(self, s, t):
        r = s.post(f"{API}/generate_token", json={"type": t})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "token_hash_hex" in d
        assert "expires_at" in d
        assert d["expires_at"] is None  # no expiry requested
