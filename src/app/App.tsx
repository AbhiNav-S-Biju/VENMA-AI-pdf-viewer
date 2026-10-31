import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { AppHeader } from "../components/AppHeader";
import { DocumentToolbar } from "../features/pdf/DocumentToolbar";
import { PdfWorkspace } from "../features/pdf/PdfWorkspace";
import { NoteEditor } from "../features/pdf/NoteEditor";
import { SelectionToolbar } from "../features/pdf/SelectionToolbar";
import { AIAnnotationPopup } from "../features/pdf/AIAnnotationPopup";
import { useAnnotationEngine } from "../features/pdf/useAnnotationEngine";
import { PetAssistant } from "../features/pet/PetAssistant";
import {
  createPdfSourceFromFile,
  createPdfSourceFromUrl,
  loadPdfDocument
} from "../services/pdf/loadPdf";
import { fingerprintBytes } from "../services/annotations/fingerprint";
import type { PdfLoadState } from "../types/pdf";
import type { SelectionSnapshot } from "../types/annotation";
import type { PDFDocumentProxy } from "pdfjs-dist";

const DEFAULT_SCALE = 1;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const ZOOM_STEP = 0.15;
const NARROW_VIEWPORT = 900;

export function App() {
  const [loadState, setLoadState] = useState<PdfLoadState>({ status: "empty" });
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [fitToWidth, setFitToWidth] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [pageJumpToken, setPageJumpToken] = useState(0);
  const [workspaceElement, setWorkspaceElement] = useState<HTMLElement | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [pageDims, setPageDims] = useState<Map<number, { width: number; height: number }>>(
    () => new Map()
  );
  const [currentSelection, setCurrentSelection] = useState<SelectionSnapshot | null>(null);
  const [activeAnnotation, setActiveAnnotation] = useState<{
    id: string;
    anchor: DOMRect;
  } | null>(null);
  const activeDocumentRef = useRef<PdfLoadState>(loadState);

  useEffect(() => {
    activeDocumentRef.current = loadState;
  }, [loadState]);

  const readySource = loadState.status === "ready" ? loadState.source : null;
  const readyDocument = loadState.status === "ready" ? loadState.document : null;

  // Fingerprint the document content (not the filename) and measure every page
  // at scale 1 so annotation geometry can be validated against the open file.
  useEffect(() => {
    if (!readySource || !readyDocument) {
      setFingerprint(null);
      setPageDims(new Map());
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const [hash, dims] = await Promise.all([
          fingerprintBytes(readySource.bytes),
          measurePageDims(readyDocument)
        ]);

        if (cancelled) {
          return;
        }

        setFingerprint(hash);
        setPageDims(dims);
      } catch (error) {
        console.warn("Failed to prepare the document for annotations", error);
        if (!cancelled) {
          setFingerprint(null);
          setPageDims(new Map());
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [readyDocument, readySource]);

  const engine = useAnnotationEngine({
    source: readySource,
    pdfDocument: readyDocument,
    pageDims,
    fingerprint
  });
  // When a new mark lands, VENMA glances at its flag and looks pleased.
  const annotationCountRef = useRef(engine.annotations.length);
  const [celebrateToken, setCelebrateToken] = useState(0);
  useEffect(() => {
    const previous = annotationCountRef.current;
    annotationCountRef.current = engine.annotations.length;
    // Skip removals and the bulk restore of saved marks when a document opens.
    if (engine.annotations.length <= previous || (previous === 0 && engine.annotations.length > 1)) {
      return;
    }
    const newest = engine.annotations.reduce((latest, annotation) =>
      annotation.createdAt > latest.createdAt ? annotation : latest
    );
    const frame = window.requestAnimationFrame(() => {
      const flag = document.querySelector(`[data-annotation-id="${CSS.escape(newest.id)}"]`);
      if (flag) {
        const rect = flag.getBoundingClientRect();
        window.dispatchEvent(new CustomEvent("venma:look", {
          detail: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        }));
      }
      setCelebrateToken((value) => value + 1);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [engine.annotations]);

  const activeAnnotationRecord = activeAnnotation
    ? engine.annotations.find((annotation) => annotation.id === activeAnnotation.id) ?? null
    : null;

  const replaceCurrentDocument = useCallback(async (load: () => Promise<PdfLoadState>) => {
    window.getSelection()?.removeAllRanges();
    setCurrentSelection(null);

    const previousState = activeDocumentRef.current;

    setCurrentPage(1);
    // On narrow screens a page at 100% overflows; start fitted instead.
    setFitToWidth(window.innerWidth <= NARROW_VIEWPORT);
    setScale(DEFAULT_SCALE);
    setLoadState({ status: "loading", label: "Preparing document", progress: null });

    if (previousState.status === "ready") {
      window.setTimeout(() => {
        previousState.document.cleanup().catch((error: unknown) => {
          console.warn("Previous PDF cleanup failed", error);
        });
      }, 0);
    }

    try {
      const nextState = await load();
      setLoadState(nextState);
    } catch (error) {
      setLoadState({
        status: "error",
        title: "Document could not be opened",
        message:
          error instanceof Error
            ? error.message
            : "The document could not be opened because of an unknown error."
      });
    }
  }, []);

  const openFile = useCallback(
    (file: File, origin: "file" | "drop" = "file") => {
      void replaceCurrentDocument(async () => {
        setLoadState({
          status: "loading",
          label: origin === "drop" ? "Reading dropped PDF" : "Reading selected PDF",
          progress: null
        });
        const source = await createPdfSourceFromFile(file, origin, (progress) => {
          setLoadState({
            status: "loading",
            label: "Reading PDF file",
            progress
          });
        });
        const document = await loadPdfDocument(source);
        return {
          status: "ready",
          document,
          source,
          pageCount: document.numPages
        };
      });
    },
    [replaceCurrentDocument]
  );

  const openUrl = useCallback(() => {
    void replaceCurrentDocument(async () => {
      setLoadState({
        status: "loading",
        label: "Fetching PDF URL",
        progress: null
      });
      const source = await createPdfSourceFromUrl(urlValue, (progress) => {
        setLoadState({
          status: "loading",
          label: "Downloading PDF",
          progress
        });
      });
      const document = await loadPdfDocument(source);
      return {
        status: "ready",
        document,
        source,
        pageCount: document.numPages
      };
    });
  }, [replaceCurrentDocument, urlValue]);

  const goToPage = useCallback(
    (page: number) => {
      if (loadState.status !== "ready") {
        return;
      }

      setCurrentPage(clamp(page, 1, loadState.pageCount));
      setPageJumpToken((value) => value + 1);
    },
    [loadState]
  );

  const zoomIn = useCallback(() => {
    setFitToWidth(false);
    setScale((value) => clamp(roundScale(value + ZOOM_STEP), MIN_SCALE, MAX_SCALE));
  }, []);

  const zoomOut = useCallback(() => {
    setFitToWidth(false);
    setScale((value) => clamp(roundScale(value - ZOOM_STEP), MIN_SCALE, MAX_SCALE));
  }, []);

  const resetView = useCallback(() => {
    setFitToWidth(false);
    setScale(DEFAULT_SCALE);
  }, []);

  const enableFitToWidth = useCallback(() => {
    setFitToWidth(true);
  }, []);

  return (
    <ErrorBoundary>
      <div className="app-shell">
        <AppHeader>
          <DocumentToolbar
            canNavigate={loadState.status === "ready"}
            canUndo={engine.canUndo}
            canRedo={engine.canRedo}
            currentPage={currentPage}
            documentName={loadState.status === "ready" ? loadState.source.name : ""}
            exporting={engine.exportState.status === "exporting"}
            fitToWidth={fitToWidth}
            pageCount={loadState.status === "ready" ? loadState.pageCount : 0}
            scale={scale}
            urlValue={urlValue}
            onExport={engine.exportAnnotations}
            onFitToWidth={enableFitToWidth}
            onGoToPage={goToPage}
            onOpenFile={openFile}
            onOpenUrl={openUrl}
            onRedo={engine.redo}
            onResetView={resetView}
            onUndo={engine.undo}
            onUrlChange={setUrlValue}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
          />
        </AppHeader>
        <main className="workspace-layout" aria-label="PDF workspace">
          <PdfWorkspace
            currentPage={currentPage}
            fitToWidth={fitToWidth}
            loadState={loadState}
            pageJumpToken={pageJumpToken}
            scale={scale}
            annotations={engine.annotations}
            pageDims={pageDims}
            fingerprint={fingerprint}
            activeAnnotationId={activeAnnotation?.id ?? null}
            onCurrentPageChange={setCurrentPage}
            onFitScaleChange={setScale}
            onOpenFile={openFile}
            onWorkspaceElementChange={setWorkspaceElement}
            onSelectionChange={(selection) => {
              if (selection) {
                setCurrentSelection(selection.snapshot);
                engine.showSelectionToolbar(selection);
              } else {
                engine.hideSelectionToolbar();
              }
            }}
            onNoteActivate={(id, anchor) => setActiveAnnotation({ id, anchor })}
          />
          {engine.orphanedCount > 0 ? (
            <p className="annotation-notice" role="status">
              {engine.orphanedCount} saved annotation
              {engine.orphanedCount === 1 ? "" : "s"} could not be matched to this document and
              {engine.orphanedCount === 1 ? " was" : " were"} skipped.
            </p>
          ) : null}
          {engine.exportState.status === "error" ? (
            <p className="annotation-notice annotation-notice--error" role="alert">
              {engine.exportState.message}
            </p>
          ) : null}
        </main>

        {engine.selectionToolbar ? (
          <SelectionToolbar
            anchor={engine.selectionToolbar.anchor}
            onHighlight={engine.createHighlight}
            onAddNote={engine.beginNote}
            onDismiss={engine.hideSelectionToolbar}
          />
        ) : null}

        {engine.noteEditor ? (
          <NoteEditor
            mode={engine.noteEditor.mode}
            initialText={
              engine.noteEditor.mode === "edit" ? engine.noteEditor.noteText : ""
            }
            selectionText={
              engine.noteEditor.mode === "create" ? engine.noteEditor.snapshot.text : undefined
            }
            onSave={engine.saveNote}
            onDelete={
              engine.noteEditor.mode === "edit"
                ? () => engine.deleteNote((engine.noteEditor as { annotationId: string }).annotationId)
                : undefined
            }
            onCancel={engine.closeNoteEditor}
          />
        ) : null}
        {activeAnnotationRecord && activeAnnotation ? (
          <AIAnnotationPopup
            annotation={activeAnnotationRecord}
            anchor={activeAnnotation.anchor}
            onClose={() => setActiveAnnotation(null)}
            onEdit={() => {
              engine.openNote(activeAnnotationRecord.id);
              setActiveAnnotation(null);
            }}
            onDelete={() => {
              if (window.confirm("Delete this annotation?")) {
                engine.deleteNote(activeAnnotationRecord.id);
                setActiveAnnotation(null);
              }
            }}
          />
        ) : null}
        <PetAssistant
          petName="VENMA"
          celebrateToken={celebrateToken}
          onPanelOpen={engine.hideSelectionToolbar}
          documentName={loadState.status === "ready" ? loadState.source.name : ""}
          pageNumber={loadState.status === "ready" ? currentPage : null}
          workspaceElement={workspaceElement}
          selection={currentSelection}
          onCopyResponse={async (text) => {
            await navigator.clipboard.writeText(text);
          }}
          onAddExplanationNote={engine.addAiExplanationNote}
          onHighlightSelection={(color) => {
            if (currentSelection) {
              engine.createHighlightFromSelection(currentSelection, color);
            }
          }}
        />
      </div>
    </ErrorBoundary>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundScale(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Measure every page at scale 1, keyed by 0-based page index. */
async function measurePageDims(
  document: PDFDocumentProxy
): Promise<Map<number, { width: number; height: number }>> {
  const dims = new Map<number, { width: number; height: number }>();

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });

    dims.set(pageNumber - 1, { width: viewport.width, height: viewport.height });
    page.cleanup();
  }

  return dims;
}
