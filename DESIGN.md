---
name: VENMA
description: A study desk for PDFs, with a lavender cat who explains the passage you select.
colors:
  mat: "#e9e1fb"
  mat-deep: "#d9ccf6"
  ink: "#1f2340"
  ink-soft: "#4a4f72"
  bar: "#1f2340"
  bar-raised: "#30355c"
  on-bar: "#ffffff"
  on-bar-soft: "#cfcdea"
  paper: "#ffffff"
  paper-line: "#e6e1f3"
  control-line: "#d9d2ee"
  tint: "#f3effd"
  lavender: "#b9a3e8"
  lavender-pressed: "#a68ee2"
  lavender-deep: "#6f54c4"
  yellow: "#ffe45c"
  yellow-pressed: "#ffd92a"
  yellow-wash: "#fff7c9"
  pink: "#ff8fb8"
  mint: "#6ee0a8"
  mint-wash: "#ddf7ea"
  mint-ink: "#146343"
  danger: "#b4253e"
  danger-wash: "#ffe8ec"
typography:
  display:
    fontFamily: "Nunito Variable, ui-rounded, system-ui, sans-serif"
    fontSize: "clamp(2rem, 3.4vw, 3rem)"
    fontWeight: 900
    lineHeight: 1.04
    letterSpacing: "-0.02em"
  brand:
    fontFamily: "Nunito Variable, ui-rounded, system-ui, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0.04em"
  headline:
    fontFamily: "Nunito Variable, ui-rounded, system-ui, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 900
  title:
    fontFamily: "Nunito Variable, ui-rounded, system-ui, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 900
  body:
    fontFamily: "Nunito Variable, ui-rounded, system-ui, sans-serif"
    fontSize: "0.96rem"
    fontWeight: 400
    lineHeight: 1.62
  body-small:
    fontFamily: "Nunito Variable, ui-rounded, system-ui, sans-serif"
    fontSize: "0.84rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Nunito Variable, ui-rounded, system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 700
  chip:
    fontFamily: "Nunito Variable, ui-rounded, system-ui, sans-serif"
    fontSize: "0.76rem"
    fontWeight: 700
    fontFeature: "\"tnum\""
rounded:
  page: "2px"
  sm: "8px"
  control: "10px"
  md: "12px"
  toolbar: "14px"
  lg: "16px"
  drawer: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  desk-top: "36px"
  desk-side: "72px"
components:
  button:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "36px"
  button-hover:
    backgroundColor: "{colors.tint}"
  button-primary:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.yellow-pressed}"
  button-bar:
    backgroundColor: "transparent"
    textColor: "{colors.on-bar}"
    rounded: "{rounded.control}"
    height: "36px"
  button-bar-hover:
    backgroundColor: "{colors.bar-raised}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "36px"
  chip:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  chip-live:
    backgroundColor: "{colors.mint-wash}"
    textColor: "{colors.mint-ink}"
  chip-mock:
    backgroundColor: "{colors.yellow-wash}"
    textColor: "#6b5200"
  app-bar:
    backgroundColor: "{colors.bar}"
    textColor: "{colors.on-bar}"
    height: "64px"
  selection-toolbar:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.toolbar}"
    padding: "6px"
  assistant-drawer:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.drawer}"
    width: "420px"
  annotation-flag:
    backgroundColor: "{colors.yellow}"
    rounded: "0 7px 7px 0"
    width: "28px"
    height: "22px"
  note-flag:
    backgroundColor: "{colors.lavender}"
    textColor: "{colors.ink}"
    rounded: "0 7px 7px 0"
    width: "42px"
    height: "26px"
---

# Design System: VENMA

## Overview

**Creative North Star: "The Study Desk"**

VENMA is a reading desk, not a reader-with-sidebar. A lavender desk mat fills the window, a navy ink bar runs across the top, and the PDF sits on the mat as a sheet of white paper with soft shadows under it. Everything the reader adds behaves like a desk object: highlighter strokes on the page, sticky flags stuck to the page's right edge, a note that lights its passage while open. VENMA, the cat, lives on the mat bottom-right, breathing and watching the pointer, and opens a white answer drawer above itself.

Density is calm and generous: one page centred, one drawer, one floating toolbar at a time. Colour is rationed by job. Lavender belongs to VENMA, navy to the tools, white to paper, and only three highlighter hues may mark the reader's text. Type is one rounded family (Nunito) carried from the 900-weight empty-state headline down to tabular chip counters, so the whole surface reads as friendly and of a piece.

Motion is exponential ease-out everywhere a thing arrives (flags stick, toolbars pop, the drawer rises), and VENMA has its own body language: breathing, irregular blinks and ear twitches, a tail sway, and posed moods. Reduced motion holds every one of them still.

**Key Characteristics:**
- Lavender mat, navy bar, white paper: three grounds, never more.
- Annotations are physical: highlighter ink on the page, flags on its right edge, one flag per annotation.
- Lavender is VENMA's colour and lights a note passage only while that note is open.
- One rounded typeface (Nunito Variable) at heavy weights for headings, 700 for controls.
- Soft neutral navy shadows, paper-on-a-mat; no hard offsets, no glow.
- Exponential ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`) is the motion grammar.

## Colors

A lavender-and-navy desk with three highlighter inks, where each hue has exactly one job.

### Primary
- **Desk Navy Ink** (ink / bar): the app bar, all type, the selection toolbar, user-note flags, dark tooltips and the pet's action buttons. Navy is the tool colour; it carries every control surface that floats over the page.
- **Raised Navy** (bar-raised): hover and active fill for anything sitting on navy (bar buttons, toolbar buttons, the page-number field).

### Secondary
- **VENMA Lavender** (lavender): VENMA's fur, AI note flags, the scrollbar thumb, the note-passage wash (55% fill, multiply) while a note is open, and the busy state of an assistant action. Lavender means "VENMA is here" and nothing else.
- **Pressed Lavender** (lavender-pressed): a note flag that is hovered or open.
- **Deep Lavender** (lavender-deep): focus rings on light grounds, links, list markers, the spinner arc and progress bar, VENMA's thinking dots.

### Tertiary
- **Highlighter Yellow** (yellow): the primary action (Open PDF, Save), the yellow highlight and flag, focus rings on navy, the active bar control's text. Pressed state is **Pressed Yellow** (yellow-pressed). Washed form (yellow-wash) backs quoted passages and the mock-output banner and chip.
- **Highlighter Mint** (mint): the green highlight and flag, and the "online" status dot. Its wash and ink (mint-wash, mint-ink) mark live model output.
- **Highlighter Pink** (pink): the pink highlight and flag, and VENMA's blush.

### Neutral
- **Desk Mat** (mat): the whole window ground; **Deep Mat** (mat-deep) shows when a file is dragged over the desk.
- **Paper** (paper): the PDF page, the drawer, popovers, note editor, buttons.
- **Lavender Tint** (tint): the drawer header, assistant action tiles, chips, inline code, table heads, button hover.
- **Paper Line** (paper-line): section dividers inside paper surfaces and table rules. **Control Line** (control-line): the 1.5px border on buttons, inputs and textareas.
- **Soft Ink** (ink-soft): secondary copy, hints, subtitles. **On-Bar Soft** (on-bar-soft): secondary text on navy.
- **Danger** (danger / danger-wash): errors and destructive buttons only.

### Named Rules
**The One Job Per Hue Rule.** Lavender is VENMA and its note passages; yellow, mint and pink are the only highlight and flag hues; navy is tools and type. A new feature borrows a hue only for that hue's existing job.

**The Lit-While-Open Rule.** A note passage's lavender wash is at 0% at rest and fades to 55% only while its explanation is open. At rest the flag alone marks the note.

**The Navy Selection Rule.** Live text selection on the page is a navy tint (`rgba(31, 35, 64, 0.2)`) so it never reads as a lavender note passage or a highlight.

**The Weight Not Yellow Rule.** Answers emphasise with weight (900) in ink, never with highlighter yellow. Yellow on the page means the reader marked it.

## Typography

**Display Font:** Nunito Variable (with ui-rounded, system-ui, -apple-system, Segoe UI, sans-serif)
**Body Font:** Nunito Variable
**Label/Mono Font:** Nunito Variable with tabular numerals for counters; code uses the browser monospace.

**Character:** One rounded sans at two poles: heavy 900 for anything that names a thing (headings, brand, action titles) and plain 400–700 for reading and controls. It keeps the desk friendly without a second voice.

### Hierarchy
- **Display** (900, clamp(2rem, 3.4vw, 3rem), 1.04, -0.02em, balanced wrap): the empty-desk headline only.
- **Brand** (900, 1.3rem, 0.04em): the VENMA wordmark in the bar.
- **Headline** (900, 1.3rem): loading and error panel titles.
- **Title** (900, 1.05–1.12rem): drawer, popup and note-editor headings; section headings inside the drawer drop to 0.9rem at 900.
- **Body** (400, 0.96rem, 1.62): answers and explanation text; empty-desk copy runs 1.05rem / 1.6 at a 38ch measure.
- **Body Small** (400, 0.84rem, 1.45): subtitles, banners, hints, popover copy.
- **Label** (700, 0.9rem): buttons and controls; primary buttons and the page field step up to 800.
- **Chip** (700, 0.76rem, tabular): counters and model/source chips.

### Named Rules
**The Heavy Names Rule.** Headings and names are 900 (small in-popup section labels sit at 800 in soft ink); nothing is set in a second family.

**The Tabular Counter Rule.** Page numbers, page totals, zoom percentage, character counts and tables use tabular numerals.

## Layout

A 64px sticky navy bar over a full-height lavender mat. Below the bar, the page scroll region pads 36px top, 72px sides and 120px bottom, and centres a column of pages with `align-items: safe center` so a zoomed page's left edge stays reachable.

The assistant drawer is fixed bottom-right (420px wide, 24px from the right edge, 156px above the bottom to clear VENMA). On wide screens, while the drawer is visible the root carries `data-drawer="open"` and the scroll region reserves 468px on the right (420 + 24 + 24), so the page re-centres beside the drawer with its flags still visible; the padding change eases over 320ms.

The empty desk is a two-area grid: a tilted sample sheet (-4deg) with VENMA tucked at its lower right, 104px gap, then copy capped at 420px.

Spacing is a loose 4px rhythm (4, 6, 8, 10, 12, 14, 16, 18, 24), with 8px between controls in a group and 18px between groups in the bar.

**Responsive:**
- **≤900px:** the bar wraps: brand and settings on the first row, the document toolbar takes a full second row; the document title hides. Pages open fitted to width by default. The scroll region pads 18px 44px 120px 16px and the drawer reservation shrinks to 44px. The drawer spans the viewport minus 24px. The empty desk stacks art over centred copy.
- **≤600px:** zoom controls and the page total hide, and Open/Export go icon-only (40px minimum) so the tools fit one row.

## Elevation & Depth

Depth is paper on a mat: soft, neutral, navy-tinted shadows with a tight contact layer and a long diffuse layer. There are two levels plus the flag's own small shadow. Surfaces at rest on the mat (the page, the empty sheet, loading and error panels) take the paper shadow; anything that floats over the page (drawer, popovers, toolbars, notices, the note editor, a dragged-over page) takes the lift shadow.

### Shadow Vocabulary
- **Paper** (`box-shadow: 0 1px 2px rgba(31, 35, 64, 0.08), 0 14px 36px rgba(31, 35, 64, 0.14)`): pages and panels resting on the mat.
- **Lift** (`box-shadow: 0 2px 6px rgba(31, 35, 64, 0.1), 0 22px 48px rgba(31, 35, 64, 0.22)`): floating surfaces and the drag-over lift.
- **Flag** (`box-shadow: 0 1px 2px rgba(31, 35, 64, 0.2), 0 4px 10px rgba(31, 35, 64, 0.12)`): sticky flags and note flags, so they read as stuck on, not printed.
- **Held** (`filter: drop-shadow(0 14px 14px rgba(31, 35, 64, 0.22))`): VENMA while being dragged, with a 1.05 scale.

### Named Rules
**The Paper-On-Mat Rule.** Shadows are always navy-tinted and soft. Rest gets Paper, floating gets Lift; no third card level, no coloured glow.

## Shapes

Soft rounded corners in a tight band: 8px for inset blocks (quotes, errors, code), 10px for controls, 12px for popovers and action tiles, 14px for the selection toolbar, 16px for dialogs, 20px for the drawer, and pills (999px) for chips and the restore button. The PDF page itself is nearly square (2px), because it is paper. Flags are rounded only on their free edge (`0 7px 7px 0`) and sit flush against the page, growing from the left (`scaleX` from 0.2). Swatches and pet action buttons are full circles. Borders are 1.5px on controls; dividers are 1px.

## Components

### Buttons
Friendly, solid, compact.
- **Shape:** gently rounded (10px), 36px tall; large variant 46px tall at 12px radius with 1rem type.
- **Default:** paper fill, 1.5px control-line border, ink label at 700.
- **Primary:** highlighter yellow fill and border, ink label at 800; pressed yellow on hover.
- **Hover / Focus:** hover shifts to tint fill and lavender border; active nudges down 1px; focus is a 3px deep-lavender outline at 2px offset (yellow on navy). Transitions are 160ms ease-out.
- **On the bar:** transparent, white icon or label, raised navy on hover; the active control shows yellow text on raised navy. Export carries a 1.5px translucent white border.
- **Destructive:** pink-red border, danger text, danger-wash hover.
- **Link button:** deep-lavender underlined text, no chrome.

### Chips
- **Style:** pill, tint ground, soft-ink 0.76rem/700 tabular text.
- **State:** "Model output" uses mint wash and mint ink; "Mock output" uses yellow wash with dark amber text. Every answer carries one, plus a chip naming its model.

### Cards / Containers
- **Corner Style:** 16px dialogs, 20px drawer, 12px action tiles.
- **Background:** paper; the drawer header and action tiles use tint.
- **Shadow Strategy:** Paper at rest, Lift when floating (see Elevation & Depth).
- **Border:** none on containers; 1px paper-line dividers between sections.
- **Internal Padding:** 16–18px for dialogs, 16px for drawer body, 10px 12px for tiles.

### Inputs / Fields
- **Style:** paper fill, 1.5px control-line border, 10px radius, 36px tall (40px for the model select); textareas the same at 10px 12px padding.
- **Focus:** 3px deep-lavender outline at 2px offset.
- **On the bar:** the page field is raised navy, borderless, centred tabular 800 white.

### Navigation
The navy app bar (64px, sticky) holds, left to right: VENMA mark and wordmark, Open PDF (primary) and a URL loader, document title, page field with prev/next and total, zoom out/value/in and fit width, undo/redo, Export, settings. Icons come from one 20px stroke set (1.7 stroke, round caps and joins) rendered at 18px; popovers open 10px below their trigger on paper with the Lift shadow.

### Selection Toolbar
A navy pill-ish bar (14px radius, 6px padding) that pops in (220ms) above a selection: three 28px circular swatches (yellow, mint, pink, with a white ring that scales 1.12 on hover), a translucent divider, Add note, close.

### Annotation Flags (signature)
One flag per annotation on the page's right edge at the height of its first line, spaced at least 30px apart so flags never overlap. Highlight flags are 28x22px in their highlight's hue. Note flags are 42x26px with an icon: lavender for VENMA's notes, navy for the reader's own; hovered or open, they slide out 5px and deepen. Flags stick on with a 420ms ease-out scale from the page edge. Highlights themselves are multiply-blended ink rectangles.

### Assistant Drawer
White, 20px corners, rises 320ms from bottom-right. Tint header with VENMA's avatar, title and document/page subtitle; a mint (live) or yellow (mock) banner states where answers come from; actions are tint tiles in an auto-fill grid (min 150px) with a 900 label and soft hint; answers render as Markdown with weight-only emphasis.

### VENMA (signature)
A layered 120x128 vector cat: lavender gradient fur, cream muzzle and paws, amber eyes, pink inner ears. It breathes and sways its tail on 3.2–3.6s loops, blinks every 2.5–6s (sometimes twice), twitches one ear every 4–10s, and its pupils follow the pointer up to 2.6 units. Moods pose it: hover leans in with ears up, curious tilts -8deg and quickens the tail, thinking lifts the eyes and raises three deep-lavender dots, explaining moves the mouth, happy squints, blushes and hops twice, error flattens the ears and drops the tail. Reduced motion and static uses (brand mark, restore button) hold a still pose. Hidden, it leaves a navy pill restore button bottom-right.

## Do's and Don'ts

### Do:
- **Do** keep lavender for VENMA, its note flags and its open note passage; light the passage (55% multiply) only while the note is open.
- **Do** limit highlight and flag hues to yellow, mint and pink, and give every annotation exactly one flag on the page's right edge.
- **Do** tint live text selection navy (`rgba(31, 35, 64, 0.2)`).
- **Do** emphasise answers with 900-weight ink, never yellow.
- **Do** float tools in navy and dialogs in paper, with the Lift shadow; rest everything else on the mat with the Paper shadow.
- **Do** animate arrivals with `cubic-bezier(0.16, 1, 0.3, 1)` (160ms for control states, 220–320ms for toolbars and the drawer, 420ms for flags) and honour reduced motion with a still pose.
- **Do** reserve 468px for the open drawer on wide screens so the page and its flags stay visible beside the answer.
- **Do** fit pages to width by default at ≤900px, and at ≤600px hide zoom and make Open/Export icon-only.
- **Do** label every answer with its source (live or mock) and its model.

### Don't:
- **Don't** use lavender for highlights, selection, or decoration unrelated to VENMA.
- **Don't** add a fourth highlighter hue or a second accent.
- **Don't** mark answers or AI output with highlighter yellow.
- **Don't** use hard offset shadows, coloured glows, or a third elevation level.
- **Don't** introduce a second typeface or set titles and headings below 900 weight.
- **Don't** let a floating surface cover the page's flags when the drawer is open on a wide screen.
