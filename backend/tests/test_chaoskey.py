"""ChaosKey+ M3 backend pytest suite — covers identity, status, pubkey, get_random,
ledger chain integrity, simulate_universe, and request validation."""
import os
import base64
import secrets

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    from pathlib import Path
    candidates = [
        Path("/app/frontend/.env"),
        Path(__file__).resolve().parents[2] / "frontend" / ".env",
        Path(__file__).resolve().parents[2] / ".env",
    ]
    keys = ("REACT_APP_BACKEND_URL=", "REACT_APP_API_URL=")
    for env_path in candidates:
        if not env_path.exists():
            continue
        for line in env_path.read_text().splitlines():
            if line.startswith(keys):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                break
        if BASE_URL:
            break

API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Identity / service module ---
class TestIdentity:
    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "ChaosKey+ M3"
        assert "device_id" in data and isinstance(data["device_id"], str)
        assert data["version"] == "v3"

    def test_pubkey(self, session):
        r = session.get(f"{API}/pubkey")
        assert r.status_code == 200
        data = r.json()
        assert data["algorithm"] == "Ed25519"
        assert "BEGIN PUBLIC KEY" in data["public_key_pem"]
        assert "END PUBLIC KEY" in data["public_key_pem"]

    def test_status_basic(self, session):
        r = session.get(f"{API}/status")
        assert r.status_code == 200
        data = r.json()
        assert "device_id" in data
        assert "total_blocks" in data
        assert "chain_intact" in data
        assert isinstance(data["chain_intact"], bool)


# --- Block generation / get_random ---
class TestGetRandom:
    def test_system_entropy_block(self, session):
        r = session.post(f"{API}/get_random", json={"source": "system", "length": 64})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "random_hex" in data and len(data["random_hex"]) == 64 * 2
        assert isinstance(data["block_id"], int)
        assert data["health_state"] == "OK"
        assert data["source"] == "system"
        assert len(data["mixed_hash_hex"]) == 128
        assert len(data["signature_hex"]) == 128  # Ed25519 sig hex

    def test_camera_with_diffs(self, session):
        # Synthesise base64-encoded random byte arrays simulating frame diffs
        diffs = [base64.b64encode(secrets.token_bytes(2048)).decode() for _ in range(8)]
        r = session.post(f"{API}/get_random", json={
            "source": "camera", "length": 64, "frame_diffs_b64": diffs,
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["source"] == "camera"
        assert len(data["random_hex"]) == 128

    def test_camera_missing_diffs_falls_back(self, session):
        r = session.post(f"{API}/get_random", json={"source": "camera", "length": 32})
        assert r.status_code == 200, r.text
        data = r.json()
        # Should fall back to system since no frame_diffs supplied
        assert data["source"] == "system"
        assert len(data["random_hex"]) == 64

    def test_length_too_small(self, session):
        r = session.post(f"{API}/get_random", json={"source": "system", "length": 4})
        assert r.status_code == 422

    def test_length_too_large(self, session):
        r = session.post(f"{API}/get_random", json={"source": "system", "length": 1000})
        assert r.status_code == 422


# --- Ledger chain integrity ---
class TestLedger:
    def test_ledger_returns_blocks(self, session):
        # ensure at least one block exists
        session.post(f"{API}/get_random", json={"source": "system", "length": 32})
        r = session.get(f"{API}/ledger", params={"limit": 10})
        assert r.status_code == 200
        blocks = r.json()
        assert isinstance(blocks, list) and len(blocks) > 0
        for b in blocks:
            for k in ("block_id", "timestamp", "mixed_hash_hex", "prev_block_hash_hex",
                      "signature_hex", "health_state", "source"):
                assert k in b, f"missing field {k}"

    def test_ledger_sorted_desc(self, session):
        r = session.get(f"{API}/ledger", params={"limit": 10})
        blocks = r.json()
        ids = [b["block_id"] for b in blocks]
        assert ids == sorted(ids, reverse=True)

    def test_chain_integrity(self, session):
        # Get all blocks ascending and verify prev_hash linkage
        r = session.get(f"{API}/ledger", params={"limit": 200})
        blocks = r.json()
        blocks_asc = sorted(blocks, key=lambda b: b["block_id"])
        if blocks_asc[0]["block_id"] == 0:
            assert blocks_asc[0]["prev_block_hash_hex"] == "0" * 128
        for i in range(1, len(blocks_asc)):
            assert blocks_asc[i]["prev_block_hash_hex"] == blocks_asc[i - 1]["mixed_hash_hex"], \
                f"chain break at block {blocks_asc[i]['block_id']}"


# --- Universe simulation ---
class TestUniverse:
    def test_simulate_default(self, session):
        before = session.get(f"{API}/status").json()["total_blocks"]
        r = session.post(f"{API}/simulate_universe", json={
            "steps": 10, "initial_pop": 3, "initial_resources": 200.0,
            "replication_prob": 0.35, "consumption_per_entity": 4.0, "source": "system",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data["initial_origins"]) == 3
        assert data["steps_executed"] <= 10
        assert isinstance(data["trajectory"], list)
        assert len(data["trajectory"]) == data["steps_executed"]
        for t in data["trajectory"]:
            for k in ("step", "population", "resources", "avg_energy"):
                assert k in t
        assert isinstance(data["emergence_summary"], str) and data["emergence_summary"]
        after = session.get(f"{API}/status").json()["total_blocks"]
        assert after - before >= 3, "ledger should grow by at least initial_pop"
