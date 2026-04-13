# UDC Design Tokens — Scale Analysis & New Definitions

## Scale Factor: ×1.1 (compact → comfortable)

**Rationale**: The current UI targets ~375–390px phones well but feels tight on modern mid-size (390–430px) and large (430px+) devices. A ×1.1 factor provides a consistent, readable "comfortable" step without breaking proportions. All values rounded to nearest clean integer.

---

## 1. Global Style Constants (CS / LS / BP / BO / IS / PAGE)

| Token | Old | New |
|---|---|---|
| **CS** borderRadius | 16 | 18 |
| **CS** padding | 20 | 22 |
| **CS** border | 1px solid #f0f0f3 | 1px solid #f0f0f3 |
| **CS** boxShadow | 0 2px 8px rgba(0,0,0,0.04) | 0 2px 10px rgba(0,0,0,0.05) |
| **LS** fontSize | 13 | 14 |
| **LS** marginBottom | 6 | 7 |
| **BP** padding (vertical) | 14 | 16 |
| **BP** borderRadius | 12 | 14 |
| **BP** fontSize | 16 | 18 |
| **BO** padding | "10px 18px" | "11px 20px" |
| **BO** borderRadius | 10 | 11 |
| **BO** fontSize | 14 | 15 |
| **IS** padding | "12px 14px" | "13px 16px" |
| **IS** borderRadius | 10 | 11 |
| **IS** fontSize | 15 | 16 |
| **PAGE** padding | "20px 20px 100px" | "22px 22px 110px" |
| **PAGE** maxWidth | 500 | 560 |
| **App** maxWidth | 480 | 540 |

---

## 2. Typography Scale

| Role | Old (px) | New (px) | Usage |
|---|---|---|---|
| `text-3xs` | 10 | 11 | Badge text, tiny tag, production row sub |
| `text-2xs` | 11 | 12 | Meta info, timestamps, sub-labels, column headers |
| `text-xs` | 12 | 13 | Secondary body, dates, breakdown lines, input suffix |
| `text-sm` (LS) | 13 | 14 | Form labels, section sub-headers, small buttons |
| `text-base` | 14 | 15 | Default body, BO font, list title secondary |
| `text-md` | 15 | 16 | List titles, card names, IS font |
| `text-lg` (BP) | 16 | 18 | Primary button, section key value |
| `text-xl` | 18 | 20 | Revenue in list cards, inventory qty display |
| `text-2xl` | 20 | 22 | KPI card values (monthly salary/revenue) |
| `text-3xl` | 22 | 24 | Nav icon, large KPI |
| `text-4xl` | 26 | 28 | Large stat value (monthly sales count) |
| `text-5xl` | 28 | 32 | Office inventory stock numbers |
| `text-6xl` | 32 | 36 | Finance margin hero |
| `text-logo` | 42 | 48 | Login logo letter |

### Line-height (추가 — 현재 미설정)
| Token | Value | Usage |
|---|---|---|
| `leading-none` | 1 | —  |
| `leading-tight` | 1.25 | Large headings, stat numbers |
| `leading-snug` | 1.35 | Section labels, card titles |
| `leading-normal` | 1.5 | Body text, list items |
| `leading-relaxed` | 1.6 | Descriptions, help text |

### Letter-spacing (추가 — 현재 미설정)
| Token | Value | Usage |
|---|---|---|
| `tracking-tight` | -0.01em | Hero numbers (≥28px) |
| `tracking-normal` | 0em | Body text (기본) |
| `tracking-wide` | 0.04em | Uppercase small labels (e.g., "YYYY-MM 마진") |
| `tracking-wider` | 0.08em | Badge/chip text (≤12px) |

---

## 3. Spacing Scale (padding, margin, gap)

| Token | Old (px) | New (px) | Usage |
|---|---|---|---|
| `space-0.5` | 2 | 2 | Micro margin |
| `space-1` | 4 | 4 | Tiny (PIN dot gap, nav indicator) |
| `space-1.5` | 6 | 7 | Small chip/tag padding, filter gap, table cell pad |
| `space-2` | 8 | 9 | Row padding, badge padding, mini control pad |
| `space-2.5` | 10 | 11 | Nav button, section gap, modal inner |
| `space-3` | 12 | 13 | Grid gap (dashboard), header badge pad |
| `space-3.5` | 14 | 16 | Card inner section padding, form field horizontal |
| `space-4` | 16 | 18 | Grid gap (primary), header vertical, content sep |
| `space-4.5` | 18 | 20 | BO horizontal padding, card padding (small) |
| `space-5` | 20 | 22 | PAGE sides, CS default pad |
| `space-7` | 28 | 30 | Modal inner padding |
| `space-bottom-nav` | 100 | 110 | PAGE bottom (safe area + nav) |

---

## 4. Border Radius Scale

| Token | Old (px) | New (px) | Usage |
|---|---|---|---|
| `radius-xs` | 4 | 4 | Mini badge/tag, progress bar |
| `radius-sm` | 6 | 7 | Inline mini input (schedule grid) |
| `radius-md` | 8 | 9 | Info block bg, gauge segment, confirmation banner |
| `radius-input` | 10 | 11 | IS input, BO button |
| `radius-button` | 12 | 13 | BP primary button, Toast |
| `radius-card` | 16 | 18 | CS card |
| `radius-keypad` | 18 | 20 | Login keypad button |
| `radius-modal` | 20 | 22 | Modal sheet |
| `radius-logo` | 22 | 24 | Login logo container |

---

## 5. Height / Width Fixed Values

| Token | Old (px) | New (px) | Usage |
|---|---|---|---|
| `h-indicator` | 3 | 3 | Bottom nav active bar (keep thin) |
| `h-progress` | 10 | 11 | Progress bar |
| `h-pin-dot` | 16 | 18 | PIN dot circles |
| `h-badge` | 20 | 22 | Badge min-height |
| `h-gauge-block` | 28 | 30 | Gas gauge colored blocks |
| `h-adj-button` | 40 | 44 | ± inventory adjust button |
| `w-adj-button` | 28 | 30 | ± button width |
| `size-avatar-sm` | 44 | 48 | Employee avatar (admin report cards) |
| `size-fab` | 56 | 62 | Floating action button |
| `size-keypad` | 76 | 84 | Login keypad button (square) |
| `size-logo` | 88 | 96 | Login logo container |
| `h-bottom-nav` | ~88 | 96 | Bottom nav effective height |

---

## 6. Max-width Values

| Context | Old (px) | New (px) |
|---|---|---|
| App container | 480 | 540 |
| PAGE (scroll content) | 500 | 560 |
| Modal (inventory request) | 380 | 420 |
| Modal (production entry) | 420 | 460 |

---

## 7. Notes for Implementation

- All `Object.assign({}, CS, {...})` overrides that hard-code `padding: 14` → replace with `padding: 16` (new `space-3.5`)
- Toast `top: 72` → `top: 80` (header height scales accordingly)
- FAB `bottom: 88` → `bottom: 96` (nav height token)
- Login PIN dots: `gap: 12` → `gap: 14`; PIN keypad `gap: 12` → `gap: 14`
- Schedule grid: `gridTemplateColumns: "44px repeat(6, 80px)"` → `"48px repeat(6, 88px)"`, `minWidth: 530` → `minWidth: 580`
- Production list table header columns: maintain fr ratios, no change needed
- `letterSpacing: 1` (currently one raw value in finance section) → replace with `tracking-wide` token value = `"0.04em"`

---

## Summary Table (Key Token Map)

```js
// Suggested constants for fullstack-engineer to replace current CS/LS/BP/BO/IS/PAGE
var CS = {
  background: "#fff", borderRadius: 18, padding: 22,
  border: "1px solid #f0f0f3", marginBottom: 16,
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)"
};
var LS = { fontSize: 14, fontWeight: 600, color: "#71717a", marginBottom: 7, display: "block" };
var BP = { width: "100%", padding: 16, borderRadius: 14, border: "none", fontSize: 18, fontWeight: 700, cursor: "pointer", background: "#e1360a", color: "#fff" };
var BO = { padding: "11px 20px", borderRadius: 11, border: "1px solid #f0f0f3", fontSize: 15, fontWeight: 600, cursor: "pointer", background: "#fff", color: "#18181b" };
var IS = { width: "100%", padding: "13px 16px", borderRadius: 11, border: "1px solid #f0f0f3", fontSize: 16, fontWeight: 500, color: "#18181b", outline: "none", background: "#fafafa", boxSizing: "border-box" };
var PAGE = { padding: "22px 22px 110px", maxWidth: 560, margin: "0 auto" };
```
