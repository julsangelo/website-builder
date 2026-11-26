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
    case "input":
      return { body: "Enter a value" };
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
  materializePresetElements(node, descendants, createId);
  return { node, descendants };
}

/** Expands the composite blocks and implicit copy used by version 2 presets. */
export function materializePresetElements(
  section: EditorNode,
  nodes: Record<string, EditorNode>,
  createId: (role: string) => string,
) {
  const preset = section.metadata?.preset;

  function add(parent: EditorNode, role: string, type: BlockType, label: string, content: NodeContent, appearance: string = type) {
    const node = createBlock(createId(`${parent.id}:${role}`), type, content);
    node.parentId = parent.id;
    node.metadata = { label, appearance: `preset-${appearance}` };
    nodes[node.id] = node;
    parent.childIds.push(node.id);
    return node;
  }

  function group(node: EditorNode, appearance: string, label = node.metadata?.label) {
    node.type = "box";
    node.metadata = { ...node.metadata, ...(label !== undefined && { label }), appearance: `preset-${appearance}` };
  }

  function links(node: EditorNode, sample: string) {
    const { body, title, ...remaining } = node.content;
    const children = node.childIds;
    node.content = remaining;
    node.childIds = [];
    group(node, "links");
    if (title !== undefined) add(node, "title", "heading", "Links heading", { title });
    if (body !== undefined) {
      const labels = body === sample ? sample.split(" · ") : [body];
      labels.forEach((label, index) => add(node, `link-${index + 1}`, "text", labels.length === 1 ? "Link text" : label, { body: label }));
    }
    node.childIds.push(...children);
  }

  function copy(node: EditorNode, titleLabel: string, bodyLabel: string) {
    const { title, body, ...remaining } = node.content;
    node.content = remaining;
    if (title !== undefined) add(node, "title", "heading", titleLabel, { title });
    if (body !== undefined) add(node, "body", "text", bodyLabel, { body });
  }

  function action(node: EditorNode, label: string) {
    const { buttonLabel, href, ...remaining } = node.content;
    node.content = remaining;
    if (buttonLabel !== undefined || href !== undefined) add(node, "action", "button", label, { buttonLabel: buttonLabel ?? "", ...(href !== undefined && { href }) });
  }

  function question(parent: EditorNode, role: string, title: string, body: string, open = false) {
    const item = add(parent, role, "box", "Question", {}, "question");
    item.metadata = { ...item.metadata, open };
    const trigger = add(item, "question", "text", "Question text", { body: title });
    trigger.metadata = { ...trigger.metadata, disclosureTrigger: true };
    add(item, "answer", "text", "Answer", { body });
  }

  function expandCard(node: EditorNode, index: number) {
    group(node, "card", node.metadata?.label ?? (preset === "features" ? "Feature card" : "Project card"));
    if (preset === "features") {
      add(node, "number", "text", "Feature number", { body: String(index + 1).padStart(2, "0") });
    } else {
      const { imageUrl, imageAssetId, alt, ...remaining } = node.content;
      node.content = remaining;
      add(node, "media", "image", "Media", {
        imageUrl: imageUrl ?? "", ...(imageAssetId !== undefined && { imageAssetId }), ...(alt !== undefined && { alt }),
      });
    }
    copy(node, "Heading", "Description");
    action(node, "CTA button");
  }

  const children = section.childIds.map((id) => nodes[id]);
  for (const node of children) {
    const { appearance, label } = node.metadata ?? {};

    if (appearance === "split-content") {
      if (node.content.title !== undefined || node.content.body !== undefined) {
        const children = node.childIds;
        node.childIds = [];
        copy(node, "Title", "Supporting text");
        node.childIds.push(...children);
      }
    } else if ((preset === "features" || preset === "collection") && node.type === "heading" && node.content.body !== undefined) {
      const { body, ...remaining } = node.content;
      node.content = remaining;
      const isCollection = preset === "collection";
      const extra = isCollection
        ? add(section, "heading-action", "button", "View all work", { buttonLabel: body })
        : add(section, "heading-description", "text", "Description", { body });
      extra.visible = node.visible;
      section.childIds.pop();
      section.childIds.splice(section.childIds.indexOf(node.id) + 1, 0, extra.id);
    } else if (appearance === "preset-grid") {
      node.childIds.map((id) => nodes[id]).forEach((item, index) => {
        if ((preset === "features" || preset === "collection") && item.type === "card") expandCard(item, index);
        if (preset === "stats" && item.type === "stat") {
          group(item, "stat", "Stat");
          copy(item, "Value", "Caption");
        }
      });
    } else if (preset === "navigation" && node.type === "stack" && label === "Links") {
      links(node, "Our studio · Selected work · Journal");
    } else if (preset === "testimonials" && node.type === "quote" && label === "Quote") {
      group(node, "quote");
      const { body, title, ...remaining } = node.content;
      node.content = remaining;
      if (body !== undefined) add(node, "quote", "text", "Quote text", { body });
      if (title !== undefined) add(node, "attribution", "text", "Attribution", { body: title });
    } else if (preset === "faq" && node.type === "accordion" && label === "Questions") {
      const { title, body, ...remaining } = node.content;
      node.content = remaining;
      group(node, "questions");
      question(node, "first", title ?? "", body ?? "", true);
      question(node, "duration", "How long does it take?", "Timelines are shaped around your team, scope, and launch goals.");
      question(node, "location", "Where do you work?", "Copenhagen · Worldwide");
    } else if (preset === "contact" && node.type === "form" && label === "Contact form") {
      group(node, "form");
      copy(node, "Form title", "Form description");
      add(node, "name", "input", "Name field", { body: "Your name" });
      add(node, "email", "input", "Email field", { body: "you@example.com" });
      add(node, "message", "input", "Message field", { body: "How can we help?" });
      action(node, "Submit button");
    } else if (preset === "footer" && node.type === "footer" && label === "Footer navigation") {
      group(node, "footer-navigation");
      copy(node, "Logo", "Footer text");
      const nav = add(node, "links", "box", "Links", {}, "links");
      for (const link of ["Studio", "Work", "Journal"]) add(nav, link.toLowerCase(), "text", link, { body: link });
    } else if (preset === "footer" && node.type === "text" && label === "Legal links" && node.content.body === "© 2026 Forma Studio · Privacy · Terms") {
      links(node, node.content.body);
    }
  }

  if (preset === "contact") {
    const eyebrow = add(section, "eyebrow", "text", "Eyebrow", { body: "Contact" });
    section.childIds.pop();
    section.childIds.unshift(eyebrow.id);
  }
}
