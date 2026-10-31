import {
  memo,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent
} from "react";
import type {
  FragmentRect,
  HighlightColor,
  PdfAnnotation
} from "../../types/annotation";
import { Icon } from "../../components/Icon";

export type AnnotationLayerProps = {
  /** PDF page dimensions at scale 1 — used as the SVG viewBox so rects in
   * PDF points map 1:1 onto the rendered canvas at any zoom level. */
  dims: { width: number; height: number };
  renderedDims: { width: number; height: number };
  scale: number;
  pageIndex: number;
  annotations: PdfAnnotation[];
  activeAnnotationId: string | null;
  onNoteActivate: (id: string, anchor: DOMRect) => void;
};

/** Highlighter inks, matched to the sticky flags in global.css. */
const HIGHLIGHT_FILL: Record<HighlightColor, { fill: string; opacity: number }> = {
  yellow: { fill: "#FFE04A", opacity: 0.5 },
  green: { fill: "#5EDCA0", opacity: 0.38 },
  pink: { fill: "#FF8FB8", opacity: 0.38 }
};

/** Flags are 26px tall; keep at least this much between their tops. */
const FLAG_SPACING = 30;

const MARKER_STORAGE_PREFIX = "venma.annotation.marker.v1:";
function readMarkerOffset(annotationId: string): { x: number; y: number } {
  try {
    const value = JSON.parse(
      window.localStorage.getItem(`${MARKER_STORAGE_PREFIX}${annotationId}`) ?? "null"
    ) as { x?: unknown; y?: unknown } | null;
    return typeof value?.x === "number" && typeof value.y === "number"
      ? { x: value.x, y: value.y }
      : { x: 0, y: 0 };
  } catch {
    return { x: 0, y: 0 };
  }
}

function persistMarkerOffset(annotationId: string, offset: { x: number; y: number }) {
  try {
    window.localStorage.setItem(
      `${MARKER_STORAGE_PREFIX}${annotationId}`,
      JSON.stringify(offset)
    );
  } catch {
    // Marker movement remains available when storage is unavailable.
  }
}

function NoteMarker({
  annotation,
  left,
  top,
  scale,
  isActive,
  onActivate
}: {
  annotation: PdfAnnotation;
  left: number;
  top: number;
  scale: number;
  isActive: boolean;
  onActivate: (event: SyntheticEvent<HTMLButtonElement>) => void;
}) {
  const [offset, setOffset] = useState(() => readMarkerOffset(annotation.id));
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: { x: number; y: number };
    active: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: offset,
      active: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;

    if (!drag.active && Math.hypot(deltaX, deltaY) < 4) return;
    drag.active = true;
    setOffset({
      x: drag.origin.x + deltaX / scale,
      y: drag.origin.y + deltaY / scale
    });
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (drag.active) {
      const next = {
        x: drag.origin.x + (event.clientX - drag.startX) / scale,
        y: drag.origin.y + (event.clientY - drag.startY) / scale
      };
      setOffset(next);
      persistMarkerOffset(annotation.id, next);
      suppressClickRef.current = true;
    }
  }

  return (
    <button
      className="annotation-layer__note-marker"
      data-note-kind={annotation.note?.kind ?? "user"}
      data-annotation-id={annotation.id}
      type="button"
      aria-label={annotation.note?.kind === "ai" ? "Open AI explanation" : "Open note"}
      title="Drag to move this note marker"
      aria-pressed={isActive}
      style={{
        left: `${left + offset.x * scale}px`,
        top: `${top + offset.y * scale}px`
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={(event) => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        onActivate(event);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onActivate(event);
        }
      }}
    >
      <Icon name={annotation.note?.kind === "ai" ? "sparkle" : "note"} size={14} />
    </button>
  );
}

/**
 * Per-page SVG overlay. The viewBox equals the page size in PDF points at
 * scale 1, while the element is sized to the rendered page — the browser
 * scales the drawing, so highlights stay pixel-aligned through zoom and
 * resize without any recomputation.
 */
export const AnnotationLayer = memo(function AnnotationLayer({
  dims,
  renderedDims,
  scale,
  pageIndex,
  annotations,
  activeAnnotationId,
  onNoteActivate
}: AnnotationLayerProps) {
  const renderedWidth = Number.isFinite(renderedDims?.width)
    ? renderedDims.width
    : dims.width * scale;
  const renderedHeight = Number.isFinite(renderedDims?.height)
    ? renderedDims.height
    : dims.height * scale;
  const fragments: Array<{ annotation: PdfAnnotation; fragment: FragmentRect }> = [];

  for (const annotation of annotations) {
    for (const fragment of annotation.fragments) {
      if (fragment.pageIndex === pageIndex) {
        fragments.push({ annotation, fragment });
      }
    }
  }

  // Every annotation on this page gets a sticky flag on the page's right edge,
  // at the height of its first line, nudged down so flags never overlap.
  const flags = useMemo(() => {
    const placed: Array<{ annotation: PdfAnnotation; top: number }> = [];
    const entries = annotations
      .map((annotation) => ({
        annotation,
        fragment: annotation.fragments.find((fragment) => fragment.pageIndex === pageIndex)
      }))
      .filter((entry): entry is { annotation: PdfAnnotation; fragment: FragmentRect } => Boolean(entry.fragment))
      .sort((left, right) => left.fragment.y - right.fragment.y);

    let previousTop = -Infinity;
    for (const { annotation, fragment } of entries) {
      const naturalTop = (fragment.y / dims.height) * renderedHeight - 4;
      const top = Math.max(naturalTop, previousTop + FLAG_SPACING, 4);
      placed.push({ annotation, top });
      previousTop = top;
    }
    return placed;
  }, [annotations, dims.height, pageIndex, renderedHeight]);

  return (
    <div className="annotation-layer" data-selection-ignore="true">
      <svg
        className="annotation-layer__svg"
        width={renderedWidth}
        height={renderedHeight}
        viewBox={`0 0 ${dims.width} ${dims.height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        {fragments.map(({ annotation, fragment }) => {
          const isActive = annotation.id === activeAnnotationId;

          // A note's passage is marked on the page itself: a faint lavender
          // wash at rest, lit up while its explanation is open.
          if (annotation.kind === "note") {
            return (
              <rect
                key={`${annotation.id}-${fragment.id}`}
                className="annotation-layer__note-passage"
                data-active={isActive ? "true" : "false"}
                x={fragment.x}
                y={fragment.y}
                width={fragment.width}
                height={fragment.height}
                rx={2.5}
                pointerEvents="none"
              />
            );
          }

          if (annotation.kind !== "highlight") {
            return null;
          }

          return (
            <g key={`${annotation.id}-${fragment.id}`}>
              <rect
                className="annotation-layer__rect"
                x={fragment.x}
                y={fragment.y}
                width={fragment.width}
                height={fragment.height}
                rx={2.5}
                fill={annotation.color ? HIGHLIGHT_FILL[annotation.color].fill : HIGHLIGHT_FILL.yellow.fill}
                fillOpacity={annotation.color ? HIGHLIGHT_FILL[annotation.color].opacity : 0.5}
                stroke={isActive ? "#1F2340" : "none"}
                strokeWidth={isActive ? 1.4 : 0}
                pointerEvents="none"
              />
            </g>
          );
        })}

      </svg>

      {flags.map(({ annotation, top }) => {
        if (annotation.kind !== "note") {
          return (
            <span
              key={`flag-${annotation.id}`}
              className="annotation-flag"
              data-annotation-id={annotation.id}
              data-color={annotation.color ?? "yellow"}
              aria-hidden="true"
              style={{ left: `${renderedWidth}px`, top: `${top}px` }}
            />
          );
        }

        return (
          <NoteMarker
            key={`note-${annotation.id}`}
            annotation={annotation}
            left={renderedWidth}
            top={top}
            scale={scale}
            isActive={annotation.id === activeAnnotationId}
            onActivate={(event) => {
              event.stopPropagation();
              onNoteActivate(annotation.id, event.currentTarget.getBoundingClientRect());
            }}
          />
        );
      })}
    </div>
  );
});
