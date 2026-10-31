import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AssistantPanel, type AssistantRunState } from "./AssistantPanel";
import { FloatingPet } from "./FloatingPet";
import { VenmaCat } from "./VenmaCat";
import { useTextSelection } from "./useTextSelection";
import { ASSISTANT_ACTIONS } from "../../services/assistant/mockAssistantService";
import { resolveAssistantService } from "../../services/assistant/assistantService";
import type { AssistantActionId, PetMood, PetStatus } from "../../types/pet";
import type { AssistantModel } from "../../types/pet";
import { readPreferredModel, writePreferredModel } from "../../services/assistant/aiAssistantService";
import type { HighlightColor, SelectionSnapshot } from "../../types/annotation";

type PetAssistantProps = {
  petName?: string;
  documentName: string;
  pageNumber: number | null;
  workspaceElement: HTMLElement | null;
  selection: SelectionSnapshot | null;
  onCopyResponse: (text: string) => Promise<void>;
  onAddExplanationNote: (selection: SelectionSnapshot, text: string) => void;
  onHighlightSelection: (color: HighlightColor) => void;
  /** Bumped each time a new annotation lands, so VENMA can react to it. */
  celebrateToken?: number;
  onPanelOpen?: () => void;
};

/** How long a transient celebratory/error mood is held before returning to idle. */
const TRANSIENT_MOOD_MS = 1800;

/**
 * Owns every piece of pet state: position (inside FloatingPet), panel
 * visibility, text selection, assistant requests and the mascot mood.
 *
 * Mood is derived from explicit state rather than a pile of ad-hoc timers:
 *   thinking  → while a request is in flight
 *   happy     → briefly after a successful response
 *   error     → briefly after a failed request, or while the document is broken
 *   explaining→ while the panel is open with a ready response
 */
export function PetAssistant({
  petName = "VENMA",
  documentName,
  pageNumber,
  workspaceElement,
  selection,
  onCopyResponse,
  onAddExplanationNote,
  onHighlightSelection,
  celebrateToken = 0,
  onPanelOpen
}: PetAssistantProps) {
  const service = useMemo(() => resolveAssistantService(), []);

  const [status, setStatus] = useState<PetStatus>("active");
  const [panelOpen, setPanelOpen] = useState(false);
  const [run, setRun] = useState<AssistantRunState>({ status: "idle" });
  const [transientMood, setTransientMood] = useState<PetMood | null>(null);
  const [bounds, setBounds] = useState<{ width: number; height: number } | null>(null);
  const [models, setModels] = useState<AssistantModel[]>([]);
  const [selectedModel, setSelectedModel] = useState(() => readPreferredModel());

  const abortRef = useRef<AbortController | null>(null);
  const transientTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!service.listModels) return;
    void service.listModels().then(setModels).catch(() => setModels([]));
  }, [service]);

  // Track the PDF canvas size so the pet is constrained to the visible workspace.
  useEffect(() => {
    const element = workspaceElement;

    if (!element) {
      setBounds(null);
      return;
    }

    const observed = element;

    function measure() {
      const rect = observed.getBoundingClientRect();
      setBounds({ width: rect.width, height: rect.height });
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(observed);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [workspaceElement]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (transientTimerRef.current !== null) {
        window.clearTimeout(transientTimerRef.current);
      }
    },
    []
  );

  const flashMood = useCallback((mood: PetMood) => {
    setTransientMood(mood);

    if (transientTimerRef.current !== null) {
      window.clearTimeout(transientTimerRef.current);
    }

    transientTimerRef.current = window.setTimeout(() => {
      setTransientMood(null);
      transientTimerRef.current = null;
    }, TRANSIENT_MOOD_MS);
  }, []);

  useEffect(() => {
    if (documentName) {
      flashMood("happy");
    }
  }, [documentName, flashMood]);

  const runAction = useCallback(
    async (actionId: AssistantActionId) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setRun({ status: "loading", actionId });

      try {
        const response = await service.run(
          {
            documentName,
            pageNumber,
            selection: selection?.text ?? "",
            actionId,
            modelId: selectedModel
          },
          controller.signal
        );

        if (controller.signal.aborted) {
          return;
        }

        setRun({ status: "ready", response });
        flashMood("happy");
      } catch (error) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }

        setRun({
          status: "error",
          actionId,
          message:
            error instanceof Error
              ? error.message
              : "The assistant could not complete that request."
        });
        flashMood("error");
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [documentName, flashMood, pageNumber, selectedModel, selection, service]
  );

  useEffect(() => {
    if (celebrateToken > 0) {
      flashMood("happy");
    }
  }, [celebrateToken, flashMood]);

  // The page area makes room for the drawer (see [data-drawer] in global.css),
  // and a lingering selection toolbar would only sit half under it.
  const drawerVisible = panelOpen && status === "active" && Boolean(documentName);
  useEffect(() => {
    document.documentElement.dataset.drawer = drawerVisible ? "open" : "closed";
    if (drawerVisible) onPanelOpen?.();
  }, [drawerVisible, onPanelOpen]);

  const openAssistant = useCallback(() => setPanelOpen(true), []);
  const closePanel = useCallback(() => setPanelOpen(false), []);
  const togglePanel = useCallback(() => setPanelOpen((value) => !value), []);
  const clearResponse = useCallback(() => setRun({ status: "idle" }), []);
  const dismissPet = useCallback(() => {
    abortRef.current?.abort();
    setPanelOpen(false);
    setStatus("dismissed");
  }, []);
  const restorePet = useCallback(() => setStatus("active"), []);

  const mood: PetMood = (() => {
    if (run.status === "loading") {
      return "thinking";
    }

    if (transientMood) {
      return transientMood;
    }

    if (panelOpen && run.status === "ready") {
      return "explaining";
    }

    if (selection) {
      return "curious";
    }

    return "idle";
  })();

  // Document the mood for assistive tech without spamming the live region.
  const moodDescription = describeMood(mood);

  // With no document open, VENMA sits on the empty desk illustration instead;
  // one cat on screen at a time.
  if (!documentName && status === "active") {
    return null;
  }

  if (status === "dismissed") {
    return (
      <button
        type="button"
        className="pet-restore"
        onClick={restorePet}
        aria-label={`Restore ${petName}, the ${moodDescription} assistant`}
      >
        <VenmaCat className="pet-restore__mascot" mood="idle" size={30} motionless trackPointer={false} />
        <span>Bring back {petName}</span>
      </button>
    );
  }

  return (
    <>
      <FloatingPet
        name={petName}
        mood={mood}
        panelOpen={panelOpen}
        bounds={bounds}
        onOpenAssistant={openAssistant}
        onTogglePanel={togglePanel}
        onDismiss={dismissPet}
      />
      <span className="visually-hidden" role="status" aria-live="polite">
        {petName} is {moodDescription}.
      </span>

      {panelOpen ? (
        <AssistantPanel
          petName={petName}
          serviceLabel={service.label}
          isMockService={service.isMock}
          models={models}
          selectedModel={selectedModel}
          onModelChange={(modelId) => {
            setSelectedModel(modelId);
            writePreferredModel(modelId);
          }}
          actions={ASSISTANT_ACTIONS}
          selection={selection}
          documentName={documentName}
          mood={mood}
          run={run}
          onRunAction={(actionId) => {
            void runAction(actionId);
          }}
          onClose={closePanel}
          onMinimize={closePanel}
          onClearResponse={clearResponse}
          onCopyResponse={onCopyResponse}
          onAddExplanationNote={(text) => {
            if (selection) {
              onAddExplanationNote(selection, text);
            }
          }}
          onHighlightSelection={onHighlightSelection}
        />
      ) : null}
    </>
  );
}

function describeMood(mood: PetMood): string {
  switch (mood) {
    case "thinking":
      return "thinking";
    case "explaining":
      return "explaining a response";
    case "happy":
      return "happy";
    case "error":
      return "showing a soft error";
    case "hover":
      return "hovering";
    case "curious":
      return "curious about the selection";
    default:
      return "resting";
  }
}
