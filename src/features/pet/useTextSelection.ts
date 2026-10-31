import { useEffect, useState } from "react";

export type SelectionSnapshot = {
  text: string;
  /** Which PDF page the selection came from, when it can be determined. */
  pageNumber: number | null;
  /** All page indices (0-based) the selection spans — supports cross-page selections. */
  pageIndexes: number[];
};

/**
 * Tracks the user's current text selection inside the PDF workspace.
 *
 * Listens on the document so it never interferes with native selection, and
 * ignores anything selected inside the pet or the assistant panel (those have
 * `data-selection-ignore`), so dragging the pet or reading the panel can't
 * pollute the selected-text preview.
 */
export function useTextSelection(): SelectionSnapshot {
  const [snapshot, setSnapshot] = useState<SelectionSnapshot>({ text: "", pageNumber: null, pageIndexes: [] });

  useEffect(() => {
    let frame = 0;

    function readSelection() {
      const selection = window.getSelection();

      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        setSnapshot((previous) => (previous.text ? { text: "", pageNumber: null, pageIndexes: [] } : previous));
        return;
      }

      const range = selection.getRangeAt(0);

      if (isInsideIgnoredRegion(range.commonAncestorContainer)) {
        return;
      }

      const text = selection.toString().replace(/\s+/g, " ").trim();

      setSnapshot((previous) =>
        previous.text === text
          ? previous
          : { text, pageNumber: findPageNumber(range.startContainer), pageIndexes: collectPageIndexes(range) }
      );
    }

    function scheduleRead() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(readSelection);
    }

    document.addEventListener("selectionchange", scheduleRead);
    document.addEventListener("mouseup", scheduleRead);
    document.addEventListener("keyup", scheduleRead);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("selectionchange", scheduleRead);
      document.removeEventListener("mouseup", scheduleRead);
      document.removeEventListener("keyup", scheduleRead);
    };
  }, []);

  return snapshot;
}

function isInsideIgnoredRegion(node: Node | null): boolean {
  if (!node) {
    return false;
  }

  const element = node instanceof Element ? node : node.parentElement;
  return Boolean(element?.closest("[data-selection-ignore='true']"));
}

function findPageNumber(node: Node | null): number | null {
  if (!node) {
    return null;
  }

  const element = node instanceof Element ? node : node.parentElement;
  const page = element?.closest<HTMLElement>("[data-page-number]");
  const value = Number(page?.dataset.pageNumber);

  return Number.isFinite(value) ? value : null;
}

/** Collect the 0-based page indices a selection spans (for cross-page selections). */
function collectPageIndexes(range: Range): number[] {
  const indexes = new Set<number>();

  const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    if (range.intersectsNode(node)) {
      const element = node instanceof Element ? node : node.parentElement;
      const page = element?.closest<HTMLElement>("[data-page-number]");
      const value = Number(page?.dataset.pageNumber);

      if (Number.isFinite(value) && value > 0) {
        indexes.add(value - 1);
      }
    }
    node = walker.nextNode();
  }

  return [...indexes].sort((a, b) => a - b);
}
