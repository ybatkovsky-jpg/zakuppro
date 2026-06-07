"""add price unit article category to project_items

Revision ID: m007_bugfix
Revises: 
Create Date: 2026-06-07

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'm007_bugfix'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns to project_items table
    op.add_column('project_items', sa.Column('price', sa.Numeric(12, 2), nullable=True, server_default='0'))
    op.add_column('project_items', sa.Column('unit', sa.String(20), nullable=True, server_default='шт'))
    op.add_column('project_items', sa.Column('article', sa.String(100), nullable=True, server_default=''))
    op.add_column('project_items', sa.Column('category', sa.String(255), nullable=True, server_default=''))


def downgrade() -> None:
    op.drop_column('project_items', 'category')
    op.drop_column('project_items', 'article')
    op.drop_column('project_items', 'unit')
    op.drop_column('project_items', 'price')
