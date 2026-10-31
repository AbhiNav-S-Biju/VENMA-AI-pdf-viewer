import { useEffect, useRef, useState } from "react";

type NoteEditorProps = {
  mode: "create" | "edit";
  initialText: string;
  /** Optional quoted passage the note is attached to. */
  selectionText?: string;
  onSave: (text: string) => void;
  onDelete?: () => void;
  onCancel: () => void;
};

/**
 * Multiline note editor. Saving and cancelling are both explicit; Escape
 * cancels, and a note can only be saved when it has non-whitespace content.
 */
export function NoteEditor({
  mode,
  initialText,
  selectionText,
  onSave,
  onDelete,
  onCancel
}: NoteEditorProps) {
  const [text, setText] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.setSelectionRange(initialText.length, initialText.length);
  }, [initialText]);

  const canSave = text.trim().length > 0;

  return (
    <div
      className="note-editor"
      role="dialog"
      aria-modal="false"
      aria-label={mode === "create" ? "Add a note" : "Edit note"}
      data-selection-ignore="true"
    >
      <h2 className="note-editor__heading">{mode === "create" ? "Add note" : "Edit note"}</h2>

      {selectionText ? (
        <blockquote className="note-editor__quote">
          {selectionText.length > 140 ? `${selectionText.slice(0, 140)}…` : selectionText}
        </blockquote>
      ) : null}

      <label className="visually-hidden" htmlFor="venma-note-text">
        Note text
      </label>
      <textarea
        id="venma-note-text"
        ref={textareaRef}
        className="note-editor__textarea"
        rows={5}
        value={text}
        placeholder="Write your note…"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && canSave) {
            event.preventDefault();
            onSave(text.trim());
          }
        }}
      />

      <div className="note-editor__actions">
        {mode === "edit" && onDelete ? (
          <button type="button" className="note-editor__delete" onClick={onDelete}>
            Delete
          </button>
        ) : (
          <span />
        )}
        <div className="note-editor__actions-right">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="note-editor__save"
            disabled={!canSave}
            onClick={() => onSave(text.trim())}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}