import { type BlockType, type EditorNode, type NodeContent } from "./builder-document.ts";

export type SectionPreset = {
  id: string;
  label: string;
  description: string;
  layers: [BlockType, string][];
};

export const sectionPresets: SectionPreset[] = [
  { id: "hero", label: "Hero", description: "Heading, CTA, and media", layers: [["text", "Eyebrow"], ["heading", "Heading"], ["text", "Description"], ["button", "CTA button"], ["image", "Image"]] },
  { id: "navigation", label: "Navigation", description: "Logo, links, and actions", layers: [["text", "Logo"], ["stack", "Links"], ["button", "Action"]] },
  { id: "features", label: "Feature grid", description: "Icon and text cards", layers: [["heading", "Heading"], ["grid", "Feature grid"], ["card", "Feature card"]] },
  { id: "content-media", label: "Content + media", description: "Split text and image", layers: [["stack", "Content"], ["heading", "Heading"], ["text", "Description"], ["image", "Media"]] },
  { id: "collection", label: "Card collection", description: "Work, products, or posts", layers: [["heading", "Section heading"], ["grid", "Card grid"], ["card", "Project card"]] },
  { id: "gallery", label: "Gallery", description: "Responsive image collection", layers: [["grid", "Image grid"], ["image", "Image"]] },
  { id: "testimonials", label: "Testimonials", description: "Quotes and customer stories", layers: [["heading", "Heading"], ["quote", "Quote"]] },
  { id: "stats", label: "Stats", description: "Key metrics in columns", layers: [["grid", "Metrics grid"], ["stat", "Stat"]] },
  { id: "faq", label: "FAQ", description: "Expandable question list", layers: [["heading", "Heading"], ["accordion", "Questions"]] },
  { id: "cta", label: "CTA", description: "Focused conversion block", layers: [["heading", "Heading"], ["text", "Description"], ["button", "Button"]] },
  { id: "contact", label: "Contact", description: "Form and contact details", layers: [["heading", "Heading"], ["text", "Contact details"], ["form", "Contact form"]] },
  { id: "footer", label: "Footer", description: "Links, legal, and social", layers: [["footer", "Footer navigation"], ["text", "Legal links"]] },
];

export function defaultBlockContent(kind: BlockType): NodeContent {
  switch (kind) {
    case "heading":
      return { title: "A clear heading that makes the next idea feel inevitable." };
    case "text":
      return { body: "Thoughtful supporting copy gives visitors context, makes a promise, and guides them toward the next meaningful action." };
    case "image":
      return { imageUrl: "" };
    case "button":
      return { buttonLabel: "Explore the collection ↗" };
    case "card":
      return { body: "Use cards to group related information and actions.", buttonLabel: "Learn more", title: "Card title" };
    case "quote":
      return { body: "“A thoughtful component system makes every page feel more intentional.”", title: "Mia Petersen, Founder" };
    case "stat":
      return { body: "projects completed", title: "48" };
    case "form":
      return { body: "Tell us a little about your next project.", buttonLabel: "Send message", title: "Get in touch" };
    case "navigation":
      return { buttonLabel: "Contact", title: "forma." };
    case "footer":
      return { body: "© 2026 Forma Studio", title: "forma." };
    case "section":
      return { body: "Use this full-width container to group related content and create visual rhythm on your page.", title: "A new section for your story" };
    case "box":
      return { body: "A flexible content box" };
    case "stack":
      return { body: "Elements flow in order with consistent, adjustable space.", title: "A vertical stack" };
    case "grid":
      return { title: "Discover" };
    case "divider":
      return {};
    case "accordion":
      return { body: "We begin with a clear brief, then build the system and details together.", title: "What does a typical project look like?" };
  }
}


const legacyHeroContent: NodeContent[] = [
  { body: "Interior architecture" },
  { title: "Spaces for slower living." },
  { body: "Thoughtful interiors, natural materials, and a quieter kind of luxury made for the way you live." },
  { buttonLabel: "Explore our work ↗" },
  { imageUrl: "" },
];

const presetContent: Record<string, NodeContent[]> = {
  hero: legacyHeroContent,
  navigation: [{ body: "forma." }, { body: "Our studio · Selected work · Journal" }, { buttonLabel: "Let's talk" }],
  features: [{ title: "Everything you need to make it memorable.", body: "Made for teams that care about every detail." }],
  "content-media": [
    {},
    { title: "Details make the difference." },
    { body: "A thoughtful system creates a clear path from first impression to lasting connection." },
    { imageUrl: "" },
  ],
  collection: [{ title: "Selected spaces", body: "View all work →" }],
  testimonials: [
    { title: "What clients say" },
    { title: "Mia Petersen, Founder at Forma", body: "“They gave us a system that feels completely ours—and the confidence to use it.”" },
  ],
  stats: [{}, { title: "48", body: "projects completed" }],
  faq: [{ title: "Frequently asked questions" }],
  cta: [
    { title: "Ready to make your next page feel like yours?" },
    { body: "Build a site that is unmistakably your own." },
    { buttonLabel: "Start a project" },
  ],
  contact: [{ title: "Let's work together." }, { body: "hello@forma.studio\nCopenhagen · Worldwide" }],
  footer: [{}, { body: "© 2026 Forma Studio · Privacy · Terms" }],
};

// These blocks formerly displayed sample items directly in the preview.
const gridSamples: Record<string, { type: BlockType; items: NodeContent[] }> = {
  features: {
    type: "card",
    items: ["Made to scale", "Built to adapt", "Easy to share"].map((title) => ({
      title, body: "Flexible foundations for your next chapter.",
    })),
  },
  collection: {
    type: "card",
    items: ["Residences", "Hospitality", "Workplaces"].map((title) => ({ title, buttonLabel: "View project" })),
  },
  gallery: {
    type: "image",
    items: Array.from({ length: 4 }, () => ({ imageUrl: "" })),
  },
  stats: {
    type: "stat",
    items: [
      { title: "12", body: "years shaping spaces" },
      { title: "48", body: "projects completed" },
      { title: "06", body: "countries reached" },
    ],
  },
};

export function legacyPresetContent(preset: SectionPreset, index: number): NodeContent {
  return preset.id === "hero" ? legacyHeroContent[index] : defaultBlockContent(preset.layers[index][0]);
}

export function createBlock(id: string, type: BlockType, content = defaultBlockContent(type)): EditorNode {
  const base = type === "stack" ? { display: "flex", flexDirection: "column", gap: 12 } as const
    : type === "grid" ? { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 10rem), 1fr))", gap: 16 }
    : {};
  return { id, type, content, parentId: null, childIds: [], styles: { base }, visible: true };
}

function splitSection(preset: SectionPreset) {
  return preset.id === "hero" || preset.id === "content-media";
}

export function createSection(id: string, preset: SectionPreset): EditorNode {
  const section = createBlock(id, "section", {});
  section.metadata = { label: preset.label, preset: preset.id };
  if (splitSection(preset)) {
    section.styles = {
      base: {
        display: "grid",
        gridTemplateColumns: preset.id === "hero" ? "minmax(0, 1.05fr) minmax(0, .95fr)" : "repeat(2, minmax(0, 1fr))",
      },
      tablet: { gridTemplateColumns: "minmax(0, 1fr)" },
    };
  }
  return section;
}

export function createPresetChild(id: string, preset: SectionPreset, index: number): EditorNode {
  const [type, label] = preset.layers[index];
  const samples = gridSamples[preset.id];
  const sampleContent = samples?.type === type ? samples.items[preset.id === "stats" ? 1 : 0] : undefined;
  const content = sampleContent ?? presetContent[preset.id]?.[index] ?? (type === "grid" ? {} : defaultBlockContent(type));
  const child = createBlock(id, type, content);
  child.metadata = { label };
  if (splitSection(preset)) {
    child.metadata.appearance = label === "Content" ? "split-content" : `${preset.id}-${label.toLowerCase().replaceAll(" ", "-")}`;
  } else if (samples && type === "grid") {
    child.metadata.appearance = "preset-grid";
  } else if (sampleContent) {
    child.metadata.appearance = "grid-sample";
  }
  return child;
}

export function nestPresetContent(
  section: EditorNode,
  nodes: Record<string, EditorNode>,
  createId: (role: string) => string,
  migrating = false,
) {
  const preset = section.metadata?.preset;
  if (typeof preset !== "string") return;
  const samples = gridSamples[preset];
  if (samples) {
    const grid = section.childIds.map((id) => nodes[id]).find((node) => node.metadata?.appearance === "preset-grid");
    if (!grid || grid.childIds.length) return;
    const templateItem = section.childIds.map((id) => nodes[id]).find((node) => node.metadata?.appearance === "grid-sample");
    const representative = preset === "stats" ? 1 : 0;
    samples.items.forEach((content, index) => {
      if (migrating && index === representative && !templateItem) return;
      const item = index === representative && templateItem
        ? templateItem : createBlock(createId(`item-${index + 1}`), samples.type, content);
      item.parentId = grid.id;
      nodes[item.id] = item;
      grid.childIds.push(item.id);
    });
    if (templateItem) section.childIds = section.childIds.filter((id) => id !== templateItem.id);
    return;
  }
  if (preset !== "hero" && preset !== "content-media") return;

  const children = section.childIds.map((id) => nodes[id]);
  if (preset === "content-media") {
    const existing = children.find((node) => node.metadata?.appearance === "split-content");
    const text = children.filter((node) => ["content-media-heading", "content-media-description"].includes(String(node.metadata?.appearance)));
    if (!existing && !text.length) return;
    const copy = existing ?? createBlock(createId("content"), "stack", {});
    copy.metadata = { ...copy.metadata, label: "Content", appearance: "split-content" };
    copy.childIds = [...text.map((node) => node.id), ...copy.childIds];
    if (existing) {
      const eyebrow = createBlock(createId("eyebrow"), "text", { body: "Our approach" });
      eyebrow.metadata = { label: "Eyebrow", appearance: "content-media-eyebrow" };
      eyebrow.parentId = copy.id;
      nodes[eyebrow.id] = eyebrow;
      copy.childIds.unshift(eyebrow.id);
    } else if (migrating) {
      // The old preview hid all of the copy when the Content layer was deleted.
      copy.visible = false;
    }
    const groupedIds = new Set(text.map((node) => node.id));
    for (const node of text) node.parentId = copy.id;
    if (!existing) section.childIds = section.childIds.map((id) => id === text[0].id ? copy.id : id);
    section.childIds = section.childIds.filter((id) => !groupedIds.has(id));
    copy.parentId = section.id;
    nodes[copy.id] = copy;
    return;
  }

  // Group contiguous runs so an existing Hero's saved sibling order survives migration.
  const roots: string[] = [];
  let copy: EditorNode | undefined;
  for (const node of children) {
    if (!String(node.metadata?.appearance).startsWith("hero-") || node.type === "image") {
      copy = undefined;
      roots.push(node.id);
      continue;
    }
    if (!copy) {
      copy = createBlock(createId("content"), "stack", {});
      copy.parentId = section.id;
      copy.metadata = { label: "Content", appearance: "split-content" };
      nodes[copy.id] = copy;
      roots.push(copy.id);
    }
    node.parentId = copy.id;
    copy.childIds.push(node.id);
  }
  section.childIds = roots;
}

export function buildSection(preset: SectionPreset, createId: () => string) {
  const node = createSection(createId(), preset);
  const descendants: Record<string, EditorNode> = {};
  for (const index of preset.layers.keys()) {
    const child = createPresetChild(createId(), preset, index);
    child.parentId = node.id;
    node.childIds.push(child.id);
    descendants[child.id] = child;
  }
  nestPresetContent(node, descendants, createId);
  return { node, descendants };
}
