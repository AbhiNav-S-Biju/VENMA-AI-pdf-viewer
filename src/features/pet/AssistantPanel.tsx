import { useEffect, useRef } from "react";
import type { AssistantAction, AssistantActionId, AssistantModel, AssistantResponse, PetMood } from "../../types/pet";
import type { HighlightColor, SelectionSnapshot } from "../../types/annotation";
import { MarkdownContent } from "../../components/MarkdownContent";
import { MascotArt } from "./MascotArt";
import { Icon } from "../../components/Icon";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export type AssistantRunState =
  | { status: "idle" }
  | { status: "loading"; actionId: AssistantActionId }
  | { status: "ready"; response: AssistantResponse }
  | { status: "error"; actionId: AssistantActionId; message: string };

type AssistantPanelProps = {
  petName: string;
  serviceLabel: string;
  isMockService: boolean;
  models: AssistantModel[];
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  actions: AssistantAction[];
  selection: SelectionSnapshot | null;
  documentName: string;
  mood: PetMood;
  run: AssistantRunState;
  onRunAction: (actionId: AssistantActionId) => void;
  onClose: () => void;
  onMinimize: () => void;
  onClearResponse: () => void;
  onCopyResponse: (text: string) => Promise<void>;
  onAddExplanationNote: (text: string) => void;
  onHighlightSelection: (color: HighlightColor) => void;
};

export function AssistantPanel({
  petName,
  serviceLabel,
  isMockService,
  models,
  selectedModel,
  onModelChange,
  actions,
  selection,
  documentName,
  mood,
  run,
  onRunAction,
  onClose,
  onMinimize,
  onClearResponse,
  onCopyResponse,
  onAddExplanationNote,
  onHighlightSelection
}: AssistantPanelProps) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const responseRef = useRef<HTMLElement | null>(null);

  // Bring the answer into view when a request starts and when it lands;
  // the action grid otherwise leaves it below the drawer's fold.
  useEffect(() => {
    if (run.status === "idle") return;
    responseRef.current?.scrollIntoView({
      block: "nearest",
      behavior: prefersReducedMotion ? "auto" : "smooth"
    });
  }, [run.status, prefersReducedMotion]);

  // Move focus into the panel when it opens so keyboard users land on it.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const selectionText = selection?.text ?? "";
  const hasSelection = selectionText.length > 0;
  const selectionPage = selection?.fragments[0]?.pageIndex;

  return (
    <section
      className="assistant-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="venma-assistant-heading"
      data-selection-ignore="true"
    >
      <header className="assistant-panel__header">
        <div className="assistant-panel__title">
          <span className="assistant-panel__avatar" data-mood={mood}>
            <MascotArt mood={mood} motionless={prefersReducedMotion} size={56} />
          </span>
          <div>
            <h2 id="venma-assistant-heading" ref={headingRef} tabIndex={-1}>
              {petName} explains
            </h2>
            <p className="assistant-panel__subtitle">
              {documentName ? documentName : "No document loaded"}
              {selectionPage !== undefined ? ` · page ${selectionPage + 1}` : ""}
            </p>
          </div>
        </div>

        <div className="assistant-panel__header-actions">
          <button type="button" className="icon-button" onClick={onMinimize} aria-label="Minimize assistant panel">
            <Icon name="collapse" />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close assistant panel (the pet stays available)"
          >
            <Icon name="close" />
          </button>
        </div>
      </header>

      {isMockService ? (
        <p className="assistant-panel__banner" role="note">
          <strong>Demo data.</strong> Responses come from a bundled mock service — no AI model is
          connected yet.
        </p>
      ) : (
        <p className="assistant-panel__banner assistant-panel__banner--live" role="note">
          Live AI via the local {serviceLabel} server. Each answer names the model that wrote it.
        </p>
      )}

      <div className="assistant-panel__body">
        <section className="assistant-model" aria-label="AI model">
          <label htmlFor="assistant-model-select">Model</label>
          <select
            id="assistant-model-select"
            value={selectedModel}
            onChange={(event) => onModelChange(event.target.value)}
            disabled={run.status === "loading"}
          >
            <option value="auto">Auto · best available</option>
            {models.map((model) => (
              <option key={model.id} value={model.id} disabled={model.status === "offline" || model.status === "quota_exceeded"}>
                {model.name} · {model.provider} · {formatStatus(model.status)}
              </option>
            ))}
          </select>
          {selectedModel !== "auto" ? (
            <p className="assistant-model__hint">
              {models.find((model) => model.id === selectedModel)?.suitability || "Configured PDF model"}
            </p>
          ) : null}
          {!models.length ? (
            <p className="assistant-model__hint">No server-configured models are currently available.</p>
          ) : null}
          {models.some((model) => model.temporary) ? (
            <p className="assistant-model__hint">Some models run in temporary Kaggle sessions and may go offline.</p>
          ) : null}
        </section>
        <section className="assistant-selection" aria-label="Selected text">
          <div className="assistant-section-heading">
            <h3>Selection</h3>
            {hasSelection ? <span className="assistant-chip">{selectionText.length} chars</span> : null}
          </div>
          {hasSelection ? (
            <blockquote className="assistant-selection__preview">{selectionText}</blockquote>
          ) : (
            <p className="assistant-selection__empty">
              Highlight text on the page, then choose an action. The selected passage is sent
              separately from the AI-generated response.
            </p>
          )}
          {hasSelection ? (
            <button type="button" className="assistant-link-button" onClick={() => onHighlightSelection("yellow")}>
              Highlight original selection
            </button>
          ) : null}
        </section>

        <section className="assistant-actions" aria-label="Assistant actions">
          <div className="assistant-section-heading">
            <h3>Actions</h3>
          </div>
          <div className="assistant-actions__grid">
            {actions.map((action) => {
              const disabled = action.requiresSelection && !hasSelection;
              const loading = run.status === "loading" && run.actionId === action.id;

              return (
                <button
                  key={action.id}
                  type="button"
                  className="assistant-action"
                  disabled={disabled || run.status === "loading"}
                  aria-busy={loading}
                  title={disabled ? "Select text first" : action.description}
                  onClick={() => onRunAction(action.id)}
                >
                  <span className="assistant-action__label">{action.label}</span>
                  <span className="assistant-action__hint">
                    {loading ? "Working…" : disabled ? "Needs selection" : action.description}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section ref={responseRef} className="assistant-response" aria-label="Assistant response" aria-live="polite">
          <div className="assistant-section-heading">
            <h3>Response</h3>
            {run.status === "ready" ? (
              <span
                className={`assistant-chip assistant-chip--${run.response.source === "mock" ? "mock" : "live"
                  }`}
              >
                {run.response.source === "mock" ? "Mock output" : "Model output"}
              </span>
            ) : null}
            {run.status === "ready" && run.response.modelLabel ? (
              <span className="assistant-chip" title="The model that wrote this answer">
                {run.response.modelLabel}
              </span>
            ) : null}
            {run.status !== "idle" ? (
              <button type="button" className="assistant-link-button" onClick={onClearResponse}>
                Clear
              </button>
            ) : null}
          </div>

          {run.status === "idle" ? (
            <p className="assistant-response__placeholder">
              Choose an action above to see a response here.
            </p>
          ) : null}

          {run.status === "loading" ? (
            <div className="assistant-response__loading" role="status">
              <span className="loading-spinner" aria-hidden="true" />
              <p>Thinking about your selection…</p>
            </div>
          ) : null}

          {run.status === "error" ? (
            <div className="assistant-response__error" role="alert">
              <p>{run.message}</p>
              {selectedModel !== "auto" ? (
                <button type="button" onClick={() => onModelChange("auto")}>
                  Try Auto mode
                </button>
              ) : null}
            </div>
          ) : null}

          {run.status === "ready" ? (
            <>
              <MarkdownContent className="assistant-response__text" content={run.response.text} />
              <div className="assistant-response__actions">
                <button type="button" onClick={() => void onCopyResponse(run.response.text)}>
                  Copy response
                </button>
                <button type="button" onClick={() => onAddExplanationNote(run.response.text)}>
                  Add AI explanation note
                </button>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </section>
  );
}

function formatStatus(status: AssistantModel["status"]): string {
  return status.replace("_", " ");
}
