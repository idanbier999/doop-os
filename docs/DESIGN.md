# Doop Design System

> The complete design language, visual identity, and component philosophy behind the Doop dashboard.

---

## Vision

Doop is an **AI agent fleet management dashboard** — a command center for monitoring, orchestrating, and debugging autonomous agents at scale. The design communicates one core idea: **serious infrastructure tooling wrapped in warmth and personality.**

We reject the cold, sterile dashboards that dominate DevOps. Instead, Doop draws from the **golden era of personal computing** — specifically the visual language of **classic Macintosh System 7 (1991)** — and fuses it with modern information density. The result is a tool that feels like a physical control room you'd actually want to sit in: precise, legible, and quietly delightful.

The vintage Mac aesthetic is not decoration. It signals that Doop treats AI agents as **real machines** deserving real craftsmanship — not as abstract cloud processes. Every window border, every pixel font label, every title bar says: "this is built with care."

---

## Tone

- **Precise, not cold.** Data-dense interfaces with clear hierarchy. No fluff.
- **Warm, not playful.** The retro aesthetic adds personality without undermining seriousness.
- **Honest, not alarming.** Status indicators are clear and semantic. Red means something.
- **Crafted, not over-designed.** Every element serves a purpose. No gradients for gradients' sake.

The voice is a calm engineer at a well-organized workstation — confident, unhurried, and in control.

---

## Color Palette

### Foundation

The base palette is built on **cool neutrals with warm undertones**, inspired by the beige/cream tones of vintage Macintosh hardware.

| Token               | Hex       | Role                                                                  |
| ------------------- | --------- | --------------------------------------------------------------------- |
| `mac-cream`         | `#EDEEF2` | Primary background — the "desk" everything sits on                    |
| `mac-white`         | `#FFFFFF` | Card/window surfaces                                                  |
| `mac-black`         | `#1A1A2E` | Primary text, strong borders. Not pure black — has a deep navy warmth |
| `mac-dark-gray`     | `#4A4E69` | Secondary text, shadow color                                          |
| `mac-gray`          | `#9CA3B0` | Disabled text, placeholders                                           |
| `mac-light-gray`    | `#DFE2E8` | Subtle backgrounds, table headers                                     |
| `mac-border`        | `#C5C9D4` | Standard border color                                                 |
| `mac-border-strong` | `#1A1A2E` | Emphasis borders (matches primary text)                               |

### Accent

| Token                 | Hex       | Role                                                  |
| --------------------- | --------- | ----------------------------------------------------- |
| `mac-highlight`       | `#0066FF` | Primary action color — links, active nav, focus rings |
| `mac-highlight-hover` | `#0052CC` | Hover state for primary actions                       |
| `mac-highlight-soft`  | `#E8F0FF` | Subtle hover backgrounds, selected rows               |
| `mac-highlight-text`  | `#FFFFFF` | Text on highlight backgrounds                         |

### Semantic Status Colors

These are the backbone of the dashboard. Every color has **one unambiguous meaning** across the entire system.

**Health:**

| Token             | Hex       | Meaning                                   |
| ----------------- | --------- | ----------------------------------------- |
| `health-healthy`  | `#00875A` | System operating normally                 |
| `health-degraded` | `#997A00` | Performance issues, needs attention       |
| `health-critical` | `#DE350B` | System failure, immediate action required |
| `health-offline`  | `#6B778C` | System unreachable or shut down           |

**Severity:**

| Token               | Hex       | Meaning                |
| ------------------- | --------- | ---------------------- |
| `severity-low`      | `#0065FF` | Informational          |
| `severity-medium`   | `#997A00` | Worth investigating    |
| `severity-high`     | `#FF8B00` | Needs prompt attention |
| `severity-critical` | `#DE350B` | Drop everything        |

**Agent Stage:**

| Token             | Hex       | Meaning                   |
| ----------------- | --------- | ------------------------- |
| `stage-idle`      | `#6B778C` | Waiting for work          |
| `stage-running`   | `#00875A` | Actively executing        |
| `stage-blocked`   | `#FF8B00` | Stuck, needs intervention |
| `stage-completed` | `#0065FF` | Finished successfully     |
| `stage-error`     | `#DE350B` | Failed                    |

**Task Status:**

| Token                     | Hex       | Meaning                                |
| ------------------------- | --------- | -------------------------------------- |
| `status-pending`          | `#6B778C` | Not started                            |
| `status-in-progress`      | `#0065FF` | Actively being worked on               |
| `status-waiting-on-agent` | `#8250DF` | Blocked on AI — the distinctive purple |
| `status-waiting-on-human` | `#BF8700` | Blocked on a person                    |
| `status-completed`        | `#00875A` | Done                                   |
| `status-cancelled`        | `#6B778C` | Abandoned                              |

**Priority:**

| Token               | Hex       | Meaning             |
| ------------------- | --------- | ------------------- |
| `priority-low`      | `#6B778C` | When you get to it  |
| `priority-medium`   | `#997A00` | Should be addressed |
| `priority-high`     | `#FF8B00` | Soon                |
| `priority-critical` | `#DE350B` | Now                 |

### Background

The page background is not flat — it uses a subtle radial gradient that creates depth without distraction:

```css
background: radial-gradient(ellipse at 50% 0%, #f5f6fa 0%, #edeef2 60%);
```

A slightly lighter center fading to cream at the edges. This creates the feeling of light falling on a physical surface.

### The Rainbow Bar (Logo)

The Doop logo mark is a small vertical rainbow gradient bar — a direct homage to the **Apple rainbow logo** from the classic Mac era:

```css
linear-gradient(to bottom, #61BB46, #FDB827, #F5821F, #E03A3E, #963D97, #009DDC)
```

Green → Yellow → Orange → Red → Purple → Blue. It's the visual anchor of the sidebar and the strongest signal of the brand's retro identity. Compact (12px wide, 20px tall), but unmistakable.

---

## Typography

Two fonts. No more. Each has a clear job.

### VT323 — The Interface Font

- **Source:** Google Fonts
- **Classification:** Monospace pixel font
- **Weight:** 400 only (bold applied via CSS `font-weight: bold`)
- **Used for:** Buttons, labels, nav items, table headers, badge text, title bars, sidebar, breadcrumbs, empty states — essentially **every piece of UI chrome**
- **Fallback:** `"Geneva", "Chicago", monospace`

VT323 is the soul of the Doop aesthetic. It's a pixel-perfect recreation of early terminal/CRT typography. Using it for all interface elements — but not body text — creates a layered effect: the UI frame feels like a physical machine, while the data within it reads cleanly.

This font is never used for paragraphs or long-form content. It is the voice of the **system**, not the user.

### Space Grotesk — The Content Font

- **Source:** Google Fonts
- **Weights:** 400 (regular), 500 (medium), 700 (bold)
- **Classification:** Geometric sans-serif
- **Used for:** Body text, data cells, descriptions, form inputs, paragraph content
- **Fallback:** `system-ui, sans-serif`

Space Grotesk is modern, geometric, and highly legible at small sizes. Its slightly technical character (the "Grotesk" family) pairs naturally with VT323 without clashing. It handles the dense data tables and agent descriptions that make up most of the dashboard's surface area.

### Type Scale

Text sizes are kept tight for information density:

| Use                | Size                     | Font             |
| ------------------ | ------------------------ | ---------------- |
| Title bar text     | 12px                     | VT323            |
| Breadcrumbs / meta | 10-11px                  | VT323            |
| Table headers      | `text-xs` (12px)         | VT323, uppercase |
| Badge labels       | `text-xs` (12px)         | VT323, bold      |
| Nav items          | `text-sm` (14px)         | VT323            |
| Buttons            | `text-sm` to `text-base` | VT323, bold      |
| Body text          | `text-sm` (14px)         | Space Grotesk    |
| Section headings   | `text-lg` to `text-2xl`  | VT323            |

### Rendering

```css
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
```

Antialiasing is enforced globally. VT323's pixel grid stays crisp; Space Grotesk's curves stay smooth.

---

## The Mac Window — Core Component Pattern

The defining visual element of Doop is the **Mac Window**. Every card, panel, modal, and data container uses this pattern. It's the atomic unit of the design system.

### Structure

```
┌─[×]──────── Window Title ──────────┐  ← Title bar (28px, gradient)
│                                     │  ← 1.5px solid #1A1A2E border
│            Content Area             │  ← White background, padded
│                                     │
└─────────────────────────────────────┘
  ↘ 1px hard offset shadow + 12px soft shadow
```

### Visual Properties

```css
.mac-window {
  border: 1.5px solid #1a1a2e;
  border-radius: 6px;
  background: #fff;
  box-shadow:
    1px 1px 0px #4a4e69,
    /* Hard 1px offset — retro depth */ 0px 4px 12px rgba(74, 78, 105, 0.12); /* Modern soft shadow */
}
```

The **dual shadow** is key. The 1px hard offset is a direct reference to classic Mac window rendering, where windows had a pixel-perfect drop shadow. The 12px blur softens it for modern screens. Together they create windows that feel like they're floating just above the surface — physical but not heavy.

### Title Bar

```css
.mac-title-bar {
  background: linear-gradient(to bottom, #ffffff 0%, #f0f1f4 100%);
  height: 28px;
  border-bottom: 1px solid #c5c9d4;
  border-radius: 6px 6px 0 0;
}
```

- Subtle top-to-bottom gradient (white → light gray) mimics the brushed-metal look of Mac OS title bars
- Title is **always centered**, using VT323 at 12px bold
- Left-aligned close button: a tiny 12×12px bordered square that turns `#0066FF` on hover

### Close Button

```css
.mac-close-box {
  width: 12px;
  height: 12px;
  border: 1px solid #1a1a2e;
  border-radius: 3px;
  background: #fff;
}
.mac-close-box:hover {
  background: #0066ff;
  border-color: #0066ff;
  transform: scale(1.1);
}
```

This is a simplified version of the classic Mac close box — a small square instead of the familiar macOS colored circles. The hover animation (color fill + slight scale) gives it life without breaking the retro feel.

---

## Component Patterns

### Buttons

Four variants, all sharing the same skeleton:

```
┌───────────────────┐
│   Button Label    │  ← VT323, bold
└───────────────────┘
   Border: 1px solid #1A1A2E
   Border-radius: 8px
```

| Variant       | Background        | Text            | Hover                 |
| ------------- | ----------------- | --------------- | --------------------- |
| **Primary**   | `#1A1A2E` (black) | White           | `#4A4E69` (dark gray) |
| **Secondary** | White             | `#1A1A2E`       | `#E8F0FF` (soft blue) |
| **Danger**    | White             | `#DE350B` (red) | Red bg, white text    |
| **Ghost**     | Transparent       | `#1A1A2E`       | `#E8F0FF`             |

Sizes: `sm` (compact), `md` (default), `lg` (prominent).

All buttons have a strong `#1A1A2E` border — this is deliberate. It anchors them as **physical controls**, not floating colored rectangles. The border is what makes them feel "pressable."

Focus state: `ring-2 ring-mac-highlight/50 ring-offset-1`.

### Badges

Badges are the primary status communication tool. They use a **left-border accent** pattern:

```
┌┃ Healthy ┐
└──────────┘
 ↑ 3px colored left border
```

- 1px standard border on all sides
- 3px left border in the semantic color
- Text also colored to match
- White background, VT323 bold at 12px
- `border-radius: 6px`

This pattern is used for health, severity, stage, status, and priority. The left-border accent is subtle enough to scan quickly in dense tables but colorful enough to read at a glance.

### Tables

Tables follow the Mac aesthetic with clear structure:

- **Header:** `#DFE2E8` background, uppercase VT323 labels, 2px bottom border
- **Rows:** Alternating cream/white stripes (`nth-child(even): bg-mac-cream`)
- **Hover:** `#E8F0FF` soft blue highlight
- **Cell borders:** 1px right border between columns (except last)
- **Wrapper:** Rounded 8px corners with 1px border

### Inputs

Inputs use an **inset shadow** to feel recessed into the surface:

```css
.mac-inset {
  border: 1px solid #c5c9d4;
  box-shadow: inset 0px 1px 2px rgba(74, 78, 105, 0.08);
  background: #fff;
}
```

This is a direct reference to the "sunken" text fields of classic Mac OS, where input areas appeared physically carved into the window surface.

### Modals

Modals are Mac Windows with extra gravitas:

- 2px border (thicker than cards)
- Glass overlay backdrop: `blur(8px)` + `rgba(26, 26, 46, 0.3)`
- Max-width: 512px
- Full-screen on mobile
- Same title bar pattern as cards

### Toasts

Toasts slide in from the right (`translate-x-full → translate-x-0`) and use the Mac Window pattern. The title bar background color signals severity:

| Type     | Title Bar Color    |
| -------- | ------------------ |
| Info     | `#0066FF` (blue)   |
| Warning  | `#FF8B00` (orange) |
| Critical | `#DE350B` (red)    |

Auto-dismiss after 5 seconds. The sliding animation uses `ease-out` for a natural deceleration feel.

---

## Glass & Transparency

Two glass effects create depth without visual noise:

### Glass Panel (Sidebar)

```css
backdrop-filter: blur(12px) saturate(1.2);
background: rgba(255, 255, 255, 0.75);
```

Used on the sidebar to let the page background subtly show through. The `saturate(1.2)` keeps colors vibrant behind the blur. This makes the sidebar feel like it's floating above the content — a separate layer of the interface.

### Glass Overlay (Modals)

```css
backdrop-filter: blur(8px);
background: rgba(26, 26, 46, 0.3);
```

A darker, less saturated blur that dims the page content behind modals. The deep navy tint (`#1A1A2E` at 30%) maintains the color identity even in the overlay.

---

## Shadows

Three shadow levels create a consistent depth system:

| Level      | CSS                                                         | Use                       |
| ---------- | ----------------------------------------------------------- | ------------------------- |
| **Window** | `1px 1px 0px #4A4E69, 0px 4px 12px rgba(74, 78, 105, 0.12)` | Cards, windows, modals    |
| **Inset**  | `inset 0px 1px 2px rgba(74, 78, 105, 0.08)`                 | Inputs, text fields       |
| **Press**  | `1px 1px 0px #000` → `none` on active                       | Retro button press effect |

The window shadow system (hard offset + soft blur) is used everywhere. It's the visual signature that makes Doop look like Doop.

---

## Spacing

Spacing follows Tailwind's 4px grid. Key conventions:

| Context            | Value   | Tailwind                  |
| ------------------ | ------- | ------------------------- |
| Card padding       | 16px    | `p-4`                     |
| Tight card padding | 12px    | `p-3`                     |
| Section gap        | 16px    | `gap-4`                   |
| Item gap           | 8-12px  | `gap-2` to `gap-3`        |
| Between sections   | 16px    | `space-y-4`               |
| Page padding       | 12-24px | `p-3 sm:p-6` (responsive) |

Border radius:

| Context           | Value  | Tailwind       |
| ----------------- | ------ | -------------- |
| Mac windows       | 6px    | `rounded-md`   |
| Buttons           | 8px    | `rounded-lg`   |
| Badges            | 6px    | `rounded-md`   |
| Table wrapper     | 8px    | `rounded-lg`   |
| Circular elements | 9999px | `rounded-full` |

---

## Layout

### Overall Structure

```
┌──────────┬────────────────────────────────────┐
│          │  Header (40px)                      │
│  Sidebar │────────────────────────────────────│
│  (224px) │                                     │
│          │  Main Content                       │
│          │  (scrollable, padded)               │
│          │                                     │
└──────────┴────────────────────────────────────┘
```

- Sidebar: 224px (`w-56`), full height, glass panel
- Header: 40px (`h-10`), border-bottom
- Content: Flex-1, scroll-y, responsive padding

### Responsive

- **Mobile (<768px):** Sidebar becomes a fixed overlay with backdrop, toggled by hamburger
- **Desktop (>=768px):** Sidebar is static, always visible

### Grid

Dashboard cards use responsive grids: `grid-cols-1 sm:grid-cols-3 gap-3` for stats, various column counts for different content types.

---

## Animations

Animations are **minimal and purposeful**. Nothing bounces, nothing loops, nothing distracts.

| Element             | Animation                              | Duration   | Easing   |
| ------------------- | -------------------------------------- | ---------- | -------- |
| Color transitions   | `transition-colors`                    | 150ms      | default  |
| General transitions | `transition-all`                       | 200ms      | default  |
| Toast enter/exit    | `translate-x` + `opacity`              | 300ms      | ease-out |
| Mobile sidebar      | `translate-x`                          | 200ms      | default  |
| Close button hover  | `scale(1.1)`                           | 150ms      | ease     |
| Button press        | `translate(1px, 1px)` + shadow removal | instant    | —        |
| Loading spinner     | `animate-spin`                         | continuous | linear   |

The button press effect deserves a note: when active, buttons translate 1px right and down while losing their shadow. This simulates a physical button being depressed — a 1-pixel "click" that's felt more than seen. Classic Mac.

---

## Iconography

Doop uses **Unicode symbols** instead of an icon library. This is a deliberate choice that reinforces the retro-terminal aesthetic:

| Icon        | Symbol | Use                |
| ----------- | ------ | ------------------ |
| Fleet       | `▣`    | Dashboard/overview |
| Agents      | `◆`    | Agent management   |
| Audit Trail | `◷`    | Activity logs      |
| Problems    | `⚠`    | Problem tracking   |
| Projects    | `◈`    | Project views      |
| API Docs    | `◎`    | Documentation      |
| Settings    | `⚙`    | Configuration      |
| Sign out    | `⊳`    | Logout action      |
| Loading     | `◯`    | Spinner character  |

These symbols render natively, load instantly, and feel at home next to VT323 pixel text. No icon font dependency, no SVG sprite sheet — just Unicode doing what it was designed to do.

---

## Dark Mode

There is no dark mode. The design is **light-only** by intention. The cream/white palette is central to the vintage Mac identity. The warm neutrals, the gradient title bars, the physical window metaphor — all of these depend on the light surface to work.

---

## Design Principles (Summary)

1. **Mac windows are real.** Every container is a window. Windows have title bars, borders, and shadows. They feel physical.
2. **Color means something.** Red is critical. Green is healthy. Blue is active. This is never violated.
3. **Two fonts, two voices.** VT323 is the machine. Space Grotesk is the data. They don't swap roles.
4. **Dense, not cluttered.** Information density is high. Visual noise is low. Spacing and borders do the organizing.
5. **Retro is the brand.** The vintage Mac aesthetic is not a skin — it's the identity. Every new component must feel like it belongs in a 1991 control room rebuilt with 2025 technology.
