import type {
  AssistantAction,
  AssistantActionId,
  AssistantRequest,
  AssistantResponse,
  AssistantService
} from "../../types/pet";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MOCK ASSISTANT — DEVELOPMENT ONLY
 *
 * This module contains NO real AI. Every answer is generated locally from
 * canned templates so the UI can be built and tested without a backend.
 *
 * Safety guarantees baked in:
 *   - `isMock` is `true`, so the UI always shows a "Demo data" badge.
 *   - Every response carries `source: "mock"`, so consumers can tell mock and
 *     real answers apart programmatically.
 *   - Nothing here performs a network request.
 *
 * Delete or replace this file once a real backend is wired up in
 * `assistantService.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const ASSISTANT_ACTIONS: AssistantAction[] = [
  {
    id: "summary",
    label: "Summarize",
    description: "Condense the selected passage into a few key points.",
    requiresSelection: true
  },
  {
    id: "simple_explanation",
    label: "Explain",
    description: "Explain the selection in plain, everyday language.",
    requiresSelection: true
  },
  {
    id: "detailed_explanation",
    label: "Detailed explanation",
    description: "Explain the selection carefully while preserving technical terms.",
    requiresSelection: true
  },
  {
    id: "example",
    label: "Give an example",
    description: "Explain the selection with one concrete example.",
    requiresSelection: true
  },
  {
    id: "study_notes",
    label: "Study notes",
    description: "Create concise notes from the selected passage.",
    requiresSelection: true
  }
];

const MOCK_LATENCY_MS = { min: 550, max: 1100 };

export const mockAssistantService: AssistantService = {
  id: "mock-assistant",
  label: "Offline demo assistant",
  isMock: true,
  run(request, signal) {
    return new Promise<AssistantResponse>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Assistant request aborted", "AbortError"));
        return;
      }

      const delay =
        MOCK_LATENCY_MS.min + Math.random() * (MOCK_LATENCY_MS.max - MOCK_LATENCY_MS.min);

      const timer = globalThis.setTimeout(() => {
        try {
          resolve(buildMockResponse(request));
        } catch (error) {
          reject(error instanceof Error ? error : new Error("The demo assistant failed."));
        }
      }, delay);

      // Honour cancellation so switching actions mid-flight does not leak timers.
      signal.addEventListener(
        "abort",
        () => {
          globalThis.clearTimeout(timer);
          reject(new DOMException("Assistant request aborted", "AbortError"));
        },
        { once: true }
      );
    });
  }
};

function buildMockResponse(request: AssistantRequest): AssistantResponse {
  const text = buildMockText(request);

  return {
    id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    actionId: request.actionId,
    text,
    source: "mock",
    createdAt: Date.now()
  };
}

function buildMockText(request: AssistantRequest): string {
  const excerpt = condense(request.selection);
  const where = request.pageNumber ? `page ${request.pageNumber}` : "this document";

  switch (request.actionId) {
    case "summary":
      return [
        `Demo summary of ${where}:`,
        "",
        `• ${excerpt}`,
        "• The passage sets up its main claim before moving into supporting detail.",
        "• A real summary will be produced once the model backend is connected."
      ].join("\n");
    case "simple_explanation":
      return [
        `Here is a plain-language demo explanation of ${where}:`,
        "",
        `In short: “${excerpt}”`,
        "",
        "A connected assistant would break this down phrase by phrase and tie it back to the surrounding context."
      ].join("\n");
    case "detailed_explanation":
      return [
        "Simplified (demo):",
        "",
        `→ ${excerpt}`,
        "",
        "• Shorter sentences.",
        "• Everyday words instead of jargon.",
        "",
        "Real simplification will run through the model backend."
      ].join("\n");
    case "example":
      return [
        `Demo key terms for ${where}:`,
        "",
        `• Key idea — “${excerpt}”`,
        "• Context — the surrounding sentences that give the term its meaning.",
        "",
        "Term extraction is simulated for now."
      ].join("\n");
    case "study_notes":
      return [
        "Demo study notes based on your selection:",
        "",
        "1. What is the main point of this section?",
        "2. Which detail best supports that point?",
        `3. Restate “${excerpt}” in your own words.`,
        "",
        "Generated notes will come from the real backend."
      ].join("\n");
    default:
      return "This demo action has no canned response yet.";
  }
}

/** Quotes the passage from the user's own selection, without echoing it as fact. */
function condense(selection: string): string {
  const cleaned = selection.replace(/\s+/g, " ").trim();

  if (!cleaned) {
    return "no text was selected";
  }

  return cleaned.length > 160 ? `${cleaned.slice(0, 157)}…` : cleaned;
}

/** Actions that require a text selection before they can run. */
export function actionNeedsSelection(actionId: AssistantActionId): boolean {
  return ASSISTANT_ACTIONS.find((action) => action.id === actionId)?.requiresSelection ?? true;
}
