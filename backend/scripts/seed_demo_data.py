"""
scripts/seed_demo_data.py
=========================
Populates ecosort.db with clearly-labelled DEMO data for presentation purposes.

Run from the backend/ folder (with your venv active):
    python scripts/seed_demo_data.py

Safe to re-run: it skips records that already exist.
"""

import sys
import os

# Make sure Python can find the app/ package regardless of where you run from
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext

from app.database.session import Base, SessionLocal, engine
from app.models.user import User
from app.models.waste_scan import WasteScan
from app.models.pickup_request import PickupRequest

# ---------------------------------------------------------------------------
# Password hashing (bcrypt)
# ---------------------------------------------------------------------------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


# ---------------------------------------------------------------------------
# Demo data definitions
# ---------------------------------------------------------------------------

DEMO_USERS = [
    {
        "name": "Demo Admin",
        "email": "admin@ecosort.demo",
        "password": "DemoAdmin123!",
        "role": "ADMIN",
        "eco_points": 500,
    },
    {
        "name": "Alice Demo",
        "email": "alice@ecosort.demo",
        "password": "DemoAlice123!",
        "role": "USER",
        "eco_points": 340,
    },
    {
        "name": "Bob Demo",
        "email": "bob@ecosort.demo",
        "password": "DemoBob123!",
        "role": "USER",
        "eco_points": 210,
    },
    {
        "name": "Charlie Demo",
        "email": "charlie@ecosort.demo",
        "password": "DemoCharlie123!",
        "role": "USER",
        "eco_points": 75,
    },
]

# Each entry matches one typical classification the AI model would return
DEMO_SCANS = [
    {
        "user_email": "alice@ecosort.demo",
        "predicted_category": "plastic",
        "confidence": 0.94,
        "recommended_bin": "Blue Recycling Bin",
        "is_hazardous": False,
        "instructions": (
            "Rinse the item to remove food residue, then flatten if possible. "
            "Place in the Blue Recycling Bin. Remove lids and recycle separately."
        ),
        "days_ago": 5,
    },
    {
        "user_email": "alice@ecosort.demo",
        "predicted_category": "paper",
        "confidence": 0.97,
        "recommended_bin": "Blue Recycling Bin",
        "is_hazardous": False,
        "instructions": (
            "Keep paper dry and free of grease. Flatten cardboard boxes before "
            "placing in the Blue Recycling Bin. Shredded paper should go in a bag."
        ),
        "days_ago": 3,
    },
    {
        "user_email": "bob@ecosort.demo",
        "predicted_category": "glass",
        "confidence": 0.91,
        "recommended_bin": "Green Glass Bin",
        "is_hazardous": False,
        "instructions": (
            "Rinse glass bottles and jars. Remove metal lids (recycle separately). "
            "Do NOT include broken glass — wrap it and place in general waste."
        ),
        "days_ago": 7,
    },
    {
        "user_email": "bob@ecosort.demo",
        "predicted_category": "organic",
        "confidence": 0.88,
        "recommended_bin": "Brown Compost Bin",
        "is_hazardous": False,
        "instructions": (
            "Food scraps, fruit peels, and garden waste are welcome. "
            "Avoid meat, dairy, and oily food in home compost bins. "
            "Place in the Brown Compost Bin."
        ),
        "days_ago": 2,
    },
    {
        "user_email": "charlie@ecosort.demo",
        "predicted_category": "hazardous",
        "confidence": 0.96,
        "recommended_bin": "Red Hazardous Waste Bin",
        "is_hazardous": True,
        "instructions": (
            "⚠️ HAZARDOUS ITEM — Do NOT place in regular bins. "
            "Take to a certified hazardous-waste drop-off point. "
            "Keep away from children and store in original container if possible."
        ),
        "days_ago": 1,
    },
    {
        "user_email": "charlie@ecosort.demo",
        "predicted_category": "e-waste",
        "confidence": 0.89,
        "recommended_bin": "E-Waste Collection Point",
        "is_hazardous": True,
        "instructions": (
            "⚠️ Electronic waste contains toxic materials. "
            "Take to a certified e-waste recycling centre or retailer take-back programme. "
            "Do NOT dispose of in regular bins."
        ),
        "days_ago": 4,
    },
    {
        "user_email": "alice@ecosort.demo",
        "predicted_category": "metal",
        "confidence": 0.93,
        "recommended_bin": "Blue Recycling Bin",
        "is_hazardous": False,
        "instructions": (
            "Rinse metal cans (food/drink). Aluminium foil can be recycled if "
            "scrunched into a ball larger than a golf ball. Place in the Blue Recycling Bin."
        ),
        "days_ago": 6,
    },
]

DEMO_PICKUPS = [
    {
        "user_email": "alice@ecosort.demo",
        "waste_category": "plastic",
        "quantity_kg": 3.5,
        "address": "12 Green Lane, Eco City, EC1 1AB  [DEMO ADDRESS]",
        "status": "completed",
        "days_ago": 10,
    },
    {
        "user_email": "alice@ecosort.demo",
        "waste_category": "paper",
        "quantity_kg": 5.0,
        "address": "12 Green Lane, Eco City, EC1 1AB  [DEMO ADDRESS]",
        "status": "confirmed",
        "days_ago": 2,
    },
    {
        "user_email": "bob@ecosort.demo",
        "waste_category": "glass",
        "quantity_kg": 2.0,
        "address": "7 Recycle Road, Eco City, EC2 2CD  [DEMO ADDRESS]",
        "status": "pending",
        "days_ago": 1,
    },
    {
        "user_email": "charlie@ecosort.demo",
        "waste_category": "e-waste",
        "quantity_kg": 1.2,
        "address": "3 Sustainability Street, Eco City, EC3 3EF  [DEMO ADDRESS]",
        "status": "pending",
        "days_ago": 0,
    },
]


# ---------------------------------------------------------------------------
# Seed logic
# ---------------------------------------------------------------------------

def seed():
    print("📦  EcoSort AI — Demo Data Seeder")
    print("=" * 45)

    # Create all tables if they don't exist yet
    Base.metadata.create_all(bind=engine)
    print("✅  Database tables verified / created.")

    db = SessionLocal()
    try:
        # --- Users ---
        email_to_id: dict[str, int] = {}
        for u in DEMO_USERS:
            existing = db.query(User).filter(User.email == u["email"]).first()
            if existing:
                print(f"   ⏭️  User already exists: {u['email']}")
                email_to_id[u["email"]] = existing.id
            else:
                user = User(
                    name=u["name"],
                    email=u["email"],
                    hashed_password=hash_password(u["password"]),
                    role=u["role"],
                    eco_points=u["eco_points"],
                )
                db.add(user)
                db.flush()  # get the auto-assigned id before commit
                email_to_id[u["email"]] = user.id
                print(f"   ➕  Created user: {u['email']}  (role={u['role']})")

        db.commit()
        print(f"\n👤  Users seeded: {len(email_to_id)}")

        # --- WasteScans ---
        scans_added = 0
        for s in DEMO_SCANS:
            uid = email_to_id.get(s["user_email"])
            scan = WasteScan(
                user_id=uid,
                predicted_category=s["predicted_category"],
                confidence=s["confidence"],
                recommended_bin=s["recommended_bin"],
                is_hazardous=s["is_hazardous"],
                instructions=s["instructions"],
                created_at=datetime.now(timezone.utc) - timedelta(days=s["days_ago"]),
            )
            db.add(scan)
            scans_added += 1

        db.commit()
        print(f"🔍  WasteScans seeded: {scans_added}")

        # --- PickupRequests ---
        pickups_added = 0
        for p in DEMO_PICKUPS:
            uid = email_to_id.get(p["user_email"])
            pickup = PickupRequest(
                user_id=uid,
                waste_category=p["waste_category"],
                quantity_kg=p["quantity_kg"],
                address=p["address"],
                status=p["status"],
                created_at=datetime.now(timezone.utc) - timedelta(days=p["days_ago"]),
            )
            db.add(pickup)
            pickups_added += 1

        db.commit()
        print(f"🚛  PickupRequests seeded: {pickups_added}")

        print("\n🎉  All demo data seeded successfully!")
        print("\nDemo credentials (for presentation only):")
        print("  admin@ecosort.demo   /  DemoAdmin123!")
        print("  alice@ecosort.demo   /  DemoAlice123!")
        print("  bob@ecosort.demo     /  DemoBob123!")
        print("  charlie@ecosort.demo /  DemoCharlie123!")

    except Exception as exc:
        db.rollback()
        print(f"\n❌  Error during seeding: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
