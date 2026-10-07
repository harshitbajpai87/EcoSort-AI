"""
tests/test_ecopoints.py
========================
Tests for EcoPoints and leaderboard endpoints.
"""

from __future__ import annotations
import pytest
from fastapi.testclient import TestClient

USER = {"name": "EcoTester", "email": "eco@test.example", "password": "Secure1Pass!"}


def _token(client: TestClient) -> str:
    client.post("/api/v1/auth/register", json=USER)
    r = client.post("/api/v1/auth/login", json={"email": USER["email"], "password": USER["password"]})
    return r.json()["access_token"]


def _auth(t: str) -> dict:
    return {"Authorization": f"Bearer {t}"}


class TestEcoPoints:
    def test_get_my_ecopoints_returns_balance(self, client):
        token = _token(client)
        r = client.get("/api/v1/ecopoints/me", headers=_auth(token))
        assert r.status_code == 200
        body = r.json()
        assert "eco_points" in body
        assert "badges" in body
        assert isinstance(body["badges"], list)

    def test_get_leaderboard_returns_list(self, client):
        token = _token(client)
        r = client.get("/api/v1/ecopoints/leaderboard", headers=_auth(token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_history_returns_list(self, client):
        token = _token(client)
        r = client.get("/api/v1/ecopoints/history", headers=_auth(token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_unauthenticated_returns_401(self, client):
        r = client.get("/api/v1/ecopoints/me")
        assert r.status_code == 401


class TestNotifications:
    def test_list_notifications_empty(self, client):
        token = _token(client)
        r = client.get("/api/v1/notifications/", headers=_auth(token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_unread_count(self, client):
        token = _token(client)
        r = client.get("/api/v1/notifications/unread-count", headers=_auth(token))
        assert r.status_code == 200
        assert "unread_count" in r.json()
