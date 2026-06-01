"""add_failed_tasks_table

Revision ID: a1b2c3d4e5f6
Revises: e6b0df437c13
Create Date: 2026-06-01 11:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'e6b0df437c13'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'failed_tasks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('task_id', sa.String(length=255), nullable=False),
        sa.Column('task_name', sa.String(length=100), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=False),
        sa.Column('error_type', sa.String(length=100), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=True),
        sa.Column('chat_id', sa.Integer(), nullable=True),
        sa.Column('context', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now'), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_failed_tasks')),
        sa.UniqueConstraint('task_id', name=op.f('uq_failed_tasks_task_id'))
    )
    op.create_index(op.f('ix_failed_tasks_id'), 'failed_tasks', ['id'], unique=False)
    op.create_index(op.f('ix_failed_tasks_task_id'), 'failed_tasks', ['task_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_failed_tasks_task_id'), table_name='failed_tasks')
    op.drop_index(op.f('ix_failed_tasks_id'), table_name='failed_tasks')
    op.drop_table('failed_tasks')
