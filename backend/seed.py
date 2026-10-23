"""
Database Seeder Script (MongoDB)
=================================
Seeds default Admin and User accounts into the MongoDB database.
Run this ONCE after deploying or switching to MongoDB:

    cd backend
    python seed.py

"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import get_database
from app.db.models import User
from app.core.security import get_password_hash

# ─── Define your default seed users here ──────────────────────────────────────
SEED_USERS = [
    {
        "full_name":  "MGI Admin",
        "email":      "admin@mgi.org",
        "password":   "Admin@123",
        "role":       "admin",
    },
    {
        "full_name":  "MGI Employee",
        "email":      "user@mgi.org",
        "password":   "user123",
        "role":       "user",
    },
    {
        "full_name":  "Nexus Admin",
        "email":      "admin@nexus.org",
        "password":   "Admin2026",
        "role":       "admin",
    },
    {
        "full_name":  "Nexus User",
        "email":      "user@nexus.org",
        "password":   "User2026",
        "role":       "user",
    },
    {
        "full_name":  "Shah Abdul Mazid",
        "email":      "shah@nexus.com",
        "password":   "User@1234",
        "role":       "user",
    },
]
# ──────────────────────────────────────────────────────────────────────────────


def seed():
    db = get_database()
    print(f"[OK] Connected to MongoDB database: '{db.name}'")

    # Ensure unique index on email
    db["users"].create_index("email", unique=True)

    seeded = 0
    skipped = 0

    for user_data in SEED_USERS:
        existing = db["users"].find_one({"email": user_data["email"]})

        if existing:
            db["users"].update_one(
                {"email": user_data["email"]},
                {"$set": {"hashed_password": get_password_hash(user_data["password"])}}
            )
            print(f"[UPDATED] Password set for: {user_data['email']}")
            seeded += 1
            continue

        doc = User.new_doc(
            email=user_data["email"],
            hashed_password=get_password_hash(user_data["password"]),
            full_name=user_data["full_name"],
            role=user_data["role"],
        )
        db["users"].insert_one(doc)
        print(f"[CREATED] [{user_data['role'].upper()}]: {user_data['email']}")
        seeded += 1

    print(f"\nSeeding complete! {seeded} users created, {skipped} skipped.")
    print("\nLogin credentials:")
    print("-" * 45)
    for u in SEED_USERS:
        print(f"  [{u['role'].upper():5}] {u['email']} / {u['password']}")
    print("-" * 45)


if __name__ == "__main__":
    seed()
