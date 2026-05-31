"""add_performance_indexes

Revision ID: e6b0df437c13
Revises: d6d07b9ba359
Create Date: 2026-06-01 08:52:21.297560

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6b0df437c13'
down_revision: Union[str, None] = 'd6d07b9ba359'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add index on project_items.status for Kanban filtering performance
    op.create_index('ix_project_items_status', 'project_items', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_project_items_status', table_name='project_items')
