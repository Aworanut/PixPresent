# FaceFind Design System Spec — Luxury Minimalism & High-End Editorial
*Inspired by high-end fashion and wedding digital magazines (e.g., Vogue Weddings).*

This document defines the custom **Bilingual Design System** developed specifically for the **FaceFind AI Photo Retrieval Platform**. It focuses on generous breathing space, typography-first hierarchy, hairline visuals, and a timeless neutral color palette to avoid standard generic AI aesthetics.

The following B2C SaaS components have been officially chosen, validated, and locked in the Interactive Specimen Lab.

---

## 1. Typography (Bilingual Editorial Stack)
To maintain a consistent, premium magazine feel across languages, we utilize an elegant **Bilingual Heading Separation Stack** paired with a highly clean loopless body copy.

### 1.1 Bilingual Heading Separation Rule (การแยกฟอนต์หัวข้อสองภาษา)
English headings and Thai headings are handled by two distinct typefaces:
*   **English Headings:** Always rendered in **Cormorant Garamond** (Light, elegant, thin classical serif curves).
*   **Thai Headings:** Renders in the active Thai font variable (`Kanit`, `Sao Chingcha`, or `Charmonman`) depending on the selected event branding theme.
*   **Automated CSS Fallback Stack (Zero-JavaScript):** Because Cormorant Garamond has **no Thai glyphs**, Western characters render in the serif, while Thai characters naturally fall back and render in the dynamic Thai font:
    ```css
    font-family: 'Cormorant Garamond', var(--font-serif-thai), serif !important;
    ```

### 1.2 Heading Style Options (ตัวเลือกอักษรหัวข้อหลักภาษาไทย)
*   **Option A: Kanit (คณิท) — Loopless Geometric [DEFAULT / RECOMMENDED]**
    *   *Specification:* `Kanit Regular (400)` for large editorial titles, `Kanit Bold (700)` for micro-emphasis or buttons.
    *   *Design Rationale:* Geometric, loopless, and modern. Perfectly aligns with contemporary fashion-forward Vogue weddings. Completely replaces Chonburi as the display track.
    
*   **Option B: Sao Chingcha (เสาชิงช้า) — Traditional High Thai Heritage**
    *   *Specification:* `SaoChingcha Regular (400)` or `SaoChingcha Bold (700)` loaded from local assets (`public/fonts/`).
    *   *Design Rationale:* Derived from BMA's Naris signature lettering (royal calligraphy). Renders with beautiful organic ribbon curves and high stroke contrast. Excellent for highly official or prestigious traditional Thai wedding functions.

*   **Option C: Charmonman (ชามอนมาน) — Luxury Script Calligraphy**
    *   *Specification:* `Charmonman` loaded from Google Fonts.
    *   *Design Rationale:* Tall, elegant ascenders, sweeping swashes, and organic handwriting pen flows. Best for intimate digital wedding albums and high-end personal folders.

### 1.3 Body Text (Geometric Loopless Sans-Serif)
*   **Thai & English:** `IBM Plex Sans Thai` (Loopless / ไม่มีหัว - Regular 400 & Light 300)
*   **Design Rationale:** Loopless (sans-serif) Thai fonts align beautifully with geometric western typefaces, giving body text a clean, international, and upscale brand appearance that reads perfectly on mobile displays.
*   **Styling Rules:**
    *   `letter-spacing: -0.015em` for tight, clean editorial alignment.
    *   Muted text opacity (`opacity-60`) for description elements to create hierarchical depth.

### 1.4 Thai Letter-Spacing Stack Rule (ป้องกันปัญหาสระลอย/วรรณยุกต์แยก)
*   **The Problem (ปัญหาสระลอย/สระแยกตัว):** การใช้ระยะห่างตัวอักษรที่กว้างมาก (เช่น `letter-spacing: 0.25em` หรือ `tracking-widest` ใน Tailwind) บนภาษาไทยจะทำให้เว็บบราวเซอร์แยกสระบน สระล่าง และวรรณยุกต์ออกห่างจากพยัญชนะตัวหลัก
*   **The Resolution (แนวทางแก้ไข):** ทำการรีเซ็ตสเปซซิ่งอักษรภาษาไทยกลับมาปกติโดยผูก CSS กับแอตทริบิวต์ภาษาของเบราว์เซอร์ (`html[lang="th"]`):
    ```css
    html[lang="th"] [data-i18n],
    html[lang="th"] .tracking-widest,
    html[lang="th"] .tracking-mega {
      letter-spacing: -0.01em !important;
    }
    ```

---

## 2. Timeless Color System (Cream & Obsidian)
Avoid heavy colorful gradients. Use curated, warm neutral tones to convey luxury.

### 2.1 Default Theme (Light Cream)
* **Background:** Soft Cream / Off-White (`#FBF9F6`)
* **Foreground / Default Text:** Deep Charcoal (`#111111`)
* **Border Lines:** Hairline borders (`rgba(17, 17, 17, 0.1)`)
* **Selection Highlight:** Soft champagne-light (`#F5EEDC`)

### 2.2 Dark Theme (Obsidian Charcoal)
* **Background:** Deep Charcoal / Obsidian (`#111111`)
* **Foreground / Default Text:** Soft Warm Cream (`#FBF9F6`)
* **Border Lines:** Thin hairline outlines (`rgba(251, 249, 246, 0.1)`)
* **Selection Highlight:** Muted zinc-800 (`#27272A`)

### 2.3 Muted Accent Color (Champagne Gold)
* **Hex Code:** `#D4AF37`
* **Rules of Use:** Use **sparingly** and **only** for interactive indicators (e.g. active file drops, scanning lines, focus borders, active link pills).

---

## 3. Component Specimen Tokens (Locked Components)

### 3.1 Primary & Secondary Buttons — [LOCKED] Style 2: Minimalist Hairline
The B2C SaaS platform relies on 1px ultra-thin borders with champagne gold hover interactions for all main CTAs.
```css
/* Button Component Tokens */
:root {
  --cta-bg: transparent;
  --cta-text: #111111; /* Soft Warm Cream #FBF9F6 in dark mode */
  --cta-border: rgba(17, 17, 17, 0.3);
  --cta-hover-border: #D4AF37;
  --cta-hover-bg: rgba(212, 175, 55, 0.08);
}

.cta-button {
  background-color: var(--cta-bg);
  border: 1px solid var(--cta-border);
  color: var(--cta-text);
  font-family: monospace;
  letter-spacing: 0.125em;
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.cta-button:hover {
  border-color: var(--cta-hover-border);
  background-color: var(--cta-hover-bg);
  box-shadow: 0 0 10px rgba(212, 175, 55, 0.2);
}
```

### 3.2 Skeleton Card Loader — [LOCKED] Style 1: Golden Shimmer
The photo gallery skeleton state uses a soft left-to-right gold-champagne shimmering gradient to indicate loading.
```css
/* Skeleton Shimmer CSS */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton-card {
  background: linear-gradient(90deg, #F5F3ED 25%, #EFEBE0 50%, #F5F3ED 75%);
  background-size: 200% 100%;
  animation: shimmer 1.6s infinite linear;
}
html.dark .skeleton-card {
  background: linear-gradient(90deg, #1A1A1A 25%, #27272A 50%, #1A1A1A 75%);
}
```

### 3.3 Form Inputs — [LOCKED] Style 1: Bottom Hairline
Inputs are defined with elegant bottom-border lines, moving to bright champagne gold on focus, and featuring Emerald or Crimson signal dots on validation.
```css
/* Input Form Component Tokens */
.luxury-input {
  background: transparent;
  border-bottom: 1px solid rgba(17, 17, 17, 0.2);
  transition: border-bottom-color 0.4s ease;
}
html.dark .luxury-input {
  border-bottom-color: rgba(251, 249, 246, 0.2);
}
.luxury-input:focus {
  outline: none;
  border-bottom-color: #D4AF37;
}

/* Prestige Alternative — Style 3: Double Bottom Focus (4px double) */
.luxury-input-double:focus {
  outline: none;
  border-bottom: 4px double #D4AF37 !important; /* Two clean parallel 1px gold lines */
  padding-bottom: 4px;
}
```

### 3.4 Status Toasts — [LOCKED] Style 3: Center-Top Gold-Bordered White Banner
Toasts slide down from the center-top under the header, featuring a clean white background, dark text, and gold borders.
```css
/* Center-Top Status Toast Tokens */
@keyframes slideDownCenter {
  from { transform: translate(-50%, -100%); opacity: 0; }
  to { transform: translate(-50%, 0); opacity: 1; }
}
.toast-top-banner {
  position: fixed;
  top: 6.5rem; /* Just below header */
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  background-color: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(212, 175, 55, 0.3); /* Gold border */
  color: #111111; /* Dark text */
  padding: 1rem 1.5rem;
  box-shadow: 0 10px 30px rgba(0,0,0,0.08);
  width: 90%;
  max-width: 500px;
  animation: slideDownCenter 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
```

### 3.5 Photo Lightbox Viewport — [LOCKED] Theme 1: Luxury Blur
Opening gallery photos activates a full-screen backdrop overlay with blurred aesthetics, locking body scrollbars stably to prevent page layout jumps.
```css
/* Lightbox Overlay Tokens */
.photo-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 150;
  display: none; /* Block click tree when hidden */
  align-items: center;
  justify-content: center;
  opacity: 0;
  background-color: rgba(17, 17, 17, 0.88);
  backdrop-filter: blur(12px); /* Luxury backdrop blur */
  transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.photo-modal-overlay.active {
  display: flex;
  opacity: 1;
}
```

---

## 4. Icon System — Heroicons Outline Only

ห้ามใช้ emoji สำหรับ UI elements ทุกชนิด เพราะ emoji มีสีฝังอยู่และไม่ตอบสนองต่อ theme ของ design system

ใช้ **`@heroicons/react` v2 — outline variant เท่านั้น** ยกเว้น solid เมื่อต้องการ filled state เช่น active toggle

### 4.1 Import Convention

```tsx
// ✅ Correct — outline only
import { PhotoIcon, FolderIcon, TrashIcon } from "@heroicons/react/24/outline";

// ❌ Wrong — solid หรือ mini ไม่ใช้เป็นหลัก
import { PhotoIcon } from "@heroicons/react/24/solid";
```

### 4.2 Size Tokens

| Context | Class | px |
|---|---|---|
| Empty state hero | `h-12 w-12` | 48px |
| Section header | `h-6 w-6` | 24px |
| Inline with text / button | `h-4 w-4` | 16px |
| Small badge / chip | `h-3.5 w-3.5` | 14px |

### 4.3 Color Rules

- **Default:** `text-zinc-400 dark:text-zinc-500` — muted, ไม่แย่งสายตา
- **Empty state hero:** `text-zinc-300 dark:text-zinc-600` — เบาที่สุด
- **Interactive / active:** `text-zinc-700 dark:text-zinc-200`
- **Accent (sparingly):** `text-[#D4AF37]` — เฉพาะ active state หรือ highlight

ห้าม hardcode สีอื่นนอกจาก token ข้างต้น

### 4.4 Stroke Width

Heroicons outline v2 ใช้ `strokeWidth=1.5` เป็น default — ใช้ค่านี้เสมอ ห้ามเปลี่ยนเพราะตรงกับ hairline aesthetic ของ design system

### 4.5 Icon Map — Context to Icon

| Context | Icon | Import name |
|---|---|---|
| Empty photo gallery | ภาพถ่าย | `PhotoIcon` |
| No Drive folder | โฟลเดอร์ | `FolderIcon` |
| Not connected | ลิงก์ขาด | `LinkSlashIcon` |
| Delete | ถังขยะ | `TrashIcon` |
| Hide / ไม่เผยแพร่ | ตาปิด | `EyeSlashIcon` |
| Show / เผยแพร่ | ตาเปิด | `EyeIcon` |
| Public / เผยแพร่ทั้งหมด | โลก | `GlobeAltIcon` |
| Match only / ใบหน้าตรง | ผู้ใช้ | `UserIcon` |
| Face / ใบหน้า | หน้าคน | `FaceSmileIcon` |
| Search | แว่นขยาย | `MagnifyingGlassIcon` |
| Upload selfie | กล้อง | `CameraIcon` |
| Settings / Edit | ดินสอ | `PencilSquareIcon` |
| Close / ยกเลิก | กากบาท | `XMarkIcon` |
| Confirm / เลือก | checkmark | `CheckIcon` |
| Menu (⋮) | จุดสามจุด | `EllipsisVerticalIcon` |
| Warning | ระวัง | `ExclamationTriangleIcon` |
| Sync / Refresh | วนซ้ำ | `ArrowPathIcon` |
| Share link | ลิงก์ | `LinkIcon` |
| Copy | คัดลอก | `ClipboardDocumentIcon` |

### 4.6 EmptyState Component Pattern

```tsx
import { PhotoIcon } from "@heroicons/react/24/outline";
import { EmptyState } from "@/components/ui/empty-state";

// ส่ง icon เป็น component (ไม่ใช่ instance)
<EmptyState icon={PhotoIcon} message="ยังไม่มีรูปภาพ" />
```

Component จะ render icon ด้วย `h-12 w-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3` เสมอ — ไม่ต้อง style เอง
