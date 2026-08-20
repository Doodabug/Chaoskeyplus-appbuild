"""Smoke tests: core backend endpoints after frontend validator change."""
import os

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def test_status(client):
    r = client.get(f"{BASE_URL}/api/status", timeout=30)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    assert isinstance(data, (dict, list))
    if isinstance(data, dict):
        assert "_id" not in data


def test_pubkey(client):
    r = client.get(f"{BASE_URL}/api/pubkey", timeout=30)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    assert isinstance(data, dict)
    assert "_id" not in data
    assert "public_key_pem" in data
    assert data["public_key_pem"].startswith("-----BEGIN PUBLIC KEY-----")
    assert data.get("algorithm") == "Ed25519"


def test_ledger(client):
    r = client.get(f"{BASE_URL}/api/ledger", timeout=30)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    items = data if isinstance(data, list) else data.get("entries", data.get("items", []))
    assert isinstance(items, list)
    for item in items[:10]:
        if isinstance(item, dict):
            assert "_id" not in item
