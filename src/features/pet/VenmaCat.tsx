import { memo, useEffect, useId, useRef } from "react";
import type { PetMood } from "../../types/pet";

type VenmaCatProps = {
  mood: PetMood;
  /** Rendered height in CSS pixels; width follows the drawing's aspect. */
  size?: number;
  /** Hold a still pose: no breathing, blinking, twitching or eye tracking. */
  motionless?: boolean;
  /** Let the pupils follow the pointer around the screen. */
  trackPointer?: boolean;
  className?: string;
};

const VIEW_WIDTH = 120;
const VIEW_HEIGHT = 128;
/** Furthest the pupils travel from the centre of the eye, in drawing units. */
const MAX_LOOK = 2.6;

/**
 * VENMA drawn as a layered vector so each part can move on its own.
 *
 * Continuous motion (breathing, tail sway, thinking dots) lives in CSS and
 * keys off `data-mood`. Irregular motion that a loop would make robotic
 * (blinks, ear twitches) is scheduled here with jittered timers, and the
 * pupils follow the pointer through two CSS custom properties.
 */
export const VenmaCat = memo(function VenmaCat({
  mood,
  size = 112,
  motionless = false,
  trackPointer = true,
  className
}: VenmaCatProps) {
  const rootRef = useRef<SVGSVGElement | null>(null);
  const uid = useId().replace(/:/g, "");

  // Blinks: every 2.5–6s, with an occasional double blink.
  useEffect(() => {
    const element = rootRef.current;
    if (!element || motionless) return;

    let timer = 0;
    const blink = (thenAgain: boolean) => {
      element.dataset.blink = "true";
      timer = window.setTimeout(() => {
        element.dataset.blink = "false";
        timer = window.setTimeout(
          () => blink(!thenAgain && Math.random() < 0.18),
          thenAgain ? 160 : 2500 + Math.random() * 3500
        );
      }, 130);
    };
    timer = window.setTimeout(() => blink(false), 1200 + Math.random() * 2000);

    return () => {
      window.clearTimeout(timer);
      element.dataset.blink = "false";
    };
  }, [motionless]);

  // Ear twitches: one ear at a time, every 4–10s.
  useEffect(() => {
    const element = rootRef.current;
    if (!element || motionless) return;

    let timer = 0;
    const twitch = () => {
      element.dataset.twitch = Math.random() < 0.5 ? "left" : "right";
      timer = window.setTimeout(() => {
        element.dataset.twitch = "none";
        timer = window.setTimeout(twitch, 4000 + Math.random() * 6000);
      }, 420);
    };
    timer = window.setTimeout(twitch, 3000 + Math.random() * 4000);

    return () => {
      window.clearTimeout(timer);
      element.dataset.twitch = "none";
    };
  }, [motionless]);

  // Pupils follow the pointer; one write per animation frame at most.
  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;

    if (motionless || !trackPointer) {
      element.style.setProperty("--look-x", "0");
      element.style.setProperty("--look-y", "0");
      return;
    }

    let frame = 0;
    let pointer: { x: number; y: number } | null = null;
    // A "venma:look" event (a new flag, say) holds the gaze there briefly.
    let focus: { x: number; y: number } | null = null;
    let focusTimer = 0;

    const update = () => {
      frame = 0;
      const target = focus ?? pointer;
      if (!target) return;
      const rect = element.getBoundingClientRect();
      const eyeX = rect.left + rect.width * 0.5;
      const eyeY = rect.top + rect.height * 0.37;
      const dx = target.x - eyeX;
      const dy = target.y - eyeY;
      const distance = Math.hypot(dx, dy) || 1;
      // Ease in over the first 160px so a pointer resting on VENMA reads as "looking at you".
      const reach = Math.min(1, distance / 160) * MAX_LOOK;
      element.style.setProperty("--look-x", ((dx / distance) * reach).toFixed(2));
      element.style.setProperty("--look-y", ((dy / distance) * reach * 0.8).toFixed(2));
    };

    const handleMove = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    const handleLook = (event: Event) => {
      const detail = (event as CustomEvent<{ x: number; y: number }>).detail;
      if (!detail) return;
      focus = detail;
      window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => {
        focus = null;
        if (!frame) frame = window.requestAnimationFrame(update);
      }, 1600);
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    window.addEventListener("pointermove", handleMove, { passive: true });
    window.addEventListener("venma:look", handleLook);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("venma:look", handleLook);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(focusTimer);
    };
  }, [motionless, trackPointer]);

  const furId = `venma-fur-${uid}`;
  const irisId = `venma-iris-${uid}`;
  const width = (size * VIEW_WIDTH) / VIEW_HEIGHT;

  return (
    <svg
      ref={rootRef}
      className={["venma-cat", className].filter(Boolean).join(" ")}
      data-mood={mood}
      data-motionless={motionless ? "true" : "false"}
      data-blink="false"
      data-twitch="none"
      width={width}
      height={size}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={furId} cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#D9CBF7" />
          <stop offset="55%" stopColor="#B9A3E8" />
          <stop offset="100%" stopColor="#9C84D6" />
        </radialGradient>
        <radialGradient id={irisId} cx="50%" cy="65%" r="60%">
          <stop offset="0%" stopColor="#FFD27A" />
          <stop offset="70%" stopColor="#F2A93B" />
          <stop offset="100%" stopColor="#C77C17" />
        </radialGradient>
      </defs>

      <ellipse className="venma-cat__shadow" cx="60" cy="122" rx="34" ry="4" />

      <g className="venma-cat__tail">
        <path
          d="M82 112 C102 114 112 98 106 84 C102 74 108 64 115 68"
          fill="none"
          stroke={`url(#${furId})`}
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M108 70 C110 66 113 66 115 68"
          fill="none"
          stroke="#FFF6EC"
          strokeWidth="10"
          strokeLinecap="round"
        />
      </g>

      <g className="venma-cat__body">
        <path d="M37 114 C33 94 40 70 60 68 C80 70 87 94 83 114 Z" fill={`url(#${furId})`} />
        <path d="M50 74 C54 86 66 86 70 74 C73 90 67 104 60 107 C53 104 47 90 50 74 Z" fill="#FFF6EC" />
        <g className="venma-cat__paws">
          <ellipse cx="49" cy="113" rx="8.5" ry="5.5" fill="#FFF6EC" />
          <ellipse cx="71" cy="113" rx="8.5" ry="5.5" fill="#FFF6EC" />
          <path d="M46 112.5 v2.6 M49.5 112 v3 M53 112.5 v2.6 M67 112.5 v2.6 M70.5 112 v3 M74 112.5 v2.6"
            stroke="#D8C9EE" strokeWidth="1" strokeLinecap="round" />
        </g>
      </g>

      <g className="venma-cat__head">
        <g className="venma-cat__ear venma-cat__ear--left">
          <path d="M31 38 L26 8 C26 4.5 29.5 3.5 31.5 5.5 L52 23 Z" fill={`url(#${furId})`} />
          <path d="M33.5 32 L30.5 13 L45 24 Z" fill="#F7A8C4" />
        </g>
        <g className="venma-cat__ear venma-cat__ear--right">
          <path d="M89 38 L94 8 C94 4.5 90.5 3.5 88.5 5.5 L68 23 Z" fill={`url(#${furId})`} />
          <path d="M86.5 32 L89.5 13 L75 24 Z" fill="#F7A8C4" />
        </g>

        <path
          d="M28 40 C30 24 45 17 60 17 C75 17 90 24 92 40 C94 46 98 51 101 55 C97 57 95 58 93 62 C88 72 76 79 60 79 C44 79 32 72 27 62 C25 58 23 57 19 55 C22 51 26 46 28 40 Z"
          fill={`url(#${furId})`}
        />
        <ellipse cx="60" cy="65" rx="14.5" ry="9.5" fill="#FFF6EC" />

        <ellipse className="venma-cat__blush" cx="33.5" cy="61" rx="6" ry="3.4" />
        <ellipse className="venma-cat__blush" cx="86.5" cy="61" rx="6" ry="3.4" />

        <g className="venma-cat__eyes">
          {[46, 74].map((cx) => (
            <g key={cx}>
              <ellipse cx={cx} cy="48" rx="9.2" ry="10.4" fill={`url(#${irisId})`} />
              <g className="venma-cat__pupil">
                <ellipse cx={cx} cy="48.5" rx="5" ry="6.6" fill="#231A33" />
                <circle cx={cx - 3} cy="44" r="2.5" fill="#FFFFFF" />
                <circle cx={cx + 2.8} cy="51.5" r="1.1" fill="#FFFFFF" opacity="0.85" />
              </g>
              <path
                d={`M${cx - 9.6} 45 C${cx - 7} 36.5 ${cx + 7} 36.5 ${cx + 9.6} 45`}
                fill="none"
                stroke="#3A2D55"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </g>
          ))}
        </g>

        <g className="venma-cat__happy-eyes">
          <path d="M38.5 50 Q46 41 53.5 50" />
          <path d="M66.5 50 Q74 41 81.5 50" />
        </g>

        <path d="M57.4 60 Q60 58.8 62.6 60 L60 63 Z" fill="#F27BA0" strokeLinejoin="round" />
        <path
          className="venma-cat__mouth"
          d="M54 65 Q57 68.6 60 65.6 Q63 68.6 66 65"
          fill="none"
          stroke="#3A2D55"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <ellipse className="venma-cat__talk" cx="60" cy="67.4" rx="2.8" ry="2.2" fill="#7A3550" />
        <g className="venma-cat__whiskers" stroke="#8D78BF" strokeWidth="0.9" strokeLinecap="round">
          <path d="M44 64 L30 62.5 M44 67 L31 68.5" />
          <path d="M76 64 L90 62.5 M76 67 L89 68.5" />
        </g>
      </g>

      <g className="venma-cat__thought">
        <circle cx="99" cy="26" r="2.4" />
        <circle cx="106" cy="17" r="3.3" />
        <circle cx="113" cy="7" r="4.2" />
      </g>
    </svg>
  );
});
