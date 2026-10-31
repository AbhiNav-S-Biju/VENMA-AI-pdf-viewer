import { useRef, type ChangeEvent, type FormEvent } from "react";
import { Icon } from "../../components/Icon";

type DocumentToolbarProps = {
  canNavigate: boolean;
  canUndo: boolean;
  canRedo: boolean;
  currentPage: number;
  documentName: string;
  exporting: boolean;
  fitToWidth: boolean;
  pageCount: number;
  scale: number;
  urlValue: string;
  onExport: () => void;
  onFitToWidth: () => void;
  onGoToPage: (page: number) => void;
  onOpenFile: (file: File, origin?: "file" | "drop") => void;
  onOpenUrl: () => void;
  onRedo: () => void;
  onResetView: () => void;
  onUndo: () => void;
  onUrlChange: (value: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

export function DocumentToolbar({
  canNavigate,
  canUndo,
  canRedo,
  currentPage,
  documentName,
  exporting,
  fitToWidth,
  pageCount,
  scale,
  urlValue,
  onExport,
  onFitToWidth,
  onGoToPage,
  onOpenFile,
  onOpenUrl,
  onRedo,
  onResetView,
  onUndo,
  onUrlChange,
  onZoomIn,
  onZoomOut
}: DocumentToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      onOpenFile(file, "file");
    }

    event.target.value = "";
  }

  function handleUrlSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onOpenUrl();
  }

  return (
    <section className="document-toolbar" aria-label="Document tools">
      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleFileChange}
      />
      <div className="toolbar-group">
        <button className="button-primary" type="button" aria-label="Open PDF" onClick={() => fileInputRef.current?.click()}>
          <Icon name="open" />
          <span className="button-label">Open PDF</span>
        </button>
        <details className="url-loader">
          <summary aria-label="Open a PDF from a URL" title="Open from URL">
            <Icon name="link" />
          </summary>
          <form onSubmit={handleUrlSubmit}>
            <label className="visually-hidden" htmlFor="pdf-url">PDF URL</label>
            <input id="pdf-url" type="url" inputMode="url" placeholder="https://example.com/document.pdf"
              value={urlValue} onChange={(event) => onUrlChange(event.target.value)} />
            <button type="submit" className="button-primary">Load</button>
          </form>
        </details>
      </div>
      <div className="document-title" title={documentName || "No document open"}>
        <span className="visually-hidden">Current document: </span>
        <strong>{documentName || "No document open"}</strong>
      </div>
      <div className="toolbar-group page-controls" aria-label="Page controls">
        <button
          type="button"
          className="icon-button"
          aria-label="Previous page"
          disabled={!canNavigate || currentPage <= 1}
          onClick={() => onGoToPage(currentPage - 1)}
        >
          <Icon name="prev" />
        </button>
        <label>
          <span className="visually-hidden">Current page</span>
          <input
            type="number"
            min={canNavigate ? 1 : undefined}
            max={canNavigate ? pageCount : undefined}
            value={canNavigate ? currentPage : ""}
            disabled={!canNavigate}
            onChange={(event) => onGoToPage(Number(event.target.value))}
          />
        </label>
        <span className="page-total">of {pageCount || "–"}</span>
        <button
          type="button"
          className="icon-button"
          aria-label="Next page"
          disabled={!canNavigate || currentPage >= pageCount}
          onClick={() => onGoToPage(currentPage + 1)}
        >
          <Icon name="next" />
        </button>
      </div>
      <div className="toolbar-group zoom-controls" aria-label="Zoom controls">
        <button type="button" className="icon-button" disabled={!canNavigate} onClick={onZoomOut} aria-label="Zoom out">
          <Icon name="minus" />
        </button>
        <button type="button" className="zoom-value" disabled={!canNavigate} onClick={onResetView} title="Reset zoom">
          {Math.round(scale * 100)}%
        </button>
        <button type="button" className="icon-button" disabled={!canNavigate} onClick={onZoomIn} aria-label="Zoom in">
          <Icon name="plus" />
        </button>
        <button
          type="button"
          className={`icon-button${fitToWidth ? " is-active" : ""}`}
          aria-label="Fit page to width"
          aria-pressed={fitToWidth}
          title="Fit width"
          disabled={!canNavigate}
          onClick={onFitToWidth}
        >
          <Icon name="fit" />
        </button>
      </div>
      <div className="toolbar-group annotation-controls" aria-label="Annotation controls">
        <button type="button" className="icon-button" disabled={!canUndo} onClick={onUndo} aria-label="Undo annotation change" title="Undo">
          <Icon name="undo" />
        </button>
        <button type="button" className="icon-button" disabled={!canRedo} onClick={onRedo} aria-label="Redo annotation change" title="Redo">
          <Icon name="redo" />
        </button>
        <button
          type="button"
          className="button-export"
          aria-label={exporting ? "Exporting PDF" : "Export PDF"}
          disabled={!canNavigate || exporting}
          onClick={onExport}
        >
          <Icon name="export" />
          <span className="button-label">{exporting ? "Exporting…" : "Export PDF"}</span>
        </button>
      </div>
    </section>
  );
}
