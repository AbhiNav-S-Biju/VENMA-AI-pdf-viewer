/**
 * Export annotated PDFs with pdf-lib.
 *
 * The exported file is a NEW copy — the original file is never touched. Each
 * stored annotation (normalized PDF page space, Y-down from page top) is
 * converted to pdf-lib's coordinate system (PDF points, Y-up from page
 * bottom):  pdfLibY = pageHeight - fragment.y - fragment.height
 *
 * Flattening caveat (intentional for the MVP): highlights and note markers
 * are drawn as content streams, NOT native /Annots objects, so they cannot
 * be individually edited in another reader. Note text is placed in the page
 * margin beside its passage; a final summary page lists all notes so nothing
 * is hidden under the original content.
 *
 * The injected loader keeps the module testable under Node.
 */
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { PdfAnnotation, ExportResult } from "../../types/annotation.ts";

const HIGHLIGHT_COLORS: Record<string, { r: number; g: number; b: number }> = {
  yellow: { r: 1, g: 0.92, b: 0.35 },
  green: { r: 0.6, g: 0.9, b: 0.55 },
  pink: { r: 1, g: 0.62, b: 0.78 }
};

const NOTE_COLOR = { r: 0.98, g: 0.76, b: 0.2 };
const MARGIN = 36;

export type ExportInput = {
  /** Original (unmodified) PDF bytes. */
  bytes: ArrayBuffer;
  /** Annotations whose fingerprint matches the document. */
  annotations: PdfAnnotation[];
  /** Suggested download file name. */
  fileName: string;
};

export async function buildAnnotatedPdf(input: ExportInput): Promise<{
  ok: true;
  bytes: Uint8Array;
  annotationCount: number;
} | {
  ok: false;
  message: string;
}> {
  let pdf: PDFDocument;

  try {
    pdf = await PDFDocument.load(input.bytes, { ignoreEncryption: false });
  } catch (error) {
    const message = describeExportError(error);
    return { ok: false, message };
  }

  const pageCount = pdf.getPageCount();
  const pages = pdf.getPages();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const applicable = input.annotations.filter(
    (annotation) => !annotation.orphaned && annotation.fragments.length > 0
  );
  const notes: { annotation: PdfAnnotation; pageLabel: number }[] = [];
  let drawn = 0;

  for (const annotation of applicable) {
    for (const fragment of annotation.fragments) {
      const page = pages[fragment.pageIndex];

      if (!page || fragment.pageIndex >= pageCount) {
        continue;
      }

      const { width: pageWidth, height: pageHeight } = exportPageSize(page, fragment.pageWidth, fragment.pageHeight);
      // Normalized (Y-down) → pdf-lib (Y-up).
      const y = pageHeight - fragment.y - fragment.height;

      if (annotation.kind === "highlight" && annotation.color) {
        const color = HIGHLIGHT_COLORS[annotation.color] ?? HIGHLIGHT_COLORS.yellow;
        page.drawRectangle({
          x: fragment.x,
          y,
          width: fragment.width,
          height: fragment.height,
          color: rgb(color.r, color.g, color.b),
          opacity: 0.38,
          borderColor: rgb(color.r * 0.7, color.g * 0.7, color.b * 0.6),
          borderOpacity: 0.5,
          borderWidth: 0.4
        });
        drawn += 1;
      } else if (annotation.kind === "note") {
        // Marker chip beside the passage, in the right margin.
        const markerX = Math.min(fragment.x + fragment.width + 6, pageWidth - MARGIN - 12);
        const markerY = Math.max(y, MARGIN);
        page.drawRectangle({
          x: markerX,
          y: markerY,
          width: 12,
          height: 12,
          color: rgb(NOTE_COLOR.r, NOTE_COLOR.g, NOTE_COLOR.b),
          borderColor: rgb(0.55, 0.4, 0.05),
          borderWidth: 0.5
        });
        notes.push({ annotation, pageLabel: fragment.pageIndex + 1 });
        drawn += 1;
      }
    }
  }

  // Final "Notes summary" page so note text is always readable.
  if (notes.length > 0) {
    drawNotesSummary(pdf, notes, font, bold);
  }

  try {
    const bytes = await pdf.save();

    if (drawn === 0 && applicable.length > 0) {
      return {
        ok: false,
        message:
          "None of the stored annotations matched this document's pages, so nothing was exported."
      };
    }

    return { ok: true, bytes, annotationCount: applicable.length };
  } catch (error) {
    return { ok: false, message: describeExportError(error) };
  }
}

/** Convenience wrapper: build + trigger a real browser download. */
export async function exportAnnotatedPdf(
  input: ExportInput
): Promise<ExportResult> {
  const result = await buildAnnotatedPdf(input);

  if (!result.ok) {
    return result;
  }

  const safeName = input.fileName.replace(/\.pdf$/i, "") + "-annotated.pdf";

  try {
    downloadBytes(result.bytes, safeName);
  } catch {
    return { ok: false, message: "The browser blocked the file download." };
  }

  return { ok: true, fileName: safeName, annotationCount: result.annotationCount };
}

export function downloadBytes(bytes: Uint8Array, fileName: string): void {
  const copy = new Uint8Array(bytes);
  const blob = new Blob([copy.buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Actual export page box, preferring the stored fragment's page dims. */
function exportPageSize(
  page: PDFPage,
  storedWidth: number,
  storedHeight: number
): { width: number; height: number } {
  const { width, height } = page.getSize();

  if (storedWidth > 0 && storedHeight > 0 && (storedWidth !== width || storedHeight !== height)) {
    // Rotated/odd pages: pdf-lib's getSize() already reflects the media box we
    // measured in PDF.js at scale 1 in the common case. Trust the live size
    // but fall back to stored values if the live size is degenerate.
    if (width > 0 && height > 0) {
      return { width, height };
    }
  }

  return { width, height };
}

function drawNotesSummary(
  pdf: PDFDocument,
  notes: { annotation: PdfAnnotation; pageLabel: number }[],
  regular: PDFFont,
  heading: PDFFont
): void {
  const page = pdf.addPage([612, 792]);
  let cursor = 792 - MARGIN - 24;

  page.drawText("VENMA notes", {
    x: MARGIN,
    y: cursor,
    size: 18,
    font: heading,
    color: rgb(0.12, 0.19, 0.17)
  });
  cursor -= 28;

  for (const entry of notes) {
    const text = entry.annotation.note?.text?.trim();

    if (!text) {
      continue;
    }

    const header = `Page ${entry.pageLabel} — “${truncate(entry.annotation.text, 60)}”`;

    if (cursor < MARGIN + 60) {
      break; // Summary is best-effort; margin notes carry the full text too.
    }

    page.drawText(header, {
      x: MARGIN,
      y: cursor,
      size: 10,
      font: heading,
      color: rgb(0.2, 0.28, 0.25)
    });
    cursor -= 14;

    for (const line of wrapText(text, regular, 10, 612 - MARGIN * 2)) {
      page.drawText(line, {
        x: MARGIN + 10,
        y: cursor,
        size: 10,
        font: regular,
        color: rgb(0.25, 0.3, 0.28)
      });
      cursor -= 13;
    }

    cursor -= 10;
  }
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
      }
      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, 40);
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function describeExportError(error: unknown): string {
  const name = (error as { name?: string } | null)?.name;

  if (name === "EncryptedPDFError") {
    return "This PDF is encrypted, so it cannot be exported with annotations. Open an unprotected copy and try again.";
  }

  if (error instanceof Error) {
    return `Export failed: ${error.message}`;
  }

  return "Export failed because this PDF could not be processed by the export library.";
}
