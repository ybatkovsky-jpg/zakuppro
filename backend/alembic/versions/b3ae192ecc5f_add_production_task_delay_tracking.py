"""add_production_task_delay_tracking

Revision ID: b3ae192ecc5f
Revises: rbac_add_rbac
Create Date: 2026-06-04 16:41:33.033994

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3ae192ecc5f'
down_revision: Union[str, None] = 'rbac_add_rbac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add DelayReason enum type
    delay_reason_enum = sa.Enum(
        'waiting_materials',
        'equipment_failure',
        'staff_shortage',
        'supplier_delay',
        'technical_issues',
        'other',
        name='delayreason'
    )
    delay_reason_enum.create(op.get_bind())

    # Add new columns to production_tasks
    op.add_column('production_tasks', sa.Column('expected_completion_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('production_tasks', sa.Column('delay_reason', delay_reason_enum, nullable=True))
    op.add_column('production_tasks', sa.Column('custom_reason', sa.Text(), nullable=True))


def downgrade() -> None:
    # Remove columns from production_tasks
    op.drop_column('production_tasks', 'custom_reason')
    op.drop_column('production_tasks', 'delay_reason')
    op.drop_column('production_tasks', 'expected_completion_date')

    # Drop DelayReason enum type
    sa.Enum(name='delayreason').drop(op.get_bind())
