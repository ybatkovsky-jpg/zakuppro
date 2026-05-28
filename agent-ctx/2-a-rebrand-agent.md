# Task 2-a: Rebrand from ЗакупПро to ПРОМЕБЕЛЬ

## Summary
Rebranded the entire application from "ЗакупПро" to "ПРОМЕБЕЛЬ" with company logo integration.

## Changes Made

### 1. Logo Setup
- Copied `/home/z/my-project/upload/pro mebel.png` to `/home/z/my-project/public/logo.png`
- Updated `layout.tsx` favicon to use `/logo.png` instead of external CDN URL

### 2. Sidebar (`src/components/app/app-sidebar.tsx`)
- Replaced `Package` icon import with `Image` from `next/image`
- Replaced the Package icon in sidebar header with actual logo image (`<Image src="/logo.png">`)
- Logo rendered as 32x32px (`h-8 w-8`) in a `rounded-lg` container with white background
- Changed brand name from "ЗакупПро" to "ПРОМЕБЕЛЬ"
- Changed subtitle from "Управление закупками" to "Управление закупками мебели"
- Updated footer version badge from "ЗакупПро v2.0" to "ПРОМЕБЕЛЬ v3.0"

### 3. Dashboard (`src/components/app/dashboard.tsx`)
- Changed brand name from "ЗакупПро" to "ПРОМЕБЕЛЬ" in the welcome section header

### 4. Page Title (`src/app/page.tsx`)
- Changed fallback title from "ЗакупПро" to "ПРОМЕБЕЛЬ"

### 5. Root Layout (`src/app/layout.tsx`)
- Title: "ЗакупПро — Управление закупками" → "ПРОМЕБЕЛЬ — Управление закупками мебели"
- Description: Added "мебели" to the description
- Authors: "ЗакупПро" → "ПРОМЕБЕЛЬ"
- OpenGraph title: "ЗакупПро" → "ПРОМЕБЕЛЬ"
- OpenGraph description: Added "мебели"
- Icons: Changed from CDN URL to `/logo.png`

### 6. Settings (`src/components/app/settings.tsx`)
- No "ЗакупПро" references found — no changes needed

### 7. Source Code Search
- Verified zero remaining "ЗакупПро" occurrences in `/home/z/my-project/src/` after all changes

## Verification
- `bun run lint`: Clean pass (no errors)
- Dev server: Running with no runtime errors
- All API endpoints returning 200

## Files Modified
- `/home/z/my-project/public/logo.png` — New file (copied from upload)
- `/home/z/my-project/src/components/app/app-sidebar.tsx` — Brand name, logo, subtitle, version
- `/home/z/my-project/src/components/app/dashboard.tsx` — Brand name
- `/home/z/my-project/src/app/page.tsx` — Fallback title
- `/home/z/my-project/src/app/layout.tsx` — Metadata, favicon, brand name
