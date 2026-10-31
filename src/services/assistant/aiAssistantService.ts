import type {
  AssistantModel,
  AssistantRequest,
  AssistantResponse,
  AssistantService
} from "../../types/pet";

type ExplainResponse = {
  explanation: string;
  action: AssistantRequest["actionId"];
  language: string;
  generatedBy: string;
  modelId?: string;
  provider?: string;
};

const API_BASE = (import.meta.env.VITE_ASSISTANT_API_URL || "/api").replace(/\/$/, "");
const MAX_RETRIES = 2;
const MODEL_PREFERENCE_KEY = "venma.assistant.model.v1";

export const aiAssistantService: AssistantService = {
  id: "venma-ai",
  label: "VENMA AI",
  isMock: false,
  async listModels() {
    const response = await fetch(`${API_BASE}/models`);
    if (!response.ok) {
      throw new Error("VENMA AI model availability is unavailable.");
    }
    const payload = (await response.json()) as { models?: AssistantModel[] };
    return Array.isArray(payload.models) ? payload.models : [];
  },
  async run(request, signal) {
    if (!request.selection.trim()) {
      throw new Error("Select a passage before asking VENMA AI.");
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const response = await fetch(`${API_BASE}/explain`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            selectedText: request.selection,
            surroundingContext: request.surroundingContext,
            action: request.actionId,
            language: "en",
            modelId: request.modelId || "auto"
          }),
          signal
        });

        const payload = (await response.json().catch(() => ({}))) as Partial<ExplainResponse> & {
          error?: string;
        };
        if (!response.ok) {
          const error = new Error(payload.error || "VENMA AI could not complete that request.");
          if (response.status !== 429 && response.status < 500) {
            (error as Error & { retryable?: boolean }).retryable = false;
            throw error;
          }
          if (response.status === 429) {
            (error as Error & { retryable?: boolean }).retryable = false;
            throw error;
          }
          if (response.status === 504) {
            (error as Error & { retryable?: boolean }).retryable = false;
            throw error;
          }
          lastError = error;
          if (attempt < MAX_RETRIES) {
            await delay(250 * 2 ** attempt, signal);
            continue;
          }
          throw error;
        }

        if (typeof payload.explanation !== "string" || payload.explanation.trim().length === 0) {
          throw new Error("VENMA AI returned an empty response.");
        }

        return {
          id: `ai-${Date.now()}`,
          actionId: request.actionId,
          text: payload.explanation,
          source: "model",
          modelLabel: formatModelLabel(payload.modelId, payload.provider),
          createdAt: Date.now()
        };
      } catch (error) {
        if (signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
          throw error;
        }
        lastError = error instanceof Error ? error : new Error("VENMA AI request failed.");
        if (error instanceof Error && (error as Error & { retryable?: boolean }).retryable === false) {
          throw error;
        }
        if (attempt >= MAX_RETRIES) {
          throw lastError;
        }
        await delay(250 * 2 ** attempt, signal);
      }
    }

    throw lastError || new Error("VENMA AI request failed.");
  }
};

export function readPreferredModel(): string {
  try {
    return window.localStorage.getItem(MODEL_PREFERENCE_KEY) || "auto";
  } catch {
    return "auto";
  }
}

export function writePreferredModel(modelId: string): void {
  try {
    window.localStorage.setItem(MODEL_PREFERENCE_KEY, modelId);
  } catch {
    // Preference persistence is best effort.
  }
}

function formatModelLabel(modelId?: string, provider?: string): string | undefined {
  // Model ids are "<provider-key>:<model name>"; the model name may itself contain colons.
  const name = modelId?.split(":").slice(1).join(":") || modelId;
  if (!name) return provider;
  return provider ? `${name} · ${provider}` : name;
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(resolve, milliseconds);
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
