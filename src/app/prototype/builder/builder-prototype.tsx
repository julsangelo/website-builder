"use client";

import {
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
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
import { Button, buttonVariants } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog } from "@base-ui/react/dialog";
import { AppearanceInspector, ownsSurface, splitAppearanceStyles } from "./appearance-inspector";
import { LayoutInspector } from "./layout-inspector";
import { ButtonLinkControl, PreviewText } from "./preview-content";
import { PreviewImage, type ImageEdit } from "./preview-image";
import { ownsText, splitTypographyStyles, TypographyInspector } from "./typography-inspector";
import {
  applyDocumentOperation,
  canInsertAt,
  headingLevels,
  insertionAtSelection,
  isContainer,
  proposeNodeMove,
  resolveHeadingLevel,
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

type LayerDeleteDialogState = { hasChildren: boolean; label: string; layerId: string; pageId: string; trigger: HTMLButtonElement } | null;

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
  requestLayerDelete: (node: EditorNode, trigger: HTMLButtonElement) => void;
  toggleLayerCollapse: (layerId: string) => void;
  toggleLayerVisibility: (node: EditorNode) => void;
  updateBlockContent: (blockId: string, content: NodeContent) => void;
  updateImage: (nodeId: string, breakpoint: Breakpoint, edit: ImageEdit) => void;
  edit: (operation: DocumentOperation) => void;
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
    <header className="flex h-16 items-center gap-2 border-b border-zinc-200 bg-white px-3 text-zinc-900 sm:gap-4 sm:px-5">
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
      <div className="flex shrink-0 items-center gap-1">
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

function QuickInsert({ actions, draggable = true, scrolled = false }: { actions: EditorActions; draggable?: boolean; scrolled?: boolean }) {
  const [library, setLibrary] = useState<"blocks" | "sections">("blocks");
  const [query, setQuery] = useState("");
  const search = query.trim().toLowerCase();
  const blocks = quickBlocks.filter(({ label }) => label.toLowerCase().includes(search));
  const sections = sectionPresets.filter(({ label, description }) => `${label} ${description}`.toLowerCase().includes(search));
  function beginDrag(event: DragEvent, item: QuickInsertItem) {
    if (actions.page) startQuickInsertDrag(event, actions.insertDrag, { item, pageId: actions.page.id });
  }

  const items = (
    <div className="p-4">
      <div className="relative mb-3">
        <Search className="absolute top-1/2 left-2.5 size-3 -translate-y-1/2 text-zinc-400" />
        <Input
          aria-label="Search Quick insert"
          className="h-7 border-0 bg-zinc-50 pl-7 text-[11px] shadow-none"
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={library === "blocks" ? "Search blocks..." : "Search sections..."}
          type="search"
          value={query}
        />
      </div>
      <div className="mb-3 grid grid-cols-2 rounded-md bg-zinc-100 p-0.5">
        <Button aria-pressed={library === "blocks"} className="h-7 text-[11px] aria-pressed:bg-white aria-pressed:text-zinc-950 aria-pressed:shadow-sm" onClick={() => setLibrary("blocks")} size="sm" type="button" variant="ghost">Blocks</Button>
        <Button aria-pressed={library === "sections"} className="h-7 text-[11px] aria-pressed:bg-white aria-pressed:text-zinc-950 aria-pressed:shadow-sm" onClick={() => setLibrary("sections")} size="sm" type="button" variant="ghost">Sections</Button>
      </div>
      {library === "blocks" ? (
        <div className="grid grid-cols-2 gap-2">
          {blocks.map((block) => {
            const Icon = block.icon;
            const item: QuickInsertItem = { source: "block", type: block.id };
            return (
              <Button
                className={`h-auto border-zinc-200 bg-white p-0 font-normal text-zinc-900 shadow-none transition hover:border-orange-300 hover:bg-orange-50 disabled:cursor-not-allowed ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
                disabled={!actions.hasPage}
                draggable={draggable && actions.hasPage}
                key={block.id}
                onClick={() => actions.insertItem(item)}
                onDragStart={(event) => beginDrag(event, item)}
                variant="outline"
              >
                <span className="grid place-items-center gap-1.5 py-3">
                  <Icon className="size-4 text-zinc-500" />
                  <span className="text-[11px]">{block.label}</span>
                </span>
              </Button>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-1.5">
          {sections.map((section) => {
            const Icon = sectionPresetIcons[section.id] ?? LayoutTemplate;
            const item: QuickInsertItem = { source: "preset", preset: section };
            return (
              <Button
                className={`h-auto justify-start border-zinc-200 bg-white px-2.5 py-2 text-left font-normal text-zinc-900 shadow-none hover:border-orange-300 hover:bg-orange-50 disabled:cursor-not-allowed ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
                disabled={!actions.hasPage}
                draggable={draggable && actions.hasPage}
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
      {(library === "blocks" ? blocks : sections).length === 0 && (
        <p className="mt-3 text-xs text-zinc-500" role="status">No matching {library}.</p>
      )}
      {(!actions.hasPage || draggable) && (
        <p className="mt-3 flex items-center gap-1.5 text-[10px] text-zinc-500">
          {actions.hasPage ? <><GripVertical className="size-3" /> Drag {library === "blocks" ? "a block" : "a section"} onto your page</> : "Add a page before inserting blocks or sections."}
        </p>
      )}
    </div>
  );

  return (
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

function QuickInsertPanel({ actions, draggable = true }: { actions: EditorActions; draggable?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  return (
    <ScrollArea className="h-full" viewportProps={{
      onScroll: (event) => setScrolled(event.currentTarget.scrollTop > 0),
      style: { scrollPaddingTop: "2.5rem" },
    }}>
      <QuickInsert actions={actions} draggable={draggable} scrolled={scrolled} />
    </ScrollArea>
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
  const cancelRef = useRef<HTMLButtonElement>(null);
  if (!dialog) return null;

  return (
    <Dialog.Root onOpenChange={(open) => !open && onClose()} open>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[80] bg-zinc-950/25 backdrop-blur-[1px]" />
        <Dialog.Viewport className="fixed inset-0 z-[81] grid place-items-center p-4">
          <Dialog.Popup initialFocus={cancelRef} className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl outline-none">
            <Dialog.Title className="text-base font-semibold text-zinc-950">Delete layer?</Dialog.Title>
            <Dialog.Description className="mt-1.5 text-sm leading-5 text-zinc-500">
              Delete {dialog.label}{dialog.hasChildren ? " and all its descendants" : ""}? You can undo this change.
            </Dialog.Description>
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={onClose} ref={cancelRef} type="button" variant="outline">Cancel</Button>
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
  indent,
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
  parentPath,
  selection,
  drop,
  visible,
}: {
  collapsed?: boolean;
  collapsible?: boolean;
  indent: number;
  inheritedHidden?: boolean;
  icon: LucideIcon;
  label: string;
  nodeId: string;
  onDelete: (trigger: HTMLButtonElement) => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onMove: () => void;
  onSelect: () => void;
  onToggleCollapse?: () => void;
  onToggleVisibility: () => void;
  parentPath: string;
  selection: LayerSelection | null;
  drop: ReturnType<typeof useLayerDrag>["drop"];
  visible: boolean;
}) {
  const active = selection !== null;
  const visuallyHidden = inheritedHidden || !visible;
  const toggleAction = collapsed ? "Expand" : "Collapse";
  const visibilityAction = visible ? "Hide" : "Show";
  const nameTooltipId = useId();
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selection) rowRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selection]);

  return (
    <div
      className={
        "group relative flex h-8 w-full min-w-0 items-center rounded-md pr-1 transition " +
        (active ? "bg-orange-100 text-orange-600 hover:text-zinc-950 " : "text-zinc-700 hover:bg-zinc-100 ") +
        (drop?.reason ? "ring-2 ring-inset ring-red-500" : drop?.placement === "inside" ? "bg-orange-50 ring-2 ring-inset ring-orange-500" : "")
      }
      draggable
      data-layer-node-id={nodeId}
      onDragStart={onDragStart}
      ref={rowRef}
      style={{ paddingInlineStart: indent }}
    >
      {collapsible ? (
        <Tooltip>
          <TooltipTrigger
            aria-expanded={!collapsed}
            aria-label={`${toggleAction} ${label}`}
            className={"bg-transparent " + (active ? "text-orange-600 group-hover:text-zinc-950 hover:bg-orange-200 hover:text-zinc-950" : "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-950")}
            onClick={(event) => {
              event.stopPropagation();
              onToggleCollapse?.();
            }}
            render={<Button size="icon-xs" variant="ghost" />}
            type="button"
          >
            <ChevronDown className={"size-3 transition-transform " + (collapsed ? "-rotate-90" : "")} />
          </TooltipTrigger>
          <TooltipContent>{toggleAction}</TooltipContent>
        </Tooltip>
      ) : <span aria-hidden className="w-6 shrink-0" />}
      <Tooltip>
        <TooltipTrigger
          aria-current={active ? "true" : undefined}
          aria-describedby={nameTooltipId}
          aria-description={inheritedHidden ? "Hidden by a parent layer" : undefined}
          data-layer-select=""
          className={
            "h-full min-w-0 flex-1 justify-start gap-1.5 rounded-md px-1 text-left text-xs font-normal hover:bg-transparent " +
            (active ? "font-medium text-orange-600 group-hover:text-zinc-950 hover:text-zinc-950" : "text-zinc-700 hover:text-zinc-700")
          }
          onClick={onSelect}
          render={<Button variant="ghost" />}
          type="button"
        >
          <Icon className="size-3.5 shrink-0" />
          <span className={visuallyHidden ? "min-w-0 truncate text-zinc-400 line-through" : "min-w-0 truncate"}>{label}</span>
        </TooltipTrigger>
        <TooltipContent align="start" className="grid gap-1 wrap-anywhere" id={nameTooltipId}>
          <span className="font-medium">{label}</span>
          <span className="opacity-80">{parentPath}</span>
          {inheritedHidden && <span className="sr-only">Hidden by a parent layer</span>}
        </TooltipContent>
      </Tooltip>
      <div className="flex shrink-0 items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger
            aria-label={`Move ${label}`}
            className="bg-transparent text-zinc-500 hover:bg-zinc-200 hover:text-zinc-950"
            data-layer-move=""
            onClick={onMove}
            render={<Button size="icon-xs" variant="ghost" />}
            type="button"
          >
            <Move className="size-3" />
          </TooltipTrigger>
          <TooltipContent>Move</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            aria-label={`${visibilityAction} ${label}`}
            className={"bg-transparent " + (active ? "text-orange-600 group-hover:text-zinc-950 hover:bg-orange-200 hover:text-zinc-950" : "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-950")}
            onClick={(event) => {
              event.stopPropagation();
              onToggleVisibility();
            }}
            render={<Button size="icon-xs" variant="ghost" />}
            type="button"
          >
            {visible ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
          </TooltipTrigger>
          <TooltipContent>{visibilityAction}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            aria-label={`Delete ${label}`}
            className={"bg-transparent hover:text-red-600 group-focus-within:opacity-100 group-hover:opacity-100 " + (active ? "text-orange-600 hover:bg-orange-200" : "text-zinc-400 opacity-0 hover:bg-red-50")}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(event.currentTarget);
            }}
            render={<Button size="icon-xs" variant="ghost" />}
            type="button"
          >
            <Trash2 className="size-3" />
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function Layers({ actions, depth = 0, drag, ids, inheritedHidden = false, onMove, parentPath }: {
  actions: EditorActions;
  depth?: number;
  drag: ReturnType<typeof useLayerDrag>;
  ids: string[];
  inheritedHidden?: boolean;
  onMove: (nodeId: string) => void;
  parentPath: string;
}) {
  if (!actions.page) return null;
  const { nodes } = actions.page;
  const indent = 4 + Math.min(depth, 5) * 6;
  return (
    <ul className={depth ? "mt-0.5 space-y-0.5" : "space-y-0.5"} role="list">
      {ids.map((id) => {
        const node = nodes[id];
        const { label, icon } = nodeDetails(node);
        const ancestry = `${parentPath} › ${label}`;
        const collapsed = actions.isLayerCollapsed(id);
        const drop = drag.drop?.targetId === id ? drag.drop : null;
        return (
          <li aria-level={depth + 1} className="relative" key={id} role="listitem">
            {drop && !drop.reason && drop.placement !== "inside" && (
              <div aria-hidden className={`pointer-events-none absolute end-1 z-[1] h-0.5 rounded-full bg-orange-500 ${drop.placement === "before" ? "-top-px" : "-bottom-px"}`} style={{ insetInlineStart: indent }} />
            )}
            <LayerTreeItem
              collapsed={collapsed}
              collapsible={node.childIds.length > 0}
              drop={drop}
              icon={icon}
              indent={indent}
              inheritedHidden={inheritedHidden}
              label={label}
              nodeId={id}
              onDelete={(trigger) => actions.requestLayerDelete(node, trigger)}
              onDragStart={(event) => drag.startDrag(event, id)}
              onMove={() => onMove(id)}
              onSelect={() => actions.choose(node, "layers")}
              onToggleCollapse={() => actions.toggleLayerCollapse(id)}
              onToggleVisibility={() => actions.toggleLayerVisibility(node)}
              parentPath={parentPath}
              selection={actions.selection?.id === id ? actions.selection : null}
              visible={node.visible}
            />
            {!collapsed && node.childIds.length > 0 && (
              <Layers actions={actions} depth={depth + 1} drag={drag} ids={node.childIds} inheritedHidden={inheritedHidden || !node.visible} onMove={onMove} parentPath={ancestry} />
            )}
          </li>
        );
      })}
    </ul>
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
      viewportClassName="overflow-x-hidden [&>[data-slot=scroll-area-content]]:min-w-0!"
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
          <h2 data-layers-heading tabIndex={-1}>Layers</h2>
          <span role="status" className="ml-auto min-w-0 truncate text-right text-[10px] font-normal text-red-700" title={drag.drop?.reason ?? undefined}>
            {drag.drop?.reason}
          </span>
          <ListFilter className="size-3 shrink-0 text-zinc-500" />
        </div>
        <div className="space-y-0.5 p-3 pt-2">
          {page?.rootIds.length ? (
            <TooltipProvider delay={400}>
              <Layers actions={actions} drag={drag} ids={page.rootIds} onMove={(nodeId) => setMoveDialog({ nodeId, open: true })} parentPath={page.name} />
            </TooltipProvider>
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

function CompactPanel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger render={<Button aria-label={`Open ${title}`} size="icon-sm" variant="ghost" />}>
        <Icon className="size-4" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[70] bg-zinc-950/25" />
        <Dialog.Viewport className="fixed inset-0 z-[71] grid place-items-center p-4">
          <Dialog.Popup className="flex h-[min(70dvh,30rem)] w-full max-w-sm flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl outline-none">
            <Dialog.Title className="sr-only">{title}</Dialog.Title>
            <div className="min-h-0 flex-1">{children}</div>
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
          <QuickInsertPanel actions={actions} />
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
  pageMenu,
  onViewportChange,
  page,
  viewport,
}: {
  pageMenu?: ReactNode;
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
    <div className="relative flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 text-xs">
      {pageMenu ?? <div className="flex min-w-0 items-center gap-1.5 text-zinc-600"><PageIcon className="size-3.5 shrink-0" /> <span className="truncate">{page?.name ?? "No page selected"}</span> <ChevronDown className="size-3 shrink-0" /></div>}
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
      <div className="hidden items-center gap-3 text-zinc-500 sm:flex"><Code2 className="size-3.5" /><MoreHorizontal className="size-4" /></div>
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
  actions, children, className, emptyContainer, hasButton, move, node, style,
}: {
  actions: EditorActions;
  children: ReactNode;
  className: string;
  emptyContainer: boolean;
  hasButton: boolean;
  move: PreviewMove;
  node: EditorNode;
  style: CSSProperties;
}) {
  const selected = actions.selectedNode?.id === node.id;
  const { label } = nodeDetails(node);
  const selectionStyle = style.boxShadow === undefined
    ? selected ? "ring-2 ring-orange-400 ring-offset-2" : "hover:ring-1 hover:ring-orange-300"
    : selected ? "outline-2 outline-offset-2 outline-orange-400" : "hover:outline-1 hover:outline-orange-300";

  return (
    <div
      aria-label={label}
      aria-pressed={selected}
      className={
        "relative cursor-pointer transition focus-visible:ring-2 focus-visible:ring-orange-500 " +
        (emptyContainer ? "min-h-8 outline-1 -outline-offset-1 outline-dashed outline-zinc-300 " : "") +
        selectionStyle + " " + className
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
      {selected && hasButton && (
        <ButtonLinkControl content={node.content} onCommit={(content) => actions.updateBlockContent(node.id, content)} />
      )}
      {selected && (
        <button
          aria-haspopup="dialog"
          aria-label={`Move ${label}`}
          className={`absolute z-10 flex size-7 cursor-grab items-center justify-center bg-orange-500 text-white shadow-sm select-none active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 ${hasButton ? "bottom-full left-7 rounded-tr-md" : "top-0 right-0 rounded-bl-md"}`}
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
  navigation: "border-b border-zinc-200",
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
  "preset-card": "min-w-0 content-start rounded-xl border border-zinc-200 bg-white p-5 text-zinc-900",
  "preset-footer-navigation": "px-4 py-3",
  "preset-form": "rounded-lg border border-zinc-200 bg-white p-6",
  "preset-links": "px-4 py-3",
  "preset-questions": "divide-y divide-zinc-200 rounded-lg border border-zinc-200 px-4",
  "preset-quote": "mx-auto max-w-3xl rounded-lg bg-white p-8 text-zinc-900",
  "preset-stat": "rounded-lg bg-white p-7 text-center text-zinc-900 [&_:is(h1,h2,h3,h4,h5,h6)]:text-5xl",
};

function PreviewNode({ actions, node, breakpoint, move }: { actions: EditorActions; node: EditorNode; breakpoint: Breakpoint; move: PreviewMove }) {
  const page = actions.page;
  if (!node.visible || !page) return null;
  const { content, metadata } = node;
  const appearance = typeof metadata?.appearance === "string" ? metadata.appearance : "";
  const children = node.childIds.map((id) => (
    <PreviewNode actions={actions} breakpoint={breakpoint} key={id} move={move} node={page.nodes[id]} />
  ));
  const { frameStyle, surfaceStyle, objectFit, objectPosition } = splitAppearanceStyles(resolveStyles(node, breakpoint));
  const { frameStyle: layoutStyle, textStyle } = splitTypographyStyles(frameStyle);
  const surfaceOnContent = ["card", "quote", "stat", "form", "navigation", "footer", "accordion", "input", "divider"].includes(node.type)
    || (node.type === "button" && appearance !== "hero-cta-button");
  const previewStyle = {
    ...(ownsText(node) ? layoutStyle : frameStyle),
    ...(!surfaceOnContent && surfaceStyle),
  };
  const hasButton = node.type === "button" || node.type === "card" || node.type === "form" || node.type === "navigation";
  const updateContent = (content: NodeContent) => actions.updateBlockContent(node.id, content);
  const text = (
    field: "title" | "body" | "buttonLabel",
    as: "heading" | "p" | "span",
    className?: string,
  ) => (
    <PreviewText
      as={as === "heading" ? resolveHeadingLevel(node) : as}
      className={className}
      field={field}
      label={field === "buttonLabel" ? "Button label" : nodeDetails(node).label}
      multiline={field !== "buttonLabel"}
      onCommit={updateContent}
      selected={actions.selectedNode?.id === node.id}
      style={node.type === "button" && surfaceOnContent ? { ...surfaceStyle, ...textStyle } : textStyle}
      value={content[field]}
    />
  );
  const frame = (className: string, body?: ReactNode, nested: ReactNode = children) => (
    <PreviewSelectable actions={actions} className={className} emptyContainer={isContainer(node.type) && !node.childIds.some((id) => page.nodes[id].visible)} hasButton={hasButton} move={move} node={node} style={previewStyle}>
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
  if (node.type === "image") {
    const standalone = !["hero-image", "content-media-media", "preset-image"].includes(appearance);
    const dimensions = appearance === "preset-image" ? "min-h-40 rounded-lg" : standalone ? "h-64 rounded-xl" : "min-h-80";
    const gradient = {
      "hero-image": "bg-linear-to-br from-[#8f765d] via-[#c7b08d] to-[#e6d9c5]",
      "content-media-media": "bg-linear-to-bl from-[#d7c7af] via-[#887764] to-[#3f433d]",
      "preset-image": "bg-linear-to-br from-[#d5c4ac] via-[#8e7159] to-[#455143]",
    }[appearance] ?? "bg-linear-to-br from-[#d9d1c3] via-[#a8947c] to-[#4f584b]";
    const usePlaceholder = surfaceStyle.backgroundColor === undefined && surfaceStyle.backgroundImage === undefined;
    return frame(`flex flex-col ${dimensions}`, (
      <PreviewImage
        content={content}
        placeholderClassName={usePlaceholder ? gradient : ""}
        objectFit={objectFit}
        objectPosition={objectPosition}
        onCommit={(edit) => actions.updateImage(node.id, breakpoint, edit)}
        onSelect={() => actions.choose(node)}
        selected={actions.selectedNode?.id === node.id}
        standalone={standalone && usePlaceholder}
      />
    ));
  }
  switch (appearance) {
    case "preset-grid":
      return frame("min-h-16 min-w-0 p-4");
    case "split-content":
      return frame("min-h-80 min-w-0 " + (breakpoint === "base" ? "p-14" : "p-9"));
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
      return frame("", text("title", "heading", "font-semibold tracking-tight"));
    case "preset-text":
      return frame("", text("body", "p", "text-sm"));
    case "preset-button":
      return frame("w-fit max-w-full", text("buttonLabel", "span", buttonVariants({ size: "sm", variant: "outline", className: "inline-block h-auto min-h-7 w-full content-center text-center" })));
    case "hero-eyebrow":
    case "content-media-eyebrow":
      return frame("w-fit rounded-md", text("body", "span", "block text-xs font-medium tracking-[0.18em] text-zinc-500 uppercase"));
    case "hero-heading":
      return frame("max-w-xl rounded-md", text("title", "heading", "font-semibold tracking-[-0.06em] text-zinc-900 " + (breakpoint === "base" ? "text-6xl" : "text-5xl")));
    case "content-media-heading":
      return frame("rounded-md", text("title", "heading", "text-4xl font-semibold tracking-[-0.04em]"));
    case "hero-description":
    case "content-media-description":
      return frame("max-w-md rounded-md opacity-80", text("body", "p", "text-sm leading-6"));
    case "hero-cta-button":
      return frame("inline-flex w-fit max-w-full rounded-md bg-zinc-900", text("buttonLabel", "span", "min-w-0 flex-1 px-4 py-3 text-sm font-medium text-white"));
    case "section":
      return frame("rounded-xl bg-[#f5f2ec] px-8 py-12 text-center", <>{text("title", "p", "text-2xl font-semibold tracking-tight text-zinc-900")}{text("body", "p", "mx-auto mt-3 max-w-lg text-sm leading-6 text-zinc-600")}</>);
  }

  switch (node.type) {
    case "section":
      return frame("rounded-xl bg-[#f5f2ec] px-8 py-12 text-center", <>{text("title", "p", "text-2xl font-semibold tracking-tight text-zinc-900")}{text("body", "p", "mx-auto mt-3 max-w-lg text-sm leading-6 text-zinc-600")}</>);
    case "box":
      return frame("bg-white p-8", <Card className="border border-dashed border-zinc-300 bg-zinc-50 shadow-none"><CardContent className="p-8 text-center text-sm text-zinc-500">{text("body", "p")}</CardContent></Card>);
    case "stack":
      return frame("bg-white p-8", <Card className="border border-zinc-200 shadow-none"><CardHeader><CardTitle>{text("title", "span", "block")}</CardTitle><CardDescription>{text("body", "span", "block")}</CardDescription></CardHeader><CardContent><div className="h-2 w-3/4 rounded-full bg-zinc-200" /></CardContent></Card>);
    case "grid":
      return frame("min-w-0 bg-white p-6");
    case "heading":
      return frame("rounded-xl bg-white", text("title", "heading", "px-8 py-10 text-4xl font-semibold tracking-[-0.04em] text-zinc-900 max-w-[52rem]"));
    case "text":
      return frame("rounded-xl bg-white", text("body", "p", "px-8 py-6 text-base leading-7 text-zinc-600 max-w-[46rem]"));
    case "button":
      return frame("inline-flex max-w-full", text("buttonLabel", "span", buttonVariants({ className: "inline-block h-auto min-h-8 w-full content-center bg-zinc-900 px-5 text-center text-sm text-white hover:bg-zinc-800" })));
    case "divider":
      return frame("py-5", <Separator style={surfaceStyle} />);
    case "card":
      return frame("bg-zinc-50 p-6", <Card className={`border border-zinc-200 bg-white shadow-none ${surfaceStyle.borderWidth !== undefined || surfaceStyle.borderStyle !== undefined ? "ring-0" : ""}`} style={surfaceStyle}><CardHeader><CardTitle>{text("title", "span", "block")}</CardTitle><CardDescription>{text("body", "span", "block")}</CardDescription></CardHeader><CardFooter>{text("buttonLabel", "span", buttonVariants({ size: "sm", variant: "outline" }))}</CardFooter></Card>);
    case "quote":
      return frame("bg-zinc-50 p-8", <Card className="border border-zinc-200 bg-white shadow-none" style={surfaceStyle}><CardContent className="p-8">{text("body", "p", "text-2xl leading-tight tracking-[-0.03em] text-zinc-900")}{text("title", "p", "mt-5 text-sm text-zinc-500")}</CardContent></Card>);
    case "stat":
      return frame("bg-zinc-50 p-6", <Card className="border border-zinc-200 bg-white text-center shadow-none" style={surfaceStyle}><CardContent className="p-7">{text("title", "p", "text-5xl font-semibold tracking-[-0.05em] text-zinc-900")}{text("body", "p", "mt-2 text-sm text-zinc-500")}</CardContent></Card>);
    case "accordion":
      return frame("bg-white p-6", <Accordion className="rounded-lg border border-zinc-200 px-4" defaultValue={["first"]} style={surfaceStyle}><AccordionItem value="first"><AccordionTrigger><span className="flex-1" style={textStyle}>{content.title}</span></AccordionTrigger><AccordionContent>{text("body", "p")}</AccordionContent></AccordionItem><AccordionItem value="second"><AccordionTrigger>How long does it take?</AccordionTrigger><AccordionContent>Timelines are shaped around your team, scope, and launch goals.</AccordionContent></AccordionItem></Accordion>);
    case "form":
      return frame("bg-zinc-50 p-6", <Card className="border border-zinc-200 bg-white shadow-none" style={surfaceStyle}><CardHeader><CardTitle>{text("title", "span", "block")}</CardTitle><CardDescription>{text("body", "span", "block")}</CardDescription></CardHeader><CardContent className="grid gap-3"><Input placeholder="Your name" /><Input placeholder="you@example.com" /><Input placeholder="How can we help?" /></CardContent><CardFooter>{text("buttonLabel", "span", buttonVariants())}</CardFooter></Card>);
    case "navigation":
      return frame("bg-white p-4", <Card className="border border-zinc-200 bg-white shadow-none" style={surfaceStyle}><CardContent className="flex items-center justify-between p-4">{text("title", "span", "font-semibold text-zinc-900")}<span className="flex gap-4 text-sm text-zinc-600"><span>Studio</span><span>Work</span><span>Journal</span></span>{text("buttonLabel", "span", buttonVariants({ size: "sm" }))}</CardContent></Card>);
    case "footer":
      return frame("bg-zinc-950 p-6", <Card className="border-zinc-800 bg-zinc-950 text-zinc-200 shadow-none" style={surfaceStyle}><CardContent className="flex items-center justify-between p-4">{text("title", "span", "font-semibold text-white")}{text("body", "span", "text-xs text-zinc-500")}</CardContent></Card>);
    case "input":
      return frame("rounded-md", <Input aria-label={content.body} placeholder={content.body} style={surfaceStyle} />);
  }
}

function breakpointForWidth(width: number): Breakpoint {
  if (width < 510) return "mobile";
  return width <= 768 ? "tablet" : "base";
}

function Artboard({ actions, artboardRef, isResizing, viewport }: { actions: EditorActions; artboardRef: React.RefObject<HTMLElement | null>; isResizing: boolean; viewport: CanvasViewport }) {
  const compactPreview = viewport.width < 768;
  const narrowPreview = viewport.width < 510;
  const browserHeaderHeight = compactPreview ? 48 : 64;
  const page = actions.page;
  const { indicator, handlers, startMove } = useCanvasDrop(page, actions.insertDrag, actions.insertItem, actions.moveCanvasNode);
  const [moveDialog, setMoveDialog] = useState<{ nodeId: string; open: boolean } | null>(null);
  const move = { start: startMove, openDialog: (nodeId: string) => setMoveDialog({ nodeId, open: true }) };
  const breakpoint = breakpointForWidth(viewport.width);
  const hasVisibleContent = page?.rootIds.some((id) => {
    const node = page.nodes[id];
    return node.visible && resolveStyles(node, breakpoint).display !== "none";
  });

  return (
    <article
      className={"relative min-h-[640px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_12px_30px_rgba(24,24,27,0.08)] transition-[width] ease-out motion-reduce:transition-none " + (isResizing ? "duration-0" : "duration-300")}
      ref={artboardRef}
      style={{ minHeight: defaultCanvasHeight, width: viewport.width }}
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
        style={{ minHeight: defaultCanvasHeight - browserHeaderHeight - 2 }}
        {...handlers}
      >
        {hasVisibleContent ? (
          <div className="isolate w-full text-left" key={page?.id}>
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
  return <section className="space-y-3 border-b border-zinc-200 p-4"><h2 className="text-xs font-semibold">{title}</h2>{children}</section>;
}

function Inspector({ actions, breakpoint, compact = false }: { actions: EditorActions; breakpoint: Breakpoint; compact?: boolean }) {
  const { page, selectedNode: node } = actions;
  const [tab, setTab] = useState("style");
  const hasSettings = node?.type === "heading" || node?.type === "input";
  const showLayout = !!node && node.type !== "text";
  const showTypography = !!node && node.type !== "section" && ownsText(node);
  const showAppearance = !!node && ownsSurface(node);
  return (
    <aside className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-white">
      <Tabs className="min-h-0 flex-1 !gap-0" onValueChange={(value) => setTab(String(value))} value={hasSettings ? tab : "style"}>
        <div className="flex h-12 shrink-0 items-center border-b border-zinc-200 px-4 text-xs"><TabsList className="!grid !h-full !w-40 grid-cols-2 !gap-0 !p-0" variant="line"><TabsTrigger className="!flex !h-full !w-full !items-center !justify-center px-0 pb-0.5 text-xs data-active:text-zinc-950 after:!bottom-[-1.5px] after:z-10 after:h-0.5 after:bg-orange-600" value="style">Style</TabsTrigger><TabsTrigger className="!flex !h-full !w-full !items-center !justify-center px-0 pb-0.5 text-xs after:!bottom-[-1.5px] after:z-10 after:h-0.5 after:bg-orange-600 disabled:opacity-40" disabled={!hasSettings} value="settings">Settings</TabsTrigger></TabsList></div>
        <TabsContent className="min-h-0" value="style">
          <ResizablePanelGroup className="min-h-0 flex-1" id="inspector-sections" orientation="vertical">
            {page && node && showLayout && (
              <>
                <ResizablePanel defaultSize="38" id="layout" minSize={compact ? "56px" : "210px"}>
                  <LayoutInspector
                    breakpoint={breakpoint}
                    key={`${page.id}:${node.id}:${breakpoint}`}
                    node={node}
                    onChange={(styles) => actions.edit({ type: "node.updateStyle", pageId: page.id, nodeId: node.id, breakpoint, styles })}
                    onReset={(property) => actions.edit({ type: "node.resetStyle", pageId: page.id, nodeId: node.id, breakpoint, property })}
                  />
                </ResizablePanel>
                {(showTypography || showAppearance) && <ResizableHandle className="bg-zinc-200 hover:bg-orange-500" withHandle />}
              </>
            )}
            {page && node && showTypography && (
              <>
                <ResizablePanel defaultSize="42" id="typography" minSize={compact ? "56px" : "240px"}>
                  <TypographyInspector
                    breakpoint={breakpoint}
                    key={`${page.id}:${node.id}:${breakpoint}`}
                    node={node}
                    onChange={(styles) => actions.edit({ type: "node.updateStyle", pageId: page.id, nodeId: node.id, breakpoint, styles })}
                    onReset={(property) => actions.edit({ type: "node.resetStyle", pageId: page.id, nodeId: node.id, breakpoint, property })}
                  />
                </ResizablePanel>
                {showAppearance && <ResizableHandle className="bg-zinc-200 hover:bg-orange-500" withHandle />}
              </>
            )}
            {page && node && showAppearance && (
              <ResizablePanel defaultSize="20" id="appearance" minSize={compact ? "56px" : "120px"}>
                <AppearanceInspector
                  breakpoint={breakpoint}
                  key={`${page.id}:${node.id}:${breakpoint}`}
                  node={node}
                  onChange={(styles) => actions.edit({ type: "node.updateStyle", pageId: page.id, nodeId: node.id, breakpoint, styles })}
                  onReset={(property) => actions.edit({ type: "node.resetStyle", pageId: page.id, nodeId: node.id, breakpoint, property })}
                />
              </ResizablePanel>
            )}
          </ResizablePanelGroup>
        </TabsContent>
        <TabsContent className="min-h-0 overflow-auto" value="settings">
          {node?.type === "heading" && (
            <InspectorSection title="Content">
              <label className="grid gap-1.5 text-xs font-medium text-zinc-600">
                Heading level
                <select
                  className="h-8 rounded-lg border border-input bg-zinc-50 px-2 text-xs focus-visible:outline-orange-500"
                  onChange={(event) => {
                    const level = headingLevels.find((level) => level === event.target.value);
                    if (level) actions.updateBlockContent(node.id, { headingLevel: level });
                  }}
                  value={resolveHeadingLevel(node)}
                >
                  {headingLevels.map((level) => <option key={level} value={level}>{level.toUpperCase()}</option>)}
                </select>
              </label>
            </InspectorSection>
          )}
          {node?.type === "input" && (
            <InspectorSection title="Content">
              <label className="grid gap-1.5 text-xs font-medium text-zinc-600">
                Placeholder
                <Input className="text-xs md:text-xs" onChange={(event) => actions.updateBlockContent(node.id, { body: event.target.value })} value={node.content.body ?? ""} />
              </label>
            </InspectorSection>
          )}
        </TabsContent>
      </Tabs>
    </aside>
  );
}

function Canvas({ actions, compact, onViewportChange, page, pageMenu, variant, viewport }: { actions: EditorActions; compact: boolean; onViewportChange: (viewport: CanvasViewport) => void; page: BuilderPage | null; pageMenu?: ReactNode; variant: VariantKey; viewport: CanvasViewport }) {
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
      <CanvasToolbar onViewportChange={onViewportChange} page={page} pageMenu={pageMenu} viewport={viewport} />
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
                  <Artboard actions={actions} artboardRef={artboardRef} isResizing={isResizingCanvas} key={actions.page?.id} viewport={viewport} />
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
          <CompactPanel icon={ListFilter} title="Layers">
            <LayersPanel actions={actions} key={actions.page?.id} />
          </CompactPanel>
          <CompactPanel icon={Plus} title="Quick insert">
            <QuickInsertPanel actions={actions} draggable={false} />
          </CompactPanel>
          {compact && variant !== "b" && (
            <CompactPanel icon={Settings2} title="Inspector">
              <Inspector actions={actions} breakpoint={breakpointForWidth(viewport.width)} compact />
            </CompactPanel>
          )}
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
  const PageIcon = page?.icon ?? FileText;
  const pageMenu = !showNavigator && (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Switch page" className="flex min-w-0 items-center gap-1.5 rounded text-zinc-600 focus-visible:outline-orange-500">
        <PageIcon className="size-3.5 shrink-0" /> <span className="truncate">{page?.name ?? "No page selected"}</span> <ChevronDown className="size-3 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[60dvh] w-44 overflow-y-auto">
        {pages.map((page) => (
          <DropdownMenuItem key={page.id} onClick={() => onSelectPage(page)}>{page.name}</DropdownMenuItem>
        ))}
        {pages.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Add page</DropdownMenuLabel>
          {pagePresets.map((preset) => (
            <DropdownMenuItem key={preset.id} onClick={() => onAddPage(preset)}>{preset.title}</DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  return (
    <div className="builder-light-theme h-screen overflow-hidden bg-white text-zinc-900">
      <ProjectBar canRedo={canRedo} canUndo={canUndo} onRedo={onRedo} onUndo={onUndo} saveStatus={saveStatus} />
      <div className="h-[calc(100vh-4rem)] min-h-0 overflow-hidden">
        <ResizablePanelGroup className="h-full min-h-0" id={`workspace-${variant}`} orientation="horizontal">
          {showNavigator && <><ResizablePanel defaultSize="244px" id="navigator" maxSize="380px" minSize="200px"><Navigator actions={actions} onAddPage={onAddPage} onDeletePage={onDeletePage} onRenamePage={onRenamePage} onSelectPage={onSelectPage} pages={pages} selectedPageId={selectedPageId} /></ResizablePanel><ResizableHandle className="bg-zinc-200 hover:bg-orange-500" withHandle /></>}
          <ResizablePanel defaultSize={compact ? "100" : "60"} id="canvas" minSize={compact ? "280px" : "440px"}><Canvas actions={actions} compact={compact} onViewportChange={onViewportChange} page={page} pageMenu={pageMenu || undefined} variant={variant} viewport={viewport} /></ResizablePanel>
          {showInspector && <><ResizableHandle className="bg-zinc-200 hover:bg-orange-500" withHandle /><ResizablePanel defaultSize="288px" id="inspector" maxSize="420px" minSize="240px"><Inspector actions={actions} breakpoint={breakpointForWidth(viewport.width)} /></ResizablePanel></>}
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
  const [saveResult, setSaveResult] = useState<{ document: SiteDocument; pageId: string | null; error: boolean } | null>(null);
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
      closeLayerDelete();
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
      closeLayerDelete({ fallback });
      return;
    }
    closeLayerDelete();
  }

  function closeLayerDelete(deleted?: { fallback: string | null }) {
    const trigger = layerDeleteDialog?.trigger;
    const layers = trigger?.closest('[data-slot="scroll-area-viewport"]');
    setLayerDeleteDialog(null);
    requestAnimationFrame(() => {
      if (!deleted) {
        trigger?.focus({ preventScroll: true });
        return;
      }
      const selector = deleted.fallback === null ? "[data-layers-heading]"
        : `[data-layer-node-id="${CSS.escape(deleted.fallback)}"] [data-layer-select]`;
      layers?.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
    });
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
    queueMicrotask(() => { if (active) setSaveResult({ document, pageId: selectedPageId, error }); });
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
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
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
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='separator']")) return;
      if (event.key === "ArrowLeft") changeVariant(adjacentVariant(current, -1));
      if (event.key === "ArrowRight") changeVariant(adjacentVariant(current, 1));
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [changeVariant, current, showVariantSwitcher]);

  const actions: EditorActions = {
    page, hasPage: page !== null, selectedNode, choose, edit, insertItem, insertDrag, moveCanvasNode, moveLayer, toggleLayerCollapse,
    selection: selectedNode ? layerSelection : null,
    expandLayer: (id) => { if (page) expandLayers(page.id, [id]); },
    isLayerCollapsed: (id) => page !== null && (collapsedLayers[page.id] ?? []).includes(id),
    requestLayerDelete: (node, trigger) => {
      if (page) setLayerDeleteDialog({
        layerId: node.id, label: nodeDetails(node).label, hasChildren: node.childIds.length > 0, pageId: page.id, trigger,
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
    updateImage: (nodeId, breakpoint, { imageUrl, alt, objectFit }) => {
      if (!page) return;
      commit((document) => {
        const currentPage = document.pages.find((candidate) => candidate.id === page.id);
        const node = currentPage && Object.hasOwn(currentPage.nodes, nodeId) ? currentPage.nodes[nodeId] : null;
        if (node?.type !== "image") return document;

        const content: NodeContent = {};
        if (imageUrl !== undefined && imageUrl !== node.content.imageUrl) content.imageUrl = imageUrl;
        if (alt !== (node.content.alt ?? "")) content.alt = alt;
        const withContent = Object.keys(content).length
          ? applyDocumentOperation(document, { type: "node.updateContent", pageId: page.id, nodeId, content })
          : document;
        return objectFit === (resolveStyles(node, breakpoint).objectFit ?? "cover") ? withContent
          : applyDocumentOperation(withContent, { type: "node.updateStyle", pageId: page.id, nodeId, breakpoint, styles: { objectFit } });
      });
    },
  };
  const saveStatus = loadStatus === "error" ? "Saved pages could not be loaded. Autosave is paused."
    : loadStatus === "loading" ? "Loading saved pages…"
    : saveResult?.document !== document || saveResult.pageId !== selectedPageId ? "Saving…"
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
      <LayerDeleteDialog dialog={layerDeleteDialog} onClose={() => closeLayerDelete()} onConfirm={confirmLayerDelete} />
      {showVariantSwitcher && <PrototypeSwitcher current={current} onChange={changeVariant} />}
    </>
  );
}
