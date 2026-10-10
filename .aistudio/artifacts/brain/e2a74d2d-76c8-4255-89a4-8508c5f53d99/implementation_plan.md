# Staff ID Card Profile Modal & Floating Hub Button Removal

Streamline Official Hub navigation and refine the Staff Profile modal into an authentic Vertical Badge ID Card:
1. **Remove Floating Hub Switcher**: Eliminate the floating bottom-corner "Official Hub" button (`#hub-floating-switcher`) across `collection.html`, `admin.html`, and `result.html`.
2. **Remove Profile from Welcome Banner**: Keep the Staff Profile trigger exclusively in the top header (`#official-my-profile-btn`), removing the duplicate button from the welcome banner in `official.html`.
3. **Vertical Badge ID Card Design**: Redesign the Profile modal into an authentic vertical physical ID card badge (`max-w-sm` / `w-[360px]`) displaying institution header, staff photo (or clean blank frame if absent), bold staff name, designation, phone, email, and department access.

## User Review & Critical Decisions

> [!IMPORTANT]
> - **Confirmed Decision 1 (ID Card Layout)**: Vertical badge ID card format with institution header band, badge slot, staff portrait, clean typographic hierarchy, and credentials grid.
> - **Confirmed Decision 2 (Highlighted Details)**: Staff photo, full name, designation/role, phone number, email address, staff key/ID, and department permissions.
> - **Confirmed Decision 3 (Photo Handling)**: If a photo is uploaded, display it crisply with rounded frame; if no photo is available, keep the photo frame clean and blank (empty avatar silhouette/initials, without falling back to institution logo).

---

### 1. Overview & Core Concept

- **What It Does**:
  - Cleans up the UI on Collection, Admin, and Result portals by removing the persistent bottom-right floating switcher button.
  - In `official.html`, eliminates the redundant "Staff Profile" button inside the welcome hero, making the header account button the single, unified profile entry point.
  - Clicking "Staff Profile" in the header presents a compact, elegant Vertical ID Card modal instead of a generic wide stretched-out dialog.

---

### 2. User Experience & Visual Design

#### A. Floating Switcher Cleanup
- `scripts/shared/hub-navigation.js`: Remove `#hub-floating-switcher` creation entirely. Top-bar navigation back to Official Hub remains cleanly in the header where appropriate.

#### B. Official Welcome Section
- The Welcome Hero retains:
  - Institution badge
  - Welcome greeting: `"Welcome, [Staff Name]"`
  - Role description
- The duplicate `"Staff Profile"` button is removed, leaving a clean, uncluttered banner.

#### C. Vertical Badge ID Card Modal
- **Container**: `max-w-sm w-full mx-auto rounded-3xl overflow-hidden shadow-2xl bg-white border border-slate-200`
- **Visual Anatomy**:
  - **Lanyard Slot / Clip Bar**: Realistic badge slot cutout at the top.
  - **Header Band**: Institution primary color gradient with Institution Logo, Name, and Reg No.
  - **Portrait Photo**:
    - With photo: Crisp `w-28 h-28` rounded-2xl object-cover with subtle border and shadow.
    - Without photo: Clean blank avatar silhouette with initials (no institution logo fallback).
  - **Identity Block**:
    - Full Name in high-contrast bold typography (`text-xl font-black text-slate-900`).
    - Role / Designation pill (e.g. `Teacher`, `Administrator`, `Treasurer`).
  - **Credentials Grid**:
    - Phone / Mobile
    - Email address
    - Assigned Classes / Duty Details (if applicable)
    - Authorized Department Permissions (Fee Collection, Result, Admin)
  - **Card Footer**: Institution signature bar and Close button.

---

### 3. Key Product Decisions & Trade-Offs

- **Dedicated ID Card Modal vs. Reusing Generic Detail Modal**:
  - *Chosen Approach*: Replace the stretched `official-detail-dialog` implementation for profile with a dedicated compact ID card dialog (`id-badge-modal`) constrained to `max-w-sm` on both mobile and desktop.
  - *Why*: Prevents horizontal stretching and provides an authentic, printable ID card experience on any screen size.
- **Photo Fallback Fix**:
  - *Chosen Approach*: When a staff member does not have a photo, render a clean blank silhouette placeholder instead of `onerror="this.src='logo.png'"`, ensuring accuracy according to user requirements.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    scripts/shared/hub-navigation.js         │
│   - Remove #hub-floating-switcher creation                  │
│   - Retain optional topbar nav link safely                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              scripts/pages/official-shared-bootstrap.js     │
│   1. Welcome Banner: Remove #hub-profile-quick button       │
│   2. openMyProfileModal(): Render Vertical Badge ID Card    │
│      - Institution Header + Logo                            │
│      - Crisp Photo OR Clean Blank Silhouette Frame          │
│      - Name, Designation, Phone, Email, Access Badges       │
└─────────────────────────────────────────────────────────────┘
```

#### Files to Update:
1. `scripts/shared/hub-navigation.js`:
   - Remove floating quick-switcher code.
2. `scripts/pages/official-shared-bootstrap.js`:
   - Remove `#hub-profile-quick` from dashboard welcome banner.
   - Refactor `openMyProfileModal()` to format profile as a Vertical Badge ID Card.
   - Update `openOfficialDetailModal` styling or create dedicated card dialog container.
3. Verification:
   - Run regression gate and applet compilation to verify.
