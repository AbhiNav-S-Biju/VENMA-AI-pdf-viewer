/**
 * Annotation command history — Phase 04.
 *
 * Every mutation of the annotation list is recorded as an (undo, redo) pair
 * and pushed here, so Ctrl+Z / Ctrl+Y work identically for creating, editing
 * and deleting highlights and notes. History is per-document and persisted,
 * so it survives a reload.
 */
import type { AnnotationOp, HistoryEntry, PdfAnnotation } from "../../types/annotation.ts";

export type HistoryState = {
  entries: HistoryEntry[];
  /** Index of the most recent applied op; -1 = nothing to undo. */
  cursor: number;
  maxEntries: number;
};

export const MAX_HISTORY_ENTRIES = 100;

export function createHistory(maxEntries = MAX_HISTORY_ENTRIES): HistoryState {
  return { entries: [], cursor: -1, maxEntries };
}

/**
 * Apply an operation to the annotation list and record it.
 * Redos ahead of the cursor are discarded (standard editor model).
 * Returns the new list and history, or null when nothing was applied.
 */
export function applyOperation(
  annotations: PdfAnnotation[],
  history: HistoryState,
  fingerprint: string,
  label: string,
  undo: AnnotationOp,
  redo: AnnotationOp,
  now = Date.now(),
  id = `h${history.entries.length + 1}-${now}`
): { annotations: PdfAnnotation[]; history: HistoryState } | null {
  const applied = applyOp(annotations, redo);

  if (applied === null) {
    return null;
  }

  const entry: HistoryEntry = {
    id,
    fingerprint,
    label,
    undo,
    redo,
    createdAt: now
  };

  const kept = [...history.entries.slice(0, history.cursor + 1), entry].slice(
    -history.maxEntries
  );

  return {
    annotations: applied,
    history: {
      entries: kept,
      cursor: Math.min(history.cursor + 1, kept.length - 1),
      maxEntries: history.maxEntries
    }
  };
}

/** Undo the op at the cursor; moves the cursor back one. */
export function undo(
  annotations: PdfAnnotation[],
  history: HistoryState
): { annotations: PdfAnnotation[]; history: HistoryState } | null {
  if (history.cursor < 0) {
    return null;
  }

  const entry = history.entries[history.cursor];
  const applied = applyOp(annotations, entry.undo);

  if (applied === null) {
    return null;
  }

  return { annotations: applied, history: { ...history, cursor: history.cursor - 1 } };
}

/** Redo the op after the cursor; moves the cursor forward one. */
export function redo(
  annotations: PdfAnnotation[],
  history: HistoryState
): { annotations: PdfAnnotation[]; history: HistoryState } | null {
  if (history.cursor + 1 >= history.entries.length) {
    return null;
  }

  const entry = history.entries[history.cursor + 1];
  const applied = applyOp(annotations, entry.redo);

  if (applied === null) {
    return null;
  }

  return { annotations: applied, history: { ...history, cursor: history.cursor + 1 } };
}

/**
 * Mutate a list per an op. Returns null when the op is impossible
 * (e.g. "remove" for an id that no longer exists), which callers treat as
 * "history entry invalid — skip".
 */
export function applyOp(
  annotations: PdfAnnotation[],
  op: AnnotationOp
): PdfAnnotation[] | null {
  if (op.kind === "add") {
    if (annotations.some((annotation) => annotation.id === op.annotation.id)) {
      return null;
    }
    return [...annotations, op.annotation];
  }

  if (op.kind === "remove") {
    const index = annotations.findIndex((annotation) => annotation.id === op.id);
    return index === -1 ? null : [...annotations.slice(0, index), ...annotations.slice(index + 1)];
  }

  const index = annotations.findIndex((annotation) => annotation.id === op.before.id);
  return index === -1 ? null : annotations.map((annotation, i) => (i === index ? op.after : annotation));
}
