import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PdfAnnotation } from "../../types/annotation";
import { MarkdownContent } from "../../components/MarkdownContent";
import { Icon } from "../../components/Icon";

type AIAnnotationPopupProps = {
  annotation: PdfAnnotation;
  anchor: DOMRect;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function AIAnnotationPopup({
  annotation,
  anchor,
  onClose,
  onEdit,
  onDelete
}: AIAnnotationPopupProps) {
  const popupRef = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState({ left: anchor.left, top: anchor.bottom + 10 });

  useLayoutEffect(() => {
    const updatePosition = () => {
      const popup = popupRef.current;
      if (!popup) return;
      const marker = document.querySelector<HTMLElement>(
        `[data-annotation-id="${CSS.escape(annotation.id)}"]`
      );
      const currentAnchor = marker?.getBoundingClientRect() ?? anchor;
      const margin = 12;
      const rect = popup.getBoundingClientRect();
      setPosition({
        left: Math.max(
          margin,
          Math.min(currentAnchor.left, window.innerWidth - rect.width - margin)
        ),
        top:
          currentAnchor.bottom + 10 + rect.height <= window.innerHeight - margin
            ? currentAnchor.bottom + 10
            : Math.max(margin, currentAnchor.top - rect.height - 10)
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchor, annotation.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [onClose]);

  const isAi = annotation.note?.kind === "ai";
  const content = (
    <aside
      ref={popupRef}
      className="ai-annotation-popup"
      role="dialog"
      aria-modal="false"
      aria-labelledby="ai-annotation-popup-heading"
      style={{ left: position.left, top: position.top }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <header className="ai-annotation-popup__header">
        <span className="ai-annotation-popup__identity" data-kind={isAi ? "ai" : "user"} aria-hidden="true">
          <Icon name={isAi ? "sparkle" : "note"} size={16} />
        </span>
        <h2 id="ai-annotation-popup-heading">{isAi ? "VENMA's explanation" : "Your note"}</h2>
        <button type="button" className="ai-annotation-popup__close icon-button" aria-label="Close annotation" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>
      <div className="ai-annotation-popup__body">
        <p className="ai-annotation-popup__meta">
          <span className="ai-annotation-popup__swatch" aria-hidden="true" />
          Page {annotation.fragments[0]?.pageIndex + 1} · the passage is highlighted in the document
        </p>
        <section>
          <MarkdownContent
            className="ai-annotation-popup__response"
            content={annotation.note?.text ?? "No saved response."}
          />
        </section>
      </div>
      <footer className="ai-annotation-popup__actions">
        <button type="button" onClick={onEdit}>Edit</button>
        <button type="button" className="ai-annotation-popup__delete" onClick={onDelete}>Delete</button>
      </footer>
    </aside>
  );
  return createPortal(content, document.body);
}
