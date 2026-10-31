import { useEffect, useRef, useState } from "react";
import { TextLayer } from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import type { PdfAnnotation } from "../../types/annotation";
import { AnnotationLayer } from "./AnnotationLayer";

type PdfPageProps = {
  documentId: string;
  pdfDocument: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  observePage: (pageNumber: number, element: HTMLElement | null) => void;
  /** Annotations to draw on this page (already filtered by the workspace). */
  annotations: PdfAnnotation[];
  /** Page size at scale 1, needed by the overlay's PDF-space viewBox. */
  pageDims: { width: number; height: number } | null;
  activeAnnotationId: string | null;
  onNoteActivate: (annotationId: string, anchor: DOMRect) => void;
};

export function PdfPage({
  documentId,
  pdfDocument,
  pageNumber,
  scale,
  observePage,
  annotations,
  pageDims,
  activeAnnotationId,
  onNoteActivate
}: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const pageShellRef = useRef<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renderedViewport, setRenderedViewport] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    observePage(pageNumber, pageShellRef.current);
    return () => observePage(pageNumber, null);
  }, [observePage, pageNumber]);

  useEffect(() => {
    let isActive = true;
    let page: PDFPageProxy | null = null;
    let renderTask: RenderTask | null = null;
    let textLayer: TextLayer | null = null;

    async function renderPage() {
      const canvas = canvasRef.current;
      const textLayerElement = textLayerRef.current;

      if (!canvas || !textLayerElement) {
        return;
      }

      setError(null);
      setRenderedViewport(null);
      textLayerElement.replaceChildren();

      try {
        page = await pdfDocument.getPage(pageNumber);

        if (!isActive) {
          return;
        }

        const viewport = page.getViewport({ scale });
        const outputScale = window.devicePixelRatio || 1;
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Canvas rendering is not available in this browser.");
        }

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        textLayerElement.style.width = `${viewport.width}px`;
        textLayerElement.style.height = `${viewport.height}px`;
        setRenderedViewport({ width: viewport.width, height: viewport.height });

        context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
        renderTask = page.render({ canvas, canvasContext: context, viewport });
        await renderTask.promise;

        if (!isActive) {
          return;
        }

        textLayer = new TextLayer({
          textContentSource: await page.getTextContent(),
          container: textLayerElement,
          viewport
        });

        await textLayer.render();
      } catch (renderError) {
        if (!isActive || isRenderingCancelled(renderError)) {
          return;
        }

        setError(
          renderError instanceof Error
            ? renderError.message
            : "This page could not be rendered."
        );
      }
    }

    void renderPage();

    return () => {
      isActive = false;
      renderTask?.cancel();
      textLayer?.cancel();
      page?.cleanup();
    };
  }, [documentId, pageNumber, pdfDocument, scale]);

  return (
    <article
      ref={pageShellRef}
      className="pdf-page"
      data-page-number={pageNumber}
      data-page-index={pageNumber - 1}
      aria-label={`Page ${pageNumber}`}
    >
      <div className="pdf-page__surface">
        <canvas ref={canvasRef} className="pdf-page__canvas" />
        {pageDims && renderedViewport ? (
          <AnnotationLayer
            dims={pageDims}
            renderedDims={renderedViewport}
            scale={scale}
            pageIndex={pageNumber - 1}
            annotations={annotations}
            activeAnnotationId={activeAnnotationId}
            onNoteActivate={onNoteActivate}
          />
        ) : null}
        <div ref={textLayerRef} className="textLayer pdf-page__text-layer" />
      </div>
      {error ? (
        <div className="page-render-error" role="alert">
          Page {pageNumber} failed to render: {error}
        </div>
      ) : null}
    </article>
  );
}

function isRenderingCancelled(error: unknown): boolean {
  return error instanceof Error && error.name === "RenderingCancelledException";
}
