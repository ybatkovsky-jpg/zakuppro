# S02: Kanban Drag-and-Drop — UAT

**Milestone:** M005
**Written:** 2026-06-03T04:34:33.900Z

# S02 UAT: Kanban Drag-and-Drop

## UAT Type
Integration & End-to-End Functional Testing

---

## Test Case 1: Valid Status Transition (Forward)

**Preconditions:**
- Application running at http://localhost:3000
- At least one project exists in status "Новые" (new)
- User authenticated with appropriate permissions

**Steps:**
1. Navigate to Projects page
2. Locate a project card in the "Новые" column
3. Click and hold the GripVertical drag handle
4. Drag the card toward the "В обработке" (processing) column
5. Observe visual feedback during drag:
   - Card opacity reduces to 50%
   - Ghost preview appears at cursor
   - Target column highlights with ring
6. Drop the card in the "В обработке" column

**Expected Outcomes:**
- ✅ Card moves to target column visually
- ✅ Success toast notification appears
- ✅ Project status updates in PostgreSQL via FastAPI
- ✅ Card remains in new position after page refresh

**Not Proven By This UAT:** 
Database persistence verification requires backend query or page refresh confirmation.

---

## Test Case 2: Invalid Status Transition (Blocked)

**Preconditions:**
- Application running at http://localhost:3000
- At least one project exists in status "Завершен" (completed)

**Steps:**
1. Navigate to Projects page
2. Locate a project card in the "Завершен" column
3. Attempt to drag the card to "Новые" column

**Expected Outcomes:**
- ✅ Drag starts normally (card becomes draggable)
- ✅ Drop is rejected or visual feedback indicates invalid target
- ✅ Error toast notification: "Invalid transition"
- ✅ Card returns to original column
- ✅ No API call made for invalid transition

**Not Proven By This UAT:**
Backend rejection of invalid transitions (client-side validation may block before API call).

---

## Test Case 3: Touch Device Mobile Support

**Preconditions:**
- Application accessed via touch device (tablet/mobile)
- Touch event simulation available

**Steps:**
1. Long-press (250ms+) on a project card drag handle
2. Drag card to different column
3. Release to drop

**Expected Outcomes:**
- ✅ Long-press initiates drag (not scroll)
- ✅ Card moves between columns on touch
- ✅ Visual feedback matches desktop experience
- ✅ Status updates persist

**Not Proven By This UAT:**
Physical device testing on iOS/Android browsers.

---

## Test Case 4: API Error Handling

**Preconditions:**
- Backend server unreachable or returning errors
- Project exists for drag operation

**Steps:**
1. Simulate network error (disconnect backend)
2. Attempt valid drag-and-drop status change
3. Observe error handling

**Expected Outcomes:**
- ✅ Error toast notification displayed
- ✅ Card returns to original column
- ✅ Console logs error details
- ✅ No data corruption in UI state

**Not Proven By This UAT:**
Retry logic for transient network failures.

---

## Test Case 5: React Query Cache Invalidation

**Preconditions:**
- Multiple projects displayed across columns
- Projects list query active

**Steps:**
1. Drag project from Column A to Column B
2. Verify immediate UI update
3. Check React Query devtools (if available)

**Expected Outcomes:**
- ✅ Card moves immediately in UI (optimistic update)
- ✅ ['projects'] query invalidated after successful mutation
- ✅ Fresh data fetched from backend
- ✅ All columns reflect accurate project counts

**Not Proven By This UAT:**
Cache invalidation timing with concurrent mutations.

---

## Edge Cases Covered

| Scenario | Expected Behavior |
|----------|-------------------|
| Drag outside column bounds | Card snaps back to origin |
| Rapid drag-drop sequence | Each mutation processes independently |
| Network latency during drop | Loading state, success toast on completion |
| Invalid transition from VALID_TRANSITIONS | Toast error, card returns, no API call |

---

## Manual Testing Checklist

- [ ] Valid transition: new → processing
- [ ] Valid transition: processing → requested
- [ ] Valid transition: requested → invoiced
- [ ] Valid transition: invoiced → paid
- [ ] Valid transition: paid → delivered
- [ ] Valid transition: delivered → completed
- [ ] Invalid transition: completed → new (blocked)
- [ ] Invalid transition: paid → new (blocked)
- [ ] Touch device: long-press drag works
- [ ] Visual feedback: opacity, highlight, ghost card
- [ ] Success toast appears on valid drop
- [ ] Error toast appears on invalid drop
- [ ] Card persists in new column after refresh
