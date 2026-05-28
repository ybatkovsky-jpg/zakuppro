---
Task ID: 3
Agent: Code Agent
Task: Supplier Detail View + Comprehensive Styling Pass

Work Log:
- Updated /src/store/app-store.ts:
  - Added 'supplier-detail' to ViewType union
  - Added selectedSupplierId: string | null state
  - Added setSelectedSupplierId and navigateToSupplier methods
  - Updated navigate() to clear selectedSupplierId when leaving supplier-detail

- Created /src/components/app/supplier-detail.tsx:
  - Full 'use client' component with TanStack Query for data fetching
  - Header with back button, supplier name, edit button, delete button
  - Info Cards Row (3 cards): Contact Info, Statistics, Performance (N/A placeholders)
  - Tabs: "Позиции" (items table), "Запросы" (requests table), "Счета" (invoices table)
  - Edit Dialog with pre-filled form
  - Delete Confirmation AlertDialog
  - API calls: GET /api/suppliers/[id], GET /api/requests?supplierId=id, GET /api/invoices (filtered client-side)
  - framer-motion entrance animations

- Updated /src/components/app/app-sidebar.tsx:
  - "Поставщики" highlights when currentView is 'supplier-detail'
  - Added colored ping dot indicators:
    - Amber dot on "Запросы" when there are draft requests (pendingRequests > 0)
    - Red dot on "Склад" when there are low-stock items (lowStockItems > 0)
  - Fetches stats via useQuery with 60s refetch interval

- Updated /src/app/page.tsx:
  - Imported SupplierDetail component
  - Added 'supplier-detail' case to render SupplierDetail
  - Added page title for supplier-detail: 'Детали поставщика'
  - supplier-detail hasOwnHeader=true (like project-detail)
  - Added bg-pattern class to main content area

- Updated /src/components/app/suppliers.tsx:
  - Added useAppStore import and navigateToSupplier
  - Added onClick prop to SupplierCard
  - Made cards clickable - navigating to supplier-detail via navigateToSupplier(id)
  - Added cursor-pointer class to card

- Updated /src/components/app/dashboard.tsx:
  - Made all 7 stat cards clickable with onClick handlers
  - "Всего проектов" → navigate('projects')
  - "Поставщиков" → navigate('suppliers')
  - "Запросов в процессе" → navigate('requests')
  - "Неоплаченных счетов" → navigate('invoices')
  - "Активных проектов" → navigate('projects')
  - "На складе" → navigate('warehouse')
  - "Низкий запас" → navigate('warehouse')
  - Added cursor-pointer, hover shadow/translate, active scale effects

- Updated /src/app/api/projects/route.ts:
  - Added items include with select: id, price, quantity, status
  - Enables budget calculation and progress tracking on frontend

- Updated /src/components/app/projects.tsx:
  - Updated Project type to include items array
  - Added "Бюджет" column: sum of all item prices × quantities, formatted "XXX XXX ₽"
  - Added "Прогресс" column: % of items with status requested/invoiced/partial/available/delivered/completed
  - Progress shown as small bar with percentage label, color-coded

- Updated /src/components/app/warehouse.tsx:
  - Added ShoppingCart icon import
  - Added reorder state: reorderOpen, reorderItem, reorderQuantity, reorderSupplierId, reorderNotes
  - Added suppliers query for reorder dropdown
  - Added openReorderDialog and handleReorderSubmit handlers
  - Low stock alert cards now have "Запросить пополнение" button (ShoppingCart icon)
  - Table rows for low-stock items show reorder button in actions column
  - Reorder Dialog with: item info, quantity, preferred supplier dropdown, notes
  - On submit shows toast "Запрос на пополнение создан"

- Updated /src/app/globals.css:
  - Added bg-pattern utility: subtle dot pattern using radial-gradient
  - Improved custom scrollbar: thinner (4px → 5px globally, 4px for custom-scrollbar)
  - Reduced scrollbar opacity for more elegant look
  - Added @keyframes shimmer: loading state animation with gradient sweep
  - Added @keyframes count-up: number entrance animation
  - Added .animate-shimmer and .animate-count-up utility classes

Stage Summary:
- No lint errors
- No dev server errors
- All features working: supplier detail, clickable cards, budget/progress columns, reorder dialog, sidebar indicators, background pattern
