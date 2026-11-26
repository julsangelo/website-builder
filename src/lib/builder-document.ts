import type { CSSProperties } from "react";

export type Breakpoint = "base" | "tablet" | "mobile";

export const blockTypes = [
  "section", "box", "stack", "grid", "heading", "text", "image", "button",
  "divider", "card", "quote", "stat", "accordion", "form", "navigation", "footer", "input",
] as const;

export type BlockType = typeof blockTypes[number];

export type NodeContent = {
  alt?: string;
  body?: string;
  buttonLabel?: string;
  href?: string;
  imageAssetId?: string;
  imageUrl?: string;
  title?: string;
};

export type StyleValues = CSSProperties & Partial<Record<`--${string}`, string | number>>;

export type EditorNode = {
  childIds: string[];
  content: NodeContent;
  id: string;
  metadata?: Record<string, string | number | boolean>;
  parentId: string | null;
  styles: {
    base: StyleValues;
    mobile?: Partial<StyleValues>;
    tablet?: Partial<StyleValues>;
  };
  type: BlockType;
  visible: boolean;
};

export type PageDocument = {
  id: string;
  metadata?: Record<string, string | number | boolean>;
  name: string;
  nodes: Record<string, EditorNode>;
  rootIds: string[];
  slug: string;
  title: string;
};

export type SiteDocument = {
  id: string;
  name: string;
  pages: PageDocument[];
  updatedAt: string;
  version: 3;
};

export function isContainer(type: BlockType) {
  return type === "section" || type === "box" || type === "stack" || type === "grid";
}

export function resolveStyles(node: EditorNode, breakpoint: Breakpoint): StyleValues {
  return {
    ...node.styles.base,
    ...(breakpoint !== "base" && node.styles.tablet),
    ...(breakpoint === "mobile" && node.styles.mobile),
  };
}

export type DocumentOperation =
  | { type: "node.insert"; pageId: string; parentId: string | null; index: number; node: EditorNode; descendants?: Record<string, EditorNode> }
  | { type: "node.move"; pageId: string; nodeId: string; parentId: string | null; index: number }
  | { type: "node.updateContent"; pageId: string; nodeId: string; content: Partial<NodeContent> }
  | { type: "node.updateStyle"; pageId: string; nodeId: string; breakpoint: Breakpoint; styles: Partial<StyleValues> }
  | { type: "node.setVisibility"; pageId: string; nodeId: string; visible: boolean }
  | { type: "node.delete"; pageId: string; nodeId: string };

export function validatePageTree(page: PageDocument) {
  const visited = new Set<string>();
  const pending = page.rootIds.map((id) => ({ id, parentId: null as string | null }));

  while (pending.length) {
    const { id, parentId } = pending.pop()!;
    if (!Object.hasOwn(page.nodes, id)) throw new Error(`Missing node ${id}`);
    if (visited.has(id)) throw new Error(`Repeated node ${id}`);
    const node = page.nodes[id];
    if (node.id !== id || node.parentId !== parentId) throw new Error(`Invalid identity or parent for ${id}`);
    if (parentId !== null && node.type === "section") throw new Error("Sections belong at the page root");
    if (node.childIds.length && !isContainer(node.type)) throw new Error(`Node ${id} cannot contain children`);
    visited.add(id);
    for (const childId of node.childIds) pending.push({ id: childId, parentId: id });
  }

  if (visited.size !== Object.keys(page.nodes).length) throw new Error("Page contains unreachable nodes");
}

function validatePlacement(page: PageDocument, parentId: string | null, type: BlockType) {
  if (parentId === null) return;
  if (type === "section") throw new Error("Sections belong at the page root");
  if (!Object.hasOwn(page.nodes, parentId) || !isContainer(page.nodes[parentId].type)) {
    throw new Error(`Parent ${parentId} is not a container`);
  }
}

function pageFor(document: SiteDocument, pageId: string) {
  const page = document.pages.find((candidate) => candidate.id === pageId);
  if (!page) throw new Error(`Page ${pageId} was not found`);
  return page;
}

function insertAt<T>(items: T[], index: number, item: T) {
  const next = [...items];
  next.splice(Math.max(0, Math.min(index, next.length)), 0, item);
  return next;
}

function updatePage(document: SiteDocument, pageId: string, update: (page: PageDocument) => PageDocument): SiteDocument {
  return {
    ...document,
    pages: document.pages.map((page) => page.id === pageId ? update(page) : page),
    updatedAt: new Date().toISOString(),
  };
}

export function applyDocumentOperation(document: SiteDocument, operation: DocumentOperation): SiteDocument {
  const page = pageFor(document, operation.pageId);

  switch (operation.type) {
    case "node.insert": {
      const { parentId, index, node, descendants = {} } = operation;
      validatePlacement(page, parentId, node.type);
      const added = { [node.id]: { ...node, parentId: null }, ...descendants };
      if (Object.hasOwn(descendants, node.id)) throw new Error(`Repeated node ${node.id}`);
      validatePageTree({ ...page, nodes: added, rootIds: [node.id] });
      for (const id of Object.keys(added)) {
        if (Object.hasOwn(page.nodes, id)) throw new Error(`Node ${id} already exists`);
      }
      const nodes = { ...page.nodes, ...added, [node.id]: { ...node, parentId } };
      const rootIds = parentId === null ? insertAt(page.rootIds, index, node.id) : page.rootIds;
      if (parentId !== null) {
        const parent = nodes[parentId];
        nodes[parentId] = { ...parent, childIds: insertAt(parent.childIds, index, node.id) };
      }
      return updatePage(document, page.id, (current) => ({ ...current, nodes, rootIds }));
    }
    case "node.move": {
      const node = page.nodes[operation.nodeId];
      if (!Object.hasOwn(page.nodes, operation.nodeId)) throw new Error(`Node ${operation.nodeId} was not found`);
      validatePlacement(page, operation.parentId, node.type);
      for (let parentId = operation.parentId; parentId !== null; parentId = page.nodes[parentId].parentId) {
        if (parentId === node.id) throw new Error("A node cannot be moved into its own descendant");
      }
      const nodes = { ...page.nodes };
      const rootIds = [...page.rootIds];
      if (node.parentId !== null) nodes[node.parentId] = { ...nodes[node.parentId], childIds: nodes[node.parentId].childIds.filter((id) => id !== node.id) };
      else rootIds.splice(rootIds.indexOf(node.id), 1);
      if (operation.parentId !== null) nodes[operation.parentId] = { ...nodes[operation.parentId], childIds: insertAt(nodes[operation.parentId].childIds, operation.index, node.id) };
      else rootIds.splice(Math.max(0, Math.min(operation.index, rootIds.length)), 0, node.id);
      nodes[node.id] = { ...node, parentId: operation.parentId };
      return updatePage(document, page.id, (current) => ({ ...current, nodes, rootIds }));
    }
    case "node.updateContent": {
      const node = page.nodes[operation.nodeId];
      if (!Object.hasOwn(page.nodes, operation.nodeId)) throw new Error(`Node ${operation.nodeId} was not found`);
      return updatePage(document, page.id, (current) => ({ ...current, nodes: { ...current.nodes, [node.id]: { ...node, content: { ...node.content, ...operation.content } } } }));
    }
    case "node.updateStyle": {
      const node = page.nodes[operation.nodeId];
      if (!Object.hasOwn(page.nodes, operation.nodeId)) throw new Error(`Node ${operation.nodeId} was not found`);
      const changedStyles = Object.fromEntries(Object.entries(operation.styles).filter(([, value]) => value !== undefined)) as StyleValues;
      const styles = operation.breakpoint === "base"
        ? { ...node.styles, base: { ...node.styles.base, ...changedStyles } }
        : { ...node.styles, [operation.breakpoint]: { ...node.styles[operation.breakpoint], ...changedStyles } };
      return updatePage(document, page.id, (current) => ({ ...current, nodes: { ...current.nodes, [node.id]: { ...node, styles } } }));
    }
    case "node.setVisibility": {
      const node = page.nodes[operation.nodeId];
      if (!Object.hasOwn(page.nodes, operation.nodeId)) throw new Error(`Node ${operation.nodeId} was not found`);
      return updatePage(document, page.id, (current) => ({ ...current, nodes: { ...current.nodes, [node.id]: { ...node, visible: operation.visible } } }));
    }
    case "node.delete": {
      const node = page.nodes[operation.nodeId];
      if (!Object.hasOwn(page.nodes, operation.nodeId)) throw new Error(`Node ${operation.nodeId} was not found`);
      const deleted = new Set([node.id]);
      for (const id of deleted) {
        for (const childId of page.nodes[id].childIds) deleted.add(childId);
      }
      const nodes = Object.fromEntries(Object.entries(page.nodes).filter(([id]) => !deleted.has(id)).map(([id, candidate]) => [id, { ...candidate, childIds: candidate.childIds.filter((childId) => !deleted.has(childId)) }]));
      return updatePage(document, page.id, (current) => ({
        ...current,
        nodes,
        rootIds: current.rootIds.filter((id) => !deleted.has(id)),
      }));
    }
  }
}
