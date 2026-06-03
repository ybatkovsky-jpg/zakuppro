---
estimated_steps: 11
estimated_files: 1
skills_used: []
---

# T03: Integrate Financial Cards into Dashboard

## Why
Финансовые метрики должны быть видны на главном экране рядом с существующими KPI.

## Do
1. Открыть `src/components/app/dashboard.tsx`
2. Импортировать FinancialMetricsCard и PaymentDynamicsChart
3. Разместить FinancialMetricsCard в KPI секции (рядом с BudgetExecutionCard)
4. Разместить PaymentDynamicsChart в charts секции (рядом с ProjectStatusCard)
5. Убедиться что responsive layout работает (grid cols: мобильный vs desktop)
6. Проверить что нет конфликта с существующими Card компонентами

## Done when
Dashboard загружается с новыми карточками, layout не сломлен на мобильном/desktop

## Inputs

- `src/components/app/financial-metrics-card.tsx`
- `src/components/app/payment-dynamics-chart.tsx`
- `src/components/app/dashboard.tsx`

## Expected Output

- `src/components/app/dashboard.tsx`

## Verification

1. npm run build без ошибок
2. Визуально: все карточки на своих местах, responsive grid работает
3. Прокрутка страницы не вызывает layout shift

## Observability Impact

Нет новых observability surfaces - использует существующие
