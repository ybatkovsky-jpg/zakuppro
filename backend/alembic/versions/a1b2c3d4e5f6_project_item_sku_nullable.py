"""Make project_items.sku nullable with server_default

Revision ID: a1b2c3d4e5f6
Revises: f7e8d9c0b1a2
Create Date: 2026-06-07

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'f7e8d9c0b1a2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Backfill any NULL sku values with empty string before adding server_default
    op.execute("UPDATE project_items SET sku = '' WHERE sku IS NULL OR sku = 'NULL'")

    # Alter column to add server_default and keep nullable=False
    # (we store empty string instead of NULL for items without SKU)
    op.alter_column(
        'project_items', 'sku',
        existing_type=sa.String(100),
        nullable=False,
        server_default='',
    )


def downgrade() -> None:
    op.alter_column(
        'project_items', 'sku',
        existing_type=sa.String(100),
        nullable=False,
        server_default=None,
    )
