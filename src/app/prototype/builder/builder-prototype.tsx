"use client";

import {
  type DragEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type LucideIcon,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  CloudCheck,
  Code2,
  FileText,
  GripVertical,
  HelpCircle,
  Home,
  ImageIcon,
  LayoutTemplate,
  ListFilter,
  Monitor,
  MoreHorizontal,
  MousePointer2,
  PanelTop,
  Play,
  Plus,
  Redo2,
  Search,
  Settings2,
  Smartphone,
  Tablet,
  Type,
  Undo2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  height: number;
};

const canvasViewportPresets: Record<
  Exclude<CanvasViewportKind, "custom">,
  CanvasViewport
> = {
  desktop: { kind: "desktop", label: "Desktop", width: 1200, height: 860 },
  tablet: { kind: "tablet", label: "Tablet", width: 768, height: 1024 },
  mobile: { kind: "mobile", label: "Mobile", width: 390, height: 844 },
};

const customViewportBounds = {
  width: { min: 320, max: 1920 },
  height: { min: 480, max: 2160 },
} as const;

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

function Navigator({ actions }: { actions: EditorActions }) {
  return (
    <aside className="flex h-full w-full min-w-0 flex-col bg-white">
      <div className="flex h-12 items-center gap-5 border-b border-zinc-200 px-4 text-xs">
        <Tabs className="h-full gap-0" defaultValue="design">
          <TabsList className="h-full gap-5 p-0" variant="line">
            <TabsTrigger className="h-full flex-none px-0 text-xs data-active:text-zinc-950 after:bottom-0 after:bg-orange-600" value="design">Design</TabsTrigger>
            <TabsTrigger className="h-full flex-none px-0 text-xs after:bottom-0 after:bg-orange-600" value="assets">Assets</TabsTrigger>
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
          <section className="h-full overflow-auto p-3">
            <div className="mb-2 flex items-center justify-between px-1 text-xs font-semibold">
              Pages <Plus className="size-3.5 text-zinc-500" />
            </div>
            <SidebarItem active><Home className="size-3.5" /> Home <MoreHorizontal className="ml-auto size-3.5" /></SidebarItem>
            <SidebarItem><FileText className="size-3.5" /> Our studio</SidebarItem>
            <SidebarItem><FileText className="size-3.5" /> Selected work</SidebarItem>
            <SidebarItem><FileText className="size-3.5" /> Contact</SidebarItem>
          </section>
        </ResizablePanel>
        <ResizableHandle className="bg-zinc-200 hover:bg-orange-500" withHandle />
        <ResizablePanel defaultSize="43" id="layers" minSize="160px">
          <section className="h-full overflow-auto p-3">
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
        </ResizablePanel>
        <ResizableHandle className="bg-zinc-200 hover:bg-orange-500" withHandle />
        <ResizablePanel defaultSize="35" id="quick-insert" minSize="190px">
          <div className="h-full overflow-auto">
            <QuickInsert actions={actions} />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      <div className="flex items-center gap-2 border-t border-zinc-200 px-4 py-3 text-[10px] text-zinc-500">
        <HelpCircle className="size-3.5" /> Help & keyboard shortcuts
      </div>
    </aside>
  );
}

function CanvasToolbar({
  onViewportChange,
  viewport,
}: {
  onViewportChange: (viewport: CanvasViewport) => void;
  viewport: CanvasViewport;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customWidth, setCustomWidth] = useState(String(viewport.width));
  const [customHeight, setCustomHeight] = useState(String(viewport.height));
  const parsedWidth = Number(customWidth);
  const parsedHeight = Number(customHeight);
  const customIsValid =
    Number.isInteger(parsedWidth) &&
    parsedWidth >= customViewportBounds.width.min &&
    parsedWidth <= customViewportBounds.width.max &&
    Number.isInteger(parsedHeight) &&
    parsedHeight >= customViewportBounds.height.min &&
    parsedHeight <= customViewportBounds.height.max;

  function choosePreset(kind: Exclude<CanvasViewportKind, "custom">) {
    const preset = canvasViewportPresets[kind];
    setCustomWidth(String(preset.width));
    setCustomHeight(String(preset.height));
    setCustomOpen(false);
    onViewportChange(preset);
  }

  function applyCustomViewport() {
    if (!customIsValid) return;
    onViewportChange({
      kind: "custom",
      label: "Custom",
      width: parsedWidth,
      height: parsedHeight,
    });
    setCustomOpen(false);
  }

  const viewportButtons = [
    { kind: "desktop", label: "Desktop viewport", icon: Monitor },
    { kind: "tablet", label: "Tablet viewport", icon: Tablet },
    { kind: "mobile", label: "Mobile viewport", icon: Smartphone },
  ] as const;

  return (
    <div className="relative flex h-12 items-center justify-between border-b border-zinc-200 bg-white px-4 text-xs">
      <div className="flex items-center gap-1.5 text-zinc-600"><Home className="size-3.5" /> Home <ChevronDown className="size-3" /></div>
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
                  ? "bg-orange-100 text-orange-600 hover:bg-orange-100"
                  : "text-zinc-500")
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
            (viewport.kind === "custom" ? "text-orange-600" : "text-zinc-500")
          }
          onClick={() => setCustomOpen((open) => !open)}
          size="sm"
          type="button"
          variant="ghost"
        >
          {viewport.width} × {viewport.height}
          <ChevronDown className="size-3" />
        </Button>
      </div>
      <div className="flex items-center gap-3 text-zinc-500"><Code2 className="size-3.5" /><MoreHorizontal className="size-4" /></div>
      {customOpen && (
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
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
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
            <span className="pb-2 text-zinc-400">×</span>
            <label className="grid gap-1 text-[10px] text-zinc-500">
              Height
              <Input
                aria-label="Canvas height"
                className="h-8 text-xs"
                inputMode="numeric"
                max={customViewportBounds.height.max}
                min={customViewportBounds.height.min}
                onChange={(event) => setCustomHeight(event.target.value)}
                type="number"
                value={customHeight}
              />
            </label>
          </div>
          <p className="mt-2 text-[9px] text-zinc-400">
            Width 320–1920 · height 480–2160
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              className="h-7 px-2 text-[10px]"
              onClick={() => setCustomOpen(false)}
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
      )}
    </div>
  );
}

function Artboard({ actions, viewport }: { actions: EditorActions; viewport: CanvasViewport }) {
  const [dragging, setDragging] = useState(false);
  const selectedClass = "ring-1 ring-orange-500 ring-offset-[-1px]";
  const narrow = viewport.width < 768;

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
      className="relative shrink-0 overflow-x-hidden overflow-y-auto bg-[#fff7ec] shadow-[0_10px_30px_rgba(74,50,25,0.09)]"
      onDragEnter={() => setDragging(true)}
      onDragLeave={() => setDragging(false)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      style={{ height: viewport.height, width: viewport.width }}
    >
      <nav className={"flex h-17 items-center justify-between bg-[#fff7ec] text-[10px] text-[#333b32] " + (narrow ? "px-7" : "px-9")}>
        <p className="text-[27px] font-semibold tracking-tight">forma.</p>
        <div className={(narrow ? "hidden" : "flex") + " items-center gap-6"}><span>Our studio</span><span>Selected work</span><span>Journal</span><span className="flex items-center gap-1">Let&apos;s talk <ArrowUpRight className="size-3" /></span></div>
      </nav>
      <section className={"grid min-h-[360px] " + (narrow ? "grid-cols-1" : "grid-cols-2")}>
        <div className={"relative flex flex-col justify-center py-10 " + (narrow ? "px-7 " : "px-9 ") + (actions.selected === "section" ? selectedClass : "")}>
          <Button className="mb-3 h-auto w-fit gap-2 rounded-none p-0 text-[9px] font-normal uppercase tracking-wide text-[#4a5144] hover:bg-transparent" onClick={() => actions.choose("section", "artboard")} variant="ghost"><span className="size-1 rounded-full bg-[#333b32]" /> Interiors with intention</Button>
          <Button className={"relative h-auto w-fit justify-start rounded-none p-0 text-left font-normal hover:bg-transparent " + (actions.selected === "heading" ? selectedClass : "")} onClick={() => actions.choose("heading", "artboard")} variant="ghost">
            {actions.selected === "heading" && <span className="absolute -top-6 left-0 rounded-t bg-orange-600 px-2 py-1 text-[10px] font-sans text-white">T Hero heading</span>}
            <span className={(narrow ? "text-5xl" : "text-6xl") + " font-semibold leading-[0.84] tracking-[-0.05em] text-[#333b32]"}>Spaces for<br />slower living.</span>
          </Button>
          <p className="mt-6 max-w-xs text-[10px] leading-4 text-[#6f746c]">Thoughtful interiors. Natural materials. A quieter kind of luxury, made for the way you live.</p>
          <Button className="mt-5 w-fit rounded-none bg-[#333b32] px-4 text-[10px] text-white hover:bg-[#454d43]" size="sm">Explore our work <ArrowUpRight className="size-3" /></Button>
          <p className="mt-7 text-[8px] uppercase tracking-wide text-[#747970]">Based in Copenhagen · working everywhere</p>
        </div>
        <Button aria-label="Select hero image" className={"relative h-auto min-h-70 w-full overflow-hidden rounded-none p-0 text-left hover:bg-transparent " + (actions.selected === "hero-image" ? selectedClass : "")} onClick={() => actions.choose("hero-image", "artboard")} type="button" variant="ghost">
          <Image alt="Warm living room from the reference design" className="object-cover" fill preload sizes="(max-width: 768px) 100vw, 486px" src="/prototype/forma-hero.png" />
          {actions.selected === "hero-image" && <span className="absolute right-2 bottom-2 rounded bg-orange-600 px-2 py-1 text-[10px] text-white">Image</span>}
        </Button>
      </section>
      <section className={"relative border-t-2 border-orange-500 py-6 " + (narrow ? "px-7 " : "px-9 ") + (actions.selected === "gallery" ? selectedClass : "")}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <Button className="h-auto justify-start rounded-none p-0 text-left text-2xl font-semibold tracking-[-0.03em] text-[#333b32] hover:bg-transparent" onClick={() => actions.choose("gallery", "artboard")} variant="ghost">Considered spaces, lasting feeling.</Button>
          <span className="text-[9px] text-[#6f746c]">Selected work / 01—03</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            ["/prototype/forma-project-1.png", "The Frederiksberg residence", "Residential · Copenhagen"],
            ["/prototype/forma-project-2.png", "A softer way to gather", "Residential · Copenhagen"],
            ["/prototype/forma-project-3.png", "A retreat by the coast", "Residential · North sea"],
          ].map(([source, title, location]) => (
            <div key={title}>
              <Image alt="Interior project" className={(narrow ? "h-20" : "h-31") + " w-full object-cover"} height={125} sizes="(max-width: 768px) 30vw, 288px" src={source} width={288} />
              <p className="mt-1.5 truncate text-[10px] font-medium text-[#333b32]">{title}</p>
              <p className="mt-0.5 text-[7px] uppercase tracking-wide text-[#777b72]">{location}</p>
            </div>
          ))}
        </div>
      </section>
      {actions.insertedBlocks.length > 0 && <section className="border-t border-orange-200 bg-white/50 px-7 py-6 sm:px-9"><p className="mb-3 text-[9px] font-semibold uppercase tracking-widest text-orange-700">Added blocks</p><div className="grid gap-3 sm:grid-cols-2">{actions.insertedBlocks.map((block, index) => { const blockInfo = quickBlocks.find((candidate) => candidate.id === block)!; const BlockIcon = blockInfo.icon; return <Card className="border-orange-200 bg-white shadow-none" key={`${block}-${index}`}><CardContent className="flex min-h-24 items-center justify-center p-4">{block === "button" ? <Button className="bg-[#333b32] text-white hover:bg-[#454d43]">New button <ArrowUpRight className="size-3" /></Button> : block === "heading" ? <h3 className="text-2xl font-semibold text-[#333b32]">New heading</h3> : block === "image" ? <div className="grid place-items-center gap-2 text-xs text-zinc-500"><BlockIcon className="size-6" />Image block</div> : <div className="flex items-center gap-2 text-sm font-medium text-[#333b32]"><BlockIcon className="size-4" />New section</div>}</CardContent></Card>; })}</div></section>}
      {dragging && <div className="absolute inset-3 grid place-items-center border-2 border-dashed border-orange-500 bg-orange-50/90 text-sm font-medium text-orange-700">Drop to add a block</div>}
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
      <div className="flex h-12 items-center gap-5 border-b border-zinc-200 px-4 text-xs"><Tabs className="h-full gap-0" defaultValue="style"><TabsList className="h-full gap-5 p-0" variant="line"><TabsTrigger className="h-full flex-none px-0 text-xs data-active:text-zinc-950 after:bottom-0 after:bg-orange-600" value="style">Style</TabsTrigger><TabsTrigger className="h-full flex-none px-0 text-xs after:bottom-0 after:bg-orange-600" value="settings">Settings</TabsTrigger></TabsList></Tabs><MoreHorizontal className="ml-auto size-4 text-zinc-500" /></div>
      <ResizablePanelGroup className="min-h-0 flex-1" id="inspector-sections" onLayoutChanged={(layout, meta) => { if (meta.isUserInteraction) actions.resize("Inspector sections", layout); }} orientation="vertical">
        <ResizablePanel defaultSize="18" id="selection" minSize="120px"><div className="h-full overflow-auto border-b border-zinc-200 p-4"><div className="flex items-center gap-3"><div className="grid size-8 place-items-center rounded-md bg-orange-100 text-orange-600"><SelectionIcon className="size-4" /></div><div><p className="text-xs font-semibold">{selection.label}</p><p className="text-[10px] text-zinc-500">{selection.layer}</p></div></div><Button className="mt-3 w-full justify-between border-violet-300 bg-violet-50 text-[10px] text-violet-700 hover:bg-violet-100" size="sm" variant="outline">✦ {selection.label.toLowerCase().replace(" ", "-")} <ChevronDown className="size-3" /></Button><p className="mt-2 text-[9px] text-zinc-500">Inheriting 2 styles on Desktop</p></div></ResizablePanel>
        <ResizableHandle className="bg-zinc-200 hover:bg-orange-500" withHandle />
        <ResizablePanel defaultSize="31" id="layout" minSize="210px"><div className="h-full overflow-auto"><InspectorSection title="Layout"><div className="grid grid-cols-4 gap-1 rounded-md bg-zinc-50 p-1"><Button className="h-7 bg-white text-orange-600 shadow-sm hover:bg-white" size="sm" variant="ghost"><PanelTop className="size-3.5" /></Button><Button className="h-7 text-zinc-500" size="sm" variant="ghost"><LayoutTemplate className="size-3.5" /></Button><Button className="h-7 text-zinc-500" size="sm" variant="ghost"><Settings2 className="size-3.5" /></Button><Button className="h-7 text-zinc-500" size="sm" variant="ghost"><MousePointer2 className="size-3.5" /></Button></div><PropertyRow label="Size" value="W  Fill     H  Auto" /><PropertyRow label="Position" value="Relative" /><div className="rounded-md bg-zinc-50 p-2 text-[9px] text-zinc-500"><div className="flex justify-between"><span>MARGIN</span><span>0</span></div><div className="my-1.5 flex items-center gap-2"><span>0</span><div className="flex flex-1 items-center justify-center border border-zinc-200 p-2"><span className="bg-orange-100 px-6 py-2 text-orange-600">PADDING&nbsp; 0</span></div><span>0</span></div><p className="text-center">0</p></div></InspectorSection></div></ResizablePanel>
        <ResizableHandle className="bg-zinc-200 hover:bg-orange-500" withHandle />
        <ResizablePanel defaultSize="35" id="typography" minSize="240px"><div className="h-full overflow-auto"><InspectorSection title="Typography"><Button className="h-8 w-full justify-between bg-zinc-50 px-2 text-base font-medium hover:bg-zinc-100" variant="ghost">Inter <ChevronDown className="size-3 text-zinc-500" /></Button><PropertyRow label="Weight" value="Semibold" /><PropertyRow label="Size" value="76   px" /><div className="grid grid-cols-2 gap-2"><Input aria-label="Line height" className="h-8 border-0 bg-zinc-50 text-xs shadow-none" readOnly value="↕  98%" /><Input aria-label="Letter spacing" className="h-8 border-0 bg-zinc-50 text-xs shadow-none" readOnly value="↔  −1.6" /></div><div className="grid grid-cols-4 rounded-md bg-zinc-50 p-1"><Button className="h-7 bg-white text-orange-600" size="sm" variant="ghost">≡</Button><Button className="h-7 text-zinc-500" size="sm" variant="ghost">≡</Button><Button className="h-7 text-zinc-500" size="sm" variant="ghost">≡</Button><Button className="h-7 text-zinc-500" size="sm" variant="ghost">≡</Button></div><PropertyRow label="Color" value="■  333B32   100%" /></InspectorSection></div></ResizablePanel>
        <ResizableHandle className="bg-zinc-200 hover:bg-orange-500" withHandle />
        <ResizablePanel defaultSize="16" id="appearance" minSize="120px"><div className="h-full overflow-auto"><InspectorSection title="Appearance"><PropertyRow label="Opacity" value="100%" /><PropertyRow label="Radius" value="⌜  0" /></InspectorSection><Button className="h-10 w-full justify-between rounded-none px-4 text-xs font-semibold hover:bg-zinc-50" variant="ghost">Effects <Plus className="size-3.5 text-zinc-500" /></Button></div></ResizablePanel>
      </ResizablePanelGroup>
    </aside>
  );
}

function Canvas({ actions, compact, onViewportChange, variant, viewport }: { actions: EditorActions; compact: boolean; onViewportChange: (viewport: CanvasViewport) => void; variant: VariantKey; viewport: CanvasViewport }) {
  const scrollViewportRef = useRef<HTMLDivElement>(null);

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
  }, [viewport.height, viewport.width]);

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-[#f7f6f4]">
      <CanvasToolbar onViewportChange={onViewportChange} viewport={viewport} />
      <div className="min-h-0 flex-1 overflow-auto" ref={scrollViewportRef}>
        <div className="flex min-h-full w-max min-w-full justify-center px-5 py-6 sm:px-10">
          <div className="shrink-0" style={{ width: viewport.width }}>
            <div className="mb-2 flex justify-between text-[10px] text-zinc-400"><span>Home · {viewport.label}</span><span>{viewport.width} × {viewport.height}</span></div>
            <Artboard actions={actions} viewport={viewport} />
          </div>
        </div>
      </div>
      <footer className="flex h-7 items-center justify-between gap-3 border-t border-zinc-200 bg-white px-4 text-[9px] text-zinc-500"><span className="truncate">Home › Hero section › <span className="text-orange-600">{selectionDetails[actions.selected].label}</span></span><span className="hidden truncate sm:inline">{actions.lastAction}</span></footer>
      {(compact || variant === "c") && <div className="fixed right-4 bottom-10 z-20 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg"><QuickInsert actions={actions} rail /></div>}
    </main>
  );
}

function FormaVariant({ actions, compact, onViewportChange, variant, viewport }: { actions: EditorActions; compact: boolean; onViewportChange: (viewport: CanvasViewport) => void; variant: VariantKey; viewport: CanvasViewport }) {
  const showNavigator = !compact && variant !== "c";
  const showInspector = !compact && variant !== "b";
  return (
    <div className="h-screen overflow-hidden bg-white text-zinc-900">
      <ProjectBar />
      <ResizablePanelGroup className="h-[calc(100vh-4rem)]" id={`workspace-${variant}`} onLayoutChanged={(layout, meta) => { if (meta.isUserInteraction) actions.resize("Workspace panels", layout); }} orientation="horizontal">
        {showNavigator && <><ResizablePanel defaultSize="244px" id="navigator" maxSize="380px" minSize="200px"><Navigator actions={actions} /></ResizablePanel><ResizableHandle className="bg-zinc-200 hover:bg-orange-500" withHandle /></>}
        <ResizablePanel defaultSize={compact ? "100" : "60"} id="canvas" minSize={compact ? "280px" : "560px"}><Canvas actions={actions} compact={compact} onViewportChange={onViewportChange} variant={variant} viewport={viewport} /></ResizablePanel>
        {showInspector && <><ResizableHandle className="bg-zinc-200 hover:bg-orange-500" withHandle /><ResizablePanel defaultSize="288px" id="inspector" maxSize="420px" minSize="240px"><Inspector actions={actions} /></ResizablePanel></>}
      </ResizablePanelGroup>
    </div>
  );
}

function PrototypeSwitcher({ current, onChange }: { current: VariantKey; onChange: (variant: VariantKey) => void }) {
  const previous = adjacentVariant(current, -1);
  const next = adjacentVariant(current, 1);
  return <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-zinc-300 bg-white/95 px-2 py-1.5 shadow-xl backdrop-blur"><Button aria-label="Previous prototype variation" className="size-7" onClick={() => onChange(previous)} size="icon-sm" variant="ghost"><ArrowLeft className="size-3.5" /></Button><div className="min-w-44 text-center leading-tight"><p className="text-xs font-semibold">{current.toUpperCase()} · {variants[current].name}</p><p className="text-[10px] text-zinc-500">{variants[current].description}</p></div><Button aria-label="Next prototype variation" className="size-7" onClick={() => onChange(next)} size="icon-sm" variant="ghost"><ArrowRight className="size-3.5" /></Button></div>;
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
  const changeVariant = useCallback((variant: VariantKey) => { const next = new URLSearchParams(searchParams.toString()); next.set("variant", variant); router.replace(pathname + "?" + next.toString(), { scroll: false }); setLastAction("Switched to " + variants[variant].name); }, [pathname, router, searchParams]);
  const choose = useCallback((node: SelectedNode, source: string) => { setSelected(node); setLastAction("Selected " + selectionDetails[node].label + " from " + source); }, []);
  const addBlock = useCallback((block: QuickBlock, source: string) => { setInsertedBlocks((currentBlocks) => [...currentBlocks, block]); choose(blockTargets[block], source + " · added " + block); }, [choose]);
  const resize = useCallback((scope: string, layout: Record<string, number>) => { const dimensions = Object.entries(layout).map(([id, size]) => `${id} ${Math.round(size)}%`).join(" · "); setLastAction(`${scope} resized · ${dimensions}`); }, []);
  const changeViewport = useCallback((nextViewport: CanvasViewport) => { setViewport(nextViewport); setLastAction(`Canvas changed to ${nextViewport.label} · ${nextViewport.width} × ${nextViewport.height}`); }, []);
  useEffect(() => { const media = window.matchMedia("(max-width: 899px)"); const sync = () => setCompact(media.matches); sync(); media.addEventListener("change", sync); return () => media.removeEventListener("change", sync); }, []);
  useEffect(() => { if (!showVariantSwitcher) return; function handleKeyDown(event: KeyboardEvent) { const target = event.target as HTMLElement | null; if (target?.closest("input, textarea, [contenteditable='true'], [role='separator']")) return; if (event.key === "ArrowLeft") changeVariant(adjacentVariant(current, -1)); if (event.key === "ArrowRight") changeVariant(adjacentVariant(current, 1)); } window.addEventListener("keydown", handleKeyDown); return () => window.removeEventListener("keydown", handleKeyDown); }, [changeVariant, current, showVariantSwitcher]);
  const actions: EditorActions = { insertedBlocks, selected, lastAction, choose, addBlock, resize };
  return <><FormaVariant actions={actions} compact={compact} onViewportChange={changeViewport} variant={current} viewport={viewport} />{showVariantSwitcher && <PrototypeSwitcher current={current} onChange={changeVariant} />}</>;
}
