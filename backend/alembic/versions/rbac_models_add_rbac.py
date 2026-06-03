"""add_rbac_models

Revision ID: rbac_add_rbac
Revises: m0h4akx9s41v
Create Date: 2026-06-03

Adds User model with Role enum for RBAC and owner_id foreign key to projects.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import func


# revision identifiers, used by Alembic.
revision: str = 'rbac_add_rbac'
down_revision: Union[str, None] = 'm0h4akx9s41v'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create users table with role enum
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(length=100), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('role', sa.Enum('owner', 'manager', 'warehouse', name='role'), nullable=False, server_default='manager'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_users_id', 'users', ['id'])
    op.create_index('ix_users_username', 'users', ['username'], unique=True)
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    # Add owner_id column to projects table (nullable for existing data)
    op.add_column(
        'projects',
        sa.Column('owner_id', sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        'fk_projects_owner',
        'projects', 'users',
        ['owner_id'], ['id']
    )

    # Backfill existing projects with owner_id=1 (will be created in seed script)
    op.execute(
        "UPDATE projects SET owner_id = 1 WHERE owner_id IS NULL"
    )

    # Make owner_id NOT NULL after backfill (optional - kept nullable for flexibility)
    # Commented out to allow projects without owner for flexibility
    # op.alter_column('projects', 'owner_id', nullable=False)


def downgrade() -> None:
    # Drop foreign key and owner_id column from projects
    op.drop_constraint('fk_projects_owner', 'projects', type_='foreignkey')
    op.drop_column('projects', 'owner_id')

    # Drop users table
    op.drop_index('ix_users_email', table_name='users')
    op.drop_index('ix_users_username', table_name='users')
    op.drop_index('ix_users_id', table_name='users')
    op.execute('DROP TYPE role')
    op.drop_table('users')
