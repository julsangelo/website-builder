"use client";

import * as React from "react";
import { Grip, Image as ImageIcon, LayoutPanelTop, RectangleEllipsis, Search, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

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

        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Grip className="size-3.5" />
          Drag a block onto your page
        </p>
      </div>
    </ScrollArea>
  )
}
export default QuickInsert;
