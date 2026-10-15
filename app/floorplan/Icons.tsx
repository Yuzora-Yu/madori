export type IconName =
  | "settings"
  | "expand"
  | "collapse"
  | "layers"
  | "label"
  | "note"
  | "ruler"
  | "image"
  | "print"
  | "opening"
  | "cursor"
  | "wall"
  | "door"
  | "sliding"
  | "window"
  | "bath"
  | "toilet"
  | "outlet"
  | "sofa"
  | "bed"
  | "table"
  | "shelf"
  | "storage"
  | "appliance"
  | "plant"
  | "generic"
  | "plus"
  | "minus"
  | "undo"
  | "redo"
  | "download"
  | "upload"
  | "rotate"
  | "trash"
  | "fit"
  | "grid"
  | "box"
  | "plan"
  | "close"
  | "check"
  | "chevron"
  | "copy"
  | "help";
const paths: Record<IconName, string> = {
  settings: "M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6",
  expand: "M9 3H3v6 M15 3h6v6 M3 15v6h6 M21 15v6h-6",
  collapse: "M3 9h6V3 M21 9h-6V3 M3 15h6v6 M21 15h-6v6",
  layers: "M3 3h12v12H3z M9 9h12v12H9z",
  label: "M3 6h12v12H3z M15 12h6 M18 9l3 3-3 3 M6 10h6 M6 14h4",
  note: "M4 3h16v12l-6 6H4z M14 21v-6h6 M7 8h10 M7 12h7",
  ruler: "M3 7h18v10H3z M7 7v5 M12 7v3 M17 7v5",
  image: "M3 4h18v16H3z M3 16l6-7 5 5 3-3 4 5 M17 7h1",
  print: "M6 8V3h12v5 M6 17H3V8h18v9h-3 M6 14h12v7H6z M17 11h1",
  opening: "M4 21V3h16v18 M8 21V7h8v14",
  cursor: "M5 3l14 9-7 1-3 7z",
  wall: "M4 5h16v14H4z M4 12h16 M10 5v7 M15 12v7",
  door: "M5 20V4h12v16 M5 4l9 3v13l-9-3 M11 12v2",
  sliding: "M3 5h18v14H3z M12 5v14 M9 10v4 M15 10v4",
  window: "M4 4h16v16H4z M12 4v16 M4 12h16",
  bath: "M3 12h18v4a4 4 0 01-4 4H7a4 4 0 01-4-4z M5 12V5a2 2 0 014 0 M7 20v2 M17 20v2",
  toilet: "M7 3h10v7H7z M6 10h12v4a6 6 0 01-12 0z M9 20h6v2H9",
  outlet: "M5 3h14v18H5z M9 8v3 M15 8v3 M10 16h4",
  sofa: "M5 11V6a2 2 0 012-2h10a2 2 0 012 2v5 M3 10h4v6h10v-6h4v9H3z M6 19v2 M18 19v2",
  bed: "M4 20V5h16v15 M4 11h16 M7 7h3v4 M14 7h3v4 M4 18h16",
  table: "M3 7h18v4H3z M6 11v9 M18 11v9",
  shelf: "M4 3h16v18H4z M4 9h16 M4 15h16",
  storage: "M4 3h16v18H4z M12 3v18 M8 11v3 M16 11v3",
  appliance: "M6 2h12v20H6z M6 9h12 M9 5v2 M9 12v3",
  plant:
    "M8 16h8l-1 6H9z M12 16V6 M12 11C4 11 3 4 5 3c6 0 7 8 7 8 M12 8c0-5 5-7 8-6 1 5-4 9-8 9",
  generic: "M4 5h16v14H4z M8 19v2 M16 19v2",
  plus: "M12 5v14 M5 12h14",
  minus: "M5 12h14",
  undo: "M9 5L4 10l5 5 M4 10h10a6 6 0 016 6v3",
  redo: "M15 5l5 5-5 5 M20 10H10a6 6 0 00-6 6v3",
  download: "M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5",
  upload: "M12 16V4 M7 9l5-5 5 5 M4 16v5h16v-5",
  rotate: "M19 9a8 8 0 10-1 10 M19 3v6h-6",
  trash: "M3 6h18 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7",
  fit: "M9 4H4v5 M15 4h5v5 M4 15v5h5 M20 15v5h-5",
  grid: "M4 4h16v16H4z M4 12h16 M12 4v16",
  box: "M12 3l9 5v9l-9 5-9-5V8z M3 8l9 5 9-5 M12 13v9",
  plan: "M3 4h18v16H3z M13 4v10h8 M3 14h5",
  close: "M6 6l12 12 M18 6L6 18",
  check: "M5 12l4 4L19 6",
  chevron: "M9 5l7 7-7 7",
  copy: "M9 9h12v12H9z M15 9V3H3v12h6",
  help: "M9 8a3 3 0 016 0c0 2-3 2-3 5 M12 17v1 M22 12a10 10 0 11-20 0 10 10 0 0120 0",
};
export default function Icon({
  name,
  size = 20,
}: {
  name: IconName;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
