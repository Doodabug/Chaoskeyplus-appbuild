"""Tests for POST /api/generate_token — all 6 token types + ledger integration."""
import os
import re
import base64
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    from pathlib import Path
    env_path = Path("/app/frontend/.env")
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _common_asserts(data):
    assert data["health_state"] == "OK"
    assert isinstance(data["block_id"], int)
    assert data["source"] == "system"
    assert len(data["signature_hex"]) == 128
    assert len(data["mixed_hash_hex"]) == 128


class TestTokens:
    # Regression: status still works
    def test_regression_status(self, session):
        r = session.get(f"{API}/status")
        assert r.status_code == 200

    def test_regression_get_random(self, session):
        r = session.post(f"{API}/get_random", json={"source": "system", "length": 32})
        assert r.status_code == 200
        assert r.json()["health_state"] == "OK"

    # --- bearer ---
    def test_bearer_default(self, session):
        r = session.post(f"{API}/generate_token", json={"type": "bearer"})
        assert r.status_code == 200, r.text
        d = r.json()
        _common_asserts(d)
        assert d["type"] == "bearer"
        assert d["token"].startswith("ck_live_")
        body = d["token"].split("_", 2)[-1]
        assert len(body) == 40
        assert re.fullmatch(r"[0-9A-Za-z]+", body)

    def test_bearer_custom_prefix(self, session):
        r = session.post(f"{API}/generate_token", json={"type": "bearer", "prefix": "ck_test", "length": 24})
        assert r.status_code == 200
        d = r.json()
        assert d["token"].startswith("ck_test_")
        body = d["token"].split("_", 2)[-1]
        assert len(body) == 24

    # --- password ---
    def test_password_length_and_charset(self, session):
        r = session.post(f"{API}/generate_token", json={
            "type": "password", "length": 16,
            "include_upper": False, "include_lower": True,
            "include_digits": True, "include_symbols": False,
        })
        assert r.status_code == 200
        d = r.json()
        assert len(d["token"]) == 16
        assert not re.search(r"[A-Z]", d["token"])
        assert not re.search(r"[!@#\$%\^&\*\-_=\+\?]", d["token"])
        assert re.fullmatch(r"[a-z0-9]+", d["token"])

    def test_password_symbols_only(self, session):
        # Deterministic: only lowercase enabled
        r = session.post(f"{API}/generate_token", json={
            "type": "password", "length": 20,
            "include_upper": False, "include_lower": True,
            "include_digits": False, "include_symbols": False,
        })
        d = r.json()
        assert re.fullmatch(r"[a-z]+", d["token"])

    # --- uuid ---
    def test_uuid_v4_format(self, session):
        r = session.post(f"{API}/generate_token", json={"type": "uuid"})
        assert r.status_code == 200
        d = r.json()
        assert re.fullmatch(
            r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
            d["token"],
        )

    # --- totp ---
    def test_totp_base32_and_uri(self, session):
        r = session.post(f"{API}/generate_token", json={"type": "totp"})
        assert r.status_code == 200
        d = r.json()
        assert len(d["token"]) == 32
        assert re.fullmatch(r"[A-Z2-7]+", d["token"])
        uri = d["otpauth_uri"]
        # Fix (iteration 3): issuer/label must be URL-encoded — '+' -> %2B
        assert uri and uri.startswith("otpauth://totp/ChaosKey%2B:chaoskey-user?")
        assert "ChaosKey+" not in uri  # literal '+' must not appear
        assert "ChaosKey%2B" in uri
        assert f"secret={d['token']}" in uri
        assert "issuer=ChaosKey%2B" in uri
        assert "algorithm=SHA1" in uri
        assert "digits=6" in uri
        assert "period=30" in uri

    def test_totp_issuer_url_encoded_with_spaces_and_plus(self, session):
        r = session.post(f"{API}/generate_token", json={
            "type": "totp", "totp_issuer": "My App+ 2026", "totp_label": "user@x.com",
        })
        assert r.status_code == 200
        d = r.json()
        uri = d["otpauth_uri"]
        assert uri is not None
        # 'My App+ 2026' -> 'My%20App%2B%202026'
        assert "My%20App%2B%202026" in uri
        assert "My App+ 2026" not in uri
        # label with '@' should also be encoded
        assert "user%40x.com" in uri

    # --- otp ---
    def test_otp_numeric_padded(self, session):
        r = session.post(f"{API}/generate_token", json={"type": "otp", "otp_digits": 8})
        assert r.status_code == 200
        d = r.json()
        assert len(d["token"]) == 8
        assert d["token"].isdigit()

    # --- session ---
    def test_session_base64url(self, session):
        r = session.post(f"{API}/generate_token", json={"type": "session", "length": 43})
        assert r.status_code == 200
        d = r.json()
        # NOTE: server treats `length` as input byte count, so 43 bytes → 58 base64url chars
        assert len(d["token"]) >= 43
        assert re.fullmatch(r"[A-Za-z0-9\-_]+", d["token"])

    # --- ledger integration ---
    def test_ledger_increments_and_context(self, session):
        r1 = session.post(f"{API}/generate_token", json={"type": "bearer"})
        r2 = session.post(f"{API}/generate_token", json={"type": "uuid"})
        assert r1.status_code == 200 and r2.status_code == 200
        b1, b2 = r1.json()["block_id"], r2.json()["block_id"]
        assert b2 > b1

        r = session.get(f"{API}/ledger", params={"limit": 10})
        blocks = r.json()
        ids = {b["block_id"]: b for b in blocks}
        assert b1 in ids and b2 in ids
        assert ids[b1]["context"].startswith("token:bearer")
        assert ids[b2]["context"].startswith("token:uuid")

    # --- validation ---
    def test_invalid_type(self, session):
        r = session.post(f"{API}/generate_token", json={"type": "invalid"})
        assert r.status_code == 422
