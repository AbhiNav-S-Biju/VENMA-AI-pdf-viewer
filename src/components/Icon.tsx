/** Small stroke icon set drawn on one 20px grid at one weight. */
const PATHS = {
  open: "M3.5 6.5h5l1.5 2h6.5v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z M10 10.5v4 M8 12.5l2-2 2 2",
  link: "M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-1 1 M11.5 8.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l1-1",
  prev: "M12 5l-5 5 5 5",
  next: "M8 5l5 5-5 5",
  minus: "M5 10h10",
  plus: "M10 5v10 M5 10h10",
  fit: "M3.5 10h13 M6 7.5l-2.5 2.5 2.5 2.5 M14 7.5l2.5 2.5-2.5 2.5",
  undo: "M7 5L3.5 8.5 7 12 M3.5 8.5h8a4.5 4.5 0 0 1 0 9H9",
  redo: "M13 5l3.5 3.5L13 12 M16.5 8.5h-8a4.5 4.5 0 0 0 0 9H11",
  export: "M10 3.5v9 M6.5 9l3.5 3.5L13.5 9 M4 14.5v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1",
  close: "M5.5 5.5l9 9 M14.5 5.5l-9 9",
  collapse: "M5 12.5l5-5 5 5",
  settings: "M10 7.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z M10 2.8v2 M10 15.2v2 M2.8 10h2 M15.2 10h2 M4.9 4.9l1.4 1.4 M13.7 13.7l1.4 1.4 M4.9 15.1l1.4-1.4 M13.7 6.3l1.4-1.4",
  note: "M5 3.5h10a1 1 0 0 1 1 1v8l-4 4H5a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1z M12 16.5v-3a1 1 0 0 1 1-1h3 M7 7.5h6 M7 10.5h4",
  copy: "M7.5 7.5h8v9h-8z M4.5 12.5v-9h8",
  sparkle: "M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6z",
  hide: "M3 10s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z M3.5 3.5l13 13"
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
