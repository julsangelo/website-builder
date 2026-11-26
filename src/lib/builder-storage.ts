import {
  blockTypes,
  type BlockType,
  type EditorNode,
  type NodeContent,
  type PageDocument,
  type SiteDocument,
  validatePageTree,
} from "./builder-document.ts";
import {
  createBlock,
  defaultBlockContent,
  createPresetChild,
  createSection,
  legacyPresetContent,
  nestPresetContent,
  sectionPresets,
} from "./builder-presets.ts";

export const editorStorageKey = "forma-builder-document-v1";

export const emptyDocument: SiteDocument = {
  id: "forma-site",
  name: "Forma Studio",
  pages: [],
  updatedAt: "",
  version: 2,
};

type SavedEditor = { document: SiteDocument; selectedPageId: string | null };

export function pageSlug(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "page";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isId(value: unknown): value is string {
  return isString(value) && value.length > 0;
}

function optionalRecord(value: unknown, isValue: (entry: unknown) => boolean) {
  return value === undefined || isRecord(value) && Object.values(value).every(isValue);
}

function isScalar(value: unknown) {
  return isString(value) || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value);
}

export function isBlockType(value: unknown): value is BlockType {
  return blockTypes.some((type) => type === value);
}

function isNode(value: unknown): value is EditorNode {
  return isRecord(value) && isId(value.id) && isBlockType(value.type)
    && (value.parentId === null || isId(value.parentId))
    && Array.isArray(value.childIds) && value.childIds.every(isId)
    && typeof value.visible === "boolean"
    && isRecord(value.content) && Object.values(value.content).every(isString)
    && optionalRecord(value.metadata, isScalar)
    && isRecord(value.styles) && isRecord(value.styles.base)
    && optionalRecord(value.styles.base, isScalar)
    && optionalRecord(value.styles.tablet, isScalar) && optionalRecord(value.styles.mobile, isScalar);
}

function readPages(value: unknown): PageDocument[] {
  if (!Array.isArray(value)) throw new Error("Missing pages");
  return value.map((page) => {
    if (!isRecord(page) || !isId(page.id) || !isString(page.name) || !isString(page.title) || !isString(page.slug)
      || !optionalRecord(page.metadata, isScalar) || !Array.isArray(page.rootIds) || !page.rootIds.every(isId)
      || !isRecord(page.nodes) || !Object.values(page.nodes).every(isNode)) {
      throw new Error("Invalid saved page");
    }
    return page as PageDocument;
  });
}

function readLegacyPages(value: Record<string, unknown>): PageDocument[] {
  const { pages, pageContent } = value;
  if (!Array.isArray(pages) || !isRecord(pageContent)) throw new Error("Invalid legacy save");
  return pages.map((page) => {
    if (!isRecord(page) || !isId(page.id) || !isString(page.name) || !isString(page.preset)) {
      throw new Error("Invalid legacy page");
    }
    const content = Object.hasOwn(pageContent, page.id) ? pageContent[page.id] : { insertedSections: [], insertedBlocks: [] };
    if (!isRecord(content) || !Array.isArray(content.insertedSections) || !Array.isArray(content.insertedBlocks)) {
      throw new Error("Invalid legacy page content");
    }

    const nodes = new Map<string, EditorNode>();
    const rootIds: string[] = [];
    function add(node: EditorNode, parent: EditorNode | null) {
      if (nodes.has(node.id)) throw new Error(`Duplicate legacy node ${node.id}`);
      node.parentId = parent?.id ?? null;
      nodes.set(node.id, node);
      (parent?.childIds ?? rootIds).push(node.id);
    }
    function addBlock(block: unknown, parent: EditorNode | null) {
      if (!isRecord(block) || !isId(block.id) || !isBlockType(block.kind)
        || !isRecord(block.content) || !Object.values(block.content).every(isString)
        || typeof block.visible !== "boolean") throw new Error("Invalid legacy block");
      const node = createBlock(block.id, block.kind, { ...defaultBlockContent(block.kind), ...block.content });
      node.visible = block.visible;
      add(node, parent);
    }

    for (const section of content.insertedSections) {
      if (!isRecord(section) || !isId(section.id) || typeof section.visible !== "boolean"
        || !Array.isArray(section.addedBlocks) || !Array.isArray(section.deletedChildIndexes)
        || !Array.isArray(section.hiddenChildIndexes)) throw new Error("Invalid legacy section");
      const preset = sectionPresets.find((preset) => preset.id === section.preset);
      if (!preset) throw new Error("Unknown legacy section preset");
      const root = createSection(section.id, preset);
      root.visible = section.visible;
      add(root, null);
      const indexes = Array.isArray(section.childOrder) && section.childOrder.length ? section.childOrder : [...preset.layers.keys()];
      for (const index of indexes) {
        if (!Number.isInteger(index) || !preset.layers[index]) throw new Error("Invalid legacy section order");
        if (section.deletedChildIndexes.includes(index)) continue;
        const item = createPresetChild(`${section.id}:child:${index}`, preset, index);
        const content = isRecord(section.childContent) && section.childContent[index] !== undefined ? section.childContent[index] : {};
        if (!isRecord(content) || !Object.values(content).every(isString)) throw new Error("Invalid legacy node content");
        item.content = { ...legacyPresetContent(preset, index), ...content };
        item.metadata = { ...item.metadata, templateIndex: index };
        item.visible = !section.hiddenChildIndexes.includes(index);
        add(item, root);
      }
      for (const block of section.addedBlocks) addBlock(block, root);
    }
    for (const block of content.insertedBlocks) addBlock(block, null);
    return {
      id: page.id, name: page.name, title: page.name, slug: pageSlug(page.name),
      metadata: { preset: page.preset },
      rootIds, nodes: Object.fromEntries(nodes),
    };
  });
}

function migratePage(page: PageDocument): PageDocument {
  const nodes = Object.fromEntries(Object.entries(page.nodes).map(([id, saved]) => {
    // The old section drop accepted the Section block as a child. Keep it as a container.
    const node = saved.type === "section" && saved.parentId !== null
      ? { ...saved, type: "box" as const, metadata: { ...saved.metadata, label: "Section", appearance: "section" } }
      : { ...saved };
    const defaults = createBlock(node.id, saved.type);
    node.content = saved.metadata?.preset ? saved.content : { ...defaults.content, ...saved.content };
    node.styles = { ...saved.styles, base: { ...defaults.styles.base, ...saved.styles.base } };
    return [id, node];
  }));
  const migrated = { ...page, nodes };
  validatePageTree(migrated);

  for (const id of page.rootIds) {
    const node = nodes[id];
    const preset = sectionPresets.find((candidate) => candidate.id === node.metadata?.preset);
    if (node.type !== "section" || !preset) continue;
    const defaults = createSection(id, preset);
    node.metadata = { ...defaults.metadata, ...node.metadata };
    node.styles = {
      ...node.styles,
      base: { ...defaults.styles.base, ...node.styles.base },
      ...(defaults.styles.tablet && { tablet: { ...defaults.styles.tablet, ...node.styles.tablet } }),
    };
    for (const childId of node.childIds) {
      const child = nodes[childId];
      const index = child.metadata?.templateIndex;
      if (typeof index !== "number" || !preset.layers[index]) continue;
      const legacy = legacyPresetContent(preset, index);
      const template = createPresetChild(childId, preset, index);
      child.metadata = { ...template.metadata, ...child.metadata };
      delete child.metadata.templateIndex;
      // Translate stored boilerplate back to the preset's previously rendered copy.
      const edits = Object.fromEntries(Object.entries(child.content).filter(([key, value]) => legacy[key as keyof NodeContent] !== value));
      child.content = { ...template.content, ...edits };
    }
    const createId = (role: string) => {
      const base = `${id}:${role}`;
      let candidate = base;
      for (let suffix = 2; Object.hasOwn(nodes, candidate); suffix++) candidate = `${base}-${suffix}`;
      return candidate;
    };
    nestPresetContent(node, nodes, createId, true);
  }
  return migrated;
}

export function loadEditorSave(value: unknown): SavedEditor {
  if (!isRecord(value)) throw new Error("Invalid editor save");
  let document = emptyDocument;
  if ("document" in value) {
    const saved = value.document;
    if (!isRecord(saved) || (saved.version !== 1 && saved.version !== 2)
      || !isId(saved.id) || !isString(saved.name) || !isString(saved.updatedAt)) {
      throw new Error("Unsupported editor document");
    }
    const pages = readPages(saved.pages);
    document = {
      id: saved.id, name: saved.name, updatedAt: saved.updatedAt, version: 2,
      pages: saved.version === 1 ? pages.map(migratePage) : pages,
    };
  } else {
    document = { ...emptyDocument, pages: readLegacyPages(value).map(migratePage) };
  }

  const ids = new Set<string>();
  for (const page of document.pages) {
    if (ids.has(page.id)) throw new Error(`Duplicate page ${page.id}`);
    ids.add(page.id);
    validatePageTree(page);
  }
  return {
    document,
    selectedPageId: isString(value.selectedPageId) && ids.has(value.selectedPageId)
      ? value.selectedPageId : document.pages[0]?.id ?? null,
  };
}
