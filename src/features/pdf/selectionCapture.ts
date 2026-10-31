import type { SelectionSnapshot } from "../../types/annotation";
import {
  normalizeSelectionRects,
  type ClientRectLike
} from "../../services/annotations/coordinates";
import type { PageDims } from "./useAnnotationEngine";
import { newId } from "./useAnnotationEngine";

/**
 * DOM-side snapshot builder.
 *
 * Walks the browser selection range by range, buckets each text node by the
 * page it belongs to, then normalizes its client rects into PDF page space
 * (multi-line selections merge into per-line boxes; cross-page selections
 * produce fragments on each affected page, one logical annotation).
 */
export function captureSelectionSnapshot(input: {
  selection: Selection;
  pageDims: Map<number, PageDims>;
  fingerprint: string;
}): SelectionSnapshot | null {
  const { selection, pageDims, fingerprint } = input;
  const text = selection.toString().replace(/\s+/g, " ").trim();

  if (!text) {
    return null;
  }

  const fragments = [];

  for (let index = 0; index < selection.rangeCount; index += 1) {
    const range = selection.getRangeAt(index);

    // Collect text nodes in reading order that intersect the range.
    const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let node = walker.nextNode() as Text | null;

    while (node) {
      if (node.textContent?.trim() && range.intersectsNode(node)) {
        nodes.push(node);
      }
      node = walker.nextNode() as Text | null;
    }

    for (const textNode of nodes) {
      const pageHost = textNode.parentElement?.closest<HTMLElement>("[data-page-index]");
      const surface = pageHost?.querySelector<HTMLElement>(".pdf-page__surface");
      const pageIndexValue = pageHost?.dataset.pageIndex;

      if (!pageHost || !surface || pageIndexValue === undefined) {
        continue;
      }

      const pageIndex = Number(pageIndexValue);

      if (!Number.isInteger(pageIndex) || pageIndex < 0) {
        continue;
      }

      const dims = pageDims.get(pageIndex);

      if (!dims) {
        continue;
      }

      // Narrow this node's range to the intersection with the selection.
      const nodeRange = document.createRange();
      nodeRange.selectNodeContents(textNode);

      if (nodeRange.compareBoundaryPoints(Range.START_TO_START, range) < 0) {
        nodeRange.setStart(range.startContainer, range.startOffset);
      }
      if (nodeRange.compareBoundaryPoints(Range.END_TO_END, range) > 0) {
        nodeRange.setEnd(range.endContainer, range.endOffset);
      }

      if (!nodeRange.toString().trim()) {
        continue;
      }

      const rects: ClientRectLike[] = Array.from(nodeRange.getClientRects());

      // The viewport scale the rects were measured at: current rendered page
      // width divided by the page width at scale 1.
      const rendered = surface.getBoundingClientRect();
      const scale = rendered.width / dims.width;

      fragments.push(
        ...normalizeSelectionRects(
          pageIndex,
          dims.width,
          dims.height,
          scale,
          rendered,
          rects
        )
      );
    }
  }

  if (fragments.length === 0) {
    return null;
  }

  // Stable ordering: page, then top, then left.
  fragments.sort((a, b) => a.pageIndex - b.pageIndex || a.y - b.y || a.x - b.x);

  return {
    id: newId(),
    fingerprint,
    text,
    createdAt: Date.now(),
    fragments
  };
}

/** Toolbar anchor: fixed-position point just after the last selected line. */
export function selectionToolbarAnchor(fragments: SelectionSnapshot["fragments"]): {
  x: number;
  y: number;
} {
  const last = fragments[fragments.length - 1];

  if (!last) {
    return { x: 0, y: 0 };
  }

  const surface = document.querySelector<HTMLElement>(
    `[data-page-index="${last.pageIndex}"] .pdf-page__surface`
  );

  if (!surface) {
    return { x: 0, y: 0 };
  }

  const box = surface.getBoundingClientRect();
  const widthRatio = box.width / (last.pageWidth || 1);
  const heightRatio = box.height / (last.pageHeight || 1);

  return {
    x: box.left + (last.x + last.width) * widthRatio,
    y: box.top + last.y * heightRatio
  };
}
