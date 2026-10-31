import type { HighlightColor } from "../../types/annotation";
import { Icon } from "../../components/Icon";

type SelectionToolbarProps = {
  /** Viewport (fixed-position) coordinates of the selection's last line. */
  anchor: { x: number; y: number };
  onHighlight: (color: HighlightColor) => void;
  onAddNote: () => void;
  onDismiss: () => void;
};

const COLORS: { color: HighlightColor; label: string }[] = [
  { color: "yellow", label: "Yellow highlight" },
  { color: "green", label: "Green highlight" },
  { color: "pink", label: "Pink highlight" }
];

/**
 * Contextual toolbar that appears above a fresh text selection.
 *
 * Positioned with fixed coordinates just above the anchor (the end of the
 * selection) and clamped to the viewport so it never runs off-screen.
 */
export function SelectionToolbar({
  anchor,
  onHighlight,
  onAddNote,
  onDismiss
}: SelectionToolbarProps) {
  // Stay in the reading area: an open VENMA drawer takes the right 468px on wide screens.
  const drawerOpen = document.documentElement.dataset.drawer === "open" && window.innerWidth > 900;
  const rightLimit = window.innerWidth - (drawerOpen ? 468 : 0);
  const left = Math.max(12, Math.min(anchor.x - 70, rightLimit - 250));
  const top = Math.max(12, anchor.y - 56);

  return (
    <div
      className="selection-toolbar"
      role="toolbar"
      aria-label="Annotation actions for the selected text"
      style={{ left, top }}
      data-selection-ignore="true"
      onPointerDown={(event) => event.preventDefault()}
    >
      {COLORS.map(({ color, label }) => (
        <button
          key={color}
          type="button"
          className={`selection-toolbar__swatch selection-toolbar__swatch--${color}`}
          aria-label={label}
          title={label}
          onClick={() => onHighlight(color)}
        />
      ))}

      <span className="selection-toolbar__divider" aria-hidden="true" />

      <button type="button" className="selection-toolbar__note" onClick={onAddNote}>
        <Icon name="note" size={16} />
        Add note
      </button>

      <button
        type="button"
        className="selection-toolbar__close icon-button"
        aria-label="Dismiss annotation toolbar"
        onClick={onDismiss}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}