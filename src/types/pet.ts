/**
 * Shared types for the VENMA floating pet and its assistant panel.
 */

/** Visual/behavioural states the mascot can display. */
export type PetMood = "idle" | "hover" | "curious" | "thinking" | "explaining" | "happy" | "error";

/** Which supported action the user triggered in the assistant panel. */
export type AssistantActionId =
  | "simple_explanation"
  | "detailed_explanation"
  | "example"
  | "summary"
  | "study_notes";

export type AssistantAction = {
  id: AssistantActionId;
  label: string;
  description: string;
  requiresSelection: boolean;
};

export type AssistantRequest = {
  documentName: string;
  pageNumber: number | null;
  selection: string;
  actionId: AssistantActionId;
  surroundingContext?: string;
  modelId?: string;
};

export type ModelStatus = "online" | "busy" | "quota_exceeded" | "offline" | "unknown";
export type AssistantModel = {
  id: string;
  name: string;
  provider: string;
  suitability: string;
  temporary: boolean;
  status: ModelStatus;
};

/**
 * Result returned by any assistant implementation.
 * `source` records where the answer came from so a mock response can never
 * silently pass itself off as a real model answer.
 */
export type AssistantResponse = {
  id: string;
  actionId: AssistantActionId;
  text: string;
  source: "mock" | "model";
  /** Which model answered, e.g. "llama3.1 · Ollama · this computer". */
  modelLabel?: string;
  createdAt: number;
};

/** Contract every assistant backend (mock or real) must satisfy. */
export interface AssistantService {
  readonly id: string;
  /** Human readable label shown in the panel UI. */
  readonly label: string;
  /** True while the backend is a placeholder with canned answers. */
  readonly isMock: boolean;
  run(request: AssistantRequest, signal: AbortSignal): Promise<AssistantResponse>;
  listModels?(): Promise<AssistantModel[]>;
};

/** Floating pet lifecycle status. */
export type PetStatus = "active" | "dismissed";
