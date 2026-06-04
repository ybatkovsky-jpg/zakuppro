"""add_project_status_history

Revision ID: 145abfb476cb
Revises: b3ae192ecc5f
Create Date: 2026-06-04 18:45:54.639091

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '145abfb476cb'
down_revision: Union[str, None] = 'b3ae192ecc5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'project_status_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('from_status', sa.String(50), nullable=False),
        sa.Column('to_status', sa.String(50), nullable=False),
        sa.Column('changed_by', sa.Integer(), nullable=True),
        sa.Column('changed_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id']),
        sa.ForeignKeyConstraint(['changed_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_project_status_history_id'), 'project_status_history', ['id'])


def downgrade() -> None:
    op.drop_index(op.f('ix_project_status_history_id'), table_name='project_status_history')
    op.drop_table('project_status_history')
