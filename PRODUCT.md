# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Anyone who reads PDFs and wants help understanding them: papers, reports, textbooks, manuals, forms. No single audience is privileged; the product must work for a casual reader as well as for someone working through a dense document.

## Product Purpose

VENMA is a PDF workspace with a cat companion. The reader opens a PDF (file, drag-and-drop, or URL), reads it, highlights and annotates it, and selects text to ask the cat for help: a simple or detailed explanation, an example, a summary, or study notes. Answers can be copied, kept as an explanation note on the page, or turned into a highlight.

Success means the reader understands the document faster and leaves with durable notes attached to the original file.

## Positioning

The AI help lives inside the reader and acts on the exact passage selected, and its answers become annotations on the document rather than a separate chat transcript. The companion is a cat, not a generic chatbot panel. *(Inferred from the codebase; not yet stated by the owner.)*

## Operating Context

- Primary delivery is a Chrome Manifest V3 extension; the extension action opens the workspace (`workspace.html`) in a tab. The same build runs as a local web app during development (`npm run dev:full`, Vite on 127.0.0.1:5173 plus the API server on :3001).
- A small Node/Express server (`server/`) holds AI provider keys server-side and routes requests across configured models (Gemma via a temporary Kaggle tunnel, Groq, OpenRouter, Gemini), with health checks and an "Auto · best available" choice.
- Annotations persist in the browser (IndexedDB), keyed to a content fingerprint of the PDF so they reattach when the same file is reopened.

## Capabilities and Constraints

- PDF viewing: open by file, drop, or URL; page navigation, zoom, fit-to-width.
- Annotations: highlights (with colors), notes, AI explanation notes; undo/redo; edit and delete; export to a new PDF via pdf-lib.
- AI actions on a selection: simple explanation, detailed explanation, example, summary, study notes. Responses render as Markdown.
- Model picker with per-model status (online, busy, quota exceeded, offline, unknown).
- **PDF integrity:** the original PDF is never modified destructively. Export produces a new file; annotations are stored alongside, not burned into the source.
- **Persistent annotations:** highlights, notes, and AI explanations can be saved, reopened, edited, and exported.
- **Local-first privacy:** documents and annotations stay in the browser. Only the selected text (plus minimal context) is sent to the AI server.
- **Honest AI labeling:** mock answers vs real model answers, model status, and the fact that some models run in temporary Kaggle sessions are always disclosed to the reader.
- **The pet is optional:** the cat can be minimized or hidden, a restore control stays available, and the reader works fully without it.
- Annotations that no longer match the open document are skipped and reported, never silently misplaced.

## Brand Commitments

- **VENMA is the cat.** VENMA is both the product name and the cat companion's name. "AI PDF Pet" and "Nia" are retired names; do not reintroduce them.
- Mascot reference image: `venma_pet.jpeg` (project root). The cat has moods: idle, hover, curious, thinking, explaining, happy, error.

## Evidence on Hand

- Mascot art: `venma_pet.jpeg`, `src/features/pet/MascotArt.tsx`.
- No testimonials, user counts, store listing, pricing, or benchmarks exist. Do not fabricate them.

## Product Principles

1. **The document is sacred.** Never alter the original PDF; everything the reader adds is layered, reversible, and exportable.
2. **Help comes to the passage.** AI acts on what the reader selected, in place, and its output can become part of their notes.
3. **Say where an answer came from.** Model, status, and mock vs real are always visible; nothing passes itself off as more reliable than it is.
4. **Local by default.** The reader's files and notes stay on their machine; only the text they ask about leaves it.
5. **A companion, not a gate.** VENMA adds warmth and help but can be dismissed at any time without losing any function.

## Accessibility & Inclusion

The codebase already honors `prefers-reduced-motion` for the pet and provides keyboard-reachable, labeled controls for the pet and assistant panel. Keep both. No formal conformance target has been set.
