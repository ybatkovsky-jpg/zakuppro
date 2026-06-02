"""add_bank_statement_models

Revision ID: m0h4akx9s41v
Revises: 4773ecad7cb2
Create Date: 2026-06-02

Adds BankStatement, BankTransaction, and TransactionMatchingAudit tables
for bank reconciliation and auto-matching features.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import func


# revision identifiers, used by Alembic.
revision: str = 'm0h4akx9s41v'
down_revision: Union[str, None] = '4773ecad7cb2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create bank_statements table
    op.create_table(
        'bank_statements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('bank_name', sa.String(length=100), nullable=False),
        sa.Column('statement_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('period_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('period_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('raw_file', sa.LargeBinary(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='Обрабатывается'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_bank_statements_id', 'bank_statements', ['id'])
    op.create_index('ix_bank_statements_statement_date', 'bank_statements', ['statement_date'])

    # Create bank_transactions table
    op.create_table(
        'bank_transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('bank_statement_id', sa.Integer(), nullable=False),
        sa.Column('transaction_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('supplier_inn', sa.String(length=12), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('operation_type', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
        sa.ForeignKeyConstraint(['bank_statement_id'], ['bank_statements.id'], name='fk_bank_transactions_bank_statement'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_bank_transactions_id', 'bank_transactions', ['id'])
    op.create_index('ix_bank_transactions_transaction_date', 'bank_transactions', ['transaction_date'])
    op.create_index('ix_bank_transactions_amount', 'bank_transactions', ['amount'])
    op.create_index('ix_bank_transactions_supplier_inn', 'bank_transactions', ['supplier_inn'])

    # Create transaction_matching_audits table
    op.create_table(
        'transaction_matching_audits',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('bank_transaction_id', sa.Integer(), nullable=False),
        sa.Column('invoice_id', sa.Integer(), nullable=False),
        sa.Column('matched_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('matched_by', sa.String(length=50), nullable=False),
        sa.Column('confidence_score', sa.Numeric(precision=3, scale=2), nullable=True),
        sa.Column('matching_context', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
        sa.ForeignKeyConstraint(['bank_transaction_id'], ['bank_transactions.id'], name='fk_transaction_matching_audit_bank_transaction'),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], name='fk_transaction_matching_audit_invoice'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_transaction_matching_audits_id', 'transaction_matching_audits', ['id'])


def downgrade() -> None:
    # Drop in reverse order: TransactionMatchingAudit -> BankTransaction -> BankStatement
    op.drop_index('ix_transaction_matching_audits_id', table_name='transaction_matching_audits')
    op.drop_table('transaction_matching_audits')

    op.drop_index('ix_bank_transactions_supplier_inn', table_name='bank_transactions')
    op.drop_index('ix_bank_transactions_amount', table_name='bank_transactions')
    op.drop_index('ix_bank_transactions_transaction_date', table_name='bank_transactions')
    op.drop_index('ix_bank_transactions_id', table_name='bank_transactions')
    op.drop_table('bank_transactions')

    op.drop_index('ix_bank_statements_statement_date', table_name='bank_statements')
    op.drop_index('ix_bank_statements_id', table_name='bank_statements')
    op.drop_table('bank_statements')
