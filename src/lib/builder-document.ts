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

type MoveOperation = Extract<DocumentOperation, { type: "node.move" }>;
export type MovePlacement = "before" | "after" | "inside";
export type InsertionTarget = {
  pageId: string;
  parentId: string | null;
  index: number;
  placement: MovePlacement;
};

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
  const error = placementError(page, parentId, type);
  if (error) throw new Error(error);
}

function placementError(page: PageDocument, parentId: string | null, type: BlockType) {
  if (parentId === null) return null;
  if (type === "section") return "Sections belong at the page root";
  if (!Object.hasOwn(page.nodes, parentId) || !isContainer(page.nodes[parentId].type)) {
    return "The destination is not a container";
  }
  return null;
}

function moveError(page: PageDocument, node: EditorNode, parentId: string | null) {
  const error = placementError(page, parentId, node.type);
  if (error) return error;
  for (let id = parentId; id !== null; id = page.nodes[id].parentId) {
    if (id === node.id) return "A node cannot be moved into itself or its descendant";
  }
  return null;
}

function siblingsAt(page: PageDocument, parentId: string | null) {
  return parentId === null ? page.rootIds : page.nodes[parentId].childIds;
}

export function canInsertAt(page: PageDocument, type: BlockType, target: InsertionTarget) {
  return target.pageId === page.id
    && !placementError(page, target.parentId, type)
    && Number.isInteger(target.index)
    && target.index >= 0
    && target.index <= siblingsAt(page, target.parentId).length;
}

export function insertionAtSelection(page: PageDocument, type: BlockType, selection: EditorNode | null): InsertionTarget {
  if (!selection) return { pageId: page.id, parentId: null, index: page.rootIds.length, placement: "after" };
  if (type !== "section" && isContainer(selection.type)) {
    return { pageId: page.id, parentId: selection.id, index: selection.childIds.length, placement: "inside" };
  }
  // A Section must follow the selected root when the selection is nested.
  while (type === "section" && selection.parentId !== null) selection = page.nodes[selection.parentId];
  const { parentId, id } = selection;
  return { pageId: page.id, parentId, index: siblingsAt(page, parentId).indexOf(id) + 1, placement: "after" };
}

export function proposeNodeMove(page: PageDocument, nodeId: string, targetId: string, placement: MovePlacement):
  { operation: MoveOperation; reason: null } | { operation: null; reason: string } {
  if (!Object.hasOwn(page.nodes, nodeId) || !Object.hasOwn(page.nodes, targetId)) {
    return { operation: null, reason: "The layer is no longer available" };
  }
  const node = page.nodes[nodeId];
  const target = page.nodes[targetId];
  const parentId = placement === "inside" ? target.id : target.parentId;
  const error = moveError(page, node, parentId);
  if (error) return { operation: null, reason: error };

  // Move indices are relative to the destination after removing the source.
  const siblings = siblingsAt(page, parentId);
  const sourceIndex = siblings.indexOf(nodeId);
  const boundary = placement === "inside" ? siblings.length : siblings.indexOf(targetId) + Number(placement === "after");
  const index = sourceIndex !== -1 && sourceIndex < boundary ? boundary - 1 : boundary;
  if (sourceIndex === index) return { operation: null, reason: "The layer is already in this position" };
  return { operation: { type: "node.move", pageId: page.id, nodeId, parentId, index }, reason: null };
}

export function selectionAfterDelete(page: PageDocument, node: EditorNode) {
  const siblings = siblingsAt(page, node.parentId);
  const index = siblings.indexOf(node.id);
  return siblings[index + 1] ?? siblings[index - 1] ?? node.parentId;
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
      const error = moveError(page, node, operation.parentId);
      if (error) throw new Error(error);
      const siblings = siblingsAt(page, operation.parentId);
      const sameParent = node.parentId === operation.parentId;
      const index = Math.max(0, Math.min(operation.index, siblings.length - Number(sameParent)));
      if (sameParent && siblings[index] === node.id) return document;
      const nodes = { ...page.nodes };
      const rootIds = [...page.rootIds];
      if (node.parentId !== null) nodes[node.parentId] = { ...nodes[node.parentId], childIds: nodes[node.parentId].childIds.filter((id) => id !== node.id) };
      else rootIds.splice(rootIds.indexOf(node.id), 1);
      if (operation.parentId !== null) nodes[operation.parentId] = { ...nodes[operation.parentId], childIds: insertAt(nodes[operation.parentId].childIds, index, node.id) };
      else rootIds.splice(index, 0, node.id);
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
