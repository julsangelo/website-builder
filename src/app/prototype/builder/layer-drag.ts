import { type DragEvent, useCallback, useEffect, useRef, useState } from "react";
import { proposeNodeMove, type MovePlacement, type PageDocument } from "@/lib/builder-document";

const layerDragType = "application/x-forma-layer";
const expandDelay = 550;
const edgeSize = 32;

type LayerDrop = { targetId: string; placement: MovePlacement; reason: string | null };

export function useLayerDrag(
  page: PageDocument | null,
  expandLayer: (id: string) => void,
  moveLayer: (sourceId: string, targetId: string, placement: MovePlacement) => void,
) {
  const pageId = page?.id;
  const [drop, setDrop] = useState<LayerDrop | null>(null);
  const session = useRef<{ sourceId: string; pageId: string } | null>(null);
  const hover = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const scrollFrameId = useRef(0);

  const stopHover = useCallback(() => {
    if (hover.current) clearTimeout(hover.current.timer);
    hover.current = null;
  }, []);

  const stopScroll = useCallback(() => {
    cancelAnimationFrame(scrollFrameId.current);
    scrollFrameId.current = 0;
  }, []);

  const finishDrag = useCallback(() => {
    session.current = null;
    stopHover();
    stopScroll();
    setDrop(null);
  }, [stopHover, stopScroll]);

  useEffect(() => {
    function cancelOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && session.current) finishDrag();
    }
    window.addEventListener("dragend", finishDrag);
    window.addEventListener("keydown", cancelOnEscape);
    return () => {
      window.removeEventListener("dragend", finishDrag);
      window.removeEventListener("keydown", cancelOnEscape);
      stopHover();
      stopScroll();
    };
  }, [pageId, finishDrag, stopHover, stopScroll]);

  function startDrag(event: DragEvent<HTMLDivElement>, sourceId: string) {
    if (!pageId) return;
    session.current = { sourceId, pageId };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(layerDragType, sourceId);
  }

  function targetAtPointer(viewport: HTMLDivElement, x: number, y: number) {
    const row = viewport.ownerDocument.elementFromPoint(x, y)?.closest<HTMLElement>("[data-layer-node-id]");
    const targetId = row?.dataset.layerNodeId;
    const source = session.current;
    if (!row || !targetId || !viewport.contains(row) || !page || source?.pageId !== page.id) return null;
    const bounds = row.getBoundingClientRect();
    const fraction = (y - bounds.top) / bounds.height;
    const placement = fraction < 0.3 ? "before" : fraction > 0.7 ? "after" : "inside";
    const { reason } = proposeNodeMove(page, source.sourceId, targetId, placement);
    return { targetId, placement, reason } satisfies LayerDrop;
  }

  function showTarget(next: LayerDrop | null) {
    setDrop((current) => current?.targetId === next?.targetId && current?.placement === next?.placement
      && current?.reason === next?.reason ? current : next);
    const expandId = next?.placement === "inside" && !next.reason ? next.targetId : null;
    if (hover.current?.id === expandId) return;
    stopHover();
    if (expandId) {
      hover.current = { id: expandId, timer: setTimeout(() => expandLayer(expandId), expandDelay) };
    }
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    if (!session.current || !event.dataTransfer.types.includes(layerDragType)) return;
    event.preventDefault();
    const viewport = event.currentTarget;
    const { clientX, clientY } = event;
    const next = targetAtPointer(viewport, clientX, clientY);
    showTarget(next);
    event.dataTransfer.dropEffect = next && !next.reason ? "move" : "none";

    const { top, bottom } = viewport.getBoundingClientRect();
    const contentTop = top + 40; // The sticky Layers heading.
    const speed = clientY < contentTop + edgeSize ? -8 : clientY > bottom - edgeSize ? 8 : 0;
    stopScroll();
    if (speed === 0) return;
    function scrollFrame() {
      const previous = viewport.scrollTop;
      viewport.scrollTop += speed;
      if (viewport.scrollTop === previous) {
        scrollFrameId.current = 0;
        return;
      }
      showTarget(targetAtPointer(viewport, clientX, clientY));
      scrollFrameId.current = requestAnimationFrame(scrollFrame);
    }
    scrollFrameId.current = requestAnimationFrame(scrollFrame);
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!session.current) return;
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
    if (!event.relatedTarget && event.clientX >= left && event.clientX < right
      && event.clientY >= top && event.clientY < bottom) return;
    showTarget(null);
    stopScroll();
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    const source = session.current;
    if (!source || !event.dataTransfer.types.includes(layerDragType)) return;
    event.preventDefault();
    const target = targetAtPointer(event.currentTarget, event.clientX, event.clientY);
    finishDrag();
    if (target && !target.reason) moveLayer(source.sourceId, target.targetId, target.placement);
  }

  return { drop, startDrag, viewportProps: { onDragOver, onDragLeave, onDrop } };
}
