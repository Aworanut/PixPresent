# FaceFind Design System Spec — Luxury Minimalism & High-End Editorial
*Inspired by high-end fashion and wedding digital magazines (e.g., Vogue Weddings).*

This document defines the custom **Bilingual Design System** developed specifically for the **FaceFind AI Photo Retrieval Platform**. It focuses on generous breathing space, typography-first hierarchy, hairline visuals, and a timeless neutral color palette to avoid standard generic AI aesthetics.

---

## 1. Typography (Bilingual Editorial Stack)
Traditional western fonts do not support Thai characters, causing browsers to fall back to generic system fonts (like Thonburi), which breaks the luxury aesthetic. To maintain a consistent, premium magazine feel across languages, we utilize an elegant **Bilingual Heading Separation Stack** paired with a highly clean loopless body copy.

### 1.1 Bilingual Heading Separation Rule (การแยกฟอนต์หัวข้อสองภาษา)
To achieve a high-fashion, editorial wedding digital magazine feel, English headings and Thai headings are handled by two distinct typefaces:
*   **English Headings:** Always rendered in **Cormorant Garamond** (Light, elegant, thin classical serif curves).
*   **Thai Headings:** Renders in the active Thai font variable (`Kanit`, `Sao Chingcha`, or `Charmonman`) depending on the selected event branding theme.
*   **Automated CSS Fallback Stack (Zero-JavaScript):** Rather than using complex JS splitters, use a pure CSS fallback stack. Because Cormorant Garamond has **no Thai glyphs**, Western characters render in the serif, while Thai characters naturally fall back and render in the dynamic Thai font:
    ```css
    font-family: 'Cormorant Garamond', var(--font-serif-thai), serif !important;
    ```

### 1.2 Heading Style Options (ตัวเลือกอักษรหัวข้อหลักภาษาไทย)
To suit different event atmospheres (e.g. minimalist modern vs heritage vs romance), FaceFind supports three distinct, highly-differentiated heading tracks:

*   **Option A: Kanit (คณิท) — Loopless Geometric [DEFAULT / RECOMMENDED]**
    *   *Specification:* `Kanit Regular (400)` for large editorial titles, `Kanit Bold (700)` for micro-emphasis or buttons.
    *   *Design Rationale:* Geometric, loopless, and modern. Perfectly aligns with high-end tech SaaS platforms and contemporary fashion-forward Vogue weddings. Provides high legibility and plenty of breathing space (Negative Space). Completely replaces Chonburi as the premium contemporary display track.
    
*   **Option B: Sao Chingcha (เสาชิงช้า) — Traditional High Thai Heritage**
    *   *Specification:* `SaoChingcha Regular (400)` or `SaoChingcha Bold (700)` loaded from local assets (`public/fonts/`).
    *   *Design Rationale:* Derived from BMA's Naris signature lettering (derived from Prince Naris' royal calligraphy). Exquisitely elegant, calligraphic, and prestigious. Renders with beautiful organic ribbon curves and high stroke contrast. Excellent for highly official or prestigious traditional Thai wedding functions, but gives a more conservative/heritage vibe than a modern SaaS feel.

*   **Option C: Charmonman (ชามอนมาน) — Luxury Script Calligraphy**
    *   *Specification:* `Charmonman` (Regular 400 or Bold 700) loaded from Google Fonts.
    *   *Design Rationale:* Inspired by Zapfino's classical Western copperplate script calligraphy. Renders with tall, elegant ascenders, sweeping swashes, and organic handwriting pen flows. Extremely romantic, cozy, and artisanal. Best for intimate digital wedding albums and high-end personal memory folders where emotion and handcrafted romance are central.

### 1.3 Body Text (Geometric Loopless Sans-Serif)
*   **Thai & English:** `IBM Plex Sans Thai` (Loopless / ไม่มีหัว - Regular 400 & Light 300)
*   **Alternative Options:** `Prompt` or `Anuphan` (Loopless)
*   **Design Rationale:** Loopless (sans-serif) Thai fonts align beautifully with geometric western typefaces, giving body text a clean, international, and upscale brand appearance that reads perfectly on mobile displays.
*   **Styling Rules:**
    *   `letter-spacing: -0.015em` for tight, clean editorial alignment.
    *   Muted text opacity (`opacity-60`) for description elements to create hierarchical depth.

### 1.4 Thai Letter-Spacing Stack Rule (ป้องกันปัญหาสระลอย/วรรณยุกต์แยก)
*   **The Problem (ปัญหาสระลอย/สระแยกตัว):** ในไทโพกราฟีภาษาไทย การใช้ระยะห่างตัวอักษรที่กว้างมาก (เช่น `letter-spacing: 0.25em` หรือคลาส `tracking-widest`/`tracking-mega` ใน Tailwind) จะทำให้เว็บบราวเซอร์แยกองค์ประกอบของพยัญชนะไทย สระบน (ิ, ี, ึ, ื), สระล่าง (ุ, ู) และวรรณยุกต์ (่, ้, ๊, ๋, ์) ออกห่างจากตัวพยัญชนะหลัก เกิดช่องว่างลอยกลางอากาศและบิดเบือนการแสดงผลอย่างรุนแรง
*   **The Resolution (แนวทางแก้ไข):** เมื่อระบบเปลี่ยนหน้าจอแสดงผลเป็นภาษาไทย ระบบดีไซน์จะต้องทำการ **รีเซ็ตสเปซซิ่งอักษรให้กลับมาปกติทันที** โดยใช้การผูกคุณสมบัติ CSS กับแอตทริบิวต์ภาษาของเบราว์เซอร์ (`html[lang="th"]`) เพื่อดึงสระและวรรณยุกต์ให้กลับมาเรียงซ้อนแนวตั้งตรงกับพยัญชนะต้นอย่างสมบูรณ์แบบ:
    ```css
    html[lang="th"] [data-i18n],
    html[lang="th"] .tracking-widest,
    html[lang="th"] .tracking-mega {
      letter-spacing: -0.01em !important;
    }
    ```

---

## 2. Timeless Color System (Cream & Obsidian)
Avoid heavy colorful gradients. Use curated, warm neutral tones to convey luxury and comfort.

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
* **Rules of Use:** Use **sparingly** and **only** for interactive indicators (e.g. active file drops, scanning lines, focus borders, active link pills). Do not use for large background blocks or standard buttons.

---

## 3. Visual Layout Guidelines
To stand out from basic cards and rigid columns, adhere to these layout rules:

### 3.1 Hairline Aesthetics (Ultra-Thin Borders)
* **Rule:** Use `1px` thin borders with soft opacities (`border-charcoal/10` or `border-champagne/30`) instead of heavy shadows or rounded panels.
* **Border Radius:** Keep corners sharp or very slightly rounded (`rounded-none` or custom `0.25rem` max). Luxury branding relies on clean, architectural corners.

### 3.2 Asymmetric Masonry Grid
* **Rule:** Avoid rigid grids. For experiential photo galleries, utilize CSS Multi-column layout with staggered vertical elements to create dynamic visual breathing rooms:
  ```css
  .gallery {
    columns: 4 250px;
    column-gap: 1.5rem;
  }
  .gallery > * {
    break-inside: avoid;
    margin-bottom: 1.5rem;
  }
  ```

### 3.3 Typographic SaaS Steps (No Cards)
* **Rule:** Explain workflows using raw typographic columns rather than containers:
  * Large numbers (`01`, `02`, `03`) in light champagne.
  * Simple border-t dividers.
  * Clean, geometric text layout with generous whitespace.

---

## 4. Interactive Micro-Animation Specs

### 4.1 Face Upload & Scanner Line
* **State 1 (Idle):** Minimalist gold-dotted outline box, hover triggers scale transformations (`scale-105`) of the interior gold upload circle.
* **State 2 (Scanning):** Renders preview image and sweeps a horizontal gold laser line (with a subtle blur and gold shadow) from top to bottom continuously:
  ```css
  @keyframes scanSweep {
    0% { top: 0%; opacity: 0; }
    10% { opacity: 0.8; }
    90% { opacity: 0.8; }
    100% { top: 100%; opacity: 0; }
  }
  .scanner-line {
    position: absolute;
    width: 100%;
    height: 3px;
    background: linear-gradient(90deg, transparent, #D4AF37, transparent);
    box-shadow: 0 0 8px #D4AF37;
  }
  ```

### 4.2 Selective Gallery Match Highlighting
* **Interaction:** When a profile face is analyzed, highlight matching frames with a subtle gold hairline outline and a top-right `Matched Photo` badge.
* **Dramatic Dimming:** Dim all non-matching gallery assets simultaneously to `opacity-30` and apply `grayscale` to draw immediate, premium visual focus to matching memories.

### 4.3 Minimal Contact Form Inputs
* **Interaction:** Input elements should have bottom borders only (`border-b border-charcoal/20`). Focus moves active gold highlights (`border-champagne`) smoothly via standard transitions:
  ```css
  .luxury-input {
    background: transparent;
    border-bottom: 1px solid rgba(17, 17, 17, 0.2);
    transition: all 0.4s ease;
  }
  .luxury-input:focus {
    outline: none;
    border-bottom: 1px solid #D4AF37;
  }
  ```

---

## 5. Standalone Design Reference File
We have built a fully interactive prototype showcasing this design system under:
* **Reference Prototype File:** [facefind_landing.html](file:///Users/nuk/Pixture/facefind_landing.html)
* **Prototyping Features included:** Sun/Moon Dark Mode Toggle, `[ EN | TH ]` dynamic language switcher, Drag & Drop biometric uploads, scanning sweeps, and asymmetric gallery photo dimmer overrides.
