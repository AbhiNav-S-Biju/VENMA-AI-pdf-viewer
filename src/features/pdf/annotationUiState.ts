import type { SelectionSnapshot } from "../../types/annotation";

/** UI-only state shapes for the selection toolbar and note editor. */
export type SelectionToolbarState = {
  snapshot: SelectionSnapshot;
  /** Fixed-position anchor (viewport coordinates) for the toolbar. */
  anchor: { x: number; y: number };
} | null;

export type NoteEditorState =
  | { mode: "create"; snapshot: SelectionSnapshot }
  | { mode: "edit"; annotationId: string; noteText: string }
  | null;

/** Size of the folded-corner note marker, in PDF points. */
export const NOTE_MARKER_SIZE = 14;

/** Small padding added when the note editor pops up near a marker. */
export const NOTE_EDITOR_OFFSET = 12;
