export const KINDS = [
  "component",
  "inspiration",
  "web",
  "mobile",
  "toolkit",
] as const;

export type Kind = (typeof KINDS)[number];

export type Asset = {
  id: string;
  title: string;
  url: string;
  kind: Kind;
  category: string;
  tags: string[];
  notes: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
};

export const KIND_META: Record<
  Kind,
  { label: string; short: string; spine: string; blurb: string }
> = {
  component: {
    label: "Components",
    short: "UI",
    spine: "#b5472a",
    blurb: "Buttons, forms, nav, kits you can drop into a build.",
  },
  inspiration: {
    label: "Inspiration",
    short: "Mood",
    spine: "#2f4a3c",
    blurb: "Sites, shots, and layouts that set the bar.",
  },
  web: {
    label: "Web",
    short: "Web",
    spine: "#3d5f8a",
    blurb: "Docs, tools, and references for the browser.",
  },
  mobile: {
    label: "Mobile",
    short: "App",
    spine: "#8a5a2b",
    blurb: "iOS and Android patterns, kits, and product notes.",
  },
  toolkit: {
    label: "Toolkits",
    short: "Kit",
    spine: "#5a4a73",
    blurb: "Icons, type, color, motion, and utilities.",
  },
};

export const SUGGESTED_CATEGORIES = [
  "Buttons & forms",
  "Navigation",
  "Dashboards",
  "Landing pages",
  "Cards & lists",
  "Motion",
  "Icons",
  "Type & color",
  "Native patterns",
  "Illustrations",
  "Design systems",
  "Dev tools",
];
