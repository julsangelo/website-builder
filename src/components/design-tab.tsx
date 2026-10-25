"use client";

import {
    AlignLeft,
    ChevronDown,
    ChevronRight,
    CircleHelp,
    Eye,
    EyeOff,
    File,
    Home,
    ListFilter,
    MoreHorizontal,
    MousePointer2,
    PanelBottom,
    Plus,
    Rows3,
    SlidersHorizontal,
    SquareDashed,
} from "lucide-react"
import QuickInsert from "@/components/quick-insert";
import { LayersTree, PagesList } from "@/components/design-panel-sections";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";

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
                <Button variant='ghost' className="text-xs text-muted-foreground">
                    <CircleHelp className="size-4" />
                    Help & keyboard shortcuts
                </Button>
            </div>
        </div>
    )
}
