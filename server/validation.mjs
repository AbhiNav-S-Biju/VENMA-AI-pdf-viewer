export const ACTIONS = [
  "simple_explanation",
  "detailed_explanation",
  "example",
  "summary",
  "study_notes"
];

export const LANGUAGES = ["en", "es", "fr", "de", "hi", "ja"];
export const MAX_SELECTED_TEXT = 12000;
export const MAX_CONTEXT = 4000;

export function validateExplainRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, message: "Request body must be a JSON object." };
  }

  if (typeof value.selectedText !== "string" || value.selectedText.trim().length === 0) {
    return { ok: false, message: "selectedText is required." };
  }

  if (value.selectedText.length > MAX_SELECTED_TEXT) {
    return { ok: false, message: `selectedText must be at most ${MAX_SELECTED_TEXT} characters.` };
  }

  if (value.surroundingContext !== undefined &&
      (typeof value.surroundingContext !== "string" || value.surroundingContext.length > MAX_CONTEXT)) {
    return { ok: false, message: `surroundingContext must be at most ${MAX_CONTEXT} characters.` };
  }

  if (!ACTIONS.includes(value.action)) {
    return { ok: false, message: `action must be one of: ${ACTIONS.join(", ")}.` };
  }

  if (value.language !== undefined && !LANGUAGES.includes(value.language)) {
    return { ok: false, message: `language must be one of: ${LANGUAGES.join(", ")}.` };
  }

  return {
    ok: true,
    value: {
      selectedText: value.selectedText.trim(),
      surroundingContext: value.surroundingContext?.trim() || "",
      action: value.action,
      language: value.language || "en",
      modelId: typeof value.modelId === "string" ? value.modelId.trim() || "auto" : "auto"
    }
  };
}
