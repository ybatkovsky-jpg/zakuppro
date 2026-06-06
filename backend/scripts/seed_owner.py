"""
Seed script to create initial owner user for ZakupPro.

Run this after migration to create the default owner account.
Username: admin
Password: admin123 (CHANGE IN PRODUCTION!)
Email: admin@zakuppro.example.com
"""
import sys
import os

# Add parent directory to path to import from backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy.orm import Session
from passlib.context import CryptContext
from database import SessionLocal, engine
from models import User, Base, Role

# IMPORTANT: Must use the same hashing scheme as auth router (sha256_crypt)
# See backend/routers/auth.py line 22
pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")


def create_owner_user():
    """Create the initial owner user if it doesn't exist."""
    db: Session = SessionLocal()

    try:
        # Check if owner user already exists
        existing_user = db.query(User).filter(User.username == "admin").first()
        if existing_user:
            print(f"Owner user 'admin' already exists (ID: {existing_user.id})")
            return existing_user.id

        # Create owner user
        hashed_password = pwd_context.hash("admin123")
        owner = User(
            username="admin",
            email="admin@zakuppro.example.com",
            hashed_password=hashed_password,
            role=Role.OWNER
        )
        db.add(owner)
        db.commit()
        db.refresh(owner)

        print(f"Created owner user: ID={owner.id}, username={owner.username}, role={owner.role.value}")
        print("DEFAULT CREDENTIALS: username='admin', password='admin123'")
        print("IMPORTANT: Change the default password in production!")

        return owner.id

    except Exception as e:
        db.rollback()
        print(f"Error creating owner user: {e}")
        raise
    finally:
        db.close()


def backfill_projects(owner_id: int):
    """Backfill existing projects without owner with the created owner."""
    from sqlalchemy import text
    db: Session = SessionLocal()

    try:
        # Update projects without owner
        result = db.execute(
            text("UPDATE projects SET owner_id = :owner_id WHERE owner_id IS NULL"),
            {"owner_id": owner_id}
        )
        db.commit()
        updated = result.rowcount

        if updated > 0:
            print(f"Backfilled {updated} projects with owner_id={owner_id}")
        else:
            print("No projects needed backfilling")

    except Exception as e:
        db.rollback()
        print(f"Error backfilling projects: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("Seeding initial owner user...")
    owner_id = create_owner_user()

    # Backfill existing projects if needed
    # Note: The migration already backfills with owner_id=1
    # This is a safety check in case migration didn't run or failed
    try:
        from sqlalchemy import text
        db: Session = SessionLocal()
        result = db.execute(text("SELECT COUNT(*) FROM projects WHERE owner_id IS NULL")).scalar()
        db.close()
        if result > 0:
            print(f"Found {result} projects without owner, backfilling...")
            backfill_projects(owner_id)
    except Exception as e:
        print(f"Could not check for backfill: {e}")

    print("Seed complete!")
