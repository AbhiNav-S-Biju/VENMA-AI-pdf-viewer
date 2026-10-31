import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PdfDocumentSource } from "../../types/pdf";
import type {
  AnnotationOp,
  FragmentRect,
  HighlightColor,
  HistoryEntry,
  PdfAnnotation,
  SelectionSnapshot
} from "../../types/annotation";
import {
  applyOp,
  applyOperation,
  createHistory,
  redo as redoOp,
  undo as undoOp,
  type HistoryState
} from "../../services/annotations/history";
import { isFragmentRenderable } from "../../services/annotations/coordinates";
import { AnnotationStore } from "../../services/annotations/annotationStore";
import { exportAnnotatedPdf } from "../../services/annotations/exportPdf";
import { NoteEditorState, SelectionToolbarState } from "./annotationUiState";

/** Page dimensions at scale 1, keyed by 0-based page index. */
export type PageDims = { width: number; height: number };

export type AnnotationEngine = {
  /** Annotations for the current document (validated against page dims). */
  annotations: PdfAnnotation[];
  /** Annotations skipped at load because their geometry no longer matches. */
  orphanedCount: number;
  canUndo: boolean;
  canRedo: boolean;
  storageAvailable: boolean;
  exportState: { status: "idle" | "exporting" | "done" | "error"; message?: string };
  selectionToolbar: SelectionToolbarState;
  noteEditor: NoteEditorState;
  showSelectionToolbar: (state: NonNullable<SelectionToolbarState>) => void;
  hideSelectionToolbar: () => void;
  createHighlight: (color: HighlightColor) => void;
  createHighlightFromSelection: (snapshot: SelectionSnapshot, color: HighlightColor) => void;
  beginNote: () => void;
  saveNote: (text: string) => void;
  addAiExplanationNote: (snapshot: SelectionSnapshot, text: string) => void;
  closeNoteEditor: () => void;
  openNote: (annotationId: string) => void;
  deleteNote: (annotationId: string) => void;
  undo: () => void;
  redo: () => void;
  exportAnnotations: () => void;
};

let sharedStore: AnnotationStore | null = null;

function getStore(): AnnotationStore | null {
  if (sharedStore) {
    return sharedStore;
  }
  try {
    sharedStore = new AnnotationStore();
    return sharedStore;
  } catch {
    return null;
  }
}

function annotationGeometryKey(annotation: PdfAnnotation): string {
  const fragments = annotation.fragments
    .map((fragment) =>
      [
        fragment.pageIndex,
        fragment.x,
        fragment.y,
        fragment.width,
        fragment.height,
        fragment.order
      ].join(":")
    )
    .join("|");

  return [annotation.kind, annotation.color ?? "", annotation.text, fragments].join("::");
}

function deduplicateStoredAnnotations(annotations: PdfAnnotation[]): {
  annotations: PdfAnnotation[];
  removed: number;
} {
  const seen = new Set<string>();
  const result: PdfAnnotation[] = [];
  let removed = 0;

  for (const annotation of annotations) {
    const fragmentKeys = new Set<string>();
    const fragments = annotation.fragments.filter((fragment) => {
      const key = [
        fragment.pageIndex,
        fragment.x,
        fragment.y,
        fragment.width,
        fragment.height
      ].join(":");
      if (fragmentKeys.has(key)) {
        removed += 1;
        return false;
      }
      fragmentKeys.add(key);
      return true;
    });
    const normalizedAnnotation =
      fragments.length === annotation.fragments.length
        ? annotation
        : { ...annotation, fragments };
    const key = annotationGeometryKey(normalizedAnnotation);
    if (seen.has(key)) {
      removed += 1;
      continue;
    }

    seen.add(key);
    result.push(normalizedAnnotation);
  }

  return { annotations: result, removed };
}

export function newId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `a-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Owner of the annotation lifecycle for the open PDF document.
 *
 * Every mutation is an explicit (undo, redo) operation pair pushed through the
 * history service, so the overlay, IndexedDB and undo/redo stay consistent.
 */
export function useAnnotationEngine(input: {
  source: PdfDocumentSource | null;
  pdfDocument: PDFDocumentProxy | null;
  pageDims: Map<number, PageDims>;
  fingerprint: string | null;
}): AnnotationEngine {
  const { source, pdfDocument, pageDims, fingerprint } = input;

  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);
  const [orphanedCount, setOrphanedCount] = useState(0);
  const [history, setHistory] = useState<HistoryState>(createHistory());
  const [selectionToolbar, setSelectionToolbar] = useState<SelectionToolbarState>(null);
  const [noteEditor, setNoteEditor] = useState<NoteEditorState>(null);
  const [exportState, setExportState] = useState<AnnotationEngine["exportState"]>({
    status: "idle"
  });
  const [storageAvailable, setStorageAvailable] = useState(() => getStore() !== null);

  const stateRef = useRef({ annotations, pageDims, fingerprint, source, history });
  stateRef.current = { annotations, pageDims, fingerprint, source, history };

  // Load + validate persisted annotations whenever a document is opened.
  useEffect(() => {
    if (!source || !pdfDocument || !fingerprint) {
      setAnnotations([]);
      setOrphanedCount(0);
      setHistory(createHistory());
      setSelectionToolbar(null);
      setNoteEditor(null);
      return;
    }

    const store = getStore();

    if (!store) {
      setStorageAvailable(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const now = Date.now();
        await store.upsertDocument({
          fingerprint,
          fileName: source.name,
          pageCount: pdfDocument.numPages,
          createdAt: now,
          updatedAt: now
        });

        const [stored, entries] = await Promise.all([
          store.getAnnotations(fingerprint),
          store.getHistory(fingerprint)
        ]);

        if (cancelled) {
          return;
        }

        const dims = stateRef.current.pageDims;
        const valid: PdfAnnotation[] = [];
        const seenAnnotationIds = new Set<string>();
        let orphaned = 0;

        for (const annotation of stored) {
          const renderable = annotation.fragments.every((fragment) => {
            const dim = dims.get(fragment.pageIndex);
            return dim ? isFragmentRenderable(fragment, dim.width, dim.height) : false;
          });

          if (renderable && !seenAnnotationIds.has(annotation.id)) {
            valid.push(annotation);
            seenAnnotationIds.add(annotation.id);
          } else {
            orphaned += 1;
          }
        }

        // The annotation store contains the current document state. Replay
        // history independently only to restore undo/redo metadata; applying
        // it on top of `valid` would add every historical "add" again.
        let replayList: PdfAnnotation[] = [];
        const replayHistory = createHistory();

        for (const entry of entries) {
          const applied = applyOp(replayList, entry.redo);

          if (applied === null) {
            continue;
          }

          replayList = applied;
          replayHistory.entries.push(entry);
          replayHistory.cursor = replayHistory.entries.length - 1;
        }

        const deduplicated = deduplicateStoredAnnotations(valid);
        setAnnotations(deduplicated.annotations);
        setOrphanedCount(orphaned);
        setHistory(replayHistory);
        setSelectionToolbar(null);
        setNoteEditor(null);

        if (deduplicated.removed > 0) {
          await store.replaceAnnotationsForDocument(fingerprint, deduplicated.annotations);
        }
      } catch (error) {
        console.warn("Failed to load annotations", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source, pdfDocument, fingerprint]);

  /** Persist annotations + history for the current fingerprint. */
  const persist = useCallback(async (nextAnnotations?: PdfAnnotation[], nextHistory?: HistoryState) => {
    const store = getStore();
    const fp = stateRef.current.fingerprint;

    if (!store || !fp) {
      return;
    }

    try {
      await store.replaceAnnotationsForDocument(fp, nextAnnotations ?? stateRef.current.annotations);
      await store.replaceHistoryForDocument(
        fp,
        (nextHistory ?? stateRef.current.history).entries.slice(
          0,
          (nextHistory ?? stateRef.current.history).cursor + 1
        )
      );
    } catch (error) {
      console.warn("Failed to persist annotations", error);
    }
  }, []);

  /** Run a mutation: apply + record + persist. */
  const runOperation = useCallback(
    (label: string, undo: AnnotationOp, redo: AnnotationOp) => {
      const fp = stateRef.current.fingerprint;

      if (!fp) {
        return;
      }

      const result = applyOperation(
        stateRef.current.annotations,
        stateRef.current.history,
        fp,
        label,
        undo,
        redo
      );

      if (!result) {
        return;
      }

      stateRef.current.history = result.history;
      stateRef.current.annotations = result.annotations;
      setAnnotations(result.annotations);
      setHistory(result.history);
      setSelectionToolbar(null);
      void persist(result.annotations, result.history);
    },
    [persist]
  );

  const showSelectionToolbar = useCallback(
    (state: NonNullable<SelectionToolbarState>) => setSelectionToolbar(state),
    []
  );

  const hideSelectionToolbar = useCallback(() => setSelectionToolbar(null), []);

  const createHighlight = useCallback(
    (color: HighlightColor) => {
      const toolbar = selectionToolbar;
      const fp = stateRef.current.fingerprint;

      if (!toolbar || !fp) {
        return;
      }

      const annotation = buildAnnotation(fp, "highlight", color, toolbar.snapshot);
      runOperation("Add highlight", { kind: "remove", id: annotation.id }, { kind: "add", annotation });
      window.getSelection()?.removeAllRanges();
    },
    [runOperation, selectionToolbar]
  );

  const createHighlightFromSelection = useCallback(
    (snapshot: SelectionSnapshot, color: HighlightColor) => {
      const fp = stateRef.current.fingerprint;
      if (!fp) return;
      const annotation = buildAnnotation(fp, "highlight", color, snapshot);
      runOperation("Add highlight", { kind: "remove", id: annotation.id }, { kind: "add", annotation });
      window.getSelection()?.removeAllRanges();
    },
    [runOperation]
  );

  const beginNote = useCallback(() => {
    if (!selectionToolbar) {
      return;
    }
    setNoteEditor({ mode: "create", snapshot: selectionToolbar.snapshot });
    setSelectionToolbar(null);
  }, [selectionToolbar]);

  const saveNote = useCallback(
    (text: string) => {
      const editor = noteEditor;
      const fp = stateRef.current.fingerprint;

      if (!editor || !fp) {
        return;
      }

      if (editor.mode === "create") {
        const now = Date.now();
        const annotation: PdfAnnotation = {
          ...buildAnnotation(fp, "note", null, editor.snapshot),
          note: { text, kind: "user", createdAt: now, updatedAt: now }
        };
        runOperation(
          "Add note",
          { kind: "remove", id: annotation.id },
          { kind: "add", annotation }
        );
      } else {
        const existing = stateRef.current.annotations.find(
          (entry) => entry.id === editor.annotationId
        );

        if (existing?.note) {
          const now = Date.now();
          const after: PdfAnnotation = {
            ...existing,
            note: { ...existing.note, text, updatedAt: now },
            updatedAt: now
          };
          runOperation(
            "Edit note",
            { kind: "replace", before: existing, after },
            { kind: "replace", before: after, after: existing }
          );

        }
      }

      setNoteEditor(null);
      window.getSelection()?.removeAllRanges();
    },
    [runOperation, noteEditor]
  );

  const addAiExplanationNote = useCallback(
    (snapshot: SelectionSnapshot, text: string) => {
      const fp = stateRef.current.fingerprint;
      if (!fp || !text.trim()) return;
      const now = Date.now();
      const annotation: PdfAnnotation = {
        ...buildAnnotation(fp, "note", null, snapshot),
        note: { text: text.trim(), kind: "ai", createdAt: now, updatedAt: now }
      };
      runOperation(
        "Add AI explanation",
        { kind: "remove", id: annotation.id },
        { kind: "add", annotation }
      );
    },
    [runOperation]
  );

  const closeNoteEditor = useCallback(() => setNoteEditor(null), []);

  const openNote = useCallback((annotationId: string) => {
    const existing = stateRef.current.annotations.find((entry) => entry.id === annotationId);

    if (existing?.note) {
      setNoteEditor({ mode: "edit", annotationId, noteText: existing.note.text });
    }
  }, []);

  const deleteNote = useCallback(
    (annotationId: string) => {
      const existing = stateRef.current.annotations.find((entry) => entry.id === annotationId);

      if (existing) {
        runOperation(
          "Delete note",
          { kind: "add", annotation: existing },
          { kind: "remove", id: existing.id }
        );
      }

      setNoteEditor(null);
    },
    [runOperation]
  );

  const undo = useCallback(() => {
    const result = undoOp(stateRef.current.annotations, stateRef.current.history);

    if (!result) {
      return;
    }

    stateRef.current.annotations = result.annotations;
    stateRef.current.history = result.history;
    setAnnotations(result.annotations);
    setHistory(result.history);
    setNoteEditor(null);
    void persist(result.annotations, result.history);
  }, [persist]);

  const redo = useCallback(() => {
    const result = redoOp(stateRef.current.annotations, stateRef.current.history);

    if (!result) {
      return;
    }

    stateRef.current.annotations = result.annotations;
    stateRef.current.history = result.history;
    setAnnotations(result.annotations);
    setHistory(result.history);
    setNoteEditor(null);
    void persist(result.annotations, result.history);
  }, [persist]);

  const exportAnnotations = useCallback(() => {
    const currentSource = stateRef.current.source;

    if (!currentSource) {
      return;
    }

    setExportState({ status: "exporting" });

    void (async () => {
      try {
        const result = await exportAnnotatedPdf({
          bytes: currentSource.bytes,
          annotations: stateRef.current.annotations,
          fileName: currentSource.name
        });

        setExportState(
          result.ok ? { status: "done" } : { status: "error", message: result.message }
        );
      } catch (error) {
        setExportState({
          status: "error",
          message:
            error instanceof Error ? error.message : "The annotated PDF could not be exported."
        });
      }
    })();
  }, []);

  return useMemo(
    () => ({
      annotations,
      orphanedCount,
      canUndo: history.cursor >= 0,
      canRedo: history.cursor + 1 < history.entries.length,
      storageAvailable,
      exportState,
      selectionToolbar,
      noteEditor,
      showSelectionToolbar,
      hideSelectionToolbar,
      createHighlight,
      createHighlightFromSelection,
      beginNote,
      saveNote,
      addAiExplanationNote,
      closeNoteEditor,
      openNote,
      deleteNote,
      undo,
      redo,
      exportAnnotations
    }),
    [
      annotations,
      orphanedCount,
      history,
      storageAvailable,
      exportState,
      selectionToolbar,
      noteEditor,
      showSelectionToolbar,
      hideSelectionToolbar,
      createHighlight,
      createHighlightFromSelection,
      beginNote,
      saveNote,
      addAiExplanationNote,
      closeNoteEditor,
      openNote,
      deleteNote,
      undo,
      redo,
      exportAnnotations
    ]
  );
}

function buildAnnotation(
  fingerprint: string,
  kind: "highlight" | "note",
  color: HighlightColor | null,
  snapshot: SelectionSnapshot
): PdfAnnotation {
  return {
    id: newId(),
    documentFingerprint: fingerprint,
    kind,
    color,
    text: snapshot.text.slice(0, 500),
    note: null,
    fragments: snapshot.fragments,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export type { FragmentRect, HistoryEntry };