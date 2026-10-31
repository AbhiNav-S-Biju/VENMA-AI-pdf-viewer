import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { PdfPage } from "./PdfPage";
import type { PdfLoadState } from "../../types/pdf";
import type { PdfAnnotation, SelectionSnapshot } from "../../types/annotation";
import type { PageDims } from "./useAnnotationEngine";
import { captureSelectionSnapshot, selectionToolbarAnchor } from "./selectionCapture";
import { VenmaCat } from "../pet/VenmaCat";
import { usePrefersReducedMotion } from "../pet/usePrefersReducedMotion";
import { Icon } from "../../components/Icon";

const PAGE_GAP = 24;
const PAGE_SIDE_PADDING = 32;

type PdfWorkspaceProps = {
  currentPage: number;
  fitToWidth: boolean;
  loadState: PdfLoadState;
  pageJumpToken: number;
  scale: number;
  annotations: PdfAnnotation[];
  pageDims: Map<number, PageDims>;
  fingerprint: string | null;
  activeAnnotationId: string | null;
  onCurrentPageChange: (page: number) => void;
  onFitScaleChange: (scale: number) => void;
  onOpenFile: (file: File, origin?: "file" | "drop") => void;
  onWorkspaceElementChange?: (element: HTMLElement | null) => void;
  onSelectionChange: (
    selection: { snapshot: SelectionSnapshot; anchor: { x: number; y: number } } | null
  ) => void;
  onNoteActivate: (annotationId: string, anchor: DOMRect) => void;
};

export function PdfWorkspace({
  currentPage,
  fitToWidth,
  loadState,
  pageJumpToken,
  scale,
  annotations,
  pageDims,
  fingerprint,
  activeAnnotationId,
  onCurrentPageChange,
  onFitScaleChange,
  onOpenFile,
  onWorkspaceElementChange,
  onSelectionChange,
  onNoteActivate
}: PdfWorkspaceProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const observedPagesRef = useRef(new Map<number, HTMLElement>());
  const pageNumbers = useMemo(
    () =>
      loadState.status === "ready"
        ? Array.from({ length: loadState.pageCount }, (_, index) => index + 1)
        : [],
    [loadState]
  );

  useEffect(() => {
    onWorkspaceElementChange?.(sectionRef.current);
    return () => onWorkspaceElementChange?.(null);
  }, [onWorkspaceElementChange]);

  const observePage = useCallback((pageNumber: number, element: HTMLElement | null) => {
    if (element) {
      observedPagesRef.current.set(pageNumber, element);
    } else {
      observedPagesRef.current.delete(pageNumber);
    }
  }, []);

  useEffect(() => {
    const scrollElement = scrollRef.current;

    if (!scrollElement || loadState.status !== "ready") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visibleEntry) {
          return;
        }

        const pageNumber = Number(
          (visibleEntry.target as HTMLElement).dataset.pageNumber ?? currentPage
        );

        if (Number.isFinite(pageNumber)) {
          onCurrentPageChange(pageNumber);
        }
      },
      {
        root: scrollElement,
        threshold: [0.2, 0.45, 0.7]
      }
    );

    for (const page of observedPagesRef.current.values()) {
      observer.observe(page);
    }

    return () => observer.disconnect();
  }, [currentPage, loadState, onCurrentPageChange, pageNumbers]);

  useEffect(() => {
    if (!fitToWidth || loadState.status !== "ready") {
      return;
    }

    let resizeObserver: ResizeObserver | null = null;
    let cancelled = false;

    async function updateFitScale() {
      const scrollElement = scrollRef.current;

      if (!scrollElement || loadState.status !== "ready") {
        return;
      }

      const firstPage = await loadState.document.getPage(1);
      const baseViewport = firstPage.getViewport({ scale: 1 });
      // Read the live padding: it widens on the right for flags and the open drawer.
      const style = window.getComputedStyle(scrollElement);
      const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const availableWidth = scrollElement.clientWidth - (Number.isFinite(padding) ? padding : PAGE_SIDE_PADDING * 2);
      const nextScale = Math.max(0.5, Math.min(2.5, availableWidth / baseViewport.width));

      firstPage.cleanup();

      if (!cancelled) {
        onFitScaleChange(Math.round(nextScale * 100) / 100);
      }
    }

    void updateFitScale();

    if (scrollRef.current) {
      resizeObserver = new ResizeObserver(() => {
        void updateFitScale();
      });
      resizeObserver.observe(scrollRef.current);
    }

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
    };
  }, [fitToWidth, loadState, onFitScaleChange]);

  useEffect(() => {
    const page = observedPagesRef.current.get(currentPage);

    if (page) {
      page.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [pageJumpToken]);

  // Detect a finished text selection and hand the normalized snapshot up to the
  // annotation engine, which owns the toolbar state.
  useEffect(() => {
    if (loadState.status !== "ready" || !fingerprint) {
      return;
    }

    let frame = 0;

    function readSelection() {
      frame = 0;
      const selection = window.getSelection();

      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        onSelectionChange(null);
        return;
      }

      const anchorNode = selection.anchorNode;
      const element = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;

      if (element?.closest("[data-selection-ignore='true']")) {
        return;
      }

      if (!element?.closest(".pdf-page__text-layer")) {
        return;
      }

      const snapshot = captureSelectionSnapshot({
        selection,
        pageDims,
        fingerprint: fingerprint as string
      });

      if (!snapshot) {
        onSelectionChange(null);
        return;
      }

      onSelectionChange({ snapshot, anchor: selectionToolbarAnchor(snapshot.fragments) });
    }

    function schedule() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(readSelection);
    }

    document.addEventListener("mouseup", schedule);
    document.addEventListener("keyup", schedule);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("mouseup", schedule);
      document.removeEventListener("keyup", schedule);
    };
  }, [fingerprint, loadState.status, onSelectionChange, pageDims]);

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files[0];

    if (file) {
      onOpenFile(file, "drop");
    }
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    if (!dragOver) setDragOver(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    // Ignore leaves into child elements; only leaving the desk itself counts.
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDragOver(false);
    }
  }

  return (
    <section
      ref={sectionRef}
      className="pdf-workspace"
      aria-label="PDF reading workspace"
      data-dragover={dragOver ? "true" : "false"}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {loadState.status === "empty" ? (
        <EmptyState onOpenFile={onOpenFile} />
      ) : null}

      {loadState.status === "loading" ? (
        <LoadingState label={loadState.label} progress={loadState.progress} />
      ) : null}

      {loadState.status === "error" ? (
        <ErrorState title={loadState.title} message={loadState.message} onOpenFile={onOpenFile} />
      ) : null}

      {loadState.status === "ready" ? (
        <div ref={scrollRef} className="pdf-scroll-region" key={loadState.source.id}>
          <div className="pdf-pages" style={{ gap: PAGE_GAP }}>
            {pageNumbers.map((pageNumber) => {
              const pageIndex = pageNumber - 1;
              const pageAnnotations = annotations.filter((annotation) =>
                annotation.fragments.some((fragment) => fragment.pageIndex === pageIndex)
              );

              return (
                <PdfPage
                  key={`${loadState.source.id}-${pageNumber}-${scale}`}
                  documentId={loadState.source.id}
                  pdfDocument={loadState.document}
                  pageNumber={pageNumber}
                  scale={scale}
                  observePage={observePage}
                  annotations={pageAnnotations}
                  pageDims={pageDims.get(pageIndex) ?? null}
                  activeAnnotationId={activeAnnotationId}
                  onNoteActivate={onNoteActivate}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function EmptyState({
  onOpenFile
}: {
  onOpenFile: (file: File, origin?: "file" | "drop") => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div className="empty-state">
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept="application/pdf,.pdf"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onOpenFile(file, "file");
          }
          event.target.value = "";
        }}
      />
      <div className="empty-state__sheet" aria-hidden="true">
        <span className="empty-state__flag empty-state__flag--yellow" />
        <span className="empty-state__flag empty-state__flag--pink" />
        <span className="empty-state__flag empty-state__flag--mint" />
        <span className="empty-state__line" />
        <span className="empty-state__line empty-state__line--short" />
        <span className="empty-state__line empty-state__line--mark" />
        <span className="empty-state__line" />
        <span className="empty-state__line empty-state__line--short" />
      </div>
      <VenmaCat className="empty-state__cat" mood="curious" size={150} motionless={prefersReducedMotion} />
      <div className="empty-state__copy">
        <h2>Drop a PDF on the desk</h2>
        <p>
          Highlight as you read, and select any passage to ask VENMA for an explanation,
          an example or study notes. Your files stay in this browser.
        </p>
        <button type="button" className="button-primary button-large" onClick={() => inputRef.current?.click()}>
          <Icon name="open" />
          Choose a PDF
        </button>
      </div>
    </div>
  );
}

function LoadingState({ label, progress }: { label: string; progress: number | null }) {
  const percent = progress === null ? null : Math.round(progress * 100);
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div className="loading-state" role="status" aria-live="polite">
      <VenmaCat mood="thinking" size={96} motionless={prefersReducedMotion} trackPointer={false} />
      <h2>{label}</h2>
      <progress value={progress ?? undefined} max={1} />
      <p>{percent === null ? "Working on it..." : `${percent}%`}</p>
    </div>
  );
}

function ErrorState({
  title,
  message,
  onOpenFile
}: {
  title: string;
  message: string;
  onOpenFile: (file: File, origin?: "file" | "drop") => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="error-panel" role="alert">
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept="application/pdf,.pdf"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onOpenFile(file, "file");
          }
          event.target.value = "";
        }}
      />
      <VenmaCat mood="error" size={96} motionless trackPointer={false} />
      <h2>{title}</h2>
      <p>{message}</p>
      <button type="button" className="button-primary" onClick={() => inputRef.current?.click()}>
        Choose another PDF
      </button>
    </div>
  );
}
