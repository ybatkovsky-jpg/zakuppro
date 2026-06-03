# S03: Analytics Dashboard Real Data

**Goal:** Интегрировать Analytics Dashboard с FastAPI backend для отображения реальных финансовых метрик (счета, оплаты) на главном дашборде
**Demo:** Дашборд показывает метрики из FastAPI: paid_invoices_count, unpaid_invoices_count, total_paid_amount, total_unpaid_amount. Графики payment dynamics рендерятся данными из /api/analytics/payment-dynamics.

## Must-Haves

- 1. Financial metrics card отображает реальные данные из FastAPI /api/analytics/dashboard (paid/unpaid/pending счета, суммы)
- 2. Payment dynamics chart рендерит time-series данные из /api/analytics/payment-dynamics
- 3. Компоненты интегрированы в существующий dashboard layout
- 4. Date range filter обновляет данные без перезагрузки страницы
- 5. Empty states показывают полезные сообщения
- 6. Build проходит без TypeScript ошибок

## Proof Level

- This slice proves: Сборка + визуальная проверка компонентов (требуется FastAPI backend для runtime)

## Integration Closure

Компоненты используют api-client из S01; прокси-маршруты уже мигрированы; интеграция в dashboard.tsx без изменения контракта других слайсов

## Verification

- Loading states для React Query, error handling с сообщениями пользователю, empty states для отсутствия данных

## Tasks

- [x] **T01: Create Financial Metrics Card Component** `est:1h`
  ## Why
  Пользователям нужна видимость финансовых показателей (оплаченные/неоплаченные счета) на главном дашборде.
  - Files: `src/components/app/financial-metrics-card.tsx`
  - Verify: 1. npm run build без TypeScript ошибок
2. Визуальная проверка: карточка отображается на dashboard с корректными иконками и цветами

- [x] **T02: Create Payment Dynamics Chart Component** `est:2h`
  ## Why
  Визуализация трендов платежей помогает пользователям понимать динамику оплат во времени.
  - Files: `src/components/app/payment-dynamics-chart.tsx`
  - Verify: 1. npm run build без ошибок
2. Визуально: график отображает данные, tooltip показывает корректные значения
3. Select group_by обновляет данные

- [x] **T03: Integrate Financial Cards into Dashboard** `est:1h`
  ## Why
  Финансовые метрики должны быть видны на главном экране рядом с существующими KPI.
  - Files: `src/components/app/dashboard.tsx`
  - Verify: 1. npm run build без ошибок
2. Визуально: все карточки на своих местах, responsive grid работает
3. Прокрутка страницы не вызывает layout shift

- [x] **T04: Build Verification and Type Safety** `est:30m`
  ## Why
  Убедиться что все компоненты корректно типизированы и собираются без ошибок.
  - Verify: npm run build --silent | grep -i 'error' && exit 1 || exit 0

## Files Likely Touched

- src/components/app/financial-metrics-card.tsx
- src/components/app/payment-dynamics-chart.tsx
- src/components/app/dashboard.tsx
