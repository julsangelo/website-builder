"use client";

import {
  type ChangeEvent,
  type CSSProperties,
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
import type { EditorNode, PageDocument, SiteDocument } from "@/lib/builder-document";

// PROTOTYPE: Three Figma-derived website editor shells, switchable via ?variant=a|b|c.

const variants = {
  a: { name: "Forma studio", description: "Reference editor shell" },
  b: { name: "Navigator first", description: "Page tree drives editing" },
  c: { name: "Canvas first", description: "Wide artboard with a block rail" },
} as const;

type VariantKey = keyof typeof variants;
type SelectedNode = "heading" | "hero-image" | "section" | "gallery" | "button";
type QuickBlock = "section" | "box" | "stack" | "grid" | "heading" | "text" | "image" | "button" | "divider" | "card" | "quote" | "stat" | "accordion" | "form" | "navigation" | "footer";
type SectionPresetId = "hero" | "navigation" | "features" | "content-media" | "collection" | "gallery" | "testimonials" | "stats" | "faq" | "cta" | "contact" | "footer";

type SectionPreset = {
  description: string;
  icon: LucideIcon;
  id: SectionPresetId;
  label: string;
  layers: Array<{ block: QuickBlock; icon: LucideIcon; label: string; target: SelectedNode }>;
  target: SelectedNode;
};

type InsertedBlock = {
  content: BlockContent;
  id: string;
  kind: QuickBlock;
  visible: boolean;
};

type BlockContent = {
  body?: string;
  buttonLabel?: string;
  imageUrl?: string;
  title?: string;
};

type InsertedSection = {
  addedBlocks: InsertedBlock[];
  childContent: Record<number, BlockContent>;
  childOrder: number[];
  deletedChildIndexes: number[];
  hiddenChildIndexes: number[];
  id: string;
  preset: SectionPresetId;
  visible: boolean;
};

type PageContent = {
  insertedBlocks: InsertedBlock[];
  insertedSections: InsertedSection[];
};

type EditorDocument = {
  pageContent: Record<string, PageContent>;
  pages: BuilderPage[];
  selectedPageId: string | null;
};

const editorStorageKey = "forma-builder-document-v1";

const emptyPageContent: PageContent = {
  insertedBlocks: [],
  insertedSections: [],
};

function serializableDocument(document: EditorDocument) {
  return toPersistedSiteDocument(document);
}

function loadStoredDocument(): EditorDocument | null {
  try {
    const stored = window.localStorage.getItem(editorStorageKey);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as unknown;
    if (typeof parsed === "object" && parsed !== null && "document" in parsed) {
      const persisted = parsed as PersistedSiteDocument;
      if (persisted.document?.version === 1) return editorDocumentFromPersistedSiteDocument(persisted);
    }
    const legacy = parsed as { pageContent?: Record<string, PageContent>; pages?: Array<Pick<BuilderPage, "id" | "name" | "preset">>; selectedPageId?: string | null };
    if (!Array.isArray(legacy.pages) || !legacy.pageContent || typeof legacy.pageContent !== "object") return null;
    const pages = legacy.pages.flatMap((page) => {
      const preset = pagePresets.find((candidate) => candidate.id === page.preset);
      return preset && typeof page.id === "string" && typeof page.name === "string"
        ? [{ ...page, icon: preset.icon }]
        : [];
    });
    return { pageContent: legacy.pageContent, pages, selectedPageId: pages.some((page) => page.id === legacy.selectedPageId) ? legacy.selectedPageId ?? null : pages[0]?.id ?? null };
  } catch {
    return null;
  }
}

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

const sectionBlockDragType = "application/x-forma-section-block";
const sectionChildDragType = "application/x-forma-section-child";

function defaultBlockContent(kind: QuickBlock): BlockContent {
  switch (kind) {
    case "heading":
      return { title: "A clear heading that makes the next idea feel inevitable." };
    case "text":
      return { body: "Thoughtful supporting copy gives visitors context, makes a promise, and guides them toward the next meaningful action." };
    case "image":
      return { imageUrl: "" };
    case "button":
      return { buttonLabel: "Explore the collection ↗" };
    case "card":
      return { body: "Use cards to group related information and actions.", buttonLabel: "Learn more", title: "Card title" };
    case "quote":
      return { body: "“A thoughtful component system makes every page feel more intentional.”", title: "Mia Petersen, Founder" };
    case "stat":
      return { body: "projects completed", title: "48" };
    case "form":
      return { body: "Tell us a little about your next project.", buttonLabel: "Send message", title: "Get in touch" };
    case "navigation":
      return { buttonLabel: "Contact", title: "forma." };
    case "footer":
      return { body: "© 2026 Forma Studio", title: "forma." };
    case "section":
      return { body: "Use this full-width container to group related content and create visual rhythm on your page.", title: "A new section for your story" };
    case "box":
      return { body: "A flexible content box" };
    case "stack":
      return { body: "Elements flow in order with consistent, adjustable space.", title: "A vertical stack" };
    case "grid":
      return { title: "Discover" };
    case "divider":
      return {};
    case "accordion":
      return { body: "We begin with a clear brief, then build the system and details together.", title: "What does a typical project look like?" };
  }
}

const blockTargets: Record<QuickBlock, SelectedNode> = {
  box: "section",
  button: "button",
  card: "gallery",
  divider: "section",
  accordion: "section",
  footer: "section",
  form: "section",
  grid: "gallery",
  heading: "heading",
  image: "hero-image",
  navigation: "section",
  quote: "gallery",
  section: "section",
  stack: "section",
  stat: "gallery",
  text: "heading",
};

const sectionPresets: SectionPreset[] = [
  { id: "hero", label: "Hero", description: "Heading, CTA, and media", icon: LayoutTemplate, target: "section", layers: [{ block: "text", label: "Eyebrow", icon: Type, target: "heading" }, { block: "heading", label: "Heading", icon: Type, target: "heading" }, { block: "text", label: "Description", icon: Type, target: "heading" }, { block: "button", label: "CTA button", icon: MousePointer2, target: "button" }, { block: "image", label: "Image", icon: ImageIcon, target: "hero-image" }] },
  { id: "navigation", label: "Navigation", description: "Logo, links, and actions", icon: PanelTop, target: "section", layers: [{ block: "text", label: "Logo", icon: Home, target: "section" }, { block: "stack", label: "Links", icon: ListFilter, target: "section" }, { block: "button", label: "Action", icon: MousePointer2, target: "button" }] },
  { id: "features", label: "Feature grid", description: "Icon and text cards", icon: PanelTop, target: "gallery", layers: [{ block: "heading", label: "Heading", icon: Type, target: "heading" }, { block: "grid", label: "Feature grid", icon: PanelTop, target: "gallery" }, { block: "card", label: "Feature card", icon: LayoutTemplate, target: "gallery" }] },
  { id: "content-media", label: "Content + media", description: "Split text and image", icon: LayoutTemplate, target: "section", layers: [{ block: "stack", label: "Content", icon: Type, target: "heading" }, { block: "heading", label: "Heading", icon: Type, target: "heading" }, { block: "text", label: "Description", icon: Type, target: "heading" }, { block: "image", label: "Media", icon: ImageIcon, target: "hero-image" }] },
  { id: "collection", label: "Card collection", description: "Work, products, or posts", icon: LayoutTemplate, target: "gallery", layers: [{ block: "heading", label: "Section heading", icon: Type, target: "heading" }, { block: "grid", label: "Card grid", icon: PanelTop, target: "gallery" }, { block: "card", label: "Project card", icon: LayoutTemplate, target: "gallery" }] },
  { id: "gallery", label: "Gallery", description: "Responsive image collection", icon: ImageIcon, target: "gallery", layers: [{ block: "grid", label: "Image grid", icon: PanelTop, target: "gallery" }, { block: "image", label: "Image", icon: ImageIcon, target: "gallery" }] },
  { id: "testimonials", label: "Testimonials", description: "Quotes and customer stories", icon: FileText, target: "gallery", layers: [{ block: "heading", label: "Heading", icon: Type, target: "heading" }, { block: "quote", label: "Quote", icon: FileText, target: "gallery" }] },
  { id: "stats", label: "Stats", description: "Key metrics in columns", icon: ListFilter, target: "gallery", layers: [{ block: "grid", label: "Metrics grid", icon: PanelTop, target: "gallery" }, { block: "stat", label: "Stat", icon: ListFilter, target: "gallery" }] },
  { id: "faq", label: "FAQ", description: "Expandable question list", icon: HelpCircle, target: "section", layers: [{ block: "heading", label: "Heading", icon: Type, target: "heading" }, { block: "accordion", label: "Questions", icon: HelpCircle, target: "section" }] },
  { id: "cta", label: "CTA", description: "Focused conversion block", icon: MousePointer2, target: "section", layers: [{ block: "heading", label: "Heading", icon: Type, target: "heading" }, { block: "text", label: "Description", icon: Type, target: "heading" }, { block: "button", label: "Button", icon: MousePointer2, target: "button" }] },
  { id: "contact", label: "Contact", description: "Form and contact details", icon: Mail, target: "section", layers: [{ block: "heading", label: "Heading", icon: Type, target: "heading" }, { block: "text", label: "Contact details", icon: Mail, target: "heading" }, { block: "form", label: "Contact form", icon: Mail, target: "section" }] },
  { id: "footer", label: "Footer", description: "Links, legal, and social", icon: PanelTop, target: "section", layers: [{ block: "footer", label: "Footer navigation", icon: PanelTop, target: "section" }, { block: "text", label: "Legal links", icon: FileText, target: "section" }] },
];

function defaultSectionChildContent(preset: SectionPresetId, index: number): BlockContent {
  if (preset === "hero") {
    return [
      { body: "Interior architecture" },
      { title: "Spaces for slower living." },
      { body: "Thoughtful interiors, natural materials, and a quieter kind of luxury made for the way you live." },
      { buttonLabel: "Explore our work ↗" },
      { imageUrl: "" },
    ][index] ?? {};
  }

  const section = sectionPresets.find((candidate) => candidate.id === preset);
  const block = section?.layers[index]?.block;
  return block ? defaultBlockContent(block) : {};
}

function sectionChildOrder(section: InsertedSection, preset: SectionPreset) {
  return section.childOrder?.length ? section.childOrder : preset.layers.map((_, index) => index);
}

type PersistedSiteDocument = {
  document: SiteDocument;
  selectedPageId: string | null;
};

function nodeFromBlock(block: InsertedBlock, parentId: string | null): EditorNode {
  return {
    childIds: [],
    content: block.content,
    id: block.id,
    parentId,
    styles: { base: {} },
    type: block.kind,
    visible: block.visible,
  };
}

function toPersistedSiteDocument(editorDocument: EditorDocument): PersistedSiteDocument {
  const pages: PageDocument[] = editorDocument.pages.map((page) => {
    const content = editorDocument.pageContent[page.id] ?? emptyPageContent;
    const nodes: Record<string, EditorNode> = {};
    const rootIds: string[] = [];

    content.insertedSections.forEach((section) => {
      const preset = sectionPresets.find((candidate) => candidate.id === section.preset);
      if (!preset) return;
      const childIds = sectionChildOrder(section, preset)
        .filter((index) => !section.deletedChildIndexes.includes(index))
        .map((index) => `${section.id}:child:${index}`);
      const addedChildIds = section.addedBlocks.map((block) => block.id);
      nodes[section.id] = {
        childIds: [...childIds, ...addedChildIds],
        content: {},
        id: section.id,
        metadata: { preset: section.preset },
        parentId: null,
        styles: { base: {} },
        type: "section",
        visible: section.visible,
      };
      sectionChildOrder(section, preset).forEach((index) => {
        if (section.deletedChildIndexes.includes(index)) return;
        const layer = preset.layers[index];
        const nodeId = `${section.id}:child:${index}`;
        nodes[nodeId] = {
          childIds: [],
          content: { ...defaultSectionChildContent(section.preset, index), ...section.childContent?.[index] },
          id: nodeId,
          metadata: { templateIndex: index },
          parentId: section.id,
          styles: { base: {} },
          type: layer.block,
          visible: !section.hiddenChildIndexes.includes(index),
        };
      });
      section.addedBlocks.forEach((block) => { nodes[block.id] = nodeFromBlock(block, section.id); });
      rootIds.push(section.id);
    });
    content.insertedBlocks.forEach((block) => {
      nodes[block.id] = nodeFromBlock(block, null);
      rootIds.push(block.id);
    });

    return {
      id: page.id,
      metadata: { preset: page.preset },
      name: page.name,
      nodes,
      rootIds,
      slug: page.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "page",
      title: page.name,
    };
  });
  return { document: { id: "forma-site", name: "Forma Studio", pages, updatedAt: "", version: 1 }, selectedPageId: editorDocument.selectedPageId };
}

function editorDocumentFromPersistedSiteDocument(persisted: PersistedSiteDocument): EditorDocument {
  const pages = persisted.document.pages.map((page) => {
    const presetId = typeof page.metadata?.preset === "string" && pagePresets.some((preset) => preset.id === page.metadata?.preset)
      ? page.metadata.preset as PagePresetId
      : "custom";
    const preset = pagePresets.find((candidate) => candidate.id === presetId) ?? pagePresets[pagePresets.length - 1];
    return { icon: preset.icon, id: page.id, name: page.name, preset: presetId };
  });
  const pageContent = Object.fromEntries(persisted.document.pages.map((page) => {
    const sections: InsertedSection[] = [];
    const blocks: InsertedBlock[] = [];
    page.rootIds.forEach((nodeId) => {
      const node = page.nodes[nodeId];
      if (!node) return;
      if (node.type !== "section" || typeof node.metadata?.preset !== "string") {
        blocks.push({ content: node.content, id: node.id, kind: node.type as QuickBlock, visible: node.visible });
        return;
      }
      const presetId = typeof node.metadata?.preset === "string" && sectionPresets.some((preset) => preset.id === node.metadata?.preset)
        ? node.metadata.preset as SectionPresetId
        : "hero";
      const preset = sectionPresets.find((candidate) => candidate.id === presetId)!;
      const templateNodes = node.childIds.map((childId) => page.nodes[childId]).filter((child): child is EditorNode => Boolean(child) && typeof child.metadata?.templateIndex === "number");
      const templateIndexes = templateNodes.map((child) => child.metadata?.templateIndex as number);
      const childContent = Object.fromEntries(templateNodes.map((child) => [child.metadata?.templateIndex as number, child.content]));
      const hiddenChildIndexes = templateNodes.filter((child) => !child.visible).map((child) => child.metadata?.templateIndex as number);
      const deletedChildIndexes = preset.layers.map((_, index) => index).filter((index) => !templateIndexes.includes(index));
      const addedBlocks = node.childIds.map((childId) => page.nodes[childId]).filter((child): child is EditorNode => Boolean(child) && child.metadata?.templateIndex === undefined).map((child) => ({ content: child.content, id: child.id, kind: child.type as QuickBlock, visible: child.visible }));
      sections.push({ addedBlocks, childContent, childOrder: templateIndexes, deletedChildIndexes, hiddenChildIndexes, id: node.id, preset: presetId, visible: node.visible });
    });
    return [page.id, { insertedBlocks: blocks, insertedSections: sections } satisfies PageContent];
  }));
  return { pageContent, pages, selectedPageId: pages.some((page) => page.id === persisted.selectedPageId) ? persisted.selectedPageId : pages[0]?.id ?? null };
}

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

type LayerDeleteDialogState = { childIndex?: number; label: string; layerId: string } | null;

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
  hasPage: boolean;
  insertedBlocks: InsertedBlock[];
  insertedSections: InsertedSection[];
  selected: SelectedNode;
  selectedBlock: InsertedBlock | null;
  selectedSectionChild: { block: QuickBlock; content: BlockContent; index: number; sectionId: string } | null;
  selectedLayerId: string | null;
  lastAction: string;
  choose: (node: SelectedNode, source: string, layerId?: string | null) => void;
  addBlock: (block: QuickBlock, source: string) => void;
  addBlockToSection: (sectionId: string, block: QuickBlock, source: string) => void;
  addSection: (section: SectionPreset, source: string) => void;
  isLayerCollapsed: (layerId: string) => boolean;
  moveSectionBlock: (sectionId: string, sourceBlockId: string, targetBlockId: string) => void;
  moveSectionChild: (sectionId: string, sourceChildIndex: number, targetChildIndex: number) => void;
  requestLayerDelete: (layerId: string, label: string) => void;
  requestSectionChildDelete: (sectionId: string, childIndex: number, label: string) => void;
  resize: (scope: string, layout: Record<string, number>) => void;
  toggleLayerCollapse: (layerId: string) => void;
  toggleLayerVisibility: (layerId: string) => void;
  toggleSectionChildVisibility: (sectionId: string, childIndex: number) => void;
  updateBlockContent: (blockId: string, content: BlockContent) => void;
  updateSectionChildContent: (sectionId: string, childIndex: number, content: BlockContent) => void;
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

function ProjectBar({ canRedo, canUndo, onRedo, onUndo }: { canRedo: boolean; canUndo: boolean; onRedo: () => void; onUndo: () => void }) {
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

function QuickInsert({ actions, rail = false }: { actions: EditorActions; rail?: boolean }) {
  const [library, setLibrary] = useState<"blocks" | "sections">("blocks");

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
            return (
              <Button
                className={
                  "h-auto cursor-grab border-zinc-200 bg-white p-0 font-normal text-zinc-900 shadow-none transition hover:border-orange-300 hover:bg-orange-50 active:cursor-grabbing disabled:cursor-not-allowed " +
                  (rail ? "w-24" : "")
                }
                disabled={!actions.hasPage}
                draggable={actions.hasPage}
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
      ) : (
        <div className="grid gap-1.5">
          {sectionPresets.map((section) => {
            const Icon = section.icon;
            return (
              <Button
                className="h-auto justify-start border-zinc-200 bg-white px-2.5 py-2 text-left font-normal text-zinc-900 shadow-none hover:border-orange-300 hover:bg-orange-50 disabled:cursor-not-allowed"
                disabled={!actions.hasPage}
                key={section.id}
                onClick={() => actions.addSection(section, "section library")}
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
          {actions.hasPage ? <><GripVertical className="size-3" /> Drag a block onto your page</> : "Add a page before inserting blocks or sections."}
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
              Delete {dialog.label}? This layer cannot be restored.
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

function LayerTreeItem({
  active,
  collapsed = false,
  collapsible = false,
  depth = 0,
  inheritedHidden = false,
  icon: Icon,
  label,
  onDelete,
  onDragOver,
  onDragStart,
  onDrop,
  onSelect,
  onToggleCollapse,
  onToggleVisibility,
  visible,
}: {
  active: boolean;
  collapsed?: boolean;
  collapsible?: boolean;
  depth?: number;
  inheritedHidden?: boolean;
  icon: LucideIcon;
  label: string;
  onDelete: () => void;
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: DragEvent<HTMLDivElement>) => void;
  onSelect: () => void;
  onToggleCollapse?: () => void;
  onToggleVisibility: () => void;
  visible: boolean;
}) {
  const visuallyHidden = inheritedHidden || !visible;

  return (
    <div
      className={
        "group flex h-8 items-center rounded-md transition " +
        (active ? "bg-orange-100 text-orange-600 hover:text-zinc-950" : "text-zinc-700 hover:bg-zinc-100")
      }
      draggable={Boolean(onDragStart)}
      onDragOver={onDragOver}
      onDragStart={onDragStart}
      onDrop={onDrop}
      style={{ paddingLeft: 8 + depth * 14 }}
    >
      {collapsible ? (
        <button
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
  const [layersScrolled, setLayersScrolled] = useState(false);

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
          <ScrollArea
            className="h-full"
            viewportProps={{
              onScroll: (event) => setLayersScrolled(event.currentTarget.scrollTop > 0),
            }}
          >
            <section className="min-h-full">
              <div
                className={
                  "sticky top-0 z-10 flex h-10 items-center justify-between border-b border-zinc-100 bg-white px-4 text-xs font-semibold transition-shadow " +
                  (layersScrolled ? "shadow-[0_4px_8px_rgba(24,24,27,0.12)]" : "shadow-none")
                }
              >
                <span>Layers</span>
                <ListFilter className="size-3 text-zinc-500" />
              </div>
              <div className="space-y-0.5 p-3 pt-2">
                {!actions.hasPage ? (
                <Empty className="min-h-32 gap-2 border-0 bg-zinc-50/70 p-3">
                  <EmptyHeader className="gap-1">
                    <EmptyTitle className="text-xs">No page selected</EmptyTitle>
                    <EmptyDescription className="text-[10px]">Add or select a page to view its layers.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : actions.insertedSections.length || actions.insertedBlocks.length ? (
                <div className="space-y-0.5">
                  {actions.insertedSections.map((insertedSection) => {
                    const section = sectionPresets.find((preset) => preset.id === insertedSection.preset);
                    if (!section) return null;
                    const Icon = section.icon;
                    const collapsed = actions.isLayerCollapsed(insertedSection.id);
                    return (
                      <div key={insertedSection.id}>
                        <LayerTreeItem
                          active={actions.selectedLayerId === insertedSection.id}
                          collapsed={collapsed}
                          collapsible
                          icon={Icon}
                          label={section.label}
                          onDelete={() => actions.requestLayerDelete(insertedSection.id, section.label)}
                          onSelect={() => actions.choose(section.target, "layer tree", insertedSection.id)}
                          onToggleCollapse={() => actions.toggleLayerCollapse(insertedSection.id)}
                          onToggleVisibility={() => actions.toggleLayerVisibility(insertedSection.id)}
                          visible={insertedSection.visible}
                        />
                        {!collapsed && <div className="ml-5 space-y-0.5 border-l border-zinc-200 pl-1.5">
                          {sectionChildOrder(insertedSection, section).map((layerIndex) => {
                            const layer = section.layers[layerIndex];
                            if (insertedSection.deletedChildIndexes.includes(layerIndex)) return null;
                            const blockDefinition = quickBlocks.find((block) => block.id === layer.block);
                            const LayerIcon = blockDefinition?.icon ?? layer.icon;
                            const layerId = `${insertedSection.id}:${layerIndex}`;
                            return <LayerTreeItem
                              active={actions.selectedLayerId === layerId}
                              depth={0}
                              icon={LayerIcon}
                              inheritedHidden={!insertedSection.visible}
                              key={layerId}
                              label={layer.label}
                              onDelete={() => actions.requestSectionChildDelete(insertedSection.id, layerIndex, layer.label)}
                              onDragOver={(event) => event.preventDefault()}
                              onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData(sectionChildDragType, `${insertedSection.id}:${layerIndex}`); }}
                              onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const [sourceSectionId, sourceIndex] = event.dataTransfer.getData(sectionChildDragType).split(":"); const sourceChildIndex = Number(sourceIndex); if (sourceSectionId === insertedSection.id && Number.isInteger(sourceChildIndex) && sourceChildIndex !== layerIndex) actions.moveSectionChild(insertedSection.id, sourceChildIndex, layerIndex); }}
                              onSelect={() => actions.choose(layer.target, "layer tree", layerId)}
                              onToggleVisibility={() => actions.toggleSectionChildVisibility(insertedSection.id, layerIndex)}
                              visible={!insertedSection.hiddenChildIndexes.includes(layerIndex)}
                            />;
                          })}
                          {insertedSection.addedBlocks.map((block) => {
                            const definition = quickBlocks.find((candidate) => candidate.id === block.kind);
                            if (!definition) return null;
                            const BlockIcon = definition.icon;
                            const target = blockTargets[block.kind];
                            return <LayerTreeItem active={actions.selectedLayerId === block.id} depth={0} icon={BlockIcon} inheritedHidden={!insertedSection.visible} key={block.id} label={definition.label} onDelete={() => actions.requestLayerDelete(block.id, definition.label)} onDragOver={(event) => event.preventDefault()} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData(sectionBlockDragType, `${insertedSection.id}:${block.id}`); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const [sourceSectionId, sourceBlockId] = event.dataTransfer.getData(sectionBlockDragType).split(":"); if (sourceSectionId === insertedSection.id && sourceBlockId && sourceBlockId !== block.id) actions.moveSectionBlock(insertedSection.id, sourceBlockId, block.id); }} onSelect={() => actions.choose(target, "layer tree", block.id)} onToggleVisibility={() => actions.toggleLayerVisibility(block.id)} visible={block.visible} />;
                          })}
                        </div>}
                      </div>
                    );
                  })}
                  {actions.insertedBlocks.map((block) => {
                    const definition = quickBlocks.find((candidate) => candidate.id === block.kind);
                    if (!definition) return null;
                    const Icon = definition.icon;
                    const target = blockTargets[block.kind];
                    return <LayerTreeItem active={actions.selectedLayerId === block.id} icon={Icon} key={block.id} label={definition.label} onDelete={() => actions.requestLayerDelete(block.id, definition.label)} onSelect={() => actions.choose(target, "layer tree", block.id)} onToggleVisibility={() => actions.toggleLayerVisibility(block.id)} visible={block.visible} />;
                  })}
                </div>
              ) : (
                <Empty className="min-h-32 gap-2 border-0 bg-zinc-50/70 p-3">
                  <EmptyHeader className="gap-1">
                    <EmptyTitle className="text-xs">No layers yet</EmptyTitle>
                    <EmptyDescription className="text-[10px]">Use Quick insert to add blocks or sections.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
              </div>
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

function PreviewSelectable({
  actions,
  children,
  className,
  draggable = false,
  layerId,
  onDragOver,
  onDragStart,
  onDrop,
  selected,
  style,
  target,
}: {
  actions: EditorActions;
  children: ReactNode;
  className: string;
  draggable?: boolean;
  layerId: string;
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: DragEvent<HTMLDivElement>) => void;
  selected: boolean;
  style?: CSSProperties;
  target: SelectedNode;
}) {
  return (
    <div
      aria-pressed={selected}
      className={
        (draggable ? "cursor-grab active:cursor-grabbing " : "cursor-pointer ") + "transition outline-none focus-visible:ring-2 focus-visible:ring-orange-500 " +
        (selected ? "relative z-10 ring-2 ring-orange-400 ring-offset-2" : "hover:ring-1 hover:ring-orange-300") +
        " " + className
      }
      draggable={draggable}
      onClick={(event) => {
        event.stopPropagation();
        actions.choose(target, "canvas", layerId);
      }}
      onDragOver={onDragOver}
      onDragStart={onDragStart}
      onDrop={onDrop}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          actions.choose(target, "canvas", layerId);
        }
      }}
      role="button"
      style={style}
      tabIndex={0}
    >
      {children}
    </div>
  );
}

function PreviewBlock({ actions, block, sectionId }: { actions: EditorActions; block: InsertedBlock; sectionId?: string }) {
  const selected = actions.selectedLayerId === block.id;
  const target = blockTargets[block.kind];
  const content = { ...defaultBlockContent(block.kind), ...block.content };
  const draggableProps = sectionId ? {
    draggable: true,
    onDragOver: (event: DragEvent<HTMLDivElement>) => event.preventDefault(),
    onDragStart: (event: DragEvent<HTMLDivElement>) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(sectionBlockDragType, `${sectionId}:${block.id}`);
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const [sourceSectionId, sourceBlockId] = event.dataTransfer.getData(sectionBlockDragType).split(":");
      if (sourceSectionId === sectionId && sourceBlockId && sourceBlockId !== block.id) {
        actions.moveSectionBlock(sectionId, sourceBlockId, block.id);
      }
    },
  } : {};
  const selectionProps = { actions, layerId: block.id, selected, target, ...draggableProps };

  switch (block.kind) {
    case "section":
      return <PreviewSelectable {...selectionProps} className="rounded-xl bg-[#f5f2ec] px-8 py-12 text-center"><p className="text-2xl font-semibold tracking-tight text-zinc-900">{content.title}</p><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-zinc-600">{content.body}</p></PreviewSelectable>;
    case "box":
      return <PreviewSelectable {...selectionProps} className="bg-white p-8"><Card className="border border-dashed border-zinc-300 bg-zinc-50 shadow-none"><CardContent className="p-8 text-center text-sm text-zinc-500">{content.body}</CardContent></Card></PreviewSelectable>;
    case "stack":
      return <PreviewSelectable {...selectionProps} className="bg-white p-8"><Card className="border border-zinc-200 shadow-none"><CardHeader><CardTitle>{content.title}</CardTitle><CardDescription>{content.body}</CardDescription></CardHeader><CardContent><div className="h-2 w-3/4 rounded-full bg-zinc-200" /></CardContent></Card></PreviewSelectable>;
    case "grid":
      return <PreviewSelectable {...selectionProps} className="bg-white p-6"><div className="grid grid-cols-3 gap-4">{["Discover", "Create", "Launch"].map((label, index) => <Card className="border border-zinc-200 bg-zinc-50 shadow-none" key={label}><CardContent className="p-5"><span className="text-xs text-zinc-400">0{index + 1}</span><p className="mt-6 text-sm font-semibold text-zinc-900">{label}</p></CardContent></Card>)}</div></PreviewSelectable>;
    case "heading":
      return <PreviewSelectable {...selectionProps} className="rounded-xl bg-white px-8 py-10"><h2 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-zinc-900">{content.title}</h2></PreviewSelectable>;
    case "text":
      return <PreviewSelectable {...selectionProps} className="rounded-xl bg-white px-8 py-6"><p className="max-w-2xl text-base leading-7 text-zinc-600">{content.body}</p></PreviewSelectable>;
    case "image":
      return <PreviewSelectable {...selectionProps} className="overflow-hidden rounded-xl"><div className={content.imageUrl ? "h-64 bg-cover bg-center" : "h-64 bg-linear-to-br from-[#d9d1c3] via-[#a8947c] to-[#4f584b]"} style={content.imageUrl ? { backgroundImage: `url(${content.imageUrl})` } : undefined}>{!content.imageUrl && <div className="h-full w-full bg-[radial-gradient(circle_at_70%_35%,rgba(255,255,255,.55),transparent_26%),radial-gradient(circle_at_25%_80%,rgba(36,46,39,.45),transparent_36%)]" />}</div></PreviewSelectable>;
    case "button":
      return <PreviewSelectable {...selectionProps} className="inline-flex"><Button className="bg-zinc-900 px-5 text-sm text-white hover:bg-zinc-800" type="button">{content.buttonLabel}</Button></PreviewSelectable>;
    case "divider":
      return <PreviewSelectable {...selectionProps} className="py-5"><Separator /></PreviewSelectable>;
    case "card":
      return <PreviewSelectable {...selectionProps} className="bg-zinc-50 p-6"><Card className="border border-zinc-200 bg-white shadow-none"><CardHeader><CardTitle>{content.title}</CardTitle><CardDescription>{content.body}</CardDescription></CardHeader><CardFooter><Button size="sm" variant="outline">{content.buttonLabel}</Button></CardFooter></Card></PreviewSelectable>;
    case "quote":
      return <PreviewSelectable {...selectionProps} className="bg-zinc-50 p-8"><Card className="border border-zinc-200 bg-white shadow-none"><CardContent className="p-8"><p className="text-2xl leading-tight tracking-[-0.03em] text-zinc-900">{content.body}</p><p className="mt-5 text-sm text-zinc-500">{content.title}</p></CardContent></Card></PreviewSelectable>;
    case "stat":
      return <PreviewSelectable {...selectionProps} className="bg-zinc-50 p-6"><Card className="border border-zinc-200 bg-white text-center shadow-none"><CardContent className="p-7"><p className="text-5xl font-semibold tracking-[-0.05em] text-zinc-900">{content.title}</p><p className="mt-2 text-sm text-zinc-500">{content.body}</p></CardContent></Card></PreviewSelectable>;
    case "accordion":
      return <PreviewSelectable {...selectionProps} className="bg-white p-6"><Accordion className="rounded-lg border border-zinc-200 px-4" defaultValue={["first"]}><AccordionItem value="first"><AccordionTrigger>{content.title}</AccordionTrigger><AccordionContent>{content.body}</AccordionContent></AccordionItem><AccordionItem value="second"><AccordionTrigger>How long does it take?</AccordionTrigger><AccordionContent>Timelines are shaped around your team, scope, and launch goals.</AccordionContent></AccordionItem></Accordion></PreviewSelectable>;
    case "form":
      return <PreviewSelectable {...selectionProps} className="bg-zinc-50 p-6"><Card className="border border-zinc-200 bg-white shadow-none"><CardHeader><CardTitle>{content.title}</CardTitle><CardDescription>{content.body}</CardDescription></CardHeader><CardContent className="grid gap-3"><Input placeholder="Your name" /><Input placeholder="you@example.com" /><Input placeholder="How can we help?" /></CardContent><CardFooter><Button>{content.buttonLabel}</Button></CardFooter></Card></PreviewSelectable>;
    case "navigation":
      return <PreviewSelectable {...selectionProps} className="bg-white p-4"><Card className="border border-zinc-200 bg-white shadow-none"><CardContent className="flex items-center justify-between p-4"><span className="font-semibold text-zinc-900">{content.title}</span><span className="flex gap-4 text-sm text-zinc-600"><span>Studio</span><span>Work</span><span>Journal</span></span><Button size="sm">{content.buttonLabel}</Button></CardContent></Card></PreviewSelectable>;
    case "footer":
      return <PreviewSelectable {...selectionProps} className="bg-zinc-950 p-6"><Card className="border-zinc-800 bg-zinc-950 text-zinc-200 shadow-none"><CardContent className="flex items-center justify-between p-4"><span className="font-semibold text-white">{content.title}</span><span className="text-xs text-zinc-500">{content.body}</span></CardContent></Card></PreviewSelectable>;
  }
}

function PreviewSection({ actions, section: insertedSection }: { actions: EditorActions; section: InsertedSection }) {
  const section = sectionPresets.find((preset) => preset.id === insertedSection.preset);
  if (!section) return null;
  const sectionPreset = section;
  const selected = actions.selectedLayerId === insertedSection.id;
  const visible = (index: number) => !insertedSection.deletedChildIndexes.includes(index) && !insertedSection.hiddenChildIndexes.includes(index);
  const selectionProps = { actions, layerId: insertedSection.id, selected, target: sectionPreset.target };
  const childContent = (index: number) => ({ ...defaultSectionChildContent(sectionPreset.id, index), ...insertedSection.childContent?.[index] });
  const childOrder = sectionChildOrder(insertedSection, sectionPreset);
  const childSelectionProps = (index: number) => ({
    actions,
    draggable: true,
    layerId: `${insertedSection.id}:${index}`,
    onDragOver: (event: DragEvent<HTMLDivElement>) => event.preventDefault(),
    onDragStart: (event: DragEvent<HTMLDivElement>) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(sectionChildDragType, `${insertedSection.id}:${index}`);
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const [sourceSectionId, sourceIndex] = event.dataTransfer.getData(sectionChildDragType).split(":");
      const sourceChildIndex = Number(sourceIndex);
      if (sourceSectionId === insertedSection.id && Number.isInteger(sourceChildIndex) && sourceChildIndex !== index) {
        actions.moveSectionChild(insertedSection.id, sourceChildIndex, index);
      }
    },
    selected: actions.selectedLayerId === `${insertedSection.id}:${index}`,
    style: { order: childOrder.indexOf(index) },
    target: sectionPreset.layers[index].target,
  });
  const addedBlocks = insertedSection.addedBlocks.filter((block) => block.visible);

  function renderPreset() {
    switch (sectionPreset.id) {
    case "navigation":
      return <PreviewSelectable {...selectionProps} className="flex items-center justify-between border-b border-zinc-200 bg-white px-8 py-5 text-sm">{visible(0) && <span className="text-lg font-semibold tracking-tight text-zinc-900">forma.</span>}{visible(1) && <span className="hidden items-center gap-6 text-zinc-600 sm:flex"><span>Our studio</span><span>Selected work</span><span>Journal</span></span>}{visible(2) && <span className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-white">Let&apos;s talk</span>}</PreviewSelectable>;
    case "hero":
      return <PreviewSelectable {...selectionProps} className="grid overflow-hidden bg-[#f5f0e8] md:grid-cols-[1.05fr_.95fr]"><div className="flex min-h-[23rem] flex-col justify-center p-9 md:p-14">{visible(0) && <PreviewSelectable {...childSelectionProps(0)} className="w-fit rounded-md"><span className="text-xs font-medium tracking-[0.18em] text-zinc-500 uppercase">{childContent(0).body}</span></PreviewSelectable>}{visible(1) && <PreviewSelectable {...childSelectionProps(1)} className="mt-5 max-w-xl rounded-md"><h1 className="text-5xl font-semibold tracking-[-0.06em] text-zinc-900 md:text-6xl">{childContent(1).title}</h1></PreviewSelectable>}{visible(2) && <PreviewSelectable {...childSelectionProps(2)} className="mt-5 max-w-md rounded-md"><p className="text-sm leading-6 text-zinc-600">{childContent(2).body}</p></PreviewSelectable>}{visible(3) && <PreviewSelectable {...childSelectionProps(3)} className="mt-7 inline-flex w-fit rounded-md"><span className="inline-flex rounded-md bg-zinc-900 px-4 py-3 text-sm font-medium text-white">{childContent(3).buttonLabel}</span></PreviewSelectable>}</div>{visible(4) && <PreviewSelectable {...childSelectionProps(4)} className="h-full min-h-[23rem] overflow-hidden"><div className={childContent(4).imageUrl ? "h-full min-h-[23rem] bg-cover bg-center" : "h-full min-h-[23rem] bg-linear-to-br from-[#8f765d] via-[#c7b08d] to-[#e6d9c5]"} style={childContent(4).imageUrl ? { backgroundImage: `url(${childContent(4).imageUrl})` } : undefined} /></PreviewSelectable>}</PreviewSelectable>;
    case "features":
      return <PreviewSelectable {...selectionProps} className="bg-white px-8 py-12">{visible(0) && <div className="max-w-xl"><p className="text-3xl font-semibold tracking-[-0.04em] text-zinc-900">Everything you need to make it memorable.</p><p className="mt-3 text-sm leading-6 text-zinc-600">Made for teams that care about every detail.</p></div>}{visible(1) && <div className="mt-8 grid gap-4 sm:grid-cols-3">{["Made to scale", "Built to adapt", "Easy to share"].map((title, index) => <div className="rounded-xl border border-zinc-200 p-5" key={title}><span className="text-xs text-zinc-400">0{index + 1}</span><p className="mt-7 text-base font-semibold text-zinc-900">{title}</p><p className="mt-2 text-xs leading-5 text-zinc-500">Flexible foundations for your next chapter.</p></div>)}</div>}</PreviewSelectable>;
    case "content-media":
      return <PreviewSelectable {...selectionProps} className="grid overflow-hidden bg-zinc-900 text-white md:grid-cols-2">{visible(0) && <div className="flex min-h-80 flex-col justify-center p-9 md:p-14"><span className="text-xs tracking-[0.18em] text-zinc-400 uppercase">Our approach</span>{visible(1) && <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em]">Details make the difference.</h2>}{visible(2) && <p className="mt-4 max-w-md text-sm leading-6 text-zinc-300">A thoughtful system creates a clear path from first impression to lasting connection.</p>}</div>}{visible(3) && <div className="min-h-80 bg-linear-to-bl from-[#d7c7af] via-[#887764] to-[#3f433d]" />}</PreviewSelectable>;
    case "collection":
      return <PreviewSelectable {...selectionProps} className="bg-[#f8f7f4] px-8 py-12">{visible(0) && <div className="flex items-end justify-between"><h2 className="text-3xl font-semibold tracking-[-0.04em] text-zinc-900">Selected spaces</h2><span className="text-xs text-zinc-500">View all work →</span></div>}{visible(1) && <div className="mt-7 grid gap-4 sm:grid-cols-3">{["Residences", "Hospitality", "Workplaces"].map((title, index) => <div key={title}><div className={(index === 1 ? "from-[#544b40] via-[#a99b87] to-[#e8dfcf]" : "from-[#d5c4ac] via-[#8e7159] to-[#455143]") + " h-40 rounded-lg bg-linear-to-br"} /><p className="mt-3 text-sm font-medium text-zinc-900">{title}</p><p className="mt-1 text-xs text-zinc-500">View project</p></div>)}</div>}</PreviewSelectable>;
    case "gallery":
      return <PreviewSelectable {...selectionProps} className="bg-white p-6">{visible(0) && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{["from-[#b6a58e] to-[#66584a]", "from-[#e2d9cc] to-[#9b8d78]", "from-[#717665] to-[#c8bea9]", "from-[#8d6d57] to-[#ded2be]"].map((colors, index) => <div className={(index % 2 ? "h-48" : "h-32") + " rounded-lg bg-linear-to-br " + colors} key={colors} />)}</div>}</PreviewSelectable>;
    case "testimonials":
      return <PreviewSelectable {...selectionProps} className="bg-[#f4efe6] px-8 py-14 text-center">{visible(0) && <span className="text-xs font-medium tracking-[0.18em] text-zinc-500 uppercase">What clients say</span>}{visible(1) && <div className="mx-auto mt-6 max-w-3xl"><p className="text-3xl font-medium leading-tight tracking-[-0.04em] text-zinc-900">“They gave us a system that feels completely ours—and the confidence to use it.”</p><p className="mt-5 text-sm text-zinc-600">Mia Petersen, Founder at Forma</p></div>}</PreviewSelectable>;
    case "stats":
      return <PreviewSelectable {...selectionProps} className="bg-zinc-900 px-8 py-12 text-white">{visible(0) && <div className="grid gap-8 text-center sm:grid-cols-3">{[["12", "years shaping spaces"], ["48", "projects completed"], ["06", "countries reached"]].map(([number, label]) => <div key={number}><p className="text-5xl font-semibold tracking-[-0.05em]">{number}</p><p className="mt-2 text-xs text-zinc-400">{label}</p></div>)}</div>}</PreviewSelectable>;
    case "faq":
      return <PreviewSelectable {...selectionProps} className="bg-white px-8 py-12">{visible(0) && <h2 className="text-3xl font-semibold tracking-[-0.04em] text-zinc-900">Frequently asked questions</h2>}{visible(1) && <div className="mt-7 divide-y divide-zinc-200 border-y border-zinc-200">{["What does a typical project look like?", "How long does the process take?", "Where do you work?"].map((question) => <div className="flex items-center justify-between py-4 text-sm text-zinc-800" key={question}>{question}<Plus className="size-4 text-zinc-400" /></div>)}</div>}</PreviewSelectable>;
    case "cta":
      return <PreviewSelectable {...selectionProps} className="bg-orange-500 px-8 py-14 text-center text-white">{visible(0) && <p className="mx-auto max-w-2xl text-4xl font-semibold tracking-[-0.05em]">Ready to make your next page feel like yours?</p>}{visible(1) && <p className="mt-4 text-sm text-orange-50">Build a site that is unmistakably your own.</p>}{visible(2) && <span className="mt-7 inline-flex rounded-md bg-white px-4 py-3 text-sm font-medium text-zinc-900">Start a project</span>}</PreviewSelectable>;
    case "contact":
      return <PreviewSelectable {...selectionProps} className="grid bg-white md:grid-cols-[.8fr_1.2fr]"><div className="bg-zinc-100 p-9"><p className="text-xs font-medium tracking-[0.18em] text-zinc-500 uppercase">Contact</p>{visible(0) && <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-zinc-900">Let&apos;s work together.</h2>}{visible(1) && <p className="mt-5 text-sm leading-6 text-zinc-600">hello@forma.studio<br />Copenhagen · Worldwide</p>}</div>{visible(2) && <Card className="m-6 border border-zinc-200 bg-white shadow-none"><CardContent className="grid gap-3 p-6"><Input placeholder="Your name" /><Input placeholder="you@example.com" /><Input placeholder="How can we help?" /></CardContent><CardFooter><Button>Send message</Button></CardFooter></Card>}</PreviewSelectable>;
      case "footer":
        return <PreviewSelectable {...selectionProps} className="bg-zinc-950 px-8 py-10 text-zinc-200">{visible(0) && <div className="flex flex-wrap items-start justify-between gap-8"><span className="text-xl font-semibold text-white">forma.</span><div className="flex gap-5 text-sm text-zinc-400"><span>Studio</span><span>Work</span><span>Journal</span></div></div>}{visible(1) && <div className="mt-10 flex justify-between border-t border-zinc-800 pt-5 text-xs text-zinc-500"><span>© 2026 Forma Studio</span><span>Privacy · Terms</span></div>}</PreviewSelectable>;
    }
  }

  return (
    <div
      className="relative"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const block = event.dataTransfer.getData("text/plain") as QuickBlock;
        if (quickBlocks.some((candidate) => candidate.id === block)) {
          actions.addBlockToSection(insertedSection.id, block, "section drop");
        }
      }}
    >
      {renderPreset()}
      {addedBlocks.length > 0 && <div className="border-t border-dashed border-zinc-300 bg-zinc-50 p-4"><p className="mb-3 text-xs font-medium text-zinc-500">Added blocks · drag to reorder</p><div className="space-y-3">{addedBlocks.map((block) => <PreviewBlock actions={actions} block={block} key={block.id} sectionId={insertedSection.id} />)}</div></div>}
    </div>
  );
}

function Artboard({ actions, artboardHeight, artboardRef, isResizing, viewport }: { actions: EditorActions; artboardHeight: number; artboardRef: React.RefObject<HTMLElement | null>; isResizing: boolean; viewport: CanvasViewport }) {
  const [dragging, setDragging] = useState(false);
  const compactPreview = viewport.width < 768;
  const narrowPreview = viewport.width < 510;
  const browserHeaderHeight = compactPreview ? 48 : 64;
  const hasVisibleContent = actions.insertedSections.some((section) => section.visible) || actions.insertedBlocks.some((block) => block.visible);

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
      <section className={hasVisibleContent ? "bg-white text-center" : "grid place-items-center bg-white text-center"} style={{ minHeight: artboardHeight - browserHeaderHeight }}>
        {hasVisibleContent ? (
          <div className="w-full text-left">
            {actions.insertedSections.filter((section) => section.visible).map((section) => <PreviewSection actions={actions} key={section.id} section={section} />)}
            {actions.insertedBlocks.filter((block) => block.visible).map((block) => <PreviewBlock actions={actions} block={block} key={block.id} />)}
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

function BlockContentEditor({ actions, block }: { actions: EditorActions; block: InsertedBlock }) {
  const content = { ...defaultBlockContent(block.kind), ...block.content };
  const showTitle = ["section", "stack", "heading", "card", "quote", "stat", "form", "navigation", "footer"].includes(block.kind);
  const showBody = ["section", "box", "stack", "text", "card", "quote", "stat", "accordion", "form", "footer"].includes(block.kind);
  const showButtonLabel = ["button", "card", "form", "navigation"].includes(block.kind);
  const showImageUrl = block.kind === "image";

  return (
    <div className="mt-4 space-y-3 border-t border-zinc-200 pt-4">
      <p className="text-[10px] font-semibold tracking-[0.08em] text-zinc-500 uppercase">Content</p>
      {showTitle && <label className="grid gap-1.5 text-[10px] font-medium text-zinc-600">Title<Input className="h-8 text-xs" onChange={(event) => actions.updateBlockContent(block.id, { title: event.target.value })} value={content.title ?? ""} /></label>}
      {showBody && <label className="grid gap-1.5 text-[10px] font-medium text-zinc-600">Description<textarea className="min-h-18 w-full resize-y rounded-md border border-zinc-200 bg-white px-2.5 py-2 text-xs leading-5 outline-none placeholder:text-zinc-400 focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-200" onChange={(event) => actions.updateBlockContent(block.id, { body: event.target.value })} value={content.body ?? ""} /></label>}
      {showButtonLabel && <label className="grid gap-1.5 text-[10px] font-medium text-zinc-600">Button label<Input className="h-8 text-xs" onChange={(event) => actions.updateBlockContent(block.id, { buttonLabel: event.target.value })} value={content.buttonLabel ?? ""} /></label>}
      {showImageUrl && <div className="grid gap-2"><label className="grid gap-1.5 text-[10px] font-medium text-zinc-600">Image URL<Input className="h-8 text-xs" onChange={(event) => actions.updateBlockContent(block.id, { imageUrl: event.target.value })} placeholder="https://..." value={content.imageUrl ?? ""} /></label><ImageUploadField onChange={(imageUrl) => actions.updateBlockContent(block.id, { imageUrl })} /></div>}
    </div>
  );
}

function SectionChildContentEditor({ actions, child }: { actions: EditorActions; child: NonNullable<EditorActions["selectedSectionChild"]> }) {
  const showTitle = ["section", "stack", "heading", "card", "quote", "stat", "form", "navigation", "footer"].includes(child.block);
  const showBody = ["section", "box", "stack", "text", "card", "quote", "stat", "accordion", "form", "footer"].includes(child.block);
  const showButtonLabel = ["button", "card", "form", "navigation"].includes(child.block);
  const showImageUrl = child.block === "image";
  const update = (content: BlockContent) => actions.updateSectionChildContent(child.sectionId, child.index, content);

  return (
    <div className="mt-4 space-y-3 border-t border-zinc-200 pt-4">
      <p className="text-[10px] font-semibold tracking-[0.08em] text-zinc-500 uppercase">Content</p>
      {showTitle && <label className="grid gap-1.5 text-[10px] font-medium text-zinc-600">Title<Input className="h-8 text-xs" onChange={(event) => update({ title: event.target.value })} value={child.content.title ?? ""} /></label>}
      {showBody && <label className="grid gap-1.5 text-[10px] font-medium text-zinc-600">Description<textarea className="min-h-18 w-full resize-y rounded-md border border-zinc-200 bg-white px-2.5 py-2 text-xs leading-5 outline-none placeholder:text-zinc-400 focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-200" onChange={(event) => update({ body: event.target.value })} value={child.content.body ?? ""} /></label>}
      {showButtonLabel && <label className="grid gap-1.5 text-[10px] font-medium text-zinc-600">Button label<Input className="h-8 text-xs" onChange={(event) => update({ buttonLabel: event.target.value })} value={child.content.buttonLabel ?? ""} /></label>}
      {showImageUrl && <div className="grid gap-2"><label className="grid gap-1.5 text-[10px] font-medium text-zinc-600">Image URL<Input className="h-8 text-xs" onChange={(event) => update({ imageUrl: event.target.value })} placeholder="https://..." value={child.content.imageUrl ?? ""} /></label><ImageUploadField onChange={(imageUrl) => update({ imageUrl })} /></div>}
    </div>
  );
}

function Inspector({ actions }: { actions: EditorActions }) {
  const selection = selectionDetails[actions.selected];
  const SelectionIcon = selection.icon;
  return (
    <aside className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-white">
      <div className="flex h-12 items-center border-b border-zinc-200 px-4 text-xs"><Tabs className="!h-full w-40 !gap-0" defaultValue="style"><TabsList className="!grid !h-full !w-full grid-cols-2 !gap-0 !p-0" variant="line"><TabsTrigger className="!flex !h-full !w-full !items-center !justify-center px-0 pb-0.5 text-xs data-active:text-zinc-950 after:!bottom-[-1.5px] after:z-10 after:h-0.5 after:bg-orange-600" value="style">Style</TabsTrigger><TabsTrigger className="!flex !h-full !w-full !items-center !justify-center px-0 pb-0.5 text-xs after:!bottom-[-1.5px] after:z-10 after:h-0.5 after:bg-orange-600" value="settings">Settings</TabsTrigger></TabsList></Tabs><MoreHorizontal className="ml-auto size-4 text-zinc-500" /></div>
      <ResizablePanelGroup className="min-h-0 flex-1" id="inspector-sections" onLayoutChanged={(layout, meta) => { if (meta.isUserInteraction) actions.resize("Inspector sections", layout); }} orientation="vertical">
        <ResizablePanel defaultSize="18" id="selection" minSize="120px"><ScrollArea className="h-full"><div className="border-b border-zinc-200 p-4"><div className="flex items-center gap-3"><div className="grid size-8 place-items-center rounded-md bg-orange-100 text-orange-600"><SelectionIcon className="size-4" /></div><div><p className="text-xs font-semibold">{selection.label}</p><p className="text-[10px] text-zinc-500">{selection.layer}</p></div></div><Button className="mt-3 w-full justify-between border-violet-300 bg-violet-50 text-[10px] text-violet-700 hover:bg-violet-100" size="sm" variant="outline">✦ {selection.label.toLowerCase().replace(" ", "-")} <ChevronDown className="size-3" /></Button><p className="mt-2 text-[9px] text-zinc-500">Inheriting 2 styles on Desktop</p>{actions.selectedBlock && <BlockContentEditor actions={actions} block={actions.selectedBlock} />}{actions.selectedSectionChild && <SectionChildContentEditor actions={actions} child={actions.selectedSectionChild} />}</div></ScrollArea></ResizablePanel>
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
  }, [viewport.width, actions.insertedBlocks.length, actions.insertedSections.length]);

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
  selectedPageId: string | null;
  variant: VariantKey;
  viewport: CanvasViewport;
}) {
  const showNavigator = !compact && variant !== "c";
  const showInspector = !compact && variant !== "b";
  return (
    <div className="builder-light-theme h-screen overflow-hidden bg-white text-zinc-900">
      <ProjectBar canRedo={canRedo} canUndo={canUndo} onRedo={onRedo} onUndo={onUndo} />
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
  const [pageContent, setPageContent] = useState<Record<string, PageContent>>({});
  const [compact, setCompact] = useState(false);
  const [viewport, setViewport] = useState<CanvasViewport>(canvasViewportPresets.desktop);
  const [pages, setPages] = useState<BuilderPage[]>(initialPages);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [pageDialog, setPageDialog] = useState<PageDialogState>(null);
  const [layerDeleteDialog, setLayerDeleteDialog] = useState<LayerDeleteDialogState>(null);
  const [pageNameDraft, setPageNameDraft] = useState("");
  const [history, setHistory] = useState<EditorDocument[]>([]);
  const [future, setFuture] = useState<EditorDocument[]>([]);
  const [documentReady, setDocumentReady] = useState(false);
  const pageSequenceRef = useRef(0);
  const contentSequenceRef = useRef(0);
  const previousDocumentRef = useRef<EditorDocument>({ pageContent: {}, pages: initialPages, selectedPageId: null });
  const restoringDocumentRef = useRef(false);
  const [collapsedLayerIds, setCollapsedLayerIds] = useState<string[]>([]);
  const changeVariant = useCallback((variant: VariantKey) => { const next = new URLSearchParams(searchParams.toString()); next.set("variant", variant); router.replace(pathname + "?" + next.toString(), { scroll: false }); setLastAction("Switched to " + variants[variant].name); }, [pathname, router, searchParams]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const restoreDocument = useCallback((document: EditorDocument) => {
    restoringDocumentRef.current = true;
    setPages(document.pages);
    setPageContent(document.pageContent);
    setSelectedPageId(document.selectedPageId);
    setSelectedLayerId(null);
  }, []);
  const undo = useCallback(() => {
    const previous = history.at(-1);
    if (!previous) return;
    const currentDocument: EditorDocument = { pageContent, pages, selectedPageId };
    setHistory((entries) => entries.slice(0, -1));
    setFuture((entries) => [currentDocument, ...entries].slice(0, 50));
    restoreDocument(previous);
    setLastAction("Undid last change");
  }, [history, pageContent, pages, restoreDocument, selectedPageId]);
  const redo = useCallback(() => {
    const next = future[0];
    if (!next) return;
    const currentDocument: EditorDocument = { pageContent, pages, selectedPageId };
    setFuture((entries) => entries.slice(1));
    setHistory((entries) => [...entries, currentDocument].slice(-50));
    restoreDocument(next);
    setLastAction("Redid last change");
  }, [future, pageContent, pages, restoreDocument, selectedPageId]);
  const choose = useCallback((node: SelectedNode, source: string, layerId: string | null = null) => { setSelected(node); setSelectedLayerId(layerId); setLastAction("Selected " + selectionDetails[node].label + " from " + source); }, []);
  const addBlock = useCallback((block: QuickBlock, source: string) => {
    if (!selectedPageId) {
      setLastAction("Add a page before inserting blocks");
      return;
    }
    const insertedBlock: InsertedBlock = { content: defaultBlockContent(block), id: `block-${contentSequenceRef.current += 1}`, kind: block, visible: true };
    setPageContent((currentContent) => {
      const content = currentContent[selectedPageId] ?? emptyPageContent;
      return {
        ...currentContent,
        [selectedPageId]: { ...content, insertedBlocks: [...content.insertedBlocks, insertedBlock] },
      };
    });
    choose(blockTargets[block], source + " · added " + block, insertedBlock.id);
  }, [choose, selectedPageId]);
  const addBlockToSection = useCallback((sectionId: string, block: QuickBlock, source: string) => {
    if (!selectedPageId) return;
    const insertedBlock: InsertedBlock = { content: defaultBlockContent(block), id: `block-${contentSequenceRef.current += 1}`, kind: block, visible: true };
    setPageContent((currentContent) => {
      const content = currentContent[selectedPageId] ?? emptyPageContent;
      return {
        ...currentContent,
        [selectedPageId]: {
          ...content,
          insertedSections: content.insertedSections.map((section) => section.id === sectionId
            ? { ...section, addedBlocks: [...section.addedBlocks, insertedBlock] }
            : section),
        },
      };
    });
    choose(blockTargets[block], source + " · added " + block, insertedBlock.id);
  }, [choose, selectedPageId]);
  const moveSectionBlock = useCallback((sectionId: string, sourceBlockId: string, targetBlockId: string) => {
    if (!selectedPageId || sourceBlockId === targetBlockId) return;
    setPageContent((currentContent) => {
      const content = currentContent[selectedPageId] ?? emptyPageContent;
      return {
        ...currentContent,
        [selectedPageId]: {
          ...content,
          insertedSections: content.insertedSections.map((section) => {
            if (section.id !== sectionId) return section;
            const sourceIndex = section.addedBlocks.findIndex((block) => block.id === sourceBlockId);
            const targetIndex = section.addedBlocks.findIndex((block) => block.id === targetBlockId);
            if (sourceIndex < 0 || targetIndex < 0) return section;
            const addedBlocks = [...section.addedBlocks];
            const [movedBlock] = addedBlocks.splice(sourceIndex, 1);
            addedBlocks.splice(sourceIndex < targetIndex ? targetIndex - 1 : targetIndex, 0, movedBlock);
            return { ...section, addedBlocks };
          }),
        },
      };
    });
    setSelectedLayerId(sourceBlockId);
    setLastAction("Reordered section block");
  }, [selectedPageId]);
  const moveSectionChild = useCallback((sectionId: string, sourceChildIndex: number, targetChildIndex: number) => {
    if (!selectedPageId || sourceChildIndex === targetChildIndex) return;
    setPageContent((currentContent) => {
      const content = currentContent[selectedPageId] ?? emptyPageContent;
      return {
        ...currentContent,
        [selectedPageId]: {
          ...content,
          insertedSections: content.insertedSections.map((section) => {
            if (section.id !== sectionId) return section;
            const preset = sectionPresets.find((candidate) => candidate.id === section.preset);
            if (!preset) return section;
            const childOrder = [...sectionChildOrder(section, preset)];
            const sourceIndex = childOrder.indexOf(sourceChildIndex);
            const targetIndex = childOrder.indexOf(targetChildIndex);
            if (sourceIndex < 0 || targetIndex < 0) return section;
            const [movedChild] = childOrder.splice(sourceIndex, 1);
            childOrder.splice(sourceIndex < targetIndex ? targetIndex - 1 : targetIndex, 0, movedChild);
            return { ...section, childOrder };
          }),
        },
      };
    });
    setSelectedLayerId(`${sectionId}:${sourceChildIndex}`);
    setLastAction("Reordered section content");
  }, [selectedPageId]);
  const updateBlockContent = useCallback((blockId: string, contentUpdate: BlockContent) => {
    if (!selectedPageId) return;
    setPageContent((currentContent) => {
      const content = currentContent[selectedPageId] ?? emptyPageContent;
      const update = (block: InsertedBlock) => block.id === blockId
        ? { ...block, content: { ...block.content, ...contentUpdate } }
        : block;
      return {
        ...currentContent,
        [selectedPageId]: {
          insertedBlocks: content.insertedBlocks.map(update),
          insertedSections: content.insertedSections.map((section) => ({ ...section, addedBlocks: section.addedBlocks.map(update) })),
        },
      };
    });
    setLastAction("Updated block content");
  }, [selectedPageId]);
  const updateSectionChildContent = useCallback((sectionId: string, childIndex: number, contentUpdate: BlockContent) => {
    if (!selectedPageId) return;
    setPageContent((currentContent) => {
      const content = currentContent[selectedPageId] ?? emptyPageContent;
      return {
        ...currentContent,
        [selectedPageId]: {
          ...content,
          insertedSections: content.insertedSections.map((section) => section.id === sectionId
            ? { ...section, childContent: { ...section.childContent, [childIndex]: { ...section.childContent?.[childIndex], ...contentUpdate } } }
            : section),
        },
      };
    });
    setLastAction("Updated section content");
  }, [selectedPageId]);
  const addSection = useCallback((section: SectionPreset, source: string) => {
    if (!selectedPageId) {
      setLastAction("Add a page before inserting sections");
      return;
    }
    const insertedSection: InsertedSection = { addedBlocks: [], childContent: {}, childOrder: section.layers.map((_, index) => index), deletedChildIndexes: [], hiddenChildIndexes: [], id: `section-${contentSequenceRef.current += 1}`, preset: section.id, visible: true };
    setPageContent((currentContent) => {
      const content = currentContent[selectedPageId] ?? emptyPageContent;
      return {
        ...currentContent,
        [selectedPageId]: { ...content, insertedSections: [...content.insertedSections, insertedSection] },
      };
    });
    choose(section.target, source + " · added " + section.label, insertedSection.id);
  }, [choose, selectedPageId]);
  const resize = useCallback((scope: string, layout: Record<string, number>) => { const dimensions = Object.entries(layout).map(([id, size]) => `${id} ${Math.round(size)}%`).join(" · "); setLastAction(`${scope} resized · ${dimensions}`); }, []);
  const changeViewport = useCallback((nextViewport: CanvasViewport) => { setViewport(nextViewport); setLastAction(`Canvas changed to ${nextViewport.label} · ${nextViewport.width} px`); }, []);
  const isLayerCollapsed = useCallback((layerId: string) => collapsedLayerIds.includes(layerId), [collapsedLayerIds]);
  const toggleLayerCollapse = useCallback((layerId: string) => {
    setCollapsedLayerIds((currentIds) => currentIds.includes(layerId) ? currentIds.filter((id) => id !== layerId) : [...currentIds, layerId]);
  }, []);
  const toggleLayerVisibility = useCallback((layerId: string) => {
    if (!selectedPageId) return;
    setPageContent((currentContent) => {
      const content = currentContent[selectedPageId] ?? emptyPageContent;
      return {
        ...currentContent,
        [selectedPageId]: {
          insertedBlocks: content.insertedBlocks.map((block) => block.id === layerId ? { ...block, visible: !block.visible } : block),
          insertedSections: content.insertedSections.map((section) => section.id === layerId
            ? { ...section, visible: !section.visible }
            : { ...section, addedBlocks: section.addedBlocks.map((block) => block.id === layerId ? { ...block, visible: !block.visible } : block) }),
        },
      };
    });
  }, [selectedPageId]);
  const toggleSectionChildVisibility = useCallback((sectionId: string, childIndex: number) => {
    if (!selectedPageId) return;
    setPageContent((currentContent) => {
      const content = currentContent[selectedPageId] ?? emptyPageContent;
      return {
        ...currentContent,
        [selectedPageId]: {
          ...content,
          insertedSections: content.insertedSections.map((section) => {
            if (section.id !== sectionId) return section;
            const hiddenChildIndexes = section.hiddenChildIndexes.includes(childIndex)
              ? section.hiddenChildIndexes.filter((index) => index !== childIndex)
              : [...section.hiddenChildIndexes, childIndex];
            return { ...section, hiddenChildIndexes };
          }),
        },
      };
    });
  }, [selectedPageId]);
  const removeLayer = useCallback((layerId: string) => {
    if (!selectedPageId) return;
    setPageContent((currentContent) => {
      const content = currentContent[selectedPageId] ?? emptyPageContent;
      return {
        ...currentContent,
        [selectedPageId]: {
          insertedBlocks: content.insertedBlocks.filter((block) => block.id !== layerId),
          insertedSections: content.insertedSections
            .filter((section) => section.id !== layerId)
            .map((section) => ({ ...section, addedBlocks: section.addedBlocks.filter((block) => block.id !== layerId) })),
        },
      };
    });
    setCollapsedLayerIds((currentIds) => currentIds.filter((id) => id !== layerId));
    setSelectedLayerId((currentId) => currentId === layerId || currentId?.startsWith(`${layerId}:`) ? null : currentId);
    setLastAction("Deleted layer");
  }, [selectedPageId]);
  const requestLayerDelete = useCallback((layerId: string, label: string) => {
    setLayerDeleteDialog({ layerId, label });
  }, []);
  const requestSectionChildDelete = useCallback((sectionId: string, childIndex: number, label: string) => {
    setLayerDeleteDialog({ childIndex, label, layerId: sectionId });
  }, []);
  const removeSectionChild = useCallback((sectionId: string, childIndex: number) => {
    if (!selectedPageId) return;
    setPageContent((currentContent) => {
      const content = currentContent[selectedPageId] ?? emptyPageContent;
      return {
        ...currentContent,
        [selectedPageId]: {
          ...content,
          insertedSections: content.insertedSections.map((section) => section.id === sectionId
            ? { ...section, deletedChildIndexes: [...section.deletedChildIndexes, childIndex], hiddenChildIndexes: section.hiddenChildIndexes.filter((index) => index !== childIndex) }
            : section),
        },
      };
    });
    setSelectedLayerId((currentId) => currentId === `${sectionId}:${childIndex}` ? null : currentId);
    setLastAction("Deleted layer");
  }, [selectedPageId]);
  const confirmLayerDelete = useCallback(() => {
    if (!layerDeleteDialog) return;
    if (layerDeleteDialog.childIndex === undefined) {
      removeLayer(layerDeleteDialog.layerId);
    } else {
      removeSectionChild(layerDeleteDialog.layerId, layerDeleteDialog.childIndex);
    }
    setLayerDeleteDialog(null);
  }, [layerDeleteDialog, removeLayer, removeSectionChild]);
  const selectPage = useCallback((page: BuilderPage) => { setSelectedPageId(page.id); setSelectedLayerId(null); setLastAction(`Selected ${page.name} page`); }, []);
  const addPage = useCallback((preset: PagePreset) => {
    const page: BuilderPage = {
      id: `${preset.id}-${pageSequenceRef.current += 1}`,
      icon: preset.icon,
      name: uniquePageName(preset.name, pages),
      preset: preset.id,
    };
    setPages((currentPages) => [...currentPages, page]);
    setSelectedPageId(page.id);
    setSelectedLayerId(null);
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
    setPageContent((currentContent) => Object.fromEntries(Object.entries(currentContent).filter(([pageId]) => pageId !== page.id)));
    if (selectedPageId === page.id) {
      setSelectedPageId(remainingPages[Math.min(pageIndex, remainingPages.length - 1)]?.id ?? null);
      setSelectedLayerId(null);
    }
    setLastAction(`Deleted ${page.name}`);
    closePageDialog();
  }, [closePageDialog, pageDialog, pageNameDraft, pages, selectedPageId]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedDocument = loadStoredDocument();
      if (storedDocument) {
        previousDocumentRef.current = storedDocument;
        pageSequenceRef.current = storedDocument.pages.length;
        contentSequenceRef.current = Object.values(storedDocument.pageContent).reduce((count, content) => count + content.insertedBlocks.length + content.insertedSections.length + content.insertedSections.reduce((childCount, section) => childCount + section.addedBlocks.length, 0), 0);
        setPages(storedDocument.pages);
        setPageContent(storedDocument.pageContent);
        setSelectedPageId(storedDocument.selectedPageId);
      }
      setDocumentReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (!documentReady) return;
    const currentDocument: EditorDocument = { pageContent, pages, selectedPageId };
    const currentSnapshot = JSON.stringify(serializableDocument(currentDocument));
    const previousSnapshot = JSON.stringify(serializableDocument(previousDocumentRef.current));
    if (restoringDocumentRef.current) {
      restoringDocumentRef.current = false;
    } else if (currentSnapshot !== previousSnapshot) {
      setHistory((entries) => [...entries, previousDocumentRef.current].slice(-50));
      setFuture([]);
    }
    previousDocumentRef.current = currentDocument;
    try {
      const persisted = serializableDocument(currentDocument);
      window.localStorage.setItem(editorStorageKey, JSON.stringify({ ...persisted, document: { ...persisted.document, updatedAt: new Date().toISOString() } }));
    } catch {}
  }, [documentReady, pageContent, pages, selectedPageId]);
  useEffect(() => { const media = window.matchMedia("(max-width: 899px)"); const sync = () => setCompact(media.matches); sync(); media.addEventListener("change", sync); return () => media.removeEventListener("change", sync); }, []);
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
  useEffect(() => { if (!showVariantSwitcher) return; function handleKeyDown(event: KeyboardEvent) { const target = event.target as HTMLElement | null; if (target?.closest("input, textarea, [contenteditable='true'], [role='separator']")) return; if (event.key === "ArrowLeft") changeVariant(adjacentVariant(current, -1)); if (event.key === "ArrowRight") changeVariant(adjacentVariant(current, 1)); } window.addEventListener("keydown", handleKeyDown); return () => window.removeEventListener("keydown", handleKeyDown); }, [changeVariant, current, showVariantSwitcher]);
  const selectedPage = pages.find((page) => page.id === selectedPageId) ?? null;
  const activePageContent = selectedPageId ? pageContent[selectedPageId] ?? emptyPageContent : emptyPageContent;
  const selectedBlock = activePageContent.insertedBlocks.find((block) => block.id === selectedLayerId)
    ?? activePageContent.insertedSections.flatMap((section) => section.addedBlocks).find((block) => block.id === selectedLayerId)
    ?? null;
  const selectedSectionChild = activePageContent.insertedSections.flatMap((section) => {
    const preset = sectionPresets.find((candidate) => candidate.id === section.preset);
    return preset?.layers.map((layer, index) => ({ block: layer.block, content: { ...defaultSectionChildContent(section.preset, index), ...section.childContent?.[index] }, index, sectionId: section.id })) ?? [];
  }).find((child) => `${child.sectionId}:${child.index}` === selectedLayerId) ?? null;
  const actions: EditorActions = { hasPage: Boolean(selectedPage), insertedBlocks: activePageContent.insertedBlocks, insertedSections: activePageContent.insertedSections, selected, selectedBlock, selectedSectionChild, selectedLayerId, lastAction, choose, addBlock, addBlockToSection, addSection, isLayerCollapsed, moveSectionBlock, moveSectionChild, requestLayerDelete, requestSectionChildDelete, resize, toggleLayerCollapse, toggleLayerVisibility, toggleSectionChildVisibility, updateBlockContent, updateSectionChildContent };
  const dialogPage = pageDialog ? pages.find((page) => page.id === pageDialog.pageId) ?? null : null;
  return <><FormaVariant actions={actions} canRedo={future.length > 0} canUndo={history.length > 0} compact={compact} onAddPage={addPage} onDeletePage={deletePage} onRedo={redo} onRenamePage={renamePage} onSelectPage={selectPage} onUndo={undo} onViewportChange={changeViewport} page={selectedPage} pages={pages} selectedPageId={selectedPageId} variant={current} viewport={viewport} /><PageManagementDialog dialog={pageDialog} draftName={pageNameDraft} onClose={closePageDialog} onConfirm={confirmPageDialog} onDraftNameChange={setPageNameDraft} page={dialogPage} /><LayerDeleteDialog dialog={layerDeleteDialog} onClose={() => setLayerDeleteDialog(null)} onConfirm={confirmLayerDelete} />{showVariantSwitcher && <PrototypeSwitcher current={current} onChange={changeVariant} />}</>;
}
