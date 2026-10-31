import type { AssistantService } from "../../types/pet";
import { aiAssistantService } from "./aiAssistantService";

/**
 * Single place where the app decides which assistant backend to talk to.
 *
 * Provider credentials and model selection stay on the server and are never
 * included in the browser bundle.
 */
export function resolveAssistantService(): AssistantService {
  return aiAssistantService;
}

export type { AssistantService } from "../../types/pet";
