# Task 2-b: Frontend Bug Fix & Email Presets Agent

## Summary
Fixed the blue gradient rectangle bug, added email preset quick-config buttons for Yandex/Gmail/Mail.ru, and added connection status indicators to the Settings page.

## Changes Made

### 1. Bug Fix: Blue Gradient Rectangle
- **File**: `src/components/app/app-sidebar.tsx`
  - Removed `bg-gradient-to-b from-primary/10 via-primary/5 to-transparent` from SidebarHeader
  - Left only `border-b border-sidebar-border` for clean flat header

- **File**: `src/components/app/dashboard.tsx`
  - Reduced header gradient opacity from `from-primary/10` to `from-primary/[0.06]`
  - Reduced dot pattern opacity from `opacity-[0.02]` to `opacity-[0.015]`
  - Removed third decorative orb (violet)
  - Reduced remaining orb opacity: `from-primary/15` → `from-primary/[0.08]`, `from-emerald-500/10` → `from-emerald-500/[0.06]`
  - Added `pointer-events-none` to dot pattern div

### 2. Email Preset Quick-Config Buttons
- **File**: `src/components/app/settings.tsx`
  - Added `EMAIL_PRESETS` constant with Yandex, Gmail, Mail.ru providers
  - Added `selectedPreset` state tracking
  - Added `handlePresetClick` function to auto-fill SMTP/IMAP settings
  - Added `detectPreset` helper for auto-detection from server data
  - Added 3-column grid of clickable preset cards with colored circles and hover animations
  - Preset selection clears when manually editing server fields

### 3. Connection Status Indicators
- **File**: `prisma/schema.prisma`
  - Added `smtpTestResult`, `imapTestResult` (String) and `smtpLastTestedAt`, `imapLastTestedAt` (DateTime?) to EmailSettings

- **File**: `src/app/api/settings/email/route.ts`
  - Updated POST handler to save test results to DB on SMTP/IMAP test

- **File**: `src/components/app/settings.tsx`
  - Added `ConnectionStatusBadge` component with 3 states:
    - ✅ Подключено (green) — testResult === 'success'
    - ❌ Не подключено (red) — testResult === 'error'
    - ⚪ Не проверено (gray) — never tested
  - Added badges to SMTP, IMAP, and AI sections
  - Updated test handlers to invalidate queries after testing

## Verification
- `bun run lint`: Clean pass
- Dev server: Running with no runtime errors
- Database schema synced with `bun run db:push`
