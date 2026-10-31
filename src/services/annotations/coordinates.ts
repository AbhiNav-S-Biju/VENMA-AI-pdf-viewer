/**
 * Coordinate conversion for the annotation engine.
 *
 * Browser client rectangles are ONLY the raw input. Every rectangle that is
 * stored or persisted is first normalized here into "PDF page space":
 *
 *   - origin at the page's top-left,
 *   - units are PDF points (1/72"), i.e. the page dimensions at viewport
 *     scale 1,
 *   - Y grows downward (matching screen geometry; the single flip from PDF's
 *     bottom-left origin happens once, here).
 *
 * Rendering back to the screen at the current zoom is the exact inverse
 * (multiply by the viewport scale), so overlays stay aligned at any zoom,
 * scroll position, or window size without ever touching stored data.
 *
 * This module is deliberately DOM-free (plain shape parameters) so it can be
 * unit-tested under Node.
 */
import type { FragmentRect } from "../../types/annotation.ts";

/** Internal accumulator before line-merging assigns final fragment ids. */
type AnnotationFragment = Omit<FragmentRect, "id" | "order"> & { id: string };

/** Minimal shape of a DOMRect — safe to pass mocked rects in tests. */
export type ClientRectLike = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Tolerance (client px) for deciding that two rects share a text line. */
const LINE_MERGE_TOLERANCE_PX = 2;

/** Hard cap so a runaway selection cannot create thousands of fragments. */
export const MAX_FRAGMENTS = 300;

/**
 * Convert raw client rects from a selection Range into normalized,
 * line-merged PDF-space fragments for one page.
 *
 * @param pageIndex    0-based PDF page index
 * @param pageWidth    page width at scale 1 (PDF points)
 * @param pageHeight   page height at scale 1 (PDF points)
 * @param scale        the viewport scale the rects were measured at
 * @param pageRect     client rect of the page surface element
 * @param rects        raw client rects from Range.getClientRects()
 */
export function normalizeSelectionRects(
  pageIndex: number,
  pageWidth: number,
  pageHeight: number,
  scale: number,
  pageRect: ClientRectLike,
  rects: ClientRectLike[]
): FragmentRect[] {
  if (scale <= 0 || !Number.isFinite(scale)) {
    return [];
  }

  // 1. Normalize every client rect to PDF points, dropping degenerate rects.
  const normalized: AnnotationFragment[] = [];

  for (const rect of rects) {
    const x = (rect.left - pageRect.left) / scale;
    const y = (rect.top - pageRect.top) / scale;
    const width = rect.width / scale;
    const height = rect.height / scale;

    if (width < 1 || height < 1) {
      continue;
    }

    // Clamp into the page so stray rects (caret collapses, layer overflow)
    // cannot produce out-of-bounds geometry.
    const clampedX = Math.max(0, Math.min(x, pageWidth));
    const clampedY = Math.max(0, Math.min(y, pageHeight));
    const clampedWidth = Math.max(1, Math.min(width, pageWidth - clampedX));
    const clampedHeight = Math.max(1, Math.min(height, pageHeight - clampedY));

    normalized.push({
      id: `r${normalized.length}`,
      pageIndex,
      pageWidth,
      pageHeight,
      x: clampTo2(clampedX),
      y: clampTo2(clampedY),
      width: clampTo2(clampedWidth),
      height: clampTo2(clampedHeight)
    });
  }

  // 2. Merge rects that sit on the same text line into one line box.
  const lines: AnnotationFragment[] = [];

  for (const fragment of normalized) {
    const tolerance = LINE_MERGE_TOLERANCE_PX / scale;
    const line = lines.find(
      (candidate) =>
        Math.abs(candidate.y - fragment.y) < tolerance &&
        Math.abs(candidate.height - fragment.height) < tolerance
    );

    if (line) {
      const left = Math.min(line.x, fragment.x);
      const right = Math.max(line.x + line.width, fragment.x + fragment.width);
      line.x = clampTo2(left);
      line.width = clampTo2(right - left);
    } else {
      lines.push({ ...fragment });
    }
  }

  // 3. Reading order: top to bottom, then left to right. `order` records the
  //    final reading position so cross-page fragments can be sorted globally.
  lines.sort((a, b) => a.y - b.y || a.x - b.x);

  return lines.slice(0, MAX_FRAGMENTS).map((fragment, order) => ({
    ...fragment,
    id: `f${order}`,
    order
  }));
}

/** Convert stored PDF-space fragments back to on-screen offsets at a scale. */
export function fragmentToClientBox(
  fragment: FragmentRect,
  scale: number
): { left: number; top: number; width: number; height: number } {
  return {
    left: fragment.x * scale,
    top: fragment.y * scale,
    width: fragment.width * scale,
    height: fragment.height * scale
  };
}

export function computePdfPageRect(
  pageWidth: number,
  pageHeight: number,
  containerWidth: number,
  _containerHeight: number,
  verticalOffset = 0
): { left: number; top: number; width: number; height: number } {
  return {
    left: Math.max(0, (containerWidth - pageWidth) / 2),
    top: verticalOffset,
    width: pageWidth,
    height: pageHeight
  };
}

export function normalizePageNumber(pageNumber: number, pageCount: number): number {
  return Math.min(Math.max(Math.trunc(pageNumber), 1), Math.max(Math.trunc(pageCount), 1));
}

export function clampScroll(scrollOffset: number, contentSize: number, viewportSize: number): number {
  return Math.min(Math.max(scrollOffset, 0), Math.max(contentSize - viewportSize, 0));
}

/**
 * A fragment is renderable when it still fits the current page dimensions.
 * Used to detect annotations whose stored geometry no longer matches the
 * document (the document was replaced), so they are handled gracefully
 * instead of drawing garbage.
 */
export function isFragmentRenderable(
  fragment: FragmentRect,
  pageWidth: number,
  pageHeight: number,
  tolerance = 1
): boolean {
  return (
    fragment.pageIndex >= 0 &&
    Math.abs(fragment.pageWidth - pageWidth) <= tolerance &&
    Math.abs(fragment.pageHeight - pageHeight) <= tolerance &&
    fragment.x >= 0 &&
    fragment.y >= 0 &&
    fragment.x + fragment.width <= pageWidth + tolerance &&
    fragment.y + fragment.height <= pageHeight + tolerance
  );
}

function clampTo2(value: number): number {
  return Math.round(value * 100) / 100;
}
