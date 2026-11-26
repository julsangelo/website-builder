import { type DragEvent, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { canInsertAt, isContainer, proposeNodeMoveAt, type BlockType, type InsertionTarget, type PageDocument } from "@/lib/builder-document";
import type { SectionPreset } from "@/lib/builder-presets";

export type QuickInsertItem = { source: "block"; type: BlockType } | { source: "preset"; preset: SectionPreset };
export type QuickInsertDrag = { item: QuickInsertItem; pageId: string };

const insertDragType = "application/x-forma-insertion";
const moveDragType = "application/x-forma-node";

export function insertionType(item: QuickInsertItem): BlockType {
  return item.source === "preset" ? "section" : item.type;
}

export function startQuickInsertDrag(event: DragEvent, sessionRef: RefObject<QuickInsertDrag | null>, source: QuickInsertDrag) {
  sessionRef.current = source;
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData(insertDragType, "copy");
}

type Point = { x: number; y: number };
type Bounds = { left: number; top: number; width: number; height: number };
type Indicator = { line: Bounds; container?: Bounds; placement: InsertionTarget["placement"]; reason?: string };
type CanvasDrag = { effect: "copy"; item: QuickInsertItem } | { effect: "move"; nodeId: string };

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

function measureDrop(surface: HTMLElement, page: PageDocument, keepSectionAtRoot: boolean, clientX: number, clientY: number):
  { target: InsertionTarget; indicator: Indicator } | null {
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
  while (keepSectionAtRoot && node && node.parentId !== null) {
    node = page.nodes[node.parentId];
    element = elementFor(node.id);
  }

  let parentId = node?.parentId ?? null;
  let container: Bounds | undefined;
  let parent = parentId === null ? surface : elementFor(parentId) ?? surface;
  let sibling = element && node ? { element, box: bounds(element) } : null;
  if (sibling && node && !keepSectionAtRoot && isContainer(node.type)) {
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
  return { target, indicator: { line, container, placement } };
}

function sameBounds(a?: Bounds, b?: Bounds) {
  return a?.left === b?.left && a?.top === b?.top && a?.width === b?.width && a?.height === b?.height;
}

export function useCanvasDrop(
  page: PageDocument | null,
  insertSessionRef: RefObject<QuickInsertDrag | null>,
  insert: (item: QuickInsertItem, target: InsertionTarget) => void,
  move: (id: string, target: InsertionTarget) => void,
) {
  const moveSession = useRef<{ pageId: string; nodeId: string } | null>(null);
  const [indicator, setIndicator] = useState<Indicator | null>(null);
  const pageId = page?.id;
  const finish = useCallback(() => {
    insertSessionRef.current = null;
    moveSession.current = null;
    setIndicator(null);
  }, [insertSessionRef]);

  useEffect(() => {
    function cancel(event: KeyboardEvent) {
      if (event.key === "Escape" && (insertSessionRef.current || moveSession.current)) finish();
    }
    window.addEventListener("dragend", finish, true);
    window.addEventListener("keydown", cancel, true);
    return () => {
      insertSessionRef.current = null;
      moveSession.current = null;
      window.removeEventListener("dragend", finish, true);
      window.removeEventListener("keydown", cancel, true);
    };
  }, [finish, pageId, insertSessionRef]);

  function startMove(event: DragEvent<HTMLButtonElement>, nodeId: string) {
    if (!pageId) return;
    moveSession.current = { pageId, nodeId };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(moveDragType, nodeId);
  }

  function readSource(event: DragEvent<HTMLElement>): CanvasDrag | null {
    if (!page) return null;
    const { types } = event.dataTransfer;
    const moving = moveSession.current;
    if (moving?.pageId === page.id && types.includes(moveDragType)) return { effect: "move", nodeId: moving.nodeId };
    const inserting = insertSessionRef.current;
    if (inserting?.pageId === page.id && types.includes(insertDragType)) return { effect: "copy", item: inserting.item };
    return null;
  }

  function readDrop(event: DragEvent<HTMLElement>, source: CanvasDrag) {
    if (!page) return null;
    const type = source.effect === "copy" ? insertionType(source.item) : null;
    const drop = measureDrop(event.currentTarget, page, type === "section", event.clientX, event.clientY);
    if (!drop) return null;
    if (source.effect === "move") {
      const { reason } = proposeNodeMoveAt(page, source.nodeId, drop.target);
      return { ...drop, indicator: { ...drop.indicator, reason: reason ?? undefined } };
    }
    return type && canInsertAt(page, type, drop.target) ? drop : null;
  }

  function onDragOver(event: DragEvent<HTMLElement>) {
    const source = readSource(event);
    if (!source) return;
    event.preventDefault();
    const drop = readDrop(event, source);
    event.dataTransfer.dropEffect = drop && !drop.indicator.reason ? source.effect : "none";
    const next = drop?.indicator ?? null;
    setIndicator((current) => current?.placement === next?.placement && sameBounds(current?.line, next?.line)
      && sameBounds(current?.container, next?.container) && current?.reason === next?.reason ? current : next);
  }

  function onDragLeave(event: DragEvent<HTMLElement>) {
    if (!readSource(event)) return;
    const { currentTarget, relatedTarget, clientX, clientY } = event;
    const next = relatedTarget instanceof Node ? relatedTarget : currentTarget.ownerDocument.elementFromPoint(clientX, clientY);
    if (!currentTarget.contains(next)) setIndicator(null);
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    const source = readSource(event);
    if (!source) return;
    event.preventDefault();
    const drop = readDrop(event, source);
    finish();
    if (!drop || drop.indicator.reason) return;
    if (source.effect === "move") move(source.nodeId, drop.target);
    else insert(source.item, drop.target);
  }

  return { indicator, startMove, handlers: { onDragOver, onDragLeave, onDrop } };
}
