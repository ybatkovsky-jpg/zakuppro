"""Initial schema

Revision ID: d6d07b9ba359
Revises:
Create Date: 2026-06-01 08:42:50.282073

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import func


# revision identifiers, used by Alembic.
revision: str = 'd6d07b9ba359'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create projects table
    op.create_table(
        'projects',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('client', sa.String(length=255), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='Проектирование'),
        sa.Column('total_cost', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_projects_id'), 'projects', ['id'], unique=False)
    op.create_index('ix_projects_status', 'projects', ['status'], unique=False)

    # Create suppliers table
    op.create_table(
        'suppliers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('requisites', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_suppliers_id'), 'suppliers', ['id'], unique=False)
    op.create_index('ix_suppliers_email', 'suppliers', ['email'], unique=False)

    # Create stock_items table
    op.create_table(
        'stock_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=500), nullable=False),
        sa.Column('sku', sa.String(length=100), nullable=False),
        sa.Column('qty_total', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('qty_reserved', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('qty_available', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('sku', name='uq_stock_items_sku')
    )
    op.create_index(op.f('ix_stock_items_id'), 'stock_items', ['id'], unique=False)

    # Create project_items table (depends on projects, suppliers, stock_items)
    op.create_table(
        'project_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=500), nullable=False),
        sa.Column('sku', sa.String(length=100), nullable=False),
        sa.Column('qty', sa.Integer(), nullable=False),
        sa.Column('supplier_id', sa.Integer(), nullable=True),
        sa.Column('stock_item_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='К закупке'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], name='fk_project_items_project'),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], name='fk_project_items_supplier'),
        sa.ForeignKeyConstraint(['stock_item_id'], ['stock_items.id'], name='fk_project_items_stock_item')
    )
    op.create_index(op.f('ix_project_items_id'), 'project_items', ['id'], unique=False)
    op.create_index('ix_project_items_project_id', 'project_items', ['project_id'], unique=False)

    # Create purchase_orders table (depends on projects, suppliers)
    op.create_table(
        'purchase_orders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('supplier_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='Сформирован'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], name='fk_purchase_orders_project'),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], name='fk_purchase_orders_supplier')
    )
    op.create_index(op.f('ix_purchase_orders_id'), 'purchase_orders', ['id'], unique=False)
    op.create_index('ix_purchase_orders_project_id', 'purchase_orders', ['project_id'], unique=False)
    op.create_index('ix_purchase_orders_supplier_id', 'purchase_orders', ['supplier_id'], unique=False)

    # Create invoices table (depends on purchase_orders)
    op.create_table(
        'invoices',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('purchase_order_id', sa.Integer(), nullable=False),
        sa.Column('file_url', sa.String(length=500), nullable=True),
        sa.Column('raw_text', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='Ожидает сверки'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['purchase_order_id'], ['purchase_orders.id'], name='fk_invoices_purchase_order')
    )
    op.create_index(op.f('ix_invoices_id'), 'invoices', ['id'], unique=False)
    op.create_index('ix_invoices_purchase_order_id', 'invoices', ['purchase_order_id'], unique=False)
    op.create_index('ix_invoices_status', 'invoices', ['status'], unique=False)

    # Create payments table (depends on invoices)
    op.create_table(
        'payments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('invoice_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('bank_transaction_id', sa.String(length=255), nullable=True),
        sa.Column('payment_date', sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], name='fk_payments_invoice')
    )
    op.create_index(op.f('ix_payments_id'), 'payments', ['id'], unique=False)
    op.create_index('ix_payments_invoice_id', 'payments', ['invoice_id'], unique=False)

    # Create unresolved_transactions table
    op.create_table(
        'unresolved_transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('bank_date', sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='Не распределено'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_unresolved_transactions_id'), 'unresolved_transactions', ['id'], unique=False)

    # Create production_tasks table (depends on projects)
    op.create_table(
        'production_tasks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='Ожидание комплектации'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], name='fk_production_tasks_project')
    )
    op.create_index(op.f('ix_production_tasks_id'), 'production_tasks', ['id'], unique=False)
    op.create_index('ix_production_tasks_project_id', 'production_tasks', ['project_id'], unique=False)


def downgrade() -> None:
    # Drop in reverse order of creation (respecting FK dependencies)
    op.drop_index('ix_production_tasks_project_id', table_name='production_tasks')
    op.drop_index(op.f('ix_production_tasks_id'), table_name='production_tasks')
    op.drop_table('production_tasks')

    op.drop_index(op.f('ix_unresolved_transactions_id'), table_name='unresolved_transactions')
    op.drop_table('unresolved_transactions')

    op.drop_index('ix_payments_invoice_id', table_name='payments')
    op.drop_index(op.f('ix_payments_id'), table_name='payments')
    op.drop_table('payments')

    op.drop_index('ix_invoices_status', table_name='invoices')
    op.drop_index('ix_invoices_purchase_order_id', table_name='invoices')
    op.drop_index(op.f('ix_invoices_id'), table_name='invoices')
    op.drop_table('invoices')

    op.drop_index('ix_purchase_orders_supplier_id', table_name='purchase_orders')
    op.drop_index('ix_purchase_orders_project_id', table_name='purchase_orders')
    op.drop_index(op.f('ix_purchase_orders_id'), table_name='purchase_orders')
    op.drop_table('purchase_orders')

    op.drop_index('ix_project_items_project_id', table_name='project_items')
    op.drop_index(op.f('ix_project_items_id'), table_name='project_items')
    op.drop_table('project_items')

    op.drop_constraint('uq_stock_items_sku', 'stock_items', type_='unique')
    op.drop_index(op.f('ix_stock_items_id'), table_name='stock_items')
    op.drop_table('stock_items')

    op.drop_index('ix_suppliers_email', table_name='suppliers')
    op.drop_index(op.f('ix_suppliers_id'), table_name='suppliers')
    op.drop_table('suppliers')

    op.drop_index('ix_projects_status', table_name='projects')
    op.drop_index(op.f('ix_projects_id'), table_name='projects')
    op.drop_table('projects')
