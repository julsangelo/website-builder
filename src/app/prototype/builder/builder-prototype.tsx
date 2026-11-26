"use client";

import {
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type LucideIcon,
  ArrowLeft,
  ArrowRight,
  CircleUserRound,
  ChevronDown,
  CloudCheck,
  Code2,
  Eye,
  EyeOff,
  FileText,
  Globe2,
  GripVertical,
  HelpCircle,
  Home,
  ImageIcon,
  LayoutTemplate,
  ListFilter,
  LockKeyhole,
  Mail,
  Maximize2,
  Minimize2,
  Minus,
  Monitor,
  MoreHorizontal,
  MousePointer2,
  PanelTop,
  Move,
  Pencil,
  Play,
  Plus,
  Redo2,
  RefreshCw,
  Search,
  Settings2,
  Smartphone,
  Tablet,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog } from "@base-ui/react/dialog";
import {
  applyDocumentOperation,
  canInsertAt,
  insertionAtSelection,
  isContainer,
  proposeNodeMove,
  proposeNodeMoveAt,
  resolveStyles,
  selectionAfterDelete,
  type BlockType,
  type Breakpoint,
  type DocumentOperation,
  type EditorNode,
  type InsertionTarget,
  type MovePlacement,
  type NodeContent,
  type PageDocument,
  type SiteDocument,
} from "@/lib/builder-document";
import { buildSection, createBlock, sectionPresets } from "@/lib/builder-presets";
import { editorStorageKey, emptyDocument, loadEditorSave, pageSlug } from "@/lib/builder-storage";
import { useLayerDrag } from "./layer-drag";
import { insertionType, startQuickInsertDrag, useCanvasDrop, type QuickInsertDrag, type QuickInsertItem } from "./canvas-drop";

// PROTOTYPE: Three Figma-derived website editor shells, switchable via ?variant=a|b|c.

const variants = {
  a: { name: "Forma studio", description: "Reference editor shell" },
  b: { name: "Navigator first", description: "Page tree drives editing" },
  c: { name: "Canvas first", description: "Wide artboard with a block rail" },
} as const;

type VariantKey = keyof typeof variants;
const quickBlocks: Array<{ id: BlockType; label: string; icon: LucideIcon }> = [
  { id: "section", label: "Section", icon: LayoutTemplate },
  { id: "box", label: "Box", icon: LayoutTemplate },
  { id: "stack", label: "Stack", icon: ListFilter },
  { id: "grid", label: "Grid", icon: PanelTop },
  { id: "heading", label: "Heading", icon: Type },
  { id: "text", label: "Text", icon: Type },
  { id: "image", label: "Image", icon: ImageIcon },
  { id: "button", label: "Button", icon: MoreHorizontal },
  { id: "divider", label: "Divider", icon: Minus },
  { id: "card", label: "Card", icon: LayoutTemplate },
  { id: "quote", label: "Quote", icon: FileText },
  { id: "stat", label: "Stat", icon: ListFilter },
  { id: "accordion", label: "Accordion", icon: HelpCircle },
  { id: "form", label: "Form", icon: Mail },
  { id: "navigation", label: "Navigation", icon: PanelTop },
  { id: "footer", label: "Footer", icon: PanelTop },
];

const variantKeys = Object.keys(variants) as VariantKey[];

type CanvasViewportKind = "desktop" | "tablet" | "mobile" | "custom";

type CanvasViewport = {
  kind: CanvasViewportKind;
  label: string;
  width: number;
  zoomBaseline: number;
};

type PagePresetId = "landing" | "about" | "portfolio" | "contact" | "custom";

type BuilderPage = {
  id: string;
  icon: LucideIcon;
  name: string;
  preset: PagePresetId;
};

type PagePreset = {
  description: string;
  icon: LucideIcon;
  id: PagePresetId;
  name: string;
  title: string;
};

type PageDialogState =
  | { mode: "rename"; pageId: string }
  | { mode: "delete"; pageId: string }
  | null;

type LayerDeleteDialogState = { hasChildren: boolean; label: string; layerId: string; pageId: string } | null;

const pagePresets: PagePreset[] = [
  {
    id: "landing",
    title: "Landing page",
    name: "Landing page",
    description: "A focused starting page",
    icon: Home,
  },
  {
    id: "about",
    title: "About page",
    name: "About",
    description: "Tell your story",
    icon: CircleUserRound,
  },
  {
    id: "portfolio",
    title: "Portfolio page",
    name: "Portfolio",
    description: "Showcase selected work",
    icon: LayoutTemplate,
  },
  {
    id: "contact",
    title: "Contact page",
    name: "Contact",
    description: "Help visitors get in touch",
    icon: Mail,
  },
  {
    id: "custom",
    title: "Custom page",
    name: "Custom page",
    description: "Start with a blank page",
    icon: FileText,
  },
];

function uniquePageName(name: string, pages: BuilderPage[]) {
  const existingNames = new Set(pages.map((page) => page.name.toLocaleLowerCase()));
  if (!existingNames.has(name.toLocaleLowerCase())) return name;

  let suffix = 2;
  while (existingNames.has(`${name} ${suffix}`.toLocaleLowerCase())) suffix += 1;
  return `${name} ${suffix}`;
}

const desktopCanvasScaleAtHundredPercent = 0.6;

const canvasViewportPresets: Record<
  Exclude<CanvasViewportKind, "custom">,
  CanvasViewport
> = {
  desktop: { kind: "desktop", label: "Desktop", width: 1920, zoomBaseline: desktopCanvasScaleAtHundredPercent },
  tablet: { kind: "tablet", label: "Tablet", width: 768, zoomBaseline: 1 },
  mobile: { kind: "mobile", label: "Mobile", width: 400, zoomBaseline: 1 },
};

const customViewportBounds = {
  width: { min: 320, max: 1920 },
} as const;

const defaultCanvasHeight = 1080;

function adjacentVariant(current: VariantKey, direction: -1 | 1) {
  const index = variantKeys.indexOf(current);
  return variantKeys[(index + direction + variantKeys.length) % variantKeys.length];
}

const sectionPresetIcons: Record<string, LucideIcon> = {
  navigation: PanelTop,
  features: PanelTop,
  gallery: ImageIcon,
  testimonials: FileText,
  stats: ListFilter,
  faq: HelpCircle,
  cta: MousePointer2,
  contact: Mail,
  footer: PanelTop,
};

function nodeDetails(node: EditorNode) {
  const block = quickBlocks.find((candidate) => candidate.id === node.type) ?? { label: "Input", icon: Type };
  const preset = node.metadata?.preset;
  return {
    label: typeof node.metadata?.label === "string" ? node.metadata.label : block.label,
    icon: typeof preset === "string" ? sectionPresetIcons[preset] ?? LayoutTemplate : block.icon,
  };
}

type LayerSelection = { pageId: string; id: string; source?: "layers" };

type EditorActions = {
  page: PageDocument | null;
  hasPage: boolean;
  selectedNode: EditorNode | null;
  selection: LayerSelection | null;
  choose: (node: EditorNode, source?: "layers") => void;
  insertItem: (item: QuickInsertItem, target?: InsertionTarget) => void;
  insertDrag: RefObject<QuickInsertDrag | null>;
  isLayerCollapsed: (layerId: string) => boolean;
  expandLayer: (layerId: string) => void;
  moveLayer: (sourceId: string, targetId: string, placement: MovePlacement) => void;
  moveCanvasNode: (sourceId: string, target: InsertionTarget) => void;
  requestLayerDelete: (node: EditorNode) => void;
  toggleLayerCollapse: (layerId: string) => void;
  toggleLayerVisibility: (node: EditorNode) => void;
  updateBlockContent: (blockId: string, content: NodeContent) => void;
};

function IconButton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Button
      aria-label={label}
      className="size-7 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
      size="icon-sm"
      variant="ghost"
    >
      {children}
    </Button>
  );
}

function ProjectBar({ canRedo, canUndo, onRedo, onUndo, saveStatus }: { canRedo: boolean; canUndo: boolean; onRedo: () => void; onUndo: () => void; saveStatus: string }) {
  return (
    <header className="flex h-16 items-center gap-4 border-b border-zinc-200 bg-white px-5 text-zinc-900">
      <div className="grid size-7 shrink-0 place-items-center rounded-md bg-zinc-900 text-lg font-bold text-white">
        f
      </div>
      <div className="hidden items-center gap-2 text-xs sm:flex">
        <span className="text-zinc-500">Workspace</span>
        <span className="text-zinc-400">/</span>
        <span className="font-semibold">Forma Studio</span>
        <ChevronDown className="size-3 text-zinc-500" />
        <Badge
          className="ml-1 h-5 rounded-md bg-zinc-100 px-1.5 text-[9px] text-zinc-500 hover:bg-zinc-100"
          variant="secondary"
        >
          PRO
        </Badge>
      </div>
      <Separator className="hidden h-5 sm:block" orientation="vertical" />
      <div className="hidden items-center gap-1 sm:flex">
        <Button aria-label="Undo" className="size-7 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-35" disabled={!canUndo} onClick={onUndo} size="icon-sm" variant="ghost"><Undo2 className="size-3.5" /></Button>
        <Button aria-label="Redo" className="size-7 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-35" disabled={!canRedo} onClick={onRedo} size="icon-sm" variant="ghost"><Redo2 className="size-3.5" /></Button>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] text-zinc-500">
        {saveStatus === "All changes saved" && <CloudCheck className="size-3.5 shrink-0" />}
        <span className="truncate" role="status" title={saveStatus}>{saveStatus}</span>
      </div>
      <div className="hidden -space-x-2 sm:flex">
        <span className="grid size-7 place-items-center rounded-full border-2 border-white bg-[#e6ded4] text-[9px] font-semibold">
          AM
        </span>
        <span className="grid size-7 place-items-center rounded-full border-2 border-white bg-[#dae3df] text-[9px] font-semibold">
          JL
        </span>
      </div>
      <IconButton label="Comments"><MoreHorizontal className="size-4" /></IconButton>
      <Button
        className="hidden h-8 border-zinc-200 px-3 text-xs text-zinc-900 hover:bg-zinc-50 sm:inline-flex"
        size="sm"
        variant="outline"
      >
        <Play className="size-3.5" /> Preview
      </Button>
      <Button className="h-8 bg-orange-600 px-3 text-xs text-white hover:bg-orange-700" size="sm">
        Publish <ChevronDown className="size-3.5" />
      </Button>
    </header>
  );
}

function QuickInsert({ actions, rail = false, scrolled = false }: { actions: EditorActions; rail?: boolean; scrolled?: boolean }) {
  const [library, setLibrary] = useState<"blocks" | "sections">("blocks");
  function beginDrag(event: DragEvent, item: QuickInsertItem) {
    if (actions.page) startQuickInsertDrag(event, actions.insertDrag, { item, pageId: actions.page.id });
  }

  const items = (
    <div className={rail ? "flex items-center gap-2" : "p-4"}>
      {!rail && (
        <div className="relative mb-3">
          <Search className="absolute top-1/2 left-2.5 size-3 -translate-y-1/2 text-zinc-400" />
          <Input
            className="h-7 border-0 bg-zinc-50 pl-7 text-[11px] shadow-none"
            placeholder="Search blocks...  ⌘ K"
          />
        </div>
      )}
      {!rail && (
        <div className="mb-3 grid grid-cols-2 rounded-md bg-zinc-100 p-0.5">
          <Button aria-pressed={library === "blocks"} className="h-7 text-[11px] aria-pressed:bg-white aria-pressed:text-zinc-950 aria-pressed:shadow-sm" onClick={() => setLibrary("blocks")} size="sm" type="button" variant="ghost">Blocks</Button>
          <Button aria-pressed={library === "sections"} className="h-7 text-[11px] aria-pressed:bg-white aria-pressed:text-zinc-950 aria-pressed:shadow-sm" onClick={() => setLibrary("sections")} size="sm" type="button" variant="ghost">Sections</Button>
        </div>
      )}
      {(rail || library === "blocks") ? (
        <div className={rail ? "flex gap-2" : "grid grid-cols-2 gap-2"}>
          {quickBlocks.map((block) => {
            const Icon = block.icon;
            const item: QuickInsertItem = { source: "block", type: block.id };
            return (
              <Button
                className={
                  "h-auto cursor-grab border-zinc-200 bg-white p-0 font-normal text-zinc-900 shadow-none transition hover:border-orange-300 hover:bg-orange-50 active:cursor-grabbing disabled:cursor-not-allowed " +
                  (rail ? "w-24" : "")
                }
                disabled={!actions.hasPage}
                draggable={actions.hasPage}
                key={block.id}
                onClick={() => actions.insertItem(item)}
                onDragStart={(event) => beginDrag(event, item)}
                variant="outline"
              >
                <span
                  className={
                    rail
                      ? "flex items-center justify-center gap-2 px-2 py-2"
                      : "grid place-items-center gap-1.5 py-3"
                  }
                >
                  <Icon className="size-4 text-zinc-500" />
                  <span className="text-[11px]">{block.label}</span>
                </span>
              </Button>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-1.5">
          {sectionPresets.map((section) => {
            const Icon = sectionPresetIcons[section.id] ?? LayoutTemplate;
            const item: QuickInsertItem = { source: "preset", preset: section };
            return (
              <Button
                className="h-auto cursor-grab justify-start border-zinc-200 bg-white px-2.5 py-2 text-left font-normal text-zinc-900 shadow-none hover:border-orange-300 hover:bg-orange-50 active:cursor-grabbing disabled:cursor-not-allowed"
                disabled={!actions.hasPage}
                draggable={actions.hasPage}
                key={section.id}
                onClick={() => actions.insertItem(item)}
                onDragStart={(event) => beginDrag(event, item)}
                variant="outline"
              >
                <Icon className="size-4 shrink-0 text-zinc-500" />
                <span className="grid min-w-0 gap-0.5">
                  <span className="text-[11px] font-medium">{section.label}</span>
                  <span className="truncate text-[10px] text-zinc-500">{section.description}</span>
                </span>
              </Button>
            );
          })}
        </div>
      )}
      {!rail && (
        <p className="mt-3 flex items-center gap-1.5 text-[10px] text-zinc-500">
          {actions.hasPage ? <><GripVertical className="size-3" /> Drag {library === "blocks" ? "a block" : "a section"} onto your page</> : "Add a page before inserting blocks or sections."}
        </p>
      )}
    </div>
  );

  return rail ? items : (
    <section className="min-h-full">
      <div
        className={
          "sticky top-0 z-10 flex h-10 items-center justify-between border-b border-zinc-100 bg-white px-4 text-xs font-semibold transition-shadow " +
          (scrolled ? "shadow-[0_4px_8px_rgba(24,24,27,0.12)]" : "shadow-none")
        }
      >
        <p>Quick insert</p>
        <Settings2 className="size-3.5 text-zinc-500" />
      </div>
      {items}
    </section>
  );
}

function PageListItem({
  active,
  onDelete,
  onRename,
  onSelect,
  page,
}: {
  active: boolean;
  onDelete: () => void;
  onRename: () => void;
  onSelect: () => void;
  page: BuilderPage;
}) {
  const Icon = page.icon;

  return (
    <div
      className={
        "group flex h-8 items-center rounded-md transition " +
        (active ? "bg-orange-100 text-orange-600 hover:text-zinc-950" : "text-zinc-700 hover:bg-zinc-100")
      }
    >
      <Button
        aria-current={active ? "page" : undefined}
        className={
          "h-full min-w-0 flex-1 justify-start gap-2 rounded-md px-2.5 text-left text-xs font-normal hover:bg-transparent " +
          (active ? "font-medium text-orange-600 group-hover:text-zinc-950 hover:text-zinc-950" : "text-zinc-700 hover:text-zinc-700")
        }
        onClick={onSelect}
        type="button"
        variant="ghost"
      >
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{page.name}</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Open actions for ${page.name}`}
          className={
            "mr-1 grid size-5 shrink-0 place-items-center rounded-md outline-none transition focus-visible:ring-2 focus-visible:ring-orange-500 " +
            (active ? "text-orange-600 group-hover:text-zinc-950 hover:bg-orange-200 hover:text-zinc-950 " : "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-950 ") +
            (active ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100")
          }
          type="button"
        >
          <MoreHorizontal className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuItem className="h-7 px-1.5 py-0 text-xs" onClick={onRename}>
            <Pencil className="size-3" /> Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="h-7 px-1.5 py-0 text-xs" onClick={onDelete} variant="destructive">
            <Trash2 className="size-3" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function PageManagementDialog({
  dialog,
  draftName,
  onClose,
  onConfirm,
  onDraftNameChange,
  page,
}: {
  dialog: PageDialogState;
  draftName: string;
  onClose: () => void;
  onConfirm: () => void;
  onDraftNameChange: (name: string) => void;
  page: BuilderPage | null;
}) {
  if (!dialog || !page) return null;

  const isRename = dialog?.mode === "rename";
  const canConfirm = !isRename || draftName.trim().length > 0;

  return (
    <Dialog.Root onOpenChange={(open) => !open && onClose()} open>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[80] bg-zinc-950/25 backdrop-blur-[1px]" />
        <Dialog.Viewport className="fixed inset-0 z-[81] grid place-items-center p-4">
          <Dialog.Popup className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl outline-none">
            <Dialog.Title className="text-base font-semibold text-zinc-950">
              {isRename ? "Rename page" : "Delete page?"}
            </Dialog.Title>
            <Dialog.Description className="mt-1.5 text-sm leading-5 text-zinc-500">
              {isRename
                ? "Choose a clear name for this page."
                : `Delete ${page.name}? This page and its content cannot be restored.`}
            </Dialog.Description>
            {isRename ? (
              <form
                className="mt-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (canConfirm) onConfirm();
                }}
              >
                <label className="grid gap-1.5 text-xs font-medium text-zinc-700">
                  Page name
                  <Input
                    autoFocus
                    className="h-9 text-sm"
                    maxLength={48}
                    onChange={(event) => onDraftNameChange(event.target.value)}
                    value={draftName}
                  />
                </label>
                <div className="mt-5 flex justify-end gap-2">
                  <Button onClick={onClose} type="button" variant="outline">
                    Cancel
                  </Button>
                  <Button disabled={!canConfirm} type="submit">
                    Save name
                  </Button>
                </div>
              </form>
            ) : (
              <div className="mt-5 flex justify-end gap-2">
                <Button onClick={onClose} type="button" variant="outline">
                  Cancel
                </Button>
                <Button className="bg-red-600 text-white hover:bg-red-700" onClick={onConfirm} type="button">
                  Delete page
                </Button>
              </div>
            )}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function LayerDeleteDialog({
  dialog,
  onClose,
  onConfirm,
}: {
  dialog: LayerDeleteDialogState;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!dialog) return null;

  return (
    <Dialog.Root onOpenChange={(open) => !open && onClose()} open>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[80] bg-zinc-950/25 backdrop-blur-[1px]" />
        <Dialog.Viewport className="fixed inset-0 z-[81] grid place-items-center p-4">
          <Dialog.Popup className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl outline-none">
            <Dialog.Title className="text-base font-semibold text-zinc-950">Delete layer?</Dialog.Title>
            <Dialog.Description className="mt-1.5 text-sm leading-5 text-zinc-500">
              Delete {dialog.label}{dialog.hasChildren ? " and all its descendants" : ""}? You can undo this change.
            </Dialog.Description>
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={onClose} type="button" variant="outline">Cancel</Button>
              <Button className="bg-red-600 text-white hover:bg-red-700" onClick={onConfirm} type="button">Delete layer</Button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const movePlacements = ["before", "after", "inside"] as const;
const placementLabels = { before: "Before", after: "After", inside: "Inside, at the end" };

function LayerMoveDialog({ page, nodeId, open, onClose, onMove, restoreFocus }: {
  page: PageDocument;
  nodeId: string;
  open: boolean;
  onClose: () => void;
  onMove: EditorActions["moveLayer"];
  restoreFocus: () => HTMLElement | null;
}) {
  const [targetId, setTargetId] = useState("");
  const [placement, setPlacement] = useState<MovePlacement>("before");
  const targets = new Map<string, { path: string; placements: MovePlacement[] }>();
  function collect(ids: string[], ancestors: string[] = []) {
    ids.forEach((id, index) => {
      const node = page.nodes[id];
      const path = [...ancestors, `${nodeDetails(node).label} (${index + 1})`];
      const placements = movePlacements.filter((placement) => proposeNodeMove(page, nodeId, id, placement).operation);
      if (placements.length) targets.set(id, { path: path.join(" / "), placements });
      collect(node.childIds, path);
    });
  }
  if (open) collect(page.rootIds);
  const target = targets.get(targetId);
  const selectedPlacement = target?.placements.includes(placement) ? placement : target?.placements[0];

  function close() {
    setTargetId("");
    setPlacement("before");
    onClose();
  }

  return (
    <Dialog.Root onOpenChange={(open) => !open && close()} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[80] bg-zinc-950/25 backdrop-blur-[1px]" />
        <Dialog.Viewport className="fixed inset-0 z-[81] grid place-items-center p-4">
          <Dialog.Popup finalFocus={restoreFocus} className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl outline-none">
            <Dialog.Title className="text-base font-semibold text-zinc-950">Move {nodeDetails(page.nodes[nodeId]).label}</Dialog.Title>
            {targets.size > 0 ? (
              <div className="mt-4 grid gap-3 text-sm">
                <label className="grid gap-1">
                  Destination layer
                  <select className="w-full rounded-md border border-zinc-200 bg-white p-2" value={targetId} onChange={(event) => setTargetId(event.currentTarget.value)}>
                    <option value="" disabled>Choose a layer</option>
                    {Array.from(targets, ([id, { path }]) => <option key={id} value={id}>{path}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  Position
                  <select className="w-full rounded-md border border-zinc-200 bg-white p-2" disabled={!target} value={selectedPlacement ?? ""} onChange={(event) => setPlacement(event.currentTarget.value as MovePlacement)}>
                    {!target && <option value="">Choose a destination first</option>}
                    {target?.placements.map((value) => <option key={value} value={value}>{placementLabels[value]}</option>)}
                  </select>
                </label>
              </div>
            ) : (
              <Dialog.Description className="mt-2 text-sm text-zinc-500">There are no available destinations for this layer.</Dialog.Description>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={close} type="button" variant="outline">Cancel</Button>
              <Button disabled={!selectedPlacement} onClick={() => {
                if (selectedPlacement) onMove(nodeId, targetId, selectedPlacement);
                close();
              }} type="button">Move layer</Button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function LayerTreeItem({
  collapsed = false,
  collapsible = false,
  inheritedHidden = false,
  icon: Icon,
  label,
  nodeId,
  onDelete,
  onDragStart,
  onMove,
  onSelect,
  onToggleCollapse,
  onToggleVisibility,
  selection,
  drop,
  visible,
}: {
  collapsed?: boolean;
  collapsible?: boolean;
  inheritedHidden?: boolean;
  icon: LucideIcon;
  label: string;
  nodeId: string;
  onDelete: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onMove: () => void;
  onSelect: () => void;
  onToggleCollapse?: () => void;
  onToggleVisibility: () => void;
  selection: LayerSelection | null;
  drop: ReturnType<typeof useLayerDrag>["drop"];
  visible: boolean;
}) {
  const active = selection !== null;
  const visuallyHidden = inheritedHidden || !visible;
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selection) rowRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selection]);

  return (
    <div
      className={
        "group relative flex h-8 items-center rounded-md transition " +
        (active ? "bg-orange-100 text-orange-600 hover:text-zinc-950 " : "text-zinc-700 hover:bg-zinc-100 ") +
        (drop?.reason ? "ring-2 ring-inset ring-red-500" : drop?.placement === "inside" ? "bg-orange-50 ring-2 ring-inset ring-orange-500" : "")
      }
      draggable
      data-layer-node-id={nodeId}
      onDragStart={onDragStart}
      ref={rowRef}
      style={{ paddingLeft: 8 }}
    >
      {collapsible ? (
        <button
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${label}`}
          className={"grid size-5 shrink-0 place-items-center rounded bg-transparent " + (active ? "text-orange-600 group-hover:text-zinc-950 hover:bg-orange-200 hover:text-zinc-950" : "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-950")}
          onClick={(event) => {
            event.stopPropagation();
            onToggleCollapse?.();
          }}
          type="button"
        >
          <ChevronDown className={"size-3 transition-transform " + (collapsed ? "-rotate-90" : "")} />
        </button>
      ) : null}
      <Button
        aria-current={active ? "true" : undefined}
        aria-description={inheritedHidden ? "Hidden by a parent layer" : undefined}
        className={
          "h-full min-w-0 flex-1 justify-start gap-2 rounded-md px-1 text-left text-xs font-normal hover:bg-transparent " +
          (active ? "font-medium text-orange-600 group-hover:text-zinc-950 hover:text-zinc-950" : "text-zinc-700 hover:text-zinc-700")
        }
        onClick={onSelect}
        type="button"
        variant="ghost"
      >
        <Icon className="size-3.5 shrink-0" />
        <span className={visuallyHidden ? "truncate text-zinc-400 line-through" : "truncate"}>{label}</span>
      </Button>
      <div className="mr-1 flex shrink-0 items-center gap-0.5">
        <Button
          aria-label={`Move ${label}`}
          className="size-5 bg-transparent text-zinc-500 hover:bg-zinc-200 hover:text-zinc-950"
          data-layer-move=""
          onClick={onMove}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <Move className="size-3" />
        </Button>
        <Button
          aria-label={`${visible ? "Hide" : "Show"} ${label}`}
          className={"size-5 bg-transparent " + (active ? "text-orange-600 group-hover:text-zinc-950 hover:bg-orange-200 hover:text-zinc-950" : "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-950")}
          onClick={(event) => {
            event.stopPropagation();
            onToggleVisibility();
          }}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          {visible ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
        </Button>
        <Button
          aria-label={`Delete ${label}`}
          className={"size-5 bg-transparent hover:text-red-600 focus:opacity-100 " + (active ? "text-orange-600 opacity-60 hover:bg-orange-200 group-hover:opacity-100" : "text-zinc-400 opacity-0 hover:bg-red-50 group-hover:opacity-100")}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  );
}

function Layers({ actions, drag, ids, inheritedHidden = false, onMove }: {
  actions: EditorActions;
  drag: ReturnType<typeof useLayerDrag>;
  ids: string[];
  inheritedHidden?: boolean;
  onMove: (nodeId: string) => void;
}) {
  if (!actions.page) return null;
  const { nodes } = actions.page;
  return (
    <div className="space-y-0.5">
      {ids.map((id) => {
        const node = nodes[id];
        const { label, icon } = nodeDetails(node);
        const collapsed = actions.isLayerCollapsed(id);
        const drop = drag.drop?.targetId === id ? drag.drop : null;
        return (
          <div className="relative" key={id}>
            {drop && !drop.reason && drop.placement !== "inside" && (
              <div aria-hidden className={`pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded-full bg-orange-500 ${drop.placement === "before" ? "-top-px" : "-bottom-px"}`} />
            )}
            <LayerTreeItem
              collapsed={collapsed}
              collapsible={node.childIds.length > 0}
              drop={drop}
              icon={icon}
              inheritedHidden={inheritedHidden}
              label={label}
              nodeId={id}
              onDelete={() => actions.requestLayerDelete(node)}
              onDragStart={(event) => drag.startDrag(event, id)}
              onMove={() => onMove(id)}
              onSelect={() => actions.choose(node, "layers")}
              onToggleCollapse={() => actions.toggleLayerCollapse(id)}
              onToggleVisibility={() => actions.toggleLayerVisibility(node)}
              selection={actions.selection?.id === id ? actions.selection : null}
              visible={node.visible}
            />
            {!collapsed && node.childIds.length > 0 && (
              <div className="ml-5 border-l border-zinc-200 pl-1.5">
                <Layers actions={actions} drag={drag} ids={node.childIds} inheritedHidden={inheritedHidden || !node.visible} onMove={onMove} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LayersPanel({ actions }: { actions: EditorActions }) {
  const [scrolled, setScrolled] = useState(false);
  const [moveDialog, setMoveDialog] = useState<{ nodeId: string; open: boolean } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const page = actions.page;
  const drag = useLayerDrag(page, actions.expandLayer, actions.moveLayer);

  return (
    <ScrollArea
      className="h-full"
      viewportRef={viewportRef}
      viewportProps={{
        ...drag.viewportProps,
        onScroll: (event) => setScrolled(event.currentTarget.scrollTop > 0),
        style: { scrollPaddingTop: "2.5rem" },
      }}
    >
      <section className="min-h-full">
        <div
          className={
            "sticky top-0 z-10 flex h-10 items-center gap-2 border-b border-zinc-100 bg-white px-4 text-xs font-semibold transition-shadow " +
            (scrolled ? "shadow-[0_4px_8px_rgba(24,24,27,0.12)]" : "shadow-none")
          }
        >
          <span>Layers</span>
          <span role="status" className="ml-auto min-w-0 truncate text-right text-[10px] font-normal text-red-700" title={drag.drop?.reason ?? undefined}>
            {drag.drop?.reason}
          </span>
          <ListFilter className="size-3 shrink-0 text-zinc-500" />
        </div>
        <div className="space-y-0.5 p-3 pt-2">
          {page?.rootIds.length ? (
            <Layers actions={actions} drag={drag} ids={page.rootIds} onMove={(nodeId) => setMoveDialog({ nodeId, open: true })} />
          ) : (
            <Empty className="min-h-32 gap-2 border-0 bg-zinc-50/70 p-3">
              <EmptyHeader className="gap-1">
                <EmptyTitle className="text-xs">{page ? "No layers yet" : "No page selected"}</EmptyTitle>
                <EmptyDescription className="text-[10px]">
                  {page ? "Use Quick insert to add blocks or sections." : "Add or select a page to view its layers."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </section>
      {page && moveDialog && Object.hasOwn(page.nodes, moveDialog.nodeId) && (
        <LayerMoveDialog
          key={moveDialog.nodeId}
          nodeId={moveDialog.nodeId}
          open={moveDialog.open}
          onClose={() => setMoveDialog({ ...moveDialog, open: false })}
          onMove={actions.moveLayer}
          page={page}
          restoreFocus={() => viewportRef.current?.querySelector<HTMLElement>(`[data-layer-node-id="${CSS.escape(moveDialog.nodeId)}"] [data-layer-move]`) ?? null}
        />
      )}
    </ScrollArea>
  );
}

function CompactLayers({ actions }: { actions: EditorActions }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger render={<Button aria-label="Open Layers" size="icon-sm" variant="ghost" />}>
        <ListFilter className="size-4" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[70] bg-zinc-950/25" />
        <Dialog.Viewport className="fixed inset-0 z-[71] grid place-items-center p-4">
          <Dialog.Popup className="flex h-[min(70dvh,30rem)] w-full max-w-sm flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl outline-none">
            <Dialog.Title className="sr-only">Layers</Dialog.Title>
            <div className="min-h-0 flex-1">
              <LayersPanel actions={actions} key={actions.page?.id} />
            </div>
            <div className="flex justify-end border-t border-zinc-100 p-2">
              <Dialog.Close render={<Button size="sm" variant="outline" />}>Close</Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Navigator({
  actions,
  onAddPage,
  onDeletePage,
  onRenamePage,
  onSelectPage,
  pages,
  selectedPageId,
}: {
  actions: EditorActions;
  onAddPage: (preset: PagePreset) => void;
  onDeletePage: (page: BuilderPage) => void;
  onRenamePage: (page: BuilderPage) => void;
  onSelectPage: (page: BuilderPage) => void;
  pages: BuilderPage[];
  selectedPageId: string | null;
}) {
  const [pagesScrolled, setPagesScrolled] = useState(false);
  const [quickInsertScrolled, setQuickInsertScrolled] = useState(false);

  return (
    <aside className="flex h-full w-full min-w-0 flex-col bg-white">
      <div className="flex h-12 items-center border-b border-zinc-200 px-4 text-xs">
        <Tabs className="!h-full w-40 !gap-0" defaultValue="design">
          <TabsList className="!grid !h-full !w-full grid-cols-2 !gap-0 !p-0" variant="line">
            <TabsTrigger className="!flex !h-full !w-full !items-center !justify-center px-0 pb-0.5 text-xs data-active:text-zinc-950 after:!bottom-[-1.5px] after:z-10 after:h-0.5 after:bg-orange-600" value="design">Design</TabsTrigger>
            <TabsTrigger className="!flex !h-full !w-full !items-center !justify-center px-0 pb-0.5 text-xs after:!bottom-[-1.5px] after:z-10 after:h-0.5 after:bg-orange-600" value="assets">Assets</TabsTrigger>
          </TabsList>
        </Tabs>
        <Search className="ml-auto size-4 text-zinc-500" />
      </div>
      <ResizablePanelGroup
        className="min-h-0 flex-1"
        id="navigator-sections"
        orientation="vertical"
      >
        <ResizablePanel defaultSize="22" id="pages" minSize="120px">
          <ScrollArea
            className="h-full"
            viewportProps={{
              onScroll: (event) => setPagesScrolled(event.currentTarget.scrollTop > 0),
            }}
          >
            <section className="min-h-full">
              <div
                className={
                  "sticky top-0 z-10 flex h-10 items-center justify-between border-b border-zinc-100 bg-white px-4 text-xs font-semibold transition-shadow " +
                  (pagesScrolled ? "shadow-[0_4px_8px_rgba(24,24,27,0.12)]" : "shadow-none")
                }
              >
                <span>Pages</span>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label="Add page"
                    className="grid size-5 place-items-center rounded-md text-zinc-500 outline-none transition hover:bg-orange-100 hover:text-orange-700 focus-visible:ring-2 focus-visible:ring-orange-500"
                    type="button"
                  >
                    <Plus className="size-3" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="px-1.5 py-1 text-[10px]">Add page</DropdownMenuLabel>
                      {pagePresets
                        .filter((preset) => preset.id !== "custom")
                        .map((preset) => {
                          const Icon = preset.icon;
                          return (
                            <DropdownMenuItem
                              className="items-start gap-1.5 py-1.5 text-xs"
                              key={preset.id}
                              onClick={() => onAddPage(preset)}
                            >
                              <Icon className="mt-0.5 size-3.5" />
                              <span className="grid gap-0.5">
                                <span>{preset.title}</span>
                                <span className="text-[10px] font-normal text-zinc-500">{preset.description}</span>
                              </span>
                            </DropdownMenuItem>
                          );
                        })}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      {pagePresets
                        .filter((preset) => preset.id === "custom")
                        .map((preset) => {
                          const Icon = preset.icon;
                          return (
                            <DropdownMenuItem
                              className="items-start gap-1.5 py-1.5 text-xs"
                              key={preset.id}
                              onClick={() => onAddPage(preset)}
                            >
                              <Icon className="mt-0.5 size-3.5" />
                              <span className="grid gap-0.5">
                                <span>{preset.title}</span>
                                <span className="text-[10px] font-normal text-zinc-500">{preset.description}</span>
                              </span>
                            </DropdownMenuItem>
                          );
                        })}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="space-y-0.5 p-3 pt-2">
                {pages.length ? (
                  pages.map((page) => (
                    <PageListItem
                      active={page.id === selectedPageId}
                      key={page.id}
                      onDelete={() => onDeletePage(page)}
                      onRename={() => onRenamePage(page)}
                      onSelect={() => onSelectPage(page)}
                      page={page}
                    />
                  ))
                ) : (
                  <Empty className="min-h-28 gap-3 border-0 bg-zinc-50/70 p-3">
                    <EmptyHeader className="gap-1.5">
                      <EmptyMedia className="size-8 rounded-lg bg-zinc-100 [&>svg]:size-4">
                        <FileText />
                      </EmptyMedia>
                      <EmptyTitle className="text-xs">No pages yet</EmptyTitle>
                      <EmptyDescription className="text-[11px]">Use the plus button to add your first page.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </div>
            </section>
          </ScrollArea>
        </ResizablePanel>
        <ResizableHandle className="bg-zinc-200 hover:bg-orange-500" withHandle />
        <ResizablePanel defaultSize="43" id="layers" minSize="160px">
          <LayersPanel actions={actions} key={actions.page?.id} />
        </ResizablePanel>
        <ResizableHandle className="bg-zinc-200 hover:bg-orange-500" withHandle />
        <ResizablePanel defaultSize="35" id="quick-insert" minSize="190px">
          <ScrollArea className="h-full" viewportProps={{
            onScroll: (event) => setQuickInsertScrolled(event.currentTarget.scrollTop > 0),
          }}>
            <QuickInsert actions={actions} scrolled={quickInsertScrolled} />
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>
      <div className="flex items-center gap-2 border-t border-zinc-200 px-4 py-3 text-[10px] text-zinc-500">
        <HelpCircle className="size-3.5" /> Help & keyboard shortcuts
      </div>
    </aside>
  );
}

function CustomViewportForm({ onCancel, onViewportChange, viewport }: { onCancel: () => void; onViewportChange: (viewport: CanvasViewport) => void; viewport: CanvasViewport }) {
  const [customWidth, setCustomWidth] = useState(String(viewport.width));
  const parsedWidth = Number(customWidth);
  const customIsValid =
    Number.isInteger(parsedWidth) &&
    parsedWidth >= customViewportBounds.width.min &&
    parsedWidth <= customViewportBounds.width.max;

  function applyCustomViewport() {
    if (!customIsValid) return;
    onViewportChange({
      kind: "custom",
      label: "Custom",
      width: parsedWidth,
      zoomBaseline: viewport.zoomBaseline,
    });
    onCancel();
  }

  return (
    <form
      aria-label="Custom canvas size"
      className="absolute top-11 left-1/2 z-30 w-64 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white p-3 shadow-xl"
      onSubmit={(event) => {
        event.preventDefault();
        applyCustomViewport();
      }}
      role="dialog"
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="font-semibold text-zinc-900">Custom canvas size</p>
        <span className="text-[10px] text-zinc-400">px</span>
      </div>
      <div>
        <label className="grid gap-1 text-[10px] text-zinc-500">
          Width
          <Input
            aria-label="Canvas width"
            className="h-8 text-xs"
            inputMode="numeric"
            max={customViewportBounds.width.max}
            min={customViewportBounds.width.min}
            onChange={(event) => setCustomWidth(event.target.value)}
            type="number"
            value={customWidth}
          />
        </label>
      </div>
      <p className="mt-2 text-[9px] text-zinc-400">
        Width 320–1920
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <Button
          className="h-7 px-2 text-[10px] hover:text-zinc-900"
          onClick={onCancel}
          size="sm"
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
        <Button
          className="h-7 bg-orange-600 px-3 text-[10px] text-white hover:bg-orange-700"
          disabled={!customIsValid}
          size="sm"
          type="submit"
        >
          Apply
        </Button>
      </div>
    </form>
  );
}

function CanvasToolbar({
  onViewportChange,
  page,
  viewport,
}: {
  onViewportChange: (viewport: CanvasViewport) => void;
  page: BuilderPage | null;
  viewport: CanvasViewport;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const PageIcon = page?.icon ?? FileText;

  function choosePreset(kind: Exclude<CanvasViewportKind, "custom">) {
    const preset = canvasViewportPresets[kind];
    setCustomOpen(false);
    onViewportChange(preset);
  }

  const viewportButtons = [
    { kind: "desktop", label: "Desktop viewport", icon: Monitor },
    { kind: "tablet", label: "Tablet viewport", icon: Tablet },
    { kind: "mobile", label: "Mobile viewport", icon: Smartphone },
  ] as const;

  return (
    <div className="relative flex h-12 items-center justify-between border-b border-zinc-200 bg-white px-4 text-xs">
      <div className="flex min-w-0 items-center gap-1.5 text-zinc-600"><PageIcon className="size-3.5 shrink-0" /> <span className="truncate">{page?.name ?? "No page selected"}</span> <ChevronDown className="size-3 shrink-0" /></div>
      <div className="flex items-center gap-1 rounded-md bg-zinc-50 p-1">
        {viewportButtons.map(({ kind, label, icon: ViewportIcon }) => {
          const active = viewport.kind === kind;
          return (
            <Button
              aria-label={label}
              aria-pressed={active}
              className={
                "size-7 " +
                (active
                  ? "bg-orange-100 text-orange-600 hover:bg-orange-100 hover:text-orange-600"
                  : "text-zinc-500 hover:text-zinc-900")
              }
              key={kind}
              onClick={() => choosePreset(kind)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <ViewportIcon className="size-3.5" />
            </Button>
          );
        })}
        <Separator className="mx-1 h-4" orientation="vertical" />
        <Button
          aria-expanded={customOpen}
          aria-haspopup="dialog"
          className={
            "h-7 gap-1 px-1.5 text-[11px] font-normal " +
            (viewport.kind === "custom"
              ? "text-orange-600 hover:text-orange-600 aria-expanded:text-orange-600"
              : "text-zinc-500 hover:text-zinc-900 aria-expanded:text-zinc-900")
          }
          onClick={() => setCustomOpen((open) => !open)}
          size="sm"
          type="button"
          variant="ghost"
        >
          {viewport.width} px
          <ChevronDown className="size-3" />
        </Button>
      </div>
      <div className="flex items-center gap-3 text-zinc-500"><Code2 className="size-3.5" /><MoreHorizontal className="size-4" /></div>
      {customOpen && (
        <CustomViewportForm key={`${viewport.kind}-${viewport.width}`} onCancel={() => setCustomOpen(false)} onViewportChange={onViewportChange} viewport={viewport} />
      )}
    </div>
  );
}

type PreviewMove = {
  start: ReturnType<typeof useCanvasDrop>["startMove"];
  openDialog: (nodeId: string) => void;
};

function PreviewSelectable({
  actions, children, className, emptyContainer, move, node, style,
}: {
  actions: EditorActions;
  children: ReactNode;
  className: string;
  emptyContainer: boolean;
  move: PreviewMove;
  node: EditorNode;
  style: CSSProperties;
}) {
  const selected = actions.selectedNode?.id === node.id;
  const { label } = nodeDetails(node);

  return (
    <div
      aria-label={label}
      aria-pressed={selected}
      className={
        "cursor-pointer transition focus-visible:ring-2 focus-visible:ring-orange-500 " +
        (emptyContainer ? "min-h-8 outline-1 -outline-offset-1 outline-dashed outline-zinc-300 " : "outline-none ") +
        (selected ? "relative z-10 ring-2 ring-orange-400 ring-offset-2" : "hover:ring-1 hover:ring-orange-300") +
        " " + className
      }
      data-node-id={node.id}
      onClick={(event) => {
        event.stopPropagation();
        actions.choose(node);
      }}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          actions.choose(node);
        }
      }}
      role="button"
      style={style}
      tabIndex={0}
    >
      {children}
      {selected && (
        <button
          aria-haspopup="dialog"
          aria-label={`Move ${label}`}
          className="absolute top-0 right-0 z-10 flex size-7 cursor-grab items-center justify-center rounded-bl-md bg-orange-500 text-white shadow-sm select-none active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
          data-canvas-move-handle
          draggable
          onClick={(event) => {
            event.stopPropagation();
            move.openDialog(node.id);
          }}
          onDoubleClick={(event) => event.stopPropagation()}
          onDragStart={(event) => move.start(event, node.id)}
          type="button"
        >
          <GripVertical aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  );
}

const sectionClasses: Record<string, string> = {
  hero: "bg-[#f5f0e8]",
  "content-media": "bg-zinc-900 text-white",
  navigation: "flex flex-wrap items-center justify-between border-b border-zinc-200",
  features: "bg-white px-4 py-8",
  collection: "bg-[#f8f7f4] px-4 py-8",
  gallery: "bg-white p-6",
  testimonials: "bg-[#f4efe6] px-4 py-8 text-center",
  stats: "bg-zinc-900 px-4 py-8",
  faq: "bg-white px-4 py-8",
  cta: "bg-orange-500 px-4 py-8 text-center",
  contact: "bg-white px-4 py-8",
  footer: "bg-zinc-950 px-4 py-8 text-white",
};

const presetContainerClasses: Record<string, string> = {
  "preset-card": "grid min-w-0 content-start gap-3 rounded-xl border border-zinc-200 bg-white p-5 text-zinc-900",
  "preset-footer-navigation": "flex flex-wrap items-center justify-between gap-4 px-4 py-3",
  "preset-form": "grid gap-3 rounded-lg border border-zinc-200 bg-white p-6",
  "preset-links": "flex flex-wrap items-center gap-4 px-4 py-3",
  "preset-questions": "divide-y divide-zinc-200 rounded-lg border border-zinc-200 px-4",
  "preset-quote": "mx-auto grid max-w-3xl gap-4 rounded-lg bg-white p-8 text-zinc-900",
  "preset-stat": "grid gap-2 rounded-lg bg-white p-7 text-center text-zinc-900 [&_h2]:text-5xl",
};

function PreviewNode({ actions, node, breakpoint, move }: { actions: EditorActions; node: EditorNode; breakpoint: Breakpoint; move: PreviewMove }) {
  const page = actions.page;
  if (!node.visible || !page) return null;
  const { content, metadata } = node;
  const appearance = typeof metadata?.appearance === "string" ? metadata.appearance : "";
  const children = node.childIds.map((id) => (
    <PreviewNode actions={actions} breakpoint={breakpoint} key={id} move={move} node={page.nodes[id]} />
  ));
  const style = resolveStyles(node, breakpoint);
  const frame = (className: string, body?: ReactNode, nested: ReactNode = children) => (
    <PreviewSelectable actions={actions} className={className} emptyContainer={isContainer(node.type) && !node.childIds.some((id) => page.nodes[id].visible)} move={move} node={node} style={style}>
      {body}
      {nested}
    </PreviewSelectable>
  );

  if (node.type === "section" && typeof metadata?.preset === "string") {
    return frame(sectionClasses[metadata.preset] ?? "bg-white");
  }
  if (isContainer(node.type) && Object.hasOwn(presetContainerClasses, appearance)) {
    return frame(presetContainerClasses[appearance]);
  }
  switch (appearance) {
    case "preset-grid":
      return frame("min-h-16 min-w-0 p-4");
    case "split-content":
      return frame("min-h-80 min-w-0 justify-center " + (breakpoint === "base" ? "p-14" : "p-9"));
    case "preset-question": {
      const triggerIndex = node.childIds.findIndex((id) => page.nodes[id].metadata?.disclosureTrigger === true && page.nodes[id].visible);
      if (triggerIndex === -1) return frame("py-2 text-zinc-900");
      return frame("py-2 text-zinc-900", (
        <details open={metadata?.open === true}>
          <summary className="cursor-pointer py-2 [&>div]:inline-block">{children[triggerIndex]}</summary>
          {children.filter((_, index) => index !== triggerIndex)}
        </details>
      ), null);
    }
    case "preset-heading":
      return frame("font-semibold tracking-tight", <h2>{content.title}</h2>);
    case "preset-text":
      return frame("text-sm whitespace-pre-line", <p>{content.body}</p>);
    case "preset-button":
      return frame("w-fit", <Button size="sm" type="button" variant="outline">{content.buttonLabel}</Button>);
    case "preset-image":
      if (content.imageUrl) style.backgroundImage ??= `url(${JSON.stringify(content.imageUrl)})`;
      return frame("min-h-40 rounded-lg bg-linear-to-br from-[#d5c4ac] via-[#8e7159] to-[#455143] bg-cover bg-center", content.alt && <span className="sr-only">{content.alt}</span>);
    case "hero-eyebrow":
    case "content-media-eyebrow":
      return frame("w-fit rounded-md text-xs font-medium tracking-[0.18em] text-zinc-500 uppercase", content.body);
    case "hero-heading":
      return frame("max-w-xl rounded-md font-semibold tracking-[-0.06em] text-zinc-900 " + (breakpoint === "base" ? "text-6xl" : "text-5xl"), <h1>{content.title}</h1>);
    case "content-media-heading":
      return frame("rounded-md text-4xl font-semibold tracking-[-0.04em]", <h2>{content.title}</h2>);
    case "hero-description":
    case "content-media-description":
      return frame("max-w-md rounded-md text-sm leading-6 opacity-80", <p>{content.body}</p>);
    case "hero-cta-button":
      return frame("inline-flex w-fit rounded-md bg-zinc-900 px-4 py-3 text-sm font-medium text-white", content.buttonLabel);
    case "hero-image":
    case "content-media-media":
      if (content.imageUrl) style.backgroundImage ??= `url(${JSON.stringify(content.imageUrl)})`;
      return frame("min-h-80 bg-cover bg-center " + (appearance === "hero-image"
        ? "bg-linear-to-br from-[#8f765d] via-[#c7b08d] to-[#e6d9c5]"
        : "bg-linear-to-bl from-[#d7c7af] via-[#887764] to-[#3f433d]"), content.alt && <span className="sr-only">{content.alt}</span>);
    case "section":
      return frame("rounded-xl bg-[#f5f2ec] px-8 py-12 text-center", <><p className="text-2xl font-semibold tracking-tight text-zinc-900">{content.title}</p><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-zinc-600">{content.body}</p></>);
  }

  switch (node.type) {
    case "section":
      return frame("rounded-xl bg-[#f5f2ec] px-8 py-12 text-center", <><p className="text-2xl font-semibold tracking-tight text-zinc-900">{content.title}</p><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-zinc-600">{content.body}</p></>);
    case "box":
      return frame("bg-white p-8", <><Card className="border border-dashed border-zinc-300 bg-zinc-50 shadow-none"><CardContent className="p-8 text-center text-sm text-zinc-500">{content.body}</CardContent></Card></>);
    case "stack":
      return frame("bg-white p-8", <><Card className="border border-zinc-200 shadow-none"><CardHeader><CardTitle>{content.title}</CardTitle><CardDescription>{content.body}</CardDescription></CardHeader><CardContent><div className="h-2 w-3/4 rounded-full bg-zinc-200" /></CardContent></Card></>);
    case "grid":
      return frame("bg-white p-6", <><div className="grid grid-cols-3 gap-4">{["Discover", "Create", "Launch"].map((label, index) => <Card className="border border-zinc-200 bg-zinc-50 shadow-none" key={label}><CardContent className="p-5"><span className="text-xs text-zinc-400">0{index + 1}</span><p className="mt-6 text-sm font-semibold text-zinc-900">{label}</p></CardContent></Card>)}</div></>);
    case "heading":
      return frame("rounded-xl bg-white px-8 py-10", <><h2 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-zinc-900">{content.title}</h2></>);
    case "text":
      return frame("rounded-xl bg-white px-8 py-6", <><p className="max-w-2xl text-base leading-7 text-zinc-600">{content.body}</p></>);
    case "image":
      return frame("overflow-hidden rounded-xl", <><div className={content.imageUrl ? "h-64 bg-cover bg-center" : "h-64 bg-linear-to-br from-[#d9d1c3] via-[#a8947c] to-[#4f584b]"} style={content.imageUrl ? { backgroundImage: `url(${JSON.stringify(content.imageUrl)})` } : undefined}>{!content.imageUrl && <div className="h-full w-full bg-[radial-gradient(circle_at_70%_35%,rgba(255,255,255,.55),transparent_26%),radial-gradient(circle_at_25%_80%,rgba(36,46,39,.45),transparent_36%)]" />}</div></>);
    case "button":
      return frame("inline-flex", <><Button className="bg-zinc-900 px-5 text-sm text-white hover:bg-zinc-800" type="button">{content.buttonLabel}</Button></>);
    case "divider":
      return frame("py-5", <><Separator /></>);
    case "card":
      return frame("bg-zinc-50 p-6", <><Card className="border border-zinc-200 bg-white shadow-none"><CardHeader><CardTitle>{content.title}</CardTitle><CardDescription>{content.body}</CardDescription></CardHeader><CardFooter><Button size="sm" variant="outline">{content.buttonLabel}</Button></CardFooter></Card></>);
    case "quote":
      return frame("bg-zinc-50 p-8", <><Card className="border border-zinc-200 bg-white shadow-none"><CardContent className="p-8"><p className="text-2xl leading-tight tracking-[-0.03em] text-zinc-900">{content.body}</p><p className="mt-5 text-sm text-zinc-500">{content.title}</p></CardContent></Card></>);
    case "stat":
      return frame("bg-zinc-50 p-6", <><Card className="border border-zinc-200 bg-white text-center shadow-none"><CardContent className="p-7"><p className="text-5xl font-semibold tracking-[-0.05em] text-zinc-900">{content.title}</p><p className="mt-2 text-sm text-zinc-500">{content.body}</p></CardContent></Card></>);
    case "accordion":
      return frame("bg-white p-6", <><Accordion className="rounded-lg border border-zinc-200 px-4" defaultValue={["first"]}><AccordionItem value="first"><AccordionTrigger>{content.title}</AccordionTrigger><AccordionContent>{content.body}</AccordionContent></AccordionItem><AccordionItem value="second"><AccordionTrigger>How long does it take?</AccordionTrigger><AccordionContent>Timelines are shaped around your team, scope, and launch goals.</AccordionContent></AccordionItem></Accordion></>);
    case "form":
      return frame("bg-zinc-50 p-6", <><Card className="border border-zinc-200 bg-white shadow-none"><CardHeader><CardTitle>{content.title}</CardTitle><CardDescription>{content.body}</CardDescription></CardHeader><CardContent className="grid gap-3"><Input placeholder="Your name" /><Input placeholder="you@example.com" /><Input placeholder="How can we help?" /></CardContent><CardFooter><Button>{content.buttonLabel}</Button></CardFooter></Card></>);
    case "navigation":
      return frame("bg-white p-4", <><Card className="border border-zinc-200 bg-white shadow-none"><CardContent className="flex items-center justify-between p-4"><span className="font-semibold text-zinc-900">{content.title}</span><span className="flex gap-4 text-sm text-zinc-600"><span>Studio</span><span>Work</span><span>Journal</span></span><Button size="sm">{content.buttonLabel}</Button></CardContent></Card></>);
    case "footer":
      return frame("bg-zinc-950 p-6", <><Card className="border-zinc-800 bg-zinc-950 text-zinc-200 shadow-none"><CardContent className="flex items-center justify-between p-4"><span className="font-semibold text-white">{content.title}</span><span className="text-xs text-zinc-500">{content.body}</span></CardContent></Card></>);
    case "input":
      return frame("rounded-md", <Input aria-label={content.body} placeholder={content.body} />);
  }
}

function Artboard({ actions, artboardHeight, artboardRef, isResizing, viewport }: { actions: EditorActions; artboardHeight: number; artboardRef: React.RefObject<HTMLElement | null>; isResizing: boolean; viewport: CanvasViewport }) {
  const compactPreview = viewport.width < 768;
  const narrowPreview = viewport.width < 510;
  const browserHeaderHeight = compactPreview ? 48 : 64;
  const page = actions.page;
  const { indicator, handlers, startMove } = useCanvasDrop(page, actions.insertDrag, actions.insertItem, actions.moveCanvasNode);
  const [moveDialog, setMoveDialog] = useState<{ nodeId: string; open: boolean } | null>(null);
  const move = { start: startMove, openDialog: (nodeId: string) => setMoveDialog({ nodeId, open: true }) };
  const hasVisibleContent = page?.rootIds.some((id) => page.nodes[id].visible);
  const breakpoint: Breakpoint = narrowPreview ? "mobile" : viewport.width <= 768 ? "tablet" : "base";

  return (
    <article
      className={"relative min-h-[640px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_12px_30px_rgba(24,24,27,0.08)] transition-[width] ease-out motion-reduce:transition-none " + (isResizing ? "duration-0" : "duration-300")}
      ref={artboardRef}
      style={{ minHeight: artboardHeight, width: viewport.width }}
    >
      <header className={(compactPreview ? "h-12 px-4 " : "h-16 px-6 ") + "relative flex items-center border-b border-zinc-200 bg-zinc-50 text-zinc-400"}>
        <div className={"flex items-center " + (compactPreview ? "gap-1" : "gap-1.5")}><span className={(compactPreview ? "size-2 " : "size-3 ") + "rounded-full bg-red-400"} /><span className={(compactPreview ? "size-2 " : "size-3 ") + "rounded-full bg-amber-400"} /><span className={(compactPreview ? "size-2 " : "size-3 ") + "rounded-full bg-emerald-400"} /></div>
        <div className={(compactPreview ? "ml-5 gap-2 " : "ml-7 gap-3 ") + "flex items-center"}><ArrowLeft className={compactPreview ? "size-3" : "size-4"} /><ArrowRight className={compactPreview ? "size-3" : "size-4"} /><RefreshCw className={compactPreview ? "size-3" : "size-4"} /></div>
        {narrowPreview ? (
          <div className="ml-3 flex h-7 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white text-[9px] text-zinc-400 shadow-sm"><LockKeyhole className="size-3 shrink-0" /> <span className="truncate">yourwebsite.com</span></div>
        ) : (
          <div className={(compactPreview ? "h-7 w-[48%] gap-1.5 text-[9px] " : "h-8 w-[42%] gap-2 text-xs ") + "absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-400 shadow-sm"}><LockKeyhole className={compactPreview ? "size-3" : "size-3.5"} /> yourwebsite.com</div>
        )}
      </header>
      <section
        className={"relative bg-white text-center " + (hasVisibleContent ? "" : "grid place-items-center")}
        style={{ minHeight: artboardHeight - browserHeaderHeight }}
        {...handlers}
      >
        {hasVisibleContent ? (
          <div className="w-full text-left">
            {page?.rootIds.map((id) => (
              <PreviewNode actions={actions} breakpoint={breakpoint} key={id} move={move} node={page.nodes[id]} />
            ))}
          </div>
        ) : (
          <Empty className="max-w-sm flex-none gap-4 border-0 p-0">
            <EmptyHeader className={compactPreview ? "gap-1.5" : "gap-3"}>
              <EmptyMedia className={(compactPreview ? "size-9 rounded-lg [&>svg]:size-4" : "size-12") + " bg-zinc-100 text-zinc-500"}>
                <Globe2 />
              </EmptyMedia>
              <EmptyTitle className={compactPreview ? "text-base" : "text-xl"}>
                Your website preview
              </EmptyTitle>
              <EmptyDescription className={compactPreview ? "text-xs" : "text-base"}>
                Your page will appear here as you build it.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {indicator && (
          <div className="pointer-events-none absolute inset-0 z-20" data-insertion-indicator={indicator.placement}>
            {indicator.container && <div aria-hidden="true" className={"absolute border-2 " + (indicator.reason ? "border-red-500 bg-red-500/5" : "border-orange-400 bg-orange-400/5")} style={indicator.container} />}
            <div aria-hidden="true" className={"absolute rounded-full " + (indicator.reason ? "bg-red-500" : "bg-orange-500")} style={indicator.line} />
            {indicator.reason && (
              <span className="absolute left-2 rounded bg-red-700 px-2 py-1 text-sm text-white" role="status" style={{ top: Math.max(0, indicator.line.top - 30) }}>
                {indicator.reason}
              </span>
            )}
          </div>
        )}
      </section>
      {page && moveDialog && Object.hasOwn(page.nodes, moveDialog.nodeId) && (
        <LayerMoveDialog
          key={moveDialog.nodeId}
          nodeId={moveDialog.nodeId}
          open={moveDialog.open}
          onClose={() => setMoveDialog({ ...moveDialog, open: false })}
          onMove={actions.moveLayer}
          page={page}
          restoreFocus={() => artboardRef.current?.querySelector<HTMLElement>("[data-canvas-move-handle]") ?? null}
        />
      )}
    </article>
  );
}

function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-3 border-b border-zinc-200 p-4"><Button className="h-6 w-full justify-between px-0 text-xs font-semibold hover:bg-transparent" variant="ghost">{title}<ChevronDown className="size-3.5 text-zinc-500" /></Button>{children}</section>;
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[64px_1fr] items-center gap-2 text-[10px]"><span className="text-zinc-500">{label}</span><Input aria-label={label} className="h-8 border-0 bg-zinc-50 px-2 text-[10px] shadow-none" readOnly value={value} /></div>;
}

function ImageUploadField({ onChange }: { onChange: (imageUrl: string) => void }) {
  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const image = event.target.files?.[0];
    if (!image?.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") onChange(reader.result);
    });
    reader.readAsDataURL(image);
  };

  return <label className="flex h-8 cursor-pointer items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 px-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100">Upload image<input accept="image/*" className="sr-only" onChange={handleUpload} type="file" /></label>;
}

function BlockContentEditor({ actions, block }: { actions: EditorActions; block: EditorNode }) {
  const { content } = block;
  const appearance = block.metadata?.appearance;
  const structural = isContainer(block.type) && (block.metadata?.preset || appearance === "split-content" || (typeof appearance === "string" && Object.hasOwn(presetContainerClasses, appearance)) || appearance === "preset-question" || appearance === "preset-grid");
  const showTitle = !structural && ["section", "stack", "heading", "card", "quote", "stat", "form", "navigation", "footer"].includes(block.type);
  const showBody = !structural && ["section", "box", "stack", "text", "card", "quote", "stat", "accordion", "form", "footer"].includes(block.type);
  const showButtonLabel = ["button", "card", "form", "navigation"].includes(block.type);
  const showImageUrl = block.type === "image";
  const showPlaceholder = block.type === "input";

  if (!showTitle && !showBody && !showButtonLabel && !showImageUrl && !showPlaceholder) return null;

  return (
    <div className="mt-4 space-y-3 border-t border-zinc-200 pt-4">
      <p className="text-[10px] font-semibold tracking-[0.08em] text-zinc-500 uppercase">Content</p>
      {showTitle && <label className="grid gap-1.5 text-[10px] font-medium text-zinc-600">Title<Input className="h-8 text-xs" onChange={(event) => actions.updateBlockContent(block.id, { title: event.target.value })} value={content.title ?? ""} /></label>}
      {showBody && <label className="grid gap-1.5 text-[10px] font-medium text-zinc-600">Description<textarea className="min-h-18 w-full resize-y rounded-md border border-zinc-200 bg-white px-2.5 py-2 text-xs leading-5 outline-none placeholder:text-zinc-400 focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-200" onChange={(event) => actions.updateBlockContent(block.id, { body: event.target.value })} value={content.body ?? ""} /></label>}
      {showButtonLabel && <label className="grid gap-1.5 text-[10px] font-medium text-zinc-600">Button label<Input className="h-8 text-xs" onChange={(event) => actions.updateBlockContent(block.id, { buttonLabel: event.target.value })} value={content.buttonLabel ?? ""} /></label>}
      {showPlaceholder && <label className="grid gap-1.5 text-[10px] font-medium text-zinc-600">Placeholder<Input className="h-8 text-xs" onChange={(event) => actions.updateBlockContent(block.id, { body: event.target.value })} value={content.body ?? ""} /></label>}
      {showImageUrl && <div className="grid gap-2"><label className="grid gap-1.5 text-[10px] font-medium text-zinc-600">Image URL<Input className="h-8 text-xs" onChange={(event) => actions.updateBlockContent(block.id, { imageUrl: event.target.value })} placeholder="https://..." value={content.imageUrl ?? ""} /></label><ImageUploadField onChange={(imageUrl) => actions.updateBlockContent(block.id, { imageUrl })} /></div>}
    </div>
  );
}

function Inspector({ actions }: { actions: EditorActions }) {
  const selection = actions.selectedNode ? nodeDetails(actions.selectedNode) : null;
  const SelectionIcon = selection?.icon ?? MousePointer2;
  return (
    <aside className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-white">
      <div className="flex h-12 items-center border-b border-zinc-200 px-4 text-xs"><Tabs className="!h-full w-40 !gap-0" defaultValue="style"><TabsList className="!grid !h-full !w-full grid-cols-2 !gap-0 !p-0" variant="line"><TabsTrigger className="!flex !h-full !w-full !items-center !justify-center px-0 pb-0.5 text-xs data-active:text-zinc-950 after:!bottom-[-1.5px] after:z-10 after:h-0.5 after:bg-orange-600" value="style">Style</TabsTrigger><TabsTrigger className="!flex !h-full !w-full !items-center !justify-center px-0 pb-0.5 text-xs after:!bottom-[-1.5px] after:z-10 after:h-0.5 after:bg-orange-600" value="settings">Settings</TabsTrigger></TabsList></Tabs><MoreHorizontal className="ml-auto size-4 text-zinc-500" /></div>
      <ResizablePanelGroup className="min-h-0 flex-1" id="inspector-sections" orientation="vertical">
        <ResizablePanel defaultSize="18" id="selection" minSize="120px"><ScrollArea className="h-full"><div className="border-b border-zinc-200 p-4"><div className="flex items-center gap-3"><div className="grid size-8 place-items-center rounded-md bg-orange-100 text-orange-600"><SelectionIcon className="size-4" /></div><div><p className="text-xs font-semibold">{selection?.label ?? "No layer selected"}</p><p className="text-[10px] text-zinc-500">{actions.selectedNode?.type}</p></div></div><Button className="mt-3 w-full justify-between border-violet-300 bg-violet-50 text-[10px] text-violet-700 hover:bg-violet-100" size="sm" variant="outline">✦ {selection?.label.toLowerCase().replace(" ", "-") ?? "No selection"} <ChevronDown className="size-3" /></Button><p className="mt-2 text-[9px] text-zinc-500">Inheriting 2 styles on Desktop</p>{actions.selectedNode && <BlockContentEditor actions={actions} block={actions.selectedNode} />}</div></ScrollArea></ResizablePanel>
        <ResizableHandle className="bg-zinc-200 hover:bg-orange-500" withHandle />
        <ResizablePanel defaultSize="31" id="layout" minSize="210px"><ScrollArea className="h-full"><InspectorSection title="Layout"><div className="grid grid-cols-4 gap-1 rounded-md bg-zinc-50 p-1"><Button className="h-7 bg-white text-orange-600 shadow-sm hover:bg-white" size="sm" variant="ghost"><PanelTop className="size-3.5" /></Button><Button className="h-7 text-zinc-500" size="sm" variant="ghost"><LayoutTemplate className="size-3.5" /></Button><Button className="h-7 text-zinc-500" size="sm" variant="ghost"><Settings2 className="size-3.5" /></Button><Button className="h-7 text-zinc-500" size="sm" variant="ghost"><MousePointer2 className="size-3.5" /></Button></div><PropertyRow label="Size" value="W  Fill     H  Auto" /><PropertyRow label="Position" value="Relative" /><div className="rounded-md bg-zinc-50 p-2 text-[9px] text-zinc-500"><div className="flex justify-between"><span>MARGIN</span><span>0</span></div><div className="my-1.5 flex items-center gap-2"><span>0</span><div className="flex flex-1 items-center justify-center border border-zinc-200 p-2"><span className="bg-orange-100 px-6 py-2 text-orange-600">PADDING&nbsp; 0</span></div><span>0</span></div><p className="text-center">0</p></div></InspectorSection></ScrollArea></ResizablePanel>
        <ResizableHandle className="bg-zinc-200 hover:bg-orange-500" withHandle />
        <ResizablePanel defaultSize="35" id="typography" minSize="240px"><ScrollArea className="h-full"><InspectorSection title="Typography"><Button className="h-8 w-full justify-between bg-zinc-50 px-2 text-base font-medium hover:bg-zinc-100" variant="ghost">Inter <ChevronDown className="size-3 text-zinc-500" /></Button><PropertyRow label="Weight" value="Semibold" /><PropertyRow label="Size" value="76   px" /><div className="grid grid-cols-2 gap-2"><Input aria-label="Line height" className="h-8 border-0 bg-zinc-50 text-xs shadow-none" readOnly value="↕  98%" /><Input aria-label="Letter spacing" className="h-8 border-0 bg-zinc-50 text-xs shadow-none" readOnly value="↔  −1.6" /></div><div className="grid grid-cols-4 rounded-md bg-zinc-50 p-1"><Button className="h-7 bg-white text-orange-600" size="sm" variant="ghost">≡</Button><Button className="h-7 text-zinc-500" size="sm" variant="ghost">≡</Button><Button className="h-7 text-zinc-500" size="sm" variant="ghost">≡</Button><Button className="h-7 text-zinc-500" size="sm" variant="ghost">≡</Button></div><PropertyRow label="Color" value="■  333B32   100%" /></InspectorSection></ScrollArea></ResizablePanel>
        <ResizableHandle className="bg-zinc-200 hover:bg-orange-500" withHandle />
        <ResizablePanel defaultSize="16" id="appearance" minSize="120px"><ScrollArea className="h-full"><InspectorSection title="Appearance"><PropertyRow label="Opacity" value="100%" /><PropertyRow label="Radius" value="⌜  0" /></InspectorSection><Button className="h-10 w-full justify-between rounded-none px-4 text-xs font-semibold hover:bg-zinc-50" variant="ghost">Effects <Plus className="size-3.5 text-zinc-500" /></Button></ScrollArea></ResizablePanel>
      </ResizablePanelGroup>
    </aside>
  );
}

function Canvas({ actions, compact, onViewportChange, page, variant, viewport }: { actions: EditorActions; compact: boolean; onViewportChange: (viewport: CanvasViewport) => void; page: BuilderPage | null; variant: VariantKey; viewport: CanvasViewport }) {
  const artboardRef = useRef<HTMLElement>(null);
  const canvasStageRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({ active: false, pointerId: -1, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const canvasResizeRef = useRef({ active: false, pointerId: -1, startWidth: viewport.width, startX: 0 });
  const zoomFrameRef = useRef<number | null>(null);
  const [artboardHeight, setArtboardHeight] = useState(defaultCanvasHeight);
  const [isPanning, setIsPanning] = useState(false);
  const [isResizingCanvas, setIsResizingCanvas] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [zoomDraft, setZoomDraft] = useState("100");
  const [editingZoom, setEditingZoom] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const zoomBaseline = viewport.zoomBaseline;
  const zoomScale = zoomBaseline * zoom / 100;
  const scaledWidth = viewport.width * zoomScale;
  const scaledHeight = artboardHeight * zoomScale;
  const widthTransition = isResizingCanvas ? "duration-0" : "duration-300";
  const previewReveal = actions.selection?.source === "layers" ? actions.selection : null;

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    const artboard = artboardRef.current;
    if (!previewReveal || !viewport || !artboard) return;

    const target = artboard.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(previewReveal.id)}"]`);
    if (!target) return;

    // A selected FAQ answer may sit inside a closed disclosure in the preview.
    for (let parent = target.parentElement; parent && parent !== artboard; parent = parent.parentElement) {
      if (parent instanceof HTMLDetailsElement && !parent.querySelector(":scope > summary")?.contains(target)) {
        parent.open = true;
      }
    }
    if (!target.checkVisibility()) return;

    const bounds = target.getBoundingClientRect();
    const viewportBounds = viewport.getBoundingClientRect();
    const nearest = (start: number, end: number, length: number) =>
      start < 0 && end <= length ? Math.max(start, end - length)
        : end > length && start >= 0 ? Math.min(start, end - length)
        : 0;
    viewport.scrollBy({
      left: nearest(bounds.left - viewportBounds.left, bounds.right - viewportBounds.left, viewport.clientWidth),
      top: nearest(bounds.top - viewportBounds.top, bounds.bottom - viewportBounds.top, viewport.clientHeight),
    });
  }, [previewReveal]);

  useEffect(() => {
    const artboard = artboardRef.current;
    if (!artboard) return;

    const measure = () => setArtboardHeight(Math.max(defaultCanvasHeight, artboard.scrollHeight));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(artboard);
    return () => observer.disconnect();
  }, [viewport.width, actions.page]);

  useEffect(() => {
    const scrollViewport = scrollViewportRef.current;
    if (!scrollViewport) return;

    const recenter = () => {
      scrollViewport.scrollTo({
        left: Math.max(0, (scrollViewport.scrollWidth - scrollViewport.clientWidth) / 2),
      });
    };

    recenter();
    const observer = new ResizeObserver(recenter);
    observer.observe(scrollViewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => {
    if (zoomFrameRef.current !== null) cancelAnimationFrame(zoomFrameRef.current);
  }, []);

  function applyZoom(value: number) {
    const nextZoom = Math.min(150, Math.max(25, Math.round(value)));
    if (nextZoom === zoom) {
      setZoomDraft(String(nextZoom));
      setEditingZoom(false);
      return;
    }

    const scrollViewport = scrollViewportRef.current;
    const artboard = artboardRef.current;
    let anchor: { clientX: number; clientY: number; contentX: number; contentY: number } | null = null;
    if (scrollViewport && artboard) {
      const scrollBounds = scrollViewport.getBoundingClientRect();
      const artboardBounds = artboard.getBoundingClientRect();
      anchor = {
        clientX: scrollBounds.left + scrollViewport.clientWidth / 2,
        clientY: scrollBounds.top + scrollViewport.clientHeight / 2,
        contentX: (scrollBounds.left + scrollViewport.clientWidth / 2 - artboardBounds.left) / zoomScale,
        contentY: (scrollBounds.top + scrollViewport.clientHeight / 2 - artboardBounds.top) / zoomScale,
      };
    }

    setZoom(nextZoom);
    setZoomDraft(String(nextZoom));
    setEditingZoom(false);

    if (!anchor || !scrollViewport || !artboard) return;
    if (zoomFrameRef.current !== null) cancelAnimationFrame(zoomFrameRef.current);
    zoomFrameRef.current = requestAnimationFrame(() => {
      const updatedBounds = artboard.getBoundingClientRect();
      const nextScale = zoomBaseline * nextZoom / 100;
      scrollViewport.scrollLeft += updatedBounds.left + anchor.contentX * nextScale - anchor.clientX;
      scrollViewport.scrollTop += updatedBounds.top + anchor.contentY * nextScale - anchor.clientY;
      zoomFrameRef.current = null;
    });
  }

  function commitZoomDraft() {
    const parsedZoom = Number(zoomDraft);
    if (!zoomDraft.trim() || !Number.isFinite(parsedZoom)) {
      setZoomDraft(String(zoom));
      setEditingZoom(false);
      return;
    }
    applyZoom(parsedZoom);
  }

  function centerCanvasHorizontally() {
    const scrollViewport = scrollViewportRef.current;
    if (!scrollViewport) return;
    scrollViewport.scrollTo({
      behavior: "smooth",
      left: Math.max(0, (scrollViewport.scrollWidth - scrollViewport.clientWidth) / 2),
    });
  }

  function handlePanStart(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 1) return;
    const scrollViewport = scrollViewportRef.current;
    if (!scrollViewport) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = {
      active: true,
      pointerId: event.pointerId,
      scrollLeft: scrollViewport.scrollLeft,
      scrollTop: scrollViewport.scrollTop,
      startX: event.clientX,
      startY: event.clientY,
    };
    setIsPanning(true);
  }

  function handlePanMove(event: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    const scrollViewport = scrollViewportRef.current;
    if (!pan.active || pan.pointerId !== event.pointerId || !scrollViewport) return;
    const deltaX = event.clientX - pan.startX;
    const deltaY = event.clientY - pan.startY;
    scrollViewport.scrollLeft = pan.scrollLeft - deltaX;
    scrollViewport.scrollTop = pan.scrollTop - deltaY;
  }

  function handlePanEnd(event: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    if (!pan.active || pan.pointerId !== event.pointerId) return;
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pan.active = false;
    setIsPanning(false);
  }

  function handleMiddleClick(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 1) return;
    event.preventDefault();
  }

  function handleMiddleMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.button === 1 && event.detail >= 2) centerCanvasHorizontally();
  }

  function updateCanvasWidth(width: number) {
    const nextWidth = Math.min(
      customViewportBounds.width.max,
      Math.max(customViewportBounds.width.min, Math.round(width)),
    );
    onViewportChange({
      kind: "custom",
      label: "Custom",
      width: nextWidth,
      zoomBaseline: viewport.zoomBaseline,
    });
  }

  function handleCanvasResizeStart(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    canvasResizeRef.current = {
      active: true,
      pointerId: event.pointerId,
      startWidth: viewport.width,
      startX: event.clientX,
    };
    setIsResizingCanvas(true);
  }

  function handleCanvasResizeMove(event: PointerEvent<HTMLDivElement>) {
    const resize = canvasResizeRef.current;
    if (!resize.active || resize.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    updateCanvasWidth(resize.startWidth + (event.clientX - resize.startX) / zoomScale);
  }

  function handleCanvasResizeEnd(event: PointerEvent<HTMLDivElement>) {
    const resize = canvasResizeRef.current;
    if (!resize.active || resize.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resize.active = false;
    setIsResizingCanvas(false);
  }

  function handleCanvasResizeKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const adjustment = event.key === "ArrowRight" ? 16 : event.key === "ArrowLeft" ? -16 : 0;
    if (!adjustment) return;
    event.preventDefault();
    updateCanvasWidth(viewport.width + adjustment);
  }

  return (
    <main className={"flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f7f6f4] " + (isFullscreen ? "fixed inset-0 z-[60] h-screen w-screen" : "")}>
      <CanvasToolbar onViewportChange={onViewportChange} page={page} viewport={viewport} />
      <ScrollArea
        className="min-h-0 flex-1"
        horizontal
        viewportClassName={"overscroll-contain " + (isPanning ? "cursor-grabbing select-none" : "")}
        viewportProps={{
          onAuxClick: handleMiddleClick,
          onMouseDown: handleMiddleMouseDown,
          onPointerCancel: handlePanEnd,
          onPointerDown: handlePanStart,
          onPointerMove: handlePanMove,
          onPointerUp: handlePanEnd,
        }}
        viewportRef={scrollViewportRef}
      >
        {page ? (
          <div className="box-border flex min-h-full w-max min-w-full justify-center px-5 py-6 sm:px-10">
            <div className={"my-auto shrink-0 transition-[width,height] ease-out motion-reduce:transition-none " + widthTransition} ref={canvasStageRef} style={{ height: scaledHeight + 20, width: scaledWidth }}>
              <div className="mb-2 flex shrink-0 justify-between text-[10px] text-zinc-400"><span>{page.name} · {viewport.label}</span><span>{viewport.width} px</span></div>
              <div className={"relative transition-[width,height] ease-out motion-reduce:transition-none " + widthTransition} style={{ height: scaledHeight, width: scaledWidth }}>
                <div className="absolute top-0 left-0 origin-top-left transition-transform duration-300 ease-out will-change-transform motion-reduce:transition-none" style={{ transform: `scale(${zoomScale})`, width: viewport.width }}>
                  <Artboard actions={actions} artboardHeight={artboardHeight} artboardRef={artboardRef} isResizing={isResizingCanvas} key={actions.page?.id} viewport={viewport} />
                </div>
                <div
                  aria-label="Resize canvas width"
                  aria-orientation="vertical"
                  aria-valuemax={customViewportBounds.width.max}
                  aria-valuemin={customViewportBounds.width.min}
                  aria-valuenow={viewport.width}
                  className="absolute top-0 right-0 z-10 flex h-full w-4 translate-x-1/2 cursor-ew-resize touch-none items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
                  onKeyDown={handleCanvasResizeKeyDown}
                  onPointerCancel={handleCanvasResizeEnd}
                  onPointerDown={handleCanvasResizeStart}
                  onPointerMove={handleCanvasResizeMove}
                  onPointerUp={handleCanvasResizeEnd}
                  role="separator"
                  tabIndex={0}
                >
                  <span className="h-12 w-1 rounded-full bg-zinc-300 shadow-sm transition-colors hover:bg-orange-500" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[calc(100dvh-9.75rem)] min-w-full items-center justify-center p-8 text-center">
            <Empty className="max-w-md flex-none border-0 bg-transparent shadow-none">
              <EmptyHeader className="gap-3">
                <EmptyMedia className="bg-zinc-100 text-zinc-500">
                  <Globe2 />
                </EmptyMedia>
                <EmptyTitle className="text-xl">No pages yet</EmptyTitle>
                <EmptyDescription>
                  Add a page from the Pages panel to start building your website.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        )}
      </ScrollArea>
      <footer className="sticky bottom-0 z-20 flex h-11 shrink-0 items-center justify-between gap-3 border-t border-zinc-200 bg-white px-4 text-[11px] text-zinc-500">
        <span className="truncate">{page ? <>{page.name}{actions.page && ancestorNodes(actions.page, actions.selectedNode).map((node) => (
          <span className={node.id === actions.selectedNode?.id ? "text-orange-600" : undefined} key={node.id}> › {nodeDetails(node).label}</span>
        ))}</> : "No page selected"}</span>
        <div className="flex items-center gap-0.5">
          <Button
            aria-label="Decrease canvas zoom"
            className="size-7 text-zinc-500 hover:bg-zinc-100"
            disabled={zoom <= 25}
            onClick={() => applyZoom(zoom - 10)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Minus className="size-3" />
          </Button>
          {editingZoom ? (
            <div className="relative h-7 w-12">
              <Input
                aria-label="Canvas zoom percentage"
                autoFocus
                className="h-7 w-12 rounded-md border-orange-300 px-1 pr-3 text-center text-[10px] shadow-none"
                inputMode="numeric"
                onBlur={commitZoomDraft}
                onChange={(event) => setZoomDraft(event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.blur();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setZoomDraft(String(zoom));
                    setEditingZoom(false);
                  }
                }}
                type="text"
                value={zoomDraft}
              />
              <span className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-[9px] text-zinc-400">%</span>
            </div>
          ) : (
            <Button
              aria-label={`Canvas zoom ${zoom} percent. Click to edit`}
              className="h-7 w-12 px-1 text-[10px] font-normal text-zinc-700 hover:bg-zinc-100"
              onClick={() => {
                setZoomDraft(String(zoom));
                setEditingZoom(true);
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              <span aria-live="polite">{zoom}%</span>
            </Button>
          )}
          <Button
            aria-label="Increase canvas zoom"
            className="size-7 text-zinc-500 hover:bg-zinc-100"
            disabled={zoom >= 150}
            onClick={() => applyZoom(zoom + 10)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Plus className="size-3" />
          </Button>
          <Separator className="mx-1 h-4" orientation="vertical" />
          <Button
            aria-label={isFullscreen ? "Exit canvas full screen" : "Enter canvas full screen"}
            aria-pressed={isFullscreen}
            className="size-7 text-zinc-500 hover:bg-zinc-100"
            onClick={() => setIsFullscreen((fullscreen) => !fullscreen)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </Button>
        </div>
      </footer>
      {(compact || variant === "c") && (
        <div className="fixed right-4 bottom-14 z-20 flex items-center gap-1 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
          <CompactLayers actions={actions} />
          <QuickInsert actions={actions} rail />
        </div>
      )}
    </main>
  );
}

function FormaVariant({
  actions,
  canRedo,
  canUndo,
  compact,
  onAddPage,
  onDeletePage,
  onRenamePage,
  onRedo,
  onSelectPage,
  onUndo,
  onViewportChange,
  page,
  pages,
  saveStatus,
  selectedPageId,
  variant,
  viewport,
}: {
  actions: EditorActions;
  canRedo: boolean;
  canUndo: boolean;
  compact: boolean;
  onAddPage: (preset: PagePreset) => void;
  onDeletePage: (page: BuilderPage) => void;
  onRenamePage: (page: BuilderPage) => void;
  onRedo: () => void;
  onSelectPage: (page: BuilderPage) => void;
  onViewportChange: (viewport: CanvasViewport) => void;
  onUndo: () => void;
  page: BuilderPage | null;
  pages: BuilderPage[];
  saveStatus: string;
  selectedPageId: string | null;
  variant: VariantKey;
  viewport: CanvasViewport;
}) {
  const showNavigator = !compact && variant !== "c";
  const showInspector = !compact && variant !== "b";
  return (
    <div className="builder-light-theme h-screen overflow-hidden bg-white text-zinc-900">
      <ProjectBar canRedo={canRedo} canUndo={canUndo} onRedo={onRedo} onUndo={onUndo} saveStatus={saveStatus} />
      <div className="h-[calc(100vh-4rem)] min-h-0 overflow-hidden">
        <ResizablePanelGroup className="h-full min-h-0" id={`workspace-${variant}`} orientation="horizontal">
          {showNavigator && <><ResizablePanel defaultSize="244px" id="navigator" maxSize="380px" minSize="200px"><Navigator actions={actions} onAddPage={onAddPage} onDeletePage={onDeletePage} onRenamePage={onRenamePage} onSelectPage={onSelectPage} pages={pages} selectedPageId={selectedPageId} /></ResizablePanel><ResizableHandle className="bg-zinc-200 hover:bg-orange-500" withHandle /></>}
          <ResizablePanel defaultSize={compact ? "100" : "60"} id="canvas" minSize={compact ? "280px" : "560px"}><Canvas actions={actions} compact={compact} onViewportChange={onViewportChange} page={page} variant={variant} viewport={viewport} /></ResizablePanel>
          {showInspector && <><ResizableHandle className="bg-zinc-200 hover:bg-orange-500" withHandle /><ResizablePanel defaultSize="288px" id="inspector" maxSize="420px" minSize="240px"><Inspector actions={actions} /></ResizablePanel></>}
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

function PrototypeSwitcher({ current, onChange }: { current: VariantKey; onChange: (variant: VariantKey) => void }) {
  const previous = adjacentVariant(current, -1);
  const next = adjacentVariant(current, 1);
  return <div className="fixed bottom-12 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-zinc-300 bg-white/95 px-2 py-1.5 shadow-xl backdrop-blur"><Button aria-label="Previous prototype variation" className="size-7" onClick={() => onChange(previous)} size="icon-sm" variant="ghost"><ArrowLeft className="size-3.5" /></Button><div className="min-w-44 text-center leading-tight"><p className="text-xs font-semibold">{current.toUpperCase()} · {variants[current].name}</p><p className="text-[10px] text-zinc-500">{variants[current].description}</p></div><Button aria-label="Next prototype variation" className="size-7" onClick={() => onChange(next)} size="icon-sm" variant="ghost"><ArrowRight className="size-3.5" /></Button></div>;
}

function ancestorNodes(page: PageDocument, node: EditorNode | null) {
  const nodes: EditorNode[] = [];
  for (let current = node; current; current = current.parentId === null ? null : page.nodes[current.parentId]) {
    nodes.push(current);
  }
  return nodes.reverse();
}

type DocumentHistory = { document: SiteDocument; past: SiteDocument[]; future: SiteDocument[] };

export function BuilderEditor({ showVariantSwitcher = false }: { showVariantSwitcher?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = searchParams.get("variant");
  const current: VariantKey = showVariantSwitcher && (requested === "b" || requested === "c") ? requested : "a";
  const [compact, setCompact] = useState(false);
  const [viewport, setViewport] = useState<CanvasViewport>(canvasViewportPresets.desktop);
  const insertDrag = useRef<QuickInsertDrag | null>(null);
  const [timeline, setTimeline] = useState<DocumentHistory>({ document: emptyDocument, past: [], future: [] });
  const { document, past, future } = timeline;
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  const [saveResult, setSaveResult] = useState<{ document: SiteDocument; error: boolean } | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [layerSelection, setLayerSelection] = useState<LayerSelection | null>(null);
  const [collapsedLayers, setCollapsedLayers] = useState<Record<string, string[]>>({});
  const [pageDialog, setPageDialog] = useState<PageDialogState>(null);
  const [layerDeleteDialog, setLayerDeleteDialog] = useState<LayerDeleteDialogState>(null);
  const [pageNameDraft, setPageNameDraft] = useState("");

  const page = document.pages.find((page) => page.id === activePageId) ?? document.pages[0] ?? null;
  const selectedPageId = page?.id ?? null;
  const selectedNode = page && layerSelection?.pageId === page.id && Object.hasOwn(page.nodes, layerSelection.id)
    ? page.nodes[layerSelection.id] : null;

  const changeVariant = useCallback((variant: VariantKey) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("variant", variant);
    router.replace(pathname + "?" + next.toString(), { scroll: false });
  }, [pathname, router, searchParams]);

  function commit(update: (document: SiteDocument) => SiteDocument) {
    setTimeline((current) => {
      const document = update(current.document);
      if (document === current.document) return current;
      return {
        document,
        past: [...current.past, current.document].slice(-50),
        future: [],
      };
    });
  }

  const undo = useCallback(() => {
    setTimeline((current) => {
      const previous = current.past.at(-1);
      return previous ? {
        document: previous,
        past: current.past.slice(0, -1),
        future: [current.document, ...current.future],
      } : current;
    });
  }, []);

  const redo = useCallback(() => {
    setTimeline((current) => {
      const next = current.future[0];
      return next ? {
        document: next,
        past: [...current.past, current.document],
        future: current.future.slice(1),
      } : current;
    });
  }, []);

  function choose(node: EditorNode, source?: "layers") {
    if (!page) return;
    setLayerSelection({ pageId: page.id, id: node.id, source });
    expandLayers(page.id, ancestorNodes(page, node).slice(0, -1).map((ancestor) => ancestor.id));
  }

  function expandLayers(pageId: string, ids: string[]) {
    const expanded = new Set(ids);
    setCollapsedLayers((current) => {
      const collapsed = current[pageId];
      if (!collapsed?.some((id) => expanded.has(id))) return current;
      return { ...current, [pageId]: collapsed.filter((id) => !expanded.has(id)) };
    });
  }

  function edit(operation: DocumentOperation) {
    commit((document) => applyDocumentOperation(document, operation));
  }

  function insertItem(item: QuickInsertItem, dropTarget?: InsertionTarget) {
    if (!page) return;
    const type = insertionType(item);
    const target = dropTarget ?? insertionAtSelection(page, type, selectedNode);
    if (!canInsertAt(page, type, target)) return;
    const { pageId, parentId, index } = target;
    const { node, descendants } = item.source === "preset"
      ? buildSection(item.preset, () => crypto.randomUUID())
      : { node: createBlock(crypto.randomUUID(), item.type), descendants: undefined };
    commit((document) => {
      const currentPage = document.pages.find((candidate) => candidate.id === pageId);
      return currentPage && canInsertAt(currentPage, type, target)
        ? applyDocumentOperation(document, { type: "node.insert", pageId, node, parentId, index, descendants })
        : document;
    });
    choose({ ...node, parentId });
  }

  function moveCanvasNode(sourceId: string, target: InsertionTarget) {
    moveNode(sourceId, (page) => proposeNodeMoveAt(page, sourceId, target), true);
  }

  function moveLayer(sourceId: string, targetId: string, placement: MovePlacement) {
    moveNode(sourceId, (page) => proposeNodeMove(page, sourceId, targetId, placement));
  }

  function moveNode(sourceId: string, propose: (page: PageDocument) => ReturnType<typeof proposeNodeMove>, fromCanvas = false) {
    if (!page) return;
    const { operation } = propose(page);
    if (!operation) return;
    commit((document) => {
      const currentPage = document.pages.find((candidate) => candidate.id === page.id);
      if (!currentPage) return document;
      const { operation } = propose(currentPage);
      return operation ? applyDocumentOperation(document, operation) : document;
    });
    const parent = operation.parentId === null ? null : page.nodes[operation.parentId];
    expandLayers(page.id, ancestorNodes(page, parent).map((ancestor) => ancestor.id));
    if (fromCanvas) setLayerSelection({ pageId: page.id, id: sourceId });
  }

  function confirmLayerDelete() {
    if (!page || layerDeleteDialog?.pageId !== page.id) {
      setLayerDeleteDialog(null);
      return;
    }
    const node = page.nodes[layerDeleteDialog.layerId];
    if (node) {
      const fallback = selectionAfterDelete(page, node);
      if (fallback === null) setLayerSelection(null);
      else choose(page.nodes[fallback], "layers");
      commit((document) => {
        const currentPage = document.pages.find((candidate) => candidate.id === page.id);
        if (!currentPage || !Object.hasOwn(currentPage.nodes, node.id)) return document;
        return applyDocumentOperation(document, { type: "node.delete", pageId: page.id, nodeId: node.id });
      });
    }
    setLayerDeleteDialog(null);
  }

  function toggleLayerCollapse(id: string) {
    if (!page) return;
    setCollapsedLayers((current) => {
      const ids = current[page.id] ?? [];
      return { ...current, [page.id]: ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id] };
    });
  }

  const pages: BuilderPage[] = document.pages.map((page) => {
    const preset = pagePresets.find((preset) => preset.id === page.metadata?.preset) ?? pagePresets[pagePresets.length - 1];
    return { id: page.id, name: page.name, icon: preset.icon, preset: preset.id };
  });

  function selectPage(page: BuilderPage) {
    setActivePageId(page.id);
    setLayerSelection(null);
  }

  function addPage(preset: PagePreset) {
    if (loadStatus === "loading") return;
    const name = uniquePageName(preset.name, pages);
    const page: PageDocument = {
      id: crypto.randomUUID(), name, title: name, slug: pageSlug(name),
      metadata: { preset: preset.id }, rootIds: [], nodes: {},
    };
    commit((document) => ({ ...document, pages: [...document.pages, page], updatedAt: new Date().toISOString() }));
    setActivePageId(page.id);
    setLayerSelection(null);
  }

  function confirmPageDialog() {
    if (!pageDialog) return;
    const { pageId, mode } = pageDialog;
    if (mode === "rename") {
      const name = pageNameDraft.trim();
      if (!name) return;
      commit((document) => ({
        ...document,
        pages: document.pages.map((page) => page.id === pageId ? { ...page, name, title: name, slug: pageSlug(name) } : page),
        updatedAt: new Date().toISOString(),
      }));
    } else {
      const remaining = document.pages.filter((page) => page.id !== pageId);
      commit((document) => ({ ...document, pages: document.pages.filter((page) => page.id !== pageId), updatedAt: new Date().toISOString() }));
      if (selectedPageId === pageId) {
        const index = document.pages.findIndex((page) => page.id === pageId);
        setActivePageId(remaining[Math.min(index, remaining.length - 1)]?.id ?? null);
        setLayerSelection(null);
      }
    }
    setPageDialog(null);
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = window.localStorage.getItem(editorStorageKey);
        if (stored !== null) {
          const saved = loadEditorSave(JSON.parse(stored));
          setTimeline({ document: saved.document, past: [], future: [] });
          setActivePageId(saved.selectedPageId);
        }
        setLoadStatus("ready");
      } catch {
        setLoadStatus("error");
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (loadStatus !== "ready") return;
    let error = false;
    try {
      window.localStorage.setItem(editorStorageKey, JSON.stringify({ document, selectedPageId }));
    } catch {
      error = true;
    }
    let active = true;
    queueMicrotask(() => { if (active) setSaveResult({ document, error }); });
    return () => { active = false; };
  }, [document, loadStatus, selectedPageId]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 899px)");
    const sync = () => setCompact(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
      }
      if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleHistoryShortcut);
    return () => window.removeEventListener("keydown", handleHistoryShortcut);
  }, [redo, undo]);

  useEffect(() => {
    if (!showVariantSwitcher) return;
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true'], [role='separator']")) return;
      if (event.key === "ArrowLeft") changeVariant(adjacentVariant(current, -1));
      if (event.key === "ArrowRight") changeVariant(adjacentVariant(current, 1));
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [changeVariant, current, showVariantSwitcher]);

  const actions: EditorActions = {
    page, hasPage: page !== null, selectedNode, choose, insertItem, insertDrag, moveCanvasNode, moveLayer, toggleLayerCollapse,
    selection: selectedNode ? layerSelection : null,
    expandLayer: (id) => { if (page) expandLayers(page.id, [id]); },
    isLayerCollapsed: (id) => page !== null && (collapsedLayers[page.id] ?? []).includes(id),
    requestLayerDelete: (node) => {
      if (page) setLayerDeleteDialog({
        layerId: node.id, label: nodeDetails(node).label, hasChildren: node.childIds.length > 0, pageId: page.id,
      });
    },
    toggleLayerVisibility: (node) => {
      if (page) edit({ type: "node.setVisibility", pageId: page.id, nodeId: node.id, visible: !node.visible });
    },
    updateBlockContent: (nodeId, content) => {
      if (!page) return;
      commit((document) => {
        const currentPage = document.pages.find((candidate) => candidate.id === page.id);
        if (!currentPage || !Object.hasOwn(currentPage.nodes, nodeId)) return document;
        return applyDocumentOperation(document, { type: "node.updateContent", pageId: page.id, nodeId, content });
      });
    },
  };
  const saveStatus = loadStatus === "error" ? "Saved pages could not be loaded. Autosave is paused."
    : loadStatus === "loading" ? "Loading saved pages…"
    : saveResult?.document !== document ? "Saving…"
    : saveResult.error ? "Could not save changes to browser storage."
    : "All changes saved";
  const dialogPage = pages.find((page) => page.id === pageDialog?.pageId) ?? null;
  return (
    <>
      <FormaVariant
        actions={actions}
        canRedo={future.length > 0}
        canUndo={past.length > 0}
        compact={compact}
        onAddPage={addPage}
        onDeletePage={(page) => setPageDialog({ mode: "delete", pageId: page.id })}
        onRedo={redo}
        onRenamePage={(page) => { setPageNameDraft(page.name); setPageDialog({ mode: "rename", pageId: page.id }); }}
        onSelectPage={selectPage}
        onUndo={undo}
        onViewportChange={setViewport}
        page={pages.find((page) => page.id === selectedPageId) ?? null}
        pages={pages}
        saveStatus={saveStatus}
        selectedPageId={selectedPageId}
        variant={current}
        viewport={viewport}
      />
      <PageManagementDialog dialog={pageDialog} draftName={pageNameDraft} onClose={() => setPageDialog(null)} onConfirm={confirmPageDialog} onDraftNameChange={setPageNameDraft} page={dialogPage} />
      <LayerDeleteDialog dialog={layerDeleteDialog} onClose={() => setLayerDeleteDialog(null)} onConfirm={confirmLayerDelete} />
      {showVariantSwitcher && <PrototypeSwitcher current={current} onChange={changeVariant} />}
    </>
  );
}
