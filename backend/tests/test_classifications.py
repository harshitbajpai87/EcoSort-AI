"""
tests/test_classifications.py
================================
Tests for the waste classification endpoint.
"""

from __future__ import annotations
import io
from PIL import Image
import pytest
from fastapi.testclient import TestClient

VALID_USER = {
    "name": "Bob Recycler",
    "email": "bob@test.example",
    "password": "Secure1Pass!",
}


def _png_bytes() -> bytes:
    """Generate a minimal valid PNG image."""
    img = Image.new("RGB", (64, 64), color=(100, 150, 50))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _register_and_login(client: TestClient) -> str:
    client.post("/api/v1/auth/register", json=VALID_USER)
    r = client.post("/api/v1/auth/login", json={
        "email": VALID_USER["email"], "password": VALID_USER["password"]
    })
    return r.json()["access_token"]


class TestClassifications:
    def test_predict_without_auth_returns_result(self, client):
        """Anonymous classification should work and return a result."""
        r = client.post(
            "/api/v1/classifications/predict",
            files={"file": ("test.png", _png_bytes(), "image/png")},
        )
        assert r.status_code == 201
        body = r.json()
        assert "predicted_category" in body
        assert "confidence" in body
        assert "recommended_bin" in body
        assert "is_hazardous" in body
        assert "instructions" in body
        assert "scan_id" in body

    def test_predict_with_auth_awards_points(self, client):
        """Authenticated scan should award EcoPoints."""
        token = _register_and_login(client)

        # Get initial points
        me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        initial_points = me.json()["eco_points"]

        # Perform scan
        r = client.post(
            "/api/v1/classifications/predict",
            files={"file": ("test.png", _png_bytes(), "image/png")},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 201

        # Check points increased
        me2 = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me2.json()["eco_points"] > initial_points

    def test_predict_unsupported_type_returns_415(self, client):
        r = client.post(
            "/api/v1/classifications/predict",
            files={"file": ("test.txt", b"hello", "text/plain")},
        )
        assert r.status_code == 415

    def test_predict_empty_file_returns_400(self, client):
        r = client.post(
            "/api/v1/classifications/predict",
            files={"file": ("empty.png", b"", "image/png")},
        )
        assert r.status_code == 400

    def test_list_scans_authenticated(self, client):
        token = _register_and_login(client)
        # Create a scan first
        client.post(
            "/api/v1/classifications/predict",
            files={"file": ("test.png", _png_bytes(), "image/png")},
            headers={"Authorization": f"Bearer {token}"},
        )
        r = client.get(
            "/api/v1/classifications/?limit=10",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200
        assert isinstance(r.json(), list)
