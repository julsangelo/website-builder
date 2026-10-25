"use client";

import * as React from "react";
import {
  AlignLeft,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  File,
  Home,
  Image as ImageIcon,
  LayoutPanelTop,
  MoreHorizontal,
  MousePointer2,
  PanelBottom,
  Rows3,
  SquareDashed,
  Type,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const pages = [
  { id: "home", name: "Home", icon: Home },
  { id: "studio", name: "Our studio", icon: File },
  { id: "work", name: "Selected work", icon: File },
  { id: "contact", name: "Contact", icon: File },
]

export function PagesList() {
  const [activeId, setActiveId] = React.useState("home")

  return (
    <ScrollArea className="min-h-0 flex-1">
      <ul className="flex flex-col gap-0.5 px-3">
        {pages.map((page) => {
          const isActive = page.id === activeId
          const Icon = page.icon

          return (
            <li
              key={page.id}
              data-active={isActive}
              className={cn(
                "group/row flex items-center rounded-md text-xs",
                "hover:bg-muted",
                "data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
              )}
            >
              <Button
                type="button"
                variant="ghost"
                onClick={() => setActiveId(page.id)}
                className="h-auto min-w-0 flex-1 justify-start gap-2 rounded-none px-2 py-1.5 text-left font-normal hover:bg-transparent"
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{page.name}</span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "mr-1 size-6 shrink-0 opacity-0",
                        "group-hover/row:opacity-100",
                        "group-data-[active=true]/row:opacity-100",
                        "data-[state=open]:opacity-100"
                      )}
                    />
                  }
                >
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem>Rename</DropdownMenuItem>
                  <DropdownMenuItem>Duplicate</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          )
        })}
      </ul>
    </ScrollArea>
  )
}

type Layer = {
  id: string
  name: string
  icon: React.ElementType
  children?: Layer[]
}

const layers: Layer[] = [
  { id: "nav", name: "Navigation", icon: LayoutPanelTop },
  {
    id: "hero",
    name: "Hero section",
    icon: Rows3,
    children: [
      {
        id: "content",
        name: "Content",
        icon: SquareDashed,
        children: [
          { id: "eyebrow", name: "Eyebrow", icon: Type },
          { id: "heading", name: "Hero heading", icon: Type },
          { id: "description", name: "Description", icon: AlignLeft },
          { id: "cta", name: "Explore our work", icon: MousePointer2 },
        ],
      },
      { id: "hero-image", name: "Hero image", icon: ImageIcon },
    ],
  },
  {
    id: "spaces",
    name: "Selected spaces",
    icon: Rows3,
    children: [{ id: "spaces-title", name: "Title", icon: Type }],
  },
  { id: "footer", name: "Footer", icon: PanelBottom },
]

type LayerRowProps = {
  layer: Layer
  depth: number
  activeId: string
  expanded: Set<string>
  hidden: Set<string>
  onSelect: (id: string) => void
  onToggleExpand: (id: string) => void
  onToggleHidden: (id: string) => void
}

function LayerRow({
  layer,
  depth,
  activeId,
  expanded,
  hidden,
  onSelect,
  onToggleExpand,
  onToggleHidden,
}: LayerRowProps) {
  const Icon = layer.icon
  const hasChildren = !!layer.children?.length
  const isOpen = expanded.has(layer.id)
  const isActive = layer.id === activeId
  const isHidden = hidden.has(layer.id)

  return (
    <li>
      <div
        data-active={isActive}
        style={{ paddingLeft: depth * 16 + 4 }}
        className={cn(
          "group/row flex items-center rounded-md pr-1 text-xs",
          "hover:bg-muted",
          "data-[active=true]:bg-primary/10 data-[active=true]:text-primary",
          isHidden && "opacity-50"
        )}
      >
        {hasChildren ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onToggleExpand(layer.id)}
            className="size-5 shrink-0 rounded-sm p-0"
            aria-label={isOpen ? "Collapse layer" : "Expand layer"}
          >
            {isOpen ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </Button>
        ) : (
          <span className="size-5 shrink-0" />
        )}

        <Button
          type="button"
          variant="ghost"
          onClick={() => onSelect(layer.id)}
          className="h-auto min-w-0 flex-1 justify-start gap-2 rounded-none py-1.5 text-left font-normal hover:bg-transparent"
        >
          <Icon className="size-4 shrink-0" />
          <span className="truncate">{layer.name}</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onToggleHidden(layer.id)}
          className={cn(
            "size-6 shrink-0 opacity-0",
            "group-hover/row:opacity-100",
            "group-data-[active=true]/row:opacity-100",
            isHidden && "opacity-100"
          )}
        >
          {isHidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </div>

      {hasChildren && isOpen && (
        <ul className="flex flex-col gap-0.5">
          {layer.children!.map((child) => (
            <LayerRow
              key={child.id}
              layer={child}
              depth={depth + 1}
              activeId={activeId}
              expanded={expanded}
              hidden={hidden}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onToggleHidden={onToggleHidden}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function toggleInSet(set: Set<string>, id: string) {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

export function LayersTree() {
  const [activeId, setActiveId] = React.useState("heading")
  const [expanded, setExpanded] = React.useState(
    () => new Set(["hero", "content", "spaces"])
  )
  const [hidden, setHidden] = React.useState<Set<string>>(() => new Set())

  return (
    <ScrollArea className="min-h-0 flex-1">
      <ul className="flex flex-col gap-0.5 px-3">
        {layers.map((layer) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            depth={0}
            activeId={activeId}
            expanded={expanded}
            hidden={hidden}
            onSelect={setActiveId}
            onToggleExpand={(id) => setExpanded((s) => toggleInSet(s, id))}
            onToggleHidden={(id) => setHidden((s) => toggleInSet(s, id))}
          />
        ))}
      </ul>
    </ScrollArea>
  )
}
