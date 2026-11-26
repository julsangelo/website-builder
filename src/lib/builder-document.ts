export type Breakpoint = "base" | "tablet" | "mobile";

export type NodeContent = {
  alt?: string;
  body?: string;
  buttonLabel?: string;
  href?: string;
  imageAssetId?: string;
  imageUrl?: string;
  title?: string;
};

export type StyleValues = Record<string, string | number | boolean>;

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
  type: string;
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
  version: 1;
};

export type DocumentOperation =
  | { type: "node.insert"; pageId: string; parentId: string | null; index: number; node: EditorNode }
  | { type: "node.move"; pageId: string; nodeId: string; parentId: string | null; index: number }
  | { type: "node.updateContent"; pageId: string; nodeId: string; content: Partial<NodeContent> }
  | { type: "node.updateStyle"; pageId: string; nodeId: string; breakpoint: Breakpoint; styles: Partial<StyleValues> }
  | { type: "node.setVisibility"; pageId: string; nodeId: string; visible: boolean }
  | { type: "node.delete"; pageId: string; nodeId: string };

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

function descendantIds(nodes: Record<string, EditorNode>, nodeId: string): string[] {
  const node = nodes[nodeId];
  if (!node) return [];
  return [nodeId, ...node.childIds.flatMap((childId) => descendantIds(nodes, childId))];
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
      if (page.nodes[operation.node.id]) throw new Error(`Node ${operation.node.id} already exists`);
      if (operation.parentId && !page.nodes[operation.parentId]) throw new Error(`Parent ${operation.parentId} was not found`);
      const node = { ...operation.node, childIds: [...operation.node.childIds], parentId: operation.parentId };
      return updatePage(document, page.id, (current) => ({
        ...current,
        nodes: operation.parentId
          ? { ...current.nodes, [node.id]: node, [operation.parentId]: { ...current.nodes[operation.parentId], childIds: insertAt(current.nodes[operation.parentId].childIds, operation.index, node.id) } }
          : { ...current.nodes, [node.id]: node },
        rootIds: operation.parentId ? current.rootIds : insertAt(current.rootIds, operation.index, node.id),
      }));
    }
    case "node.move": {
      const node = page.nodes[operation.nodeId];
      if (!node) throw new Error(`Node ${operation.nodeId} was not found`);
      if (operation.parentId && !page.nodes[operation.parentId]) throw new Error(`Parent ${operation.parentId} was not found`);
      if (operation.parentId && descendantIds(page.nodes, node.id).includes(operation.parentId)) throw new Error("A node cannot be moved into its own descendant");
      const nodes = { ...page.nodes };
      const rootIds = [...page.rootIds];
      if (node.parentId) nodes[node.parentId] = { ...nodes[node.parentId], childIds: nodes[node.parentId].childIds.filter((id) => id !== node.id) };
      else rootIds.splice(rootIds.indexOf(node.id), 1);
      if (operation.parentId) nodes[operation.parentId] = { ...nodes[operation.parentId], childIds: insertAt(nodes[operation.parentId].childIds, operation.index, node.id) };
      else rootIds.splice(Math.max(0, Math.min(operation.index, rootIds.length)), 0, node.id);
      nodes[node.id] = { ...node, parentId: operation.parentId };
      return updatePage(document, page.id, (current) => ({ ...current, nodes, rootIds }));
    }
    case "node.updateContent": {
      const node = page.nodes[operation.nodeId];
      if (!node) throw new Error(`Node ${operation.nodeId} was not found`);
      return updatePage(document, page.id, (current) => ({ ...current, nodes: { ...current.nodes, [node.id]: { ...node, content: { ...node.content, ...operation.content } } } }));
    }
    case "node.updateStyle": {
      const node = page.nodes[operation.nodeId];
      if (!node) throw new Error(`Node ${operation.nodeId} was not found`);
      const changedStyles = Object.fromEntries(Object.entries(operation.styles).filter(([, value]) => value !== undefined)) as StyleValues;
      const styles = operation.breakpoint === "base"
        ? { ...node.styles, base: { ...node.styles.base, ...changedStyles } }
        : { ...node.styles, [operation.breakpoint]: { ...node.styles[operation.breakpoint], ...changedStyles } };
      return updatePage(document, page.id, (current) => ({ ...current, nodes: { ...current.nodes, [node.id]: { ...node, styles } } }));
    }
    case "node.setVisibility": {
      const node = page.nodes[operation.nodeId];
      if (!node) throw new Error(`Node ${operation.nodeId} was not found`);
      return updatePage(document, page.id, (current) => ({ ...current, nodes: { ...current.nodes, [node.id]: { ...node, visible: operation.visible } } }));
    }
    case "node.delete": {
      const node = page.nodes[operation.nodeId];
      if (!node) throw new Error(`Node ${operation.nodeId} was not found`);
      const deleted = new Set(descendantIds(page.nodes, node.id));
      const nodes = Object.fromEntries(Object.entries(page.nodes).filter(([id]) => !deleted.has(id)).map(([id, candidate]) => [id, { ...candidate, childIds: candidate.childIds.filter((childId) => !deleted.has(childId)) }]));
      return updatePage(document, page.id, (current) => ({
        ...current,
        nodes,
        rootIds: current.rootIds.filter((id) => !deleted.has(id)),
      }));
    }
  }
}
