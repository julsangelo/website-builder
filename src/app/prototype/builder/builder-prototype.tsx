"use client";

import {
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
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

// PROTOTYPE: Three Figma-derived website editor shells, switchable via ?variant=a|b|c.

const variants = {
  a: { name: "Forma studio", description: "Reference editor shell" },
  b: { name: "Navigator first", description: "Page tree drives editing" },
  c: { name: "Canvas first", description: "Wide artboard with a block rail" },
} as const;

type VariantKey = keyof typeof variants;
type SelectedNode = "heading" | "hero-image" | "section" | "gallery" | "button";
type QuickBlock = "section" | "heading" | "image" | "button";

const selectionDetails: Record<
  SelectedNode,
  { label: string; layer: string; icon: LucideIcon }
> = {
  heading: { label: "Hero heading", layer: "Heading · H1", icon: Type },
  "hero-image": { label: "Hero image", layer: "Image", icon: ImageIcon },
  section: { label: "Hero section", layer: "Section", icon: LayoutTemplate },
  gallery: { label: "Selected spaces", layer: "Collection", icon: PanelTop },
  button: { label: "Button", layer: "Button", icon: MousePointer2 },
};

const quickBlocks: Array<{ id: QuickBlock; label: string; icon: LucideIcon }> = [
  { id: "section", label: "Section", icon: LayoutTemplate },
  { id: "heading", label: "Heading", icon: Type },
  { id: "image", label: "Image", icon: ImageIcon },
  { id: "button", label: "Button", icon: MoreHorizontal },
];

const blockTargets: Record<QuickBlock, SelectedNode> = {
  button: "button",
  heading: "heading",
  image: "hero-image",
  section: "section",
};

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

const initialPages: BuilderPage[] = [];

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

type EditorActions = {
  insertedBlocks: QuickBlock[];
  selected: SelectedNode;
  lastAction: string;
  choose: (node: SelectedNode, source: string) => void;
  addBlock: (block: QuickBlock, source: string) => void;
  resize: (scope: string, layout: Record<string, number>) => void;
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

function ProjectBar() {
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
        <IconButton label="Undo"><Undo2 className="size-3.5" /></IconButton>
        <IconButton label="Redo"><Redo2 className="size-3.5" /></IconButton>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] text-zinc-500">
        <CloudCheck className="size-3.5 shrink-0" />
        <span className="truncate">All changes saved</span>
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

function SidebarItem({
  children,
  active = false,
  indent = 0,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  indent?: number;
  onClick?: () => void;
}) {
  return (
    <Button
      className={
        "h-8 w-full justify-start gap-2 rounded-md pr-2 text-left text-xs font-normal transition " +
        (active
          ? "bg-orange-100 font-medium text-orange-600"
          : "text-zinc-700 hover:bg-zinc-100")
      }
      onClick={onClick}
      style={{ paddingLeft: 9 + indent * 14 }}
      type="button"
      variant="ghost"
    >
      {children}
    </Button>
  );
}

function QuickInsert({ actions, rail = false }: { actions: EditorActions; rail?: boolean }) {
  return (
    <section className={rail ? "flex items-center gap-2" : "border-t border-zinc-200 p-4"}>
      {!rail && (
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold">Quick insert</p>
          <Settings2 className="size-3.5 text-zinc-500" />
        </div>
      )}
      {!rail && (
        <div className="relative mb-3">
          <Search className="absolute top-1/2 left-2.5 size-3 -translate-y-1/2 text-zinc-400" />
          <Input
            className="h-7 border-0 bg-zinc-50 pl-7 text-[11px] shadow-none"
            placeholder="Search blocks...  ⌘ K"
          />
        </div>
      )}
      <div className={rail ? "flex gap-2" : "grid grid-cols-2 gap-2"}>
        {quickBlocks.map((block) => {
          const Icon = block.icon;
          return (
            <Button
              className={
                "h-auto cursor-grab border-zinc-200 bg-white p-0 font-normal text-zinc-900 shadow-none transition hover:border-orange-300 hover:bg-orange-50 active:cursor-grabbing " +
                (rail ? "w-24" : "")
              }
              draggable
              key={block.id}
              onClick={() => actions.addBlock(block.id, "quick insert")}
              onDragStart={(event) => event.dataTransfer.setData("text/plain", block.id)}
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
      {!rail && (
        <p className="mt-3 flex items-center gap-1.5 text-[10px] text-zinc-500">
          <GripVertical className="size-3" /> Drag a block onto your page
        </p>
      )}
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
        (active ? "bg-orange-100 text-orange-600" : "text-zinc-700 hover:bg-zinc-100")
      }
    >
      <Button
        aria-current={active ? "page" : undefined}
        className={
          "h-full min-w-0 flex-1 justify-start gap-2 rounded-md px-2.5 text-left text-xs font-normal hover:bg-transparent " +
          (active ? "font-medium text-orange-600 hover:text-orange-600" : "text-zinc-700 hover:text-zinc-700")
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
            "mr-1 grid size-5 shrink-0 place-items-center rounded-md outline-none transition hover:bg-orange-200 hover:text-orange-700 focus-visible:ring-2 focus-visible:ring-orange-500 " +
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
        onLayoutChanged={(layout, meta) => {
          if (meta.isUserInteraction) actions.resize("Navigator sections", layout);
        }}
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
          <ScrollArea className="h-full">
            <section className="p-3">
              <div className="mb-2 flex items-center justify-between px-1 text-xs font-semibold">
                Layers <ListFilter className="size-3.5 text-zinc-500" />
              </div>
              <SidebarItem onClick={() => actions.choose("section", "layer tree")}><ChevronDown className="size-3" /><PanelTop className="size-3.5" /> Navigation</SidebarItem>
              <SidebarItem onClick={() => actions.choose("section", "layer tree")}><ChevronDown className="size-3" /><LayoutTemplate className="size-3.5" /> Hero section</SidebarItem>
              <SidebarItem indent={1} onClick={() => actions.choose("section", "layer tree")}><ChevronDown className="size-3" /><LayoutTemplate className="size-3.5" /> Content</SidebarItem>
              <SidebarItem indent={2}><Type className="size-3.5" /> Eyebrow</SidebarItem>
              <SidebarItem active={actions.selected === "heading"} indent={2} onClick={() => actions.choose("heading", "layer tree")}><Type className="size-3.5" /> Hero heading</SidebarItem>
              <SidebarItem indent={2}><Type className="size-3.5" /> Description</SidebarItem>
              <SidebarItem active={actions.selected === "hero-image"} indent={1} onClick={() => actions.choose("hero-image", "layer tree")}><ImageIcon className="size-3.5" /> Hero image</SidebarItem>
              <SidebarItem active={actions.selected === "gallery"} onClick={() => actions.choose("gallery", "layer tree")}><ChevronDown className="size-3" /><LayoutTemplate className="size-3.5" /> Selected spaces</SidebarItem>
            </section>
          </ScrollArea>
        </ResizablePanel>
        <ResizableHandle className="bg-zinc-200 hover:bg-orange-500" withHandle />
        <ResizablePanel defaultSize="35" id="quick-insert" minSize="190px">
          <ScrollArea className="h-full">
            <QuickInsert actions={actions} />
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

function Artboard({ actions, artboardHeight, artboardRef, isResizing, viewport }: { actions: EditorActions; artboardHeight: number; artboardRef: React.RefObject<HTMLElement | null>; isResizing: boolean; viewport: CanvasViewport }) {
  const [dragging, setDragging] = useState(false);
  const compactPreview = viewport.width < 768;
  const narrowPreview = viewport.width < 510;
  const browserHeaderHeight = compactPreview ? 48 : 64;

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    const block = event.dataTransfer.getData("text/plain") as QuickBlock;
    if (quickBlocks.some((candidate) => candidate.id === block)) {
      actions.addBlock(block, "artboard drop");
    }
  }

  return (
    <article
      className={"relative min-h-[640px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_12px_30px_rgba(24,24,27,0.08)] transition-[width] ease-out motion-reduce:transition-none " + (isResizing ? "duration-0" : "duration-300")}
      onDragEnter={() => setDragging(true)}
      onDragLeave={() => setDragging(false)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
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
      <section className="grid place-items-center bg-white px-8 text-center" style={{ minHeight: artboardHeight - browserHeaderHeight }}>
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
      </section>
      {dragging && <div className="absolute inset-x-3 top-14 bottom-3 grid place-items-center border-2 border-dashed border-orange-500 bg-orange-50/90 text-sm font-medium text-orange-700">Drop to add a block</div>}
    </article>
  );
}

function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-3 border-b border-zinc-200 p-4"><Button className="h-6 w-full justify-between px-0 text-xs font-semibold hover:bg-transparent" variant="ghost">{title}<ChevronDown className="size-3.5 text-zinc-500" /></Button>{children}</section>;
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[64px_1fr] items-center gap-2 text-[10px]"><span className="text-zinc-500">{label}</span><Input aria-label={label} className="h-8 border-0 bg-zinc-50 px-2 text-[10px] shadow-none" readOnly value={value} /></div>;
}

function Inspector({ actions }: { actions: EditorActions }) {
  const selection = selectionDetails[actions.selected];
  const SelectionIcon = selection.icon;
  return (
    <aside className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-white">
      <div className="flex h-12 items-center border-b border-zinc-200 px-4 text-xs"><Tabs className="!h-full w-40 !gap-0" defaultValue="style"><TabsList className="!grid !h-full !w-full grid-cols-2 !gap-0 !p-0" variant="line"><TabsTrigger className="!flex !h-full !w-full !items-center !justify-center px-0 pb-0.5 text-xs data-active:text-zinc-950 after:!bottom-[-1.5px] after:z-10 after:h-0.5 after:bg-orange-600" value="style">Style</TabsTrigger><TabsTrigger className="!flex !h-full !w-full !items-center !justify-center px-0 pb-0.5 text-xs after:!bottom-[-1.5px] after:z-10 after:h-0.5 after:bg-orange-600" value="settings">Settings</TabsTrigger></TabsList></Tabs><MoreHorizontal className="ml-auto size-4 text-zinc-500" /></div>
      <ResizablePanelGroup className="min-h-0 flex-1" id="inspector-sections" onLayoutChanged={(layout, meta) => { if (meta.isUserInteraction) actions.resize("Inspector sections", layout); }} orientation="vertical">
        <ResizablePanel defaultSize="18" id="selection" minSize="120px"><ScrollArea className="h-full"><div className="border-b border-zinc-200 p-4"><div className="flex items-center gap-3"><div className="grid size-8 place-items-center rounded-md bg-orange-100 text-orange-600"><SelectionIcon className="size-4" /></div><div><p className="text-xs font-semibold">{selection.label}</p><p className="text-[10px] text-zinc-500">{selection.layer}</p></div></div><Button className="mt-3 w-full justify-between border-violet-300 bg-violet-50 text-[10px] text-violet-700 hover:bg-violet-100" size="sm" variant="outline">✦ {selection.label.toLowerCase().replace(" ", "-")} <ChevronDown className="size-3" /></Button><p className="mt-2 text-[9px] text-zinc-500">Inheriting 2 styles on Desktop</p></div></ScrollArea></ResizablePanel>
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

  useEffect(() => {
    const artboard = artboardRef.current;
    if (!artboard) return;

    const measure = () => setArtboardHeight(Math.max(defaultCanvasHeight, artboard.scrollHeight));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(artboard);
    return () => observer.disconnect();
  }, [viewport.width, actions.insertedBlocks.length]);

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
                  <Artboard actions={actions} artboardHeight={artboardHeight} artboardRef={artboardRef} isResizing={isResizingCanvas} viewport={viewport} />
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
        <span className="truncate">{page ? <>{page.name} › Hero section › <span className="text-orange-600">{selectionDetails[actions.selected].label}</span></> : "No page selected"}</span>
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
      {(compact || variant === "c") && <div className="fixed right-4 bottom-14 z-20 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg"><QuickInsert actions={actions} rail /></div>}
    </main>
  );
}

function FormaVariant({
  actions,
  compact,
  onAddPage,
  onDeletePage,
  onRenamePage,
  onSelectPage,
  onViewportChange,
  page,
  pages,
  selectedPageId,
  variant,
  viewport,
}: {
  actions: EditorActions;
  compact: boolean;
  onAddPage: (preset: PagePreset) => void;
  onDeletePage: (page: BuilderPage) => void;
  onRenamePage: (page: BuilderPage) => void;
  onSelectPage: (page: BuilderPage) => void;
  onViewportChange: (viewport: CanvasViewport) => void;
  page: BuilderPage | null;
  pages: BuilderPage[];
  selectedPageId: string | null;
  variant: VariantKey;
  viewport: CanvasViewport;
}) {
  const showNavigator = !compact && variant !== "c";
  const showInspector = !compact && variant !== "b";
  return (
    <div className="builder-light-theme h-screen overflow-hidden bg-white text-zinc-900">
      <ProjectBar />
      <div className="h-[calc(100vh-4rem)] min-h-0 overflow-hidden">
        <ResizablePanelGroup className="h-full min-h-0" id={`workspace-${variant}`} onLayoutChanged={(layout, meta) => { if (meta.isUserInteraction) actions.resize("Workspace panels", layout); }} orientation="horizontal">
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

export function BuilderEditor({ showVariantSwitcher = false }: { showVariantSwitcher?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = searchParams.get("variant");
  const current: VariantKey = showVariantSwitcher && (requested === "b" || requested === "c") ? requested : "a";
  const [selected, setSelected] = useState<SelectedNode>("heading");
  const [lastAction, setLastAction] = useState("Opened Forma studio");
  const [insertedBlocks, setInsertedBlocks] = useState<QuickBlock[]>([]);
  const [compact, setCompact] = useState(false);
  const [viewport, setViewport] = useState<CanvasViewport>(canvasViewportPresets.desktop);
  const [pages, setPages] = useState<BuilderPage[]>(initialPages);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [pageDialog, setPageDialog] = useState<PageDialogState>(null);
  const [pageNameDraft, setPageNameDraft] = useState("");
  const pageSequenceRef = useRef(0);
  const changeVariant = useCallback((variant: VariantKey) => { const next = new URLSearchParams(searchParams.toString()); next.set("variant", variant); router.replace(pathname + "?" + next.toString(), { scroll: false }); setLastAction("Switched to " + variants[variant].name); }, [pathname, router, searchParams]);
  const choose = useCallback((node: SelectedNode, source: string) => { setSelected(node); setLastAction("Selected " + selectionDetails[node].label + " from " + source); }, []);
  const addBlock = useCallback((block: QuickBlock, source: string) => { setInsertedBlocks((currentBlocks) => [...currentBlocks, block]); choose(blockTargets[block], source + " · added " + block); }, [choose]);
  const resize = useCallback((scope: string, layout: Record<string, number>) => { const dimensions = Object.entries(layout).map(([id, size]) => `${id} ${Math.round(size)}%`).join(" · "); setLastAction(`${scope} resized · ${dimensions}`); }, []);
  const changeViewport = useCallback((nextViewport: CanvasViewport) => { setViewport(nextViewport); setLastAction(`Canvas changed to ${nextViewport.label} · ${nextViewport.width} px`); }, []);
  const selectPage = useCallback((page: BuilderPage) => { setSelectedPageId(page.id); setLastAction(`Selected ${page.name} page`); }, []);
  const addPage = useCallback((preset: PagePreset) => {
    const page: BuilderPage = {
      id: `${preset.id}-${pageSequenceRef.current += 1}`,
      icon: preset.icon,
      name: uniquePageName(preset.name, pages),
      preset: preset.id,
    };
    setPages((currentPages) => [...currentPages, page]);
    setSelectedPageId(page.id);
    setLastAction(`Added ${page.name}`);
  }, [pages]);
  const renamePage = useCallback((page: BuilderPage) => {
    setPageNameDraft(page.name);
    setPageDialog({ mode: "rename", pageId: page.id });
  }, []);
  const deletePage = useCallback((page: BuilderPage) => {
    setPageDialog({ mode: "delete", pageId: page.id });
  }, []);
  const closePageDialog = useCallback(() => setPageDialog(null), []);
  const confirmPageDialog = useCallback(() => {
    if (!pageDialog) return;
    const page = pages.find((candidate) => candidate.id === pageDialog.pageId);
    if (!page) {
      closePageDialog();
      return;
    }

    if (pageDialog.mode === "rename") {
      const name = pageNameDraft.trim();
      if (!name) return;
      setPages((currentPages) => currentPages.map((candidate) => candidate.id === page.id ? { ...candidate, name } : candidate));
      setLastAction(`Renamed page to ${name}`);
      closePageDialog();
      return;
    }

    const pageIndex = pages.findIndex((candidate) => candidate.id === page.id);
    const remainingPages = pages.filter((candidate) => candidate.id !== page.id);
    setPages(remainingPages);
    if (selectedPageId === page.id) {
      setSelectedPageId(remainingPages[Math.min(pageIndex, remainingPages.length - 1)]?.id ?? null);
    }
    setLastAction(`Deleted ${page.name}`);
    closePageDialog();
  }, [closePageDialog, pageDialog, pageNameDraft, pages, selectedPageId]);
  useEffect(() => { const media = window.matchMedia("(max-width: 899px)"); const sync = () => setCompact(media.matches); sync(); media.addEventListener("change", sync); return () => media.removeEventListener("change", sync); }, []);
  useEffect(() => { if (!showVariantSwitcher) return; function handleKeyDown(event: KeyboardEvent) { const target = event.target as HTMLElement | null; if (target?.closest("input, textarea, [contenteditable='true'], [role='separator']")) return; if (event.key === "ArrowLeft") changeVariant(adjacentVariant(current, -1)); if (event.key === "ArrowRight") changeVariant(adjacentVariant(current, 1)); } window.addEventListener("keydown", handleKeyDown); return () => window.removeEventListener("keydown", handleKeyDown); }, [changeVariant, current, showVariantSwitcher]);
  const actions: EditorActions = { insertedBlocks, selected, lastAction, choose, addBlock, resize };
  const selectedPage = pages.find((page) => page.id === selectedPageId) ?? null;
  const dialogPage = pageDialog ? pages.find((page) => page.id === pageDialog.pageId) ?? null : null;
  return <><FormaVariant actions={actions} compact={compact} onAddPage={addPage} onDeletePage={deletePage} onRenamePage={renamePage} onSelectPage={selectPage} onViewportChange={changeViewport} page={selectedPage} pages={pages} selectedPageId={selectedPageId} variant={current} viewport={viewport} /><PageManagementDialog dialog={pageDialog} draftName={pageNameDraft} onClose={closePageDialog} onConfirm={confirmPageDialog} onDraftNameChange={setPageNameDraft} page={dialogPage} />{showVariantSwitcher && <PrototypeSwitcher current={current} onChange={changeVariant} />}</>;
}
