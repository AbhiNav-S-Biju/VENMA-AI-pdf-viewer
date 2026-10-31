import { memo } from "react";
import type { PetMood } from "../../types/pet";
import { VenmaCat } from "./VenmaCat";

type MascotArtProps = {
  mood: PetMood;
  /** When true VENMA holds a still pose (reduced motion / static use). */
  motionless?: boolean;
  size?: number;
  trackPointer?: boolean;
};

export const MascotArt = memo(function MascotArt({
  mood,
  motionless = false,
  size,
  trackPointer
}: MascotArtProps) {
  return (
    <VenmaCat
      className="mascot-art"
      mood={mood}
      motionless={motionless}
      size={size}
      trackPointer={trackPointer}
    />
  );
});
