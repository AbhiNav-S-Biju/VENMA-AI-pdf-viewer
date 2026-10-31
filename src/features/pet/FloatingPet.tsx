import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";
import { MascotArt } from "./MascotArt";
import { Icon } from "../../components/Icon";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import type { PetMood } from "../../types/pet";

export type PetSize = { width: number; height: number };

type FloatingPetProps = {
  name: string;
  mood: PetMood;
  panelOpen: boolean;
  /** Screen-space size of the area the pet must remain inside. */
  bounds: PetSize | null;
  /** Remember the pet's position across reloads. */
  persistPosition?: boolean;
  onOpenAssistant: () => void;
  onTogglePanel: () => void;
  onDismiss: () => void;
};

const STORAGE_KEY = "venma.pet.position.v1";
const PET_SIZE = { width: 112, height: 120 };
const EDGE_PADDING = 12;
/** Movement above this many pixels counts as a drag instead of a click. */
const DRAG_THRESHOLD = 4;

type StoredPosition = { x: number; y: number };

export function FloatingPet({
  name,
  mood,
  panelOpen,
  bounds,
  persistPosition = true,
  onOpenAssistant,
  onTogglePanel,
  onDismiss
}: FloatingPetProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    active: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const [position, setPosition] = useState<StoredPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [size, setSize] = useState(PET_SIZE);

  const clampToBounds = useCallback(
    (next: StoredPosition, petSize = size): StoredPosition => {
      const maxX = Math.max(EDGE_PADDING, window.innerWidth - petSize.width - EDGE_PADDING);
      const maxY = Math.max(EDGE_PADDING, window.innerHeight - petSize.height - EDGE_PADDING);

      return {
        x: Math.round(Math.min(Math.max(next.x, EDGE_PADDING), maxX)),
        y: Math.round(Math.min(Math.max(next.y, EDGE_PADDING), maxY))
      };
    },
    [size]
  );

  const getDefaultPosition = useCallback(
    (petSize = size): StoredPosition => ({
      x: window.innerWidth - petSize.width - 28,
      y: window.innerHeight - petSize.height - 28
    }),
    [size]
  );

  const persist = useCallback(
    (next: StoredPosition) => {
      if (!persistPosition) {
        return;
      }

      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage may be unavailable (private mode); position simply won't persist.
      }
    },
    [persistPosition]
  );

  // Restore the saved position once, on mount.
  useLayoutEffect(() => {
    const element = rootRef.current;

    if (element) {
      const rect = element.getBoundingClientRect();
      const measured = {
        width: rect.width || PET_SIZE.width,
        height: rect.height || PET_SIZE.height
      };
      setSize(measured);
      setPosition(clampToBounds(readStoredPosition() ?? getDefaultPosition(measured), measured));
      return;
    }

    setPosition(clampToBounds(readStoredPosition() ?? getDefaultPosition()));
    // Runs once on mount; resize changes are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the pet reachable when the viewport or workspace changes size.
  useEffect(() => {
    function handleResize() {
      const element = rootRef.current;

      if (element) {
        const rect = element.getBoundingClientRect();
        setSize((previous) => {
          const next = {
            width: rect.width || previous.width,
            height: rect.height || previous.height
          };
          return next.width === previous.width && next.height === previous.height
            ? previous
            : next;
        });
      }

      setPosition((current) => {
        if (!current) {
          return current;
        }

        const clamped = clampToBounds(current);
        persist(clamped);
        return clamped;
      });
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampToBounds, persist]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !position) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      active: false
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    // Prevent the browser from starting a native text selection while dragging.
    event.preventDefault();
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragStateRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;

    if (!drag.active && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) {
      return;
    }

    if (!drag.active) {
      drag.active = true;
      setIsDragging(true);
    }

    setPosition({ x: drag.originX + deltaX, y: drag.originY + deltaY });
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragStateRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (drag.active) {
      setIsDragging(false);
      suppressClickRef.current = true;
      setPosition((current) => {
        // Clamp on release so the pet always lands fully on screen.
        const clamped = clampToBounds(current ?? { x: drag.originX, y: drag.originY });
        persist(clamped);
        return clamped;
      });
    }
  }

  const handleActivate = useCallback(() => {
    onOpenAssistant();
  }, [onOpenAssistant]);

  const moveWithKeyboard = useCallback((deltaX: number, deltaY: number) => {
    setPosition((current) => {
      if (!current) {
        return current;
      }

      const next = clampToBounds({
        x: current.x + deltaX,
        y: current.y + deltaY
      });
      persist(next);
      return next;
    });
  }, [clampToBounds, persist]);

  const resolvedMood: PetMood = isDragging ? "hover" : isHovered && mood === "idle" ? "hover" : mood;
  const label = `${name} assistant`;
  const tooltip = panelOpen ? `${label} — click to focus the panel` : `${label} — click to open`;

  return (
    <div
      ref={rootRef}
      className="floating-pet"
      data-mood={resolvedMood}
      data-dragging={isDragging ? "true" : "false"}
      data-selection-ignore="true"
      data-motionless={prefersReducedMotion ? "true" : "false"}
      style={
        position
          ? { transform: `translate3d(${position.x}px, ${position.y}px, 0)` }
          : { visibility: "hidden" }
      }
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
    >
      <span className="floating-pet__tooltip" role="tooltip" id="venma-pet-tooltip">
        {tooltip}
      </span>

      <div
        className="floating-pet__anchor"
        role="button"
        tabIndex={0}
        aria-label={`${tooltip}. Drag to move, or use the arrow keys to reposition.`}
        aria-describedby="venma-pet-tooltip"
        aria-expanded={panelOpen}
        aria-haspopup="dialog"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 10 : 4;
          const movements: Record<string, [number, number]> = {
            ArrowLeft: [-step, 0],
            ArrowRight: [step, 0],
            ArrowUp: [0, -step],
            ArrowDown: [0, step]
          };
          const movement = movements[event.key];

          if (movement) {
            event.preventDefault();
            moveWithKeyboard(movement[0], movement[1]);
            return;
          }

          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleActivate();
          }
        }}
        onClick={() => {
          // Suppress the click that follows a drag gesture.
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          if (isDragging || dragStateRef.current?.active) {
            return;
          }
          handleActivate();
        }}
      >
        <MascotArt mood={resolvedMood} motionless={prefersReducedMotion} size={120} />
      </div>

      <div className="floating-pet__actions">
        <button
          type="button"
          className="floating-pet__action"
          aria-label={panelOpen ? "Minimize assistant panel" : "Open assistant panel"}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePanel();
          }}
        >
          <Icon name={panelOpen ? "minus" : "sparkle"} size={14} />
        </button>
        <button
          type="button"
          className="floating-pet__action"
          aria-label="Hide the pet (a restore button stays available in the header)"
          onClick={(event) => {
            event.stopPropagation();
            onDismiss();
          }}
        >
          <Icon name="hide" size={14} />
        </button>
      </div>
    </div>
  );
}

function readStoredPosition(): StoredPosition | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);

    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as StoredPosition).x === "number" &&
      typeof (parsed as StoredPosition).y === "number"
    ) {
      return { x: (parsed as StoredPosition).x, y: (parsed as StoredPosition).y };
    }
  } catch {
    return null;
  }

  return null;
}
