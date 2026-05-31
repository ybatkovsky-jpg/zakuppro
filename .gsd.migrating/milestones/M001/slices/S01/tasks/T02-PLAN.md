---
estimated_steps: 11
estimated_files: 2
skills_used: []
---

# T02: Create Base SQLAlchemy models

Создать базовые SQLAlchemy модели для всех таблиц из SPEC.md. Пока без relationships - только структура таблиц.

Таблицы:
- Project (id, name, client, status, total_cost)
- ProjectItem (id, project_id, name, sku, qty, supplier_id, stock_item_id, status)
- Supplier (id, name, email, requisites)
- PurchaseOrder (id, project_id, supplier_id, status)
- Invoice (id, purchase_order_id, file_url, raw_text, status)
- Payment (id, invoice_id, amount, bank_transaction_id, payment_date)
- UnresolvedTransaction (id, amount, description, bank_date, status)
- StockItem (id, name, sku, qty_total, qty_reserved, qty_available)
- ProductionTask (id, project_id, status)

## Inputs

- `SPEC.md таблицы`

## Expected Output

- `SQLAlchemy models.py сdeclarative_base()`
- `все таблицы определены`

## Verification

Python импортирует модели без ошибок; структура совпадает с SPEC
