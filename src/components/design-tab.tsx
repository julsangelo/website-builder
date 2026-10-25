"use client"

import * as React from "react"
import {
    AlignLeft,
    ChevronDown,
    ChevronRight,
    CircleHelp,
    Eye,
    EyeOff,
    File,
    Grip,
    Home,
    Image as ImageIcon,
    LayoutPanelTop,
    ListFilter,
    MoreHorizontal,
    MousePointer2,
    PanelBottom,
    Plus,
    RectangleEllipsis,
    Rows3,
    Search,
    SlidersHorizontal,
    SquareDashed,
    Type,
} from "lucide-react"
import { cn } from "cn"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./ui/resizable"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { ScrollArea } from "./ui/scroll-area"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu"

/* -------------------------------------------------------------------------- */
/*                                    Pages                                   */
/* -------------------------------------------------------------------------- */

const pages = [
    { id: "home", name: "Home", icon: Home },
    { id: "studio", name: "Our studio", icon: File },
    { id: "work", name: "Selected work", icon: File },
    { id: "contact", name: "Contact", icon: File },
]

function PagesList() {
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
                            <button
                                type="button"
                                onClick={() => setActiveId(page.id)}
                                className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                            >
                                <Icon className="size-4 shrink-0" />
                                <span className="truncate">{page.name}</span>
                            </button>

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

/* -------------------------------------------------------------------------- */
/*                                   Layers                                   */
/* -------------------------------------------------------------------------- */

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
                {/* Chevron (spacer keeps leaf rows aligned) */}
                {hasChildren ? (
                    <button
                        type="button"
                        onClick={() => onToggleExpand(layer.id)}
                        className="flex size-5 shrink-0 items-center justify-center rounded-sm"
                    >
                        {isOpen ? (
                            <ChevronDown className="size-3.5" />
                        ) : (
                            <ChevronRight className="size-3.5" />
                        )}
                    </button>
                ) : (
                    <span className="size-5 shrink-0" />
                )}

                <button
                    type="button"
                    onClick={() => onSelect(layer.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
                >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{layer.name}</span>
                </button>

                {/* Visibility toggle: sibling of the buttons, not nested */}
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

function LayersTree() {
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

/* -------------------------------------------------------------------------- */
/*                                Quick Insert                                */
/* -------------------------------------------------------------------------- */

const blocks = [
    { id: "section", name: "Section", icon: LayoutPanelTop },
    { id: "heading", name: "Heading", icon: Type },
    { id: "image", name: "Image", icon: ImageIcon },
    { id: "button", name: "Button", icon: RectangleEllipsis },
]

function QuickInsert() {
    const [query, setQuery] = React.useState("")

    const filtered = blocks.filter((block) =>
        block.name.toLowerCase().includes(query.trim().toLowerCase())
    )

    return (
        <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-3 px-3 pt-1.5">
                {/* Search */}
                <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search blocks..."
                        className="h-8 border-transparent bg-muted pr-10 pl-8 text-xs shadow-none"
                    />
                    <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[10px] text-muted-foreground">
                        ⌘K
                    </kbd>
                </div>

                {/* Blocks */}
                {filtered.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                        {filtered.map((block) => {
                            const Icon = block.icon

                            return (
                                <div
                                    key={block.id}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData("application/x-block", block.id)
                                        e.dataTransfer.effectAllowed = "copy"
                                    }}
                                    className={cn(
                                        "flex cursor-grab flex-col items-center justify-center gap-2 rounded-lg border py-4 text-xs",
                                        "text-muted-foreground transition-colors",
                                        "hover:bg-muted hover:text-foreground active:cursor-grabbing"
                                    )}
                                >
                                    <Icon className="size-5" />
                                    <span>{block.name}</span>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                        No blocks found
                    </p>
                )}

                {/* Hint */}
                <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Grip className="size-3.5" />
                    Drag a block onto your page
                </p>
            </div>
        </ScrollArea>
    )
}

export default function DesignTab() {
    return (
        <div className="flex h-full min-h-0 flex-col">
            <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
                <ResizablePanel className="p-1.5" defaultSize="34%" minSize="44px" maxSize="92%">
                    <div className="flex h-full flex-col">
                        <div className="flex shrink-0 items-center justify-between pl-1.5">
                            <h4 className="text-xs">Pages</h4>
                            <Button variant="ghost" size="icon">
                                <Plus />
                            </Button>
                        </div>
                        <PagesList />
                    </div>
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel className="p-1.5" defaultSize="33%" minSize="44px" maxSize="92%">
                    <div className="flex h-full flex-col">
                        <div className="flex shrink-0 items-center justify-between pl-1.5">
                            <h4 className="text-xs">Layers</h4>
                            <Button variant="ghost" size="icon">
                                <ListFilter />
                            </Button>
                        </div>
                        <LayersTree />
                    </div>
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel className="p-1.5" defaultSize="33%" minSize="44px" maxSize="92%">
                    <div className="flex h-full flex-col">
                        <div className="flex shrink-0 items-center justify-between pl-1.5">
                            <h4 className="text-xs">Quick Insert</h4>
                            <Button variant="ghost" size="icon">
                                <SlidersHorizontal />
                            </Button>
                        </div>
                        <QuickInsert />
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
            <div className="shrink-0 border-t p-1.5">
                <Button variant='ghost' className='text-xs text-muted-foreground'>
                    <CircleHelp className="size-4" />
                    Help & keyboard shortcuts
                </Button>
            </div>
        </div>
    )
}