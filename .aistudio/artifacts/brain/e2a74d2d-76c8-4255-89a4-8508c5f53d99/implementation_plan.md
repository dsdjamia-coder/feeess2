# Group Student Selection, Receipt Requirement UI, and Payment Mode Integration

Enhance the Master Fee Ledger and Collection page with:
1. **Vertical Student Selector for Family Groups**: In the shared fee modal, display a clean vertical list of individual students for family groups, all checked by default, allowing collectors to pay for the full group or select specific student(s) with dynamic automatic fee recalculation.
2. **Mandatory vs. Optional Receipt Numbering**: Display a red asterisk `*` and `(Mandatory)` label when receipt numbers are enforced by institution settings, strictly blocking submission without a receipt; display `(Optional)` when optional.
3. **Payment Mode in Fee Entry Tab**: Add a Payment Mode dropdown (Cash default, UPI, Bank Transfer, Cheque) directly adjacent to the Total Amount field in the main Entry tab (`#home`).

## User Review & Critical Decisions

> [!IMPORTANT]
> - **Confirmed Decision 1 (Fee Calculation)**: When individual students are checked/unchecked in a family group, the fee amount will dynamically recalculate based on the per-student fee rates.
> - **Confirmed Decision 2 (Payment Mode Choices)**: The Entry tab Payment Mode selector will support `Cash` (default), `UPI / GPay / PhonePe`, `Bank Transfer`, and `Cheque`.
> - **Confirmed Decision 3 (Receipt Enforcement)**: When receipt numbering is mandatory in settings, the red asterisk will appear and submission will be blocked until a valid receipt is entered. When optional, it will display `(Optional)`.

---

### 1. Overview & Core Concept

- **What It Does**:
  - In **Master Fee Ledger**, clicking an unpaid month cell for a sibling/family group opens the fee modal showing all children listed vertically with checkboxes (checked by default). The collector can keep all selected or check only the specific child (e.g. paying for one sibling this week and the other next week). The fee amount automatically recalculates based on selection.
  - The receipt input dynamically indicates whether receipt numbers are `(Mandatory)` with a red star `*` or `(Optional)`.
  - In the **Fee Entry Tab** (`#home`), a dedicated Payment Mode dropdown next to Total Amount allows specifying payment method (Cash, UPI, Bank Transfer, Cheque), persisting it across transactions.

---

### 2. User Experience & Visual Design

#### A. Master Fee Ledger Group Student Selection (Modal)
- Replaces static radio buttons with an interactive vertical list of student cards:
  - Each item: Checkbox + Student Name + Class Badge + Adm No + Student Fee (₹).
  - "Select All" / "Deselect All" quick toggles.
  - Live summary: e.g. "Selected: 2 of 3 students (₹400 total)".
  - Dynamic amount sync: Changing selections updates `#ledger-pay-amount` instantly.
  - Validation: At least one student must be checked; otherwise, submit button disables with helpful guidance.

#### B. Dynamic Receipt Requirement UI
- Modal inspects `window.defaultReceiptMandatory`.
- If mandatory:
  - Label: `Receipt No <span class="text-red-500 font-bold">*</span> <span class="text-rose-600 font-semibold text-[10px]">(Mandatory)</span>`
  - Submitting without receipt triggers an inline validation alert and blocks saving.
- If optional:
  - Label: `Receipt No <span class="text-slate-400 font-normal text-[10px]">(Optional)</span>`
  - Submitting without receipt is permitted and auto-generates or leaves clean.

#### C. Payment Mode in Entry Tab (`#home`)
- Positioned alongside `Total Amount (₹)` in the action section:
  ```
  ┌───────────────────────┬───────────────────────────┬──────────────────────┐
  │ Total Amount (₹)      │ Payment Mode              │ [ Save Fee Payment ] │
  │ [   ₹400            ] │ [ Cash ▼                ] │                      │
  └───────────────────────┴───────────────────────────┴──────────────────────┘
  ```
- Options:
  - `Cash` (Default)
  - `UPI / GPay / PhonePe`
  - `Bank Transfer`
  - `Cheque`
- Integrated into confirmation popup and stored in Firestore payment documents (`paymentMode`).

---

### 3. Key Product Decisions & Trade-Offs

- **Dynamic Group Pay vs Individual Pay in Ledger**:
  - *Chosen Approach*: When a single student is selected from a group, save the payment targeted specifically to that student (`studentId`, `studentName`, `studentClass`). When multiple are selected, save either as a consolidated group payment or split entries linked by `transactionId` and `billingGroupId`.
  - *Why*: Allows flexible partial-family payments while keeping financial tracking and receipts accurate.
- **Form Cohesion**:
  - *Chosen Approach*: Put Payment Mode next to Total Amount in `#home` so collectors make amount and tender choices at the same decision step before saving.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Master Fee Ledger Group Pay Flow                      │
│                                                                             │
│  [Click Month Cell] ──► [openFeeEntryEditModal]                             │
│                                │                                            │
│                                ▼                                            │
│                 Render Vertical Student Checkboxes                          │
│                 [x] 1. Muhammed Fayis (Class 6) - ₹200                      │
│                 [x] 2. Fatima Hiba   (Class 4) - ₹200                      │
│                                │                                            │
│                 Toggle ──► Recalculate #ledger-pay-amount                   │
│                                │                                            │
│  [Check Mandatory Setting] ──► Set Red Star (*) + Enforce Input             │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Entry Tab (#home) Flow                             │
│                                                                             │
│  [Total Amount: ₹400] + [Payment Mode: Cash ▼]                              │
│                                │                                            │
│                                ▼                                            │
│  [processPaymentSubmit] ──► Include paymentMode in payload & batch write    │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Files to Update:
1. `collection.html`:
   - Redesign `#ledger-pay-group-scope-wrap` into vertical student list container (`#ledger-pay-group-students-list`).
   - Add `#entry-payment-mode` select in Entry tab alongside `#total-amount`.
   - Update receipt label elements to support dynamic mandatory/optional badges.
2. `scripts/pages/collection/shared-fee-modal.js`:
   - Render vertical students list with checkboxes when `unit.isGroup` is true.
   - Attach change listeners on checkboxes to auto-recalculate total fee.
   - Check `window.defaultReceiptMandatory` to update red star and `(Mandatory)`/`(Optional)` badge.
   - Enforce receipt number validation when mandatory.
   - Target selected students in `submitFeeEntryPayment`.
3. `scripts/pages/collection-page.js`:
   - Read `#entry-payment-mode` in `processPaymentSubmit`.
   - Include `paymentMode` in payment payload.
   - Display Payment Mode in payment confirmation modal.
   - Sync `entry-payment-mode` when editing an existing payment.
