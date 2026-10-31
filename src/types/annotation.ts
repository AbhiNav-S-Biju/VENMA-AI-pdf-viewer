/**
 * Annotation engine types — Phase 04 (canonical).
 *
 * Coordinate system: every stored rectangle is in NORMALIZED PDF PAGE SPACE —
 * origin at the page's top-left, units are PDF points (the page dimensions at
 * viewport scale 1), Y grows downward. Browser screen coordinates are used
 * only transiently during capture and never persisted.
 */

export type HighlightColor = "yellow" | "green" | "pink";

/** One merged text-line rectangle, normalized to PDF page space. */
export type FragmentRect = {
  id: string;
  /** 0-based PDF page index. */
  pageIndex: number;
  /** Page size at scale 1 in PDF points (stored per fragment for validation). */
  pageWidth: number;
  pageHeight: number;
  /** Top-left corner and size, in PDF points, Y measured downward. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Reading order across pages and lines (ascending). */
  order: number;
};

export type NotePayload = {
  text: string;
  kind: "user" | "ai";
  createdAt: number;
  updatedAt: number;
};

/** One logical annotation, possibly spanning multiple pages/lines. */
export type PdfAnnotation = {
  id: string;
  documentFingerprint: string;
  kind: "highlight" | "note";
  color: HighlightColor | null;
  text: string;
  note: NotePayload | null;
  fragments: FragmentRect[];
  createdAt: number;
  updatedAt: number;
  /** True when the stored geometry no longer matches the open document. */
  orphaned?: boolean;
};

/** Persisted document metadata, keyed by content fingerprint. */
export type DocumentRecord = {
  fingerprint: string;
  fileName: string;
  pageCount: number;
  createdAt: number;
  updatedAt: number;
};

/** A live selection captured from the DOM, before becoming an annotation. */
export type SelectionSnapshot = {
  id: string;
  fingerprint: string;
  text: string;
  createdAt: number;
  fragments: FragmentRect[];
};

/** A single reversible mutation of the annotation list. */
export type AnnotationOp =
  | { kind: "add"; annotation: PdfAnnotation }
  | { kind: "remove"; id: string }
  | { kind: "replace"; before: PdfAnnotation; after: PdfAnnotation };

/** One undo/redo step, persisted so history survives a reload. */
export type HistoryEntry = {
  id: string;
  fingerprint: string;
  label: string;
  undo: AnnotationOp;
  redo: AnnotationOp;
  createdAt: number;
};

export type ExportResult =
  | { ok: true; fileName: string; annotationCount: number }
  | { ok: false, message: string };
