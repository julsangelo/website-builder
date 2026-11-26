import { type DragEvent, type RefObject, useEffect, useState } from "react";
import { canInsertAt, isContainer, type BlockType, type InsertionTarget, type PageDocument } from "@/lib/builder-document";
import type { SectionPreset } from "@/lib/builder-presets";

export type QuickInsertItem = { source: "block"; type: BlockType } | { source: "preset"; preset: SectionPreset };
export type QuickInsertDrag = { item: QuickInsertItem; pageId: string };

const dragType = "application/x-forma-insertion";

export function insertionType(item: QuickInsertItem): BlockType {
  return item.source === "preset" ? "section" : item.type;
}

export function startQuickInsertDrag(event: DragEvent, sessionRef: RefObject<QuickInsertDrag | null>, source: QuickInsertDrag) {
  sessionRef.current = source;
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData(dragType, "copy");
}

type Point = { x: number; y: number };
type Bounds = { left: number; top: number; width: number; height: number };
type Indicator = { line: Bounds; container?: Bounds; placement: InsertionTarget["placement"] };

function flow(element: HTMLElement, childBounds: Bounds, point: Point) {
  const style = getComputedStyle(element);
  const flex = style.display === "flex" || style.display === "inline-flex";
  const grid = style.display === "grid" || style.display === "inline-grid";
  const row = flex && style.flexDirection.startsWith("row");
  const multiColumn = grid && style.gridAutoFlow.startsWith("row") && style.gridTemplateColumns.includes(" ");
  const withinRow = point.y >= childBounds.top && point.y <= childBounds.top + childBounds.height;
  const horizontal = (row && style.flexWrap === "nowrap") || ((row || multiColumn) && withinRow);
  const reversed = horizontal
    ? (row && style.flexDirection === "row-reverse") !== (style.direction === "rtl")
    : flex && (row ? style.flexWrap === "wrap-reverse" : style.flexDirection === "column-reverse");
  return { horizontal, reversed };
}

function measureDrop(surface: HTMLElement, page: PageDocument, type: BlockType, clientX: number, clientY: number) {
  const hit = surface.ownerDocument.elementFromPoint(clientX, clientY);
  if (!hit || !surface.contains(hit)) return null;

  // Live rectangles account for scrolling and the current scale, including mid-transition.
  const origin = surface.getBoundingClientRect();
  const scale = origin.width / surface.offsetWidth;
  if (!scale) return null;
  const point = { x: (clientX - origin.left) / scale, y: (clientY - origin.top) / scale };
  const bounds = (element: HTMLElement): Bounds => {
    const rect = element.getBoundingClientRect();
    return { left: (rect.left - origin.left) / scale, top: (rect.top - origin.top) / scale,
      width: rect.width / scale, height: rect.height / scale };
  };
  const elementFor = (id: string) => surface.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`);
  const nearestSibling = (ids: string[], vertical: boolean) => {
    let nearest: { element: HTMLElement; box: Bounds } | null = null;
    let distance = Infinity;
    for (const id of ids) {
      const element = elementFor(id);
      if (!element?.checkVisibility()) continue;
      const box = bounds(element);
      const dx = vertical ? 0 : Math.max(0, box.left - point.x, point.x - box.left - box.width);
      const dy = Math.max(0, box.top - point.y, point.y - box.top - box.height);
      const nextDistance = dx ** 2 + dy ** 2;
      if (nextDistance < distance) {
        distance = nextDistance;
        nearest = { element, box };
      }
    }
    return nearest;
  };

  let element = hit.closest<HTMLElement>("[data-node-id]");
  let node = element?.dataset.nodeId ? page.nodes[element.dataset.nodeId] : null;
  // Even over a nested block, a Section uses the top-level sibling boundary.
  while (type === "section" && node && node.parentId !== null) {
    node = page.nodes[node.parentId];
    element = elementFor(node.id);
  }

  let parentId = node?.parentId ?? null;
  let container: Bounds | undefined;
  let parent = parentId === null ? surface : elementFor(parentId) ?? surface;
  let sibling = element && node ? { element, box: bounds(element) } : null;
  if (sibling && node && type !== "section" && isContainer(node.type)) {
    const { box } = sibling;
    const { horizontal } = flow(parent, box, point);
    const length = horizontal ? box.width : box.height;
    const offset = horizontal ? point.x - box.left : point.y - box.top;
    const edge = Math.min(24, length / 4);
    if (offset >= edge && offset <= length - edge) {
      parentId = node.id;
      parent = sibling.element;
      container = box;
      sibling = null;
    }
  }

  const ids = parentId === null ? page.rootIds : page.nodes[parentId].childIds;
  sibling ??= nearestSibling(ids, parentId === null);
  const area = container ?? bounds(surface);
  let index = ids.length;
  let placement: InsertionTarget["placement"] = container ? "inside" : "after";
  let line: Bounds = { left: area.left + 4, top: area.top + 4, width: Math.max(0, area.width - 8), height: 3 };
  if (sibling) {
    const { box } = sibling;
    const { horizontal, reversed } = flow(parent, box, point);
    const leading = horizontal ? point.x < box.left + box.width / 2 : point.y < box.top + box.height / 2;
    const before = leading !== reversed;
    index = ids.indexOf(sibling.element.dataset.nodeId!) + Number(!before);
    placement = container ? "inside" : before ? "before" : "after";
    line = horizontal
      ? { left: box.left + (leading ? 0 : box.width) - 1.5, top: box.top, width: 3, height: box.height }
      : { left: box.left, top: box.top + (leading ? 0 : box.height) - 1.5, width: box.width, height: 3 };
  }

  const target = { pageId: page.id, parentId, index, placement };
  return canInsertAt(page, type, target) ? { target, indicator: { line, container, placement } } : null;
}

function sameBounds(a?: Bounds, b?: Bounds) {
  return a?.left === b?.left && a?.top === b?.top && a?.width === b?.width && a?.height === b?.height;
}

export function useQuickInsertDrop(
  page: PageDocument | null,
  sessionRef: RefObject<QuickInsertDrag | null>,
  insert: (item: QuickInsertItem, target: InsertionTarget) => void,
) {
  const [indicator, setIndicator] = useState<Indicator | null>(null);
  const pageId = page?.id;

  useEffect(() => {
    function finish() {
      sessionRef.current = null;
      setIndicator(null);
    }
    function cancel(event: KeyboardEvent) {
      if (event.key === "Escape" && sessionRef.current) finish();
    }
    window.addEventListener("dragend", finish, true);
    window.addEventListener("keydown", cancel, true);
    return () => {
      sessionRef.current = null;
      window.removeEventListener("dragend", finish, true);
      window.removeEventListener("keydown", cancel, true);
    };
  }, [pageId, sessionRef]);

  function readDrop(event: DragEvent<HTMLElement>) {
    const source = sessionRef.current;
    return source && page && source.pageId === page.id
      ? measureDrop(event.currentTarget, page, insertionType(source.item), event.clientX, event.clientY)
      : null;
  }

  function onDragOver(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer.types.includes(dragType)) return;
    const drop = readDrop(event);
    if (drop) event.preventDefault();
    event.dataTransfer.dropEffect = drop ? "copy" : "none";
    const next = drop?.indicator ?? null;
    setIndicator((current) => current?.placement === next?.placement && sameBounds(current?.line, next?.line)
      && sameBounds(current?.container, next?.container) ? current : next);
  }

  function onDragLeave(event: DragEvent<HTMLElement>) {
    if (!sessionRef.current) return;
    const { currentTarget, relatedTarget, clientX, clientY } = event;
    const next = relatedTarget instanceof Node ? relatedTarget : currentTarget.ownerDocument.elementFromPoint(clientX, clientY);
    if (!currentTarget.contains(next)) setIndicator(null);
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer.types.includes(dragType)) return;
    event.preventDefault();
    const source = sessionRef.current;
    const drop = readDrop(event);
    sessionRef.current = null;
    setIndicator(null);
    if (source && drop) insert(source.item, drop.target);
  }

  return { indicator, handlers: { onDragOver, onDragLeave, onDrop } };
}
