"""invoice_extensions

Revision ID: 4773ecad7cb2
Revises: a1b2c3d4e5f6
Create Date: 2026-06-01

Adds Invoice.raw_file (BYTEA), Invoice.verification_result (JSONB), and InvoiceItem table.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import func


# revision identifiers, used by Alembic.
revision: str = '4773ecad7cb2'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add raw_file column for storing binary invoice data (PDF/Excel files)
    op.add_column(
        'invoices',
        sa.Column('raw_file', sa.LargeBinary(), nullable=True)
    )

    # Add verification_result column for storing LLM verification results as JSONB
    op.add_column(
        'invoices',
        sa.Column('verification_result', sa.JSON(), nullable=True)
    )

    # Create invoice_items table for line items with foreign keys
    op.create_table(
        'invoice_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('invoice_id', sa.Integer(), nullable=False),
        sa.Column('project_item_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(length=500), nullable=False),
        sa.Column('sku', sa.String(length=100), nullable=False),
        sa.Column('qty', sa.Integer(), nullable=False),
        sa.Column('unit_price', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('total_price', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], name='fk_invoice_items_invoice'),
        sa.ForeignKeyConstraint(['project_item_id'], ['project_items.id'], name='fk_invoice_items_project_item')
    )
    op.create_index(op.f('ix_invoice_items_id'), 'invoice_items', ['id'], unique=False)
    op.create_index('ix_invoice_items_invoice_id', 'invoice_items', ['invoice_id'], unique=False)
    op.create_index('ix_invoice_items_project_item_id', 'invoice_items', ['project_item_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_invoice_items_project_item_id', table_name='invoice_items')
    op.drop_index('ix_invoice_items_invoice_id', table_name='invoice_items')
    op.drop_index(op.f('ix_invoice_items_id'), table_name='invoice_items')
    op.drop_table('invoice_items')

    op.drop_column('invoices', 'verification_result')
    op.drop_column('invoices', 'raw_file')
