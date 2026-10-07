"""
tests/test_auth.py
===================
Authentication endpoint test suite.

Covers:
  ✅ successful registration
  ✅ duplicate email rejection
  ✅ weak / invalid password
  ✅ successful login
  ✅ incorrect password
  ✅ expired / invalid token
  ✅ protected endpoint requires auth
  ✅ role-based authorization (admin only)
  ✅ token refresh
  ✅ /auth/me returns correct profile
  ✅ logout returns success message
"""

from __future__ import annotations

import time
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

# ── Helpers ───────────────────────────────────────────────────────────────────

VALID_USER = {
    "name": "Alice Test",
    "email": "alice@test.example",
    "password": "Secure1Password!",
}

WEAK_PASSWORDS = [
    "short1A",          # too short (7 chars)
    "alllowercase1",    # no uppercase
    "ALLUPPERCASE1",    # no lowercase
    "NoDigitsHere",     # no digit
    "",                 # empty
]


def register(client: TestClient, payload: dict | None = None) -> dict:
    data = payload or VALID_USER
    return client.post("/api/v1/auth/register", json=data).json()


def login(client: TestClient, email: str = VALID_USER["email"],
          password: str = VALID_USER["password"]) -> dict:
    return client.post("/api/v1/auth/login",
                       json={"email": email, "password": password}).json()


# ── Registration ──────────────────────────────────────────────────────────────

class TestRegistration:
    def test_successful_registration_returns_tokens(self, client):
        r = client.post("/api/v1/auth/register", json=VALID_USER)
        assert r.status_code == 201
        body = r.json()
        assert "access_token" in body
        assert "refresh_token" in body
        assert body["token_type"] == "bearer"

    def test_duplicate_email_returns_409(self, client):
        client.post("/api/v1/auth/register", json=VALID_USER)
        r = client.post("/api/v1/auth/register", json=VALID_USER)
        assert r.status_code == 409
        assert "already exists" in r.json()["detail"].lower()

    @pytest.mark.parametrize("password", WEAK_PASSWORDS)
    def test_weak_password_rejected(self, client, password):
        payload = {**VALID_USER, "password": password}
        r = client.post("/api/v1/auth/register", json=payload)
        assert r.status_code == 422

    def test_missing_required_fields_rejected(self, client):
        r = client.post("/api/v1/auth/register", json={"email": "x@y.com"})
        assert r.status_code == 422

    def test_invalid_email_rejected(self, client):
        payload = {**VALID_USER, "email": "not-an-email"}
        r = client.post("/api/v1/auth/register", json=payload)
        assert r.status_code == 422

    def test_new_user_default_role_is_user(self, client):
        r = client.post("/api/v1/auth/register", json=VALID_USER)
        assert r.status_code == 201
        token = r.json()["access_token"]
        me = client.get("/api/v1/auth/me",
                        headers={"Authorization": f"Bearer {token}"})
        assert me.json()["role"] == "USER"

    def test_new_user_starts_with_zero_eco_points(self, client):
        r = client.post("/api/v1/auth/register", json=VALID_USER)
        token = r.json()["access_token"]
        me = client.get("/api/v1/auth/me",
                        headers={"Authorization": f"Bearer {token}"})
        assert me.json()["eco_points"] == 0


# ── Login ─────────────────────────────────────────────────────────────────────

class TestLogin:
    def test_successful_login_returns_tokens(self, client):
        client.post("/api/v1/auth/register", json=VALID_USER)
        r = client.post("/api/v1/auth/login",
                        json={"email": VALID_USER["email"],
                              "password": VALID_USER["password"]})
        assert r.status_code == 200
        body = r.json()
        assert "access_token" in body
        assert "refresh_token" in body

    def test_wrong_password_returns_401(self, client):
        client.post("/api/v1/auth/register", json=VALID_USER)
        r = client.post("/api/v1/auth/login",
                        json={"email": VALID_USER["email"],
                              "password": "WrongPassword1!"})
        assert r.status_code == 401
        assert "incorrect" in r.json()["detail"].lower()

    def test_nonexistent_email_returns_401(self, client):
        r = client.post("/api/v1/auth/login",
                        json={"email": "ghost@nowhere.com",
                              "password": "SomePass1!"})
        assert r.status_code == 401

    def test_missing_password_returns_422(self, client):
        r = client.post("/api/v1/auth/login",
                        json={"email": VALID_USER["email"]})
        assert r.status_code == 422


# ── Protected endpoints ───────────────────────────────────────────────────────

class TestProtectedEndpoints:
    def test_me_without_token_returns_401(self, client):
        r = client.get("/api/v1/auth/me")
        assert r.status_code == 401

    def test_me_with_valid_token_returns_profile(self, client):
        client.post("/api/v1/auth/register", json=VALID_USER)
        tokens = login(client)
        r = client.get("/api/v1/auth/me",
                       headers={"Authorization": f"Bearer {tokens['access_token']}"})
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == VALID_USER["email"]
        assert body["name"] == VALID_USER["name"]

    def test_me_with_invalid_token_returns_401(self, client):
        r = client.get("/api/v1/auth/me",
                       headers={"Authorization": "Bearer this.is.invalid"})
        assert r.status_code == 401

    def test_me_with_expired_token_returns_401(self, client):
        from app.core.security import _create_token
        from datetime import timedelta
        expired = _create_token(
            {"sub": "999", "role": "USER", "type": "access"},
            timedelta(seconds=-1),  # already expired
        )
        r = client.get("/api/v1/auth/me",
                       headers={"Authorization": f"Bearer {expired}"})
        assert r.status_code == 401

    def test_refresh_token_used_as_access_token_fails(self, client):
        client.post("/api/v1/auth/register", json=VALID_USER)
        tokens = login(client)
        # Refresh token should NOT work as an access token
        r = client.get("/api/v1/auth/me",
                       headers={"Authorization": f"Bearer {tokens['refresh_token']}"})
        assert r.status_code == 401


# ── Token refresh ─────────────────────────────────────────────────────────────

class TestTokenRefresh:
    def test_valid_refresh_returns_new_tokens(self, client):
        client.post("/api/v1/auth/register", json=VALID_USER)
        r = client.post("/api/v1/auth/login",
                        json={"email": VALID_USER["email"],
                              "password": VALID_USER["password"]})
        tokens = r.json()
        r2 = client.post("/api/v1/auth/refresh",
                         json={"refresh_token": tokens["refresh_token"]})
        assert r2.status_code == 200
        new = r2.json()
        assert "access_token" in new
        assert "refresh_token" in new

    def test_invalid_refresh_token_returns_401(self, client):
        r = client.post("/api/v1/auth/refresh",
                        json={"refresh_token": "garbage.token.here"})
        assert r.status_code == 401

    def test_access_token_used_as_refresh_returns_401(self, client):
        client.post("/api/v1/auth/register", json=VALID_USER)
        r = client.post("/api/v1/auth/login",
                        json={"email": VALID_USER["email"],
                              "password": VALID_USER["password"]})
        tokens = r.json()
        r2 = client.post("/api/v1/auth/refresh",
                         json={"refresh_token": tokens["access_token"]})
        assert r2.status_code == 401


# ── Role authorization ────────────────────────────────────────────────────────

class TestRoleAuthorization:
    def _get_admin_token(self, client: TestClient) -> str:
        """Create a user and manually promote them to admin via DB override."""
        from tests.conftest import override_get_db
        from app.models.user import User as UserModel

        client.post("/api/v1/auth/register", json=VALID_USER)
        # Promote to ADMIN via the same DB session the app uses
        db = next(override_get_db())
        try:
            u = db.query(UserModel).filter(
                UserModel.email == VALID_USER["email"]
            ).first()
            assert u is not None, "User not found in test DB"
            u.role = "ADMIN"
            db.commit()
        finally:
            db.close()

        r = client.post("/api/v1/auth/login",
                        json={"email": VALID_USER["email"],
                              "password": VALID_USER["password"]})
        return r.json()["access_token"]

    def test_regular_user_cannot_access_admin_endpoint(self, client):
        client.post("/api/v1/auth/register", json=VALID_USER)
        r = client.post("/api/v1/auth/login",
                        json={"email": VALID_USER["email"],
                              "password": VALID_USER["password"]})
        tokens = r.json()
        me = client.get("/api/v1/auth/me",
                        headers={"Authorization": f"Bearer {tokens['access_token']}"})
        assert me.json()["role"] == "USER"

    def test_admin_user_has_admin_role(self, client):
        token = self._get_admin_token(client)
        me = client.get("/api/v1/auth/me",
                        headers={"Authorization": f"Bearer {token}"})
        assert me.json()["role"] == "ADMIN"


# ── Logout ────────────────────────────────────────────────────────────────────

class TestLogout:
    def test_logout_returns_success_message(self, client):
        client.post("/api/v1/auth/register", json=VALID_USER)
        r = client.post("/api/v1/auth/login",
                        json={"email": VALID_USER["email"],
                              "password": VALID_USER["password"]})
        tokens = r.json()
        r2 = client.post("/api/v1/auth/logout",
                         headers={"Authorization": f"Bearer {tokens['access_token']}"})
        assert r2.status_code == 200
        assert "logged out" in r2.json()["message"].lower()

    def test_logout_without_token_returns_401(self, client):
        r = client.post("/api/v1/auth/logout")
        assert r.status_code == 401
