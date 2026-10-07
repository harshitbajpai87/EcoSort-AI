"""
tests/test_pickups.py
======================
Tests for pickup request management.
"""

from __future__ import annotations
import pytest
from fastapi.testclient import TestClient

BASE_USER = {"name": "Alice",    "email": "alice@pick.test", "password": "Secure1Pass!"}

PICKUP_PAYLOAD = {
    "waste_category": "plastic",
    "quantity_kg": 2.5,
    "address": "123 Test Street, Eco City",
}


def _tokens(client: TestClient, suffix: str = "a") -> tuple[str, str]:
    """Each test gets a unique email to avoid conflicts across isolated test functions."""
    user = {"name": f"TestUser {suffix}", "email": f"picktest_{suffix}@test.example", "password": "Secure1Pass!"}
    reg = client.post("/api/v1/auth/register", json=user)
    if reg.status_code == 409:
        # Already registered in this session — just log in
        r = client.post("/api/v1/auth/login", json={"email": user["email"], "password": user["password"]})
    else:
        r = client.post("/api/v1/auth/login", json={"email": user["email"], "password": user["password"]})
    body = r.json()
    return body["access_token"], body["refresh_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


class TestPickups:
    def test_create_pickup_authenticated(self, client):
        token, _ = _tokens(client, "p1")
        r = client.post("/api/v1/pickups/", json=PICKUP_PAYLOAD, headers=_auth(token))
        assert r.status_code == 201
        body = r.json()
        assert body["waste_category"] == "plastic"
        assert body["status"] == "pending"
        assert body["quantity_kg"] == 2.5

    def test_create_pickup_unauthenticated_returns_401(self, client):
        r = client.post("/api/v1/pickups/", json=PICKUP_PAYLOAD)
        assert r.status_code == 401

    def test_list_my_pickups(self, client):
        token, _ = _tokens(client, "p2")
        client.post("/api/v1/pickups/", json=PICKUP_PAYLOAD, headers=_auth(token))
        r = client.get("/api/v1/pickups/", headers=_auth(token))
        assert r.status_code == 200
        pickups = r.json()
        assert len(pickups) >= 1

    def test_cancel_pending_pickup(self, client):
        token, _ = _tokens(client, "p3")
        r = client.post("/api/v1/pickups/", json=PICKUP_PAYLOAD, headers=_auth(token))
        pickup_id = r.json()["id"]
        r2 = client.patch(f"/api/v1/pickups/{pickup_id}/cancel", headers=_auth(token))
        assert r2.status_code == 200
        assert r2.json()["status"] == "cancelled"

    def test_cancel_nonexistent_pickup_returns_404(self, client):
        token, _ = _tokens(client, "p4")
        r = client.patch("/api/v1/pickups/99999/cancel", headers=_auth(token))
        assert r.status_code == 404

    def test_get_pickup_own(self, client):
        token, _ = _tokens(client, "p5")
        r = client.post("/api/v1/pickups/", json=PICKUP_PAYLOAD, headers=_auth(token))
        pid = r.json()["id"]
        r2 = client.get(f"/api/v1/pickups/{pid}", headers=_auth(token))
        assert r2.status_code == 200

    def test_collector_queue_requires_collector_role(self, client):
        token, _ = _tokens(client, "p6")  # USER role
        r = client.get("/api/v1/pickups/collector/queue", headers=_auth(token))
        assert r.status_code == 403
