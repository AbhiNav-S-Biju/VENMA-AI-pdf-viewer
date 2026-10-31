import type { FragmentRect, PdfAnnotation } from "../../types/annotation.ts";

type FactoryOptions = {
  pageNumber: number;
  text?: string;
  documentFingerprint?: string;
};

const DEFAULT_PAGE_WIDTH = 612;
const DEFAULT_PAGE_HEIGHT = 792;

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `annotation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeFragment(pageNumber: number): FragmentRect {
  const pageIndex = Math.max(0, pageNumber - 1);
  return {
    id: "factory-fragment",
    pageIndex,
    pageWidth: DEFAULT_PAGE_WIDTH,
    pageHeight: DEFAULT_PAGE_HEIGHT,
    x: 72,
    y: 72,
    width: 120,
    height: 18,
    order: 0
  };
}

export function makeHighlightAnnotation({
  pageNumber,
  text = "Highlighted text",
  documentFingerprint = "factory-document"
}: FactoryOptions): PdfAnnotation {
  const now = Date.now();
  return {
    id: newId(),
    documentFingerprint,
    kind: "highlight",
    color: "yellow",
    text,
    note: null,
    fragments: [makeFragment(pageNumber)],
    createdAt: now,
    updatedAt: now
  };
}

export function makeNoteAnnotation({
  pageNumber,
  text = "",
  documentFingerprint = "factory-document"
}: FactoryOptions): PdfAnnotation {
  const now = Date.now();
  return {
    id: newId(),
    documentFingerprint,
    kind: "note",
    color: null,
    text,
    note: {
      text,
      kind: "user",
      createdAt: now,
      updatedAt: now
    },
    fragments: [makeFragment(pageNumber)],
    createdAt: now,
    updatedAt: now
  };
}

export function validateAnnotation(
  annotation: PdfAnnotation
): { valid: true } | { valid: false; error: string } {
  if (!annotation.id || !annotation.documentFingerprint) {
    return { valid: false, error: "Annotation id and document fingerprint are required." };
  }

  if (annotation.fragments.length === 0) {
    return { valid: false, error: "Annotation must contain at least one fragment." };
  }

  if (annotation.kind === "note" && !annotation.text.trim()) {
    return { valid: false, error: "Note text must not be empty." };
  }

  return { valid: true };
}

export function describeAnnotation(annotation: PdfAnnotation): string {
  const firstPage = annotation.fragments[0]?.pageIndex;
  const pageNumber = typeof firstPage === "number" ? firstPage + 1 : "unknown";
  return `${annotation.kind} on page ${pageNumber}`;
}
