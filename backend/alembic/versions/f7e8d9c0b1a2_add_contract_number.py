"""Add contract_number column to projects table

Revision ID: f7e8d9c0b1a2
Revises: 145abfb476cb
Create Date: 2026-06-06

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f7e8d9c0b1a2'
down_revision = '145abfb476cb'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add contract_number column (nullable first for backfill)
    op.add_column('projects', sa.Column('contract_number', sa.String(50), nullable=True, comment='Сквозной номер договора: ПМ000001'))

    # Backfill existing projects with sequential contract numbers
    # Using a subquery with row_number to assign ПМ000001, ПМ000002, ...
    op.execute("""
        WITH numbered AS (
            SELECT id, 
                   'ПМ' || LPAD(ROW_NUMBER() OVER (ORDER BY id)::text, 6, '0') AS cn
            FROM projects
            WHERE contract_number IS NULL
        )
        UPDATE projects
        SET contract_number = numbered.cn
        FROM numbered
        WHERE projects.id = numbered.id;
    """)

    # Now create unique constraint and index
    op.create_index('ix_projects_contract_number', 'projects', ['contract_number'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_projects_contract_number', table_name='projects')
    op.drop_column('projects', 'contract_number')
