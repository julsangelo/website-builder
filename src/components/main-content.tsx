import { Layers, Maximize2, Minus, Plus } from "lucide-react";
import LeftPanel from "@/components/left-panel";
import PreviewPanel from "@/components/preview-panel";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

export default function MainContent() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <LeftPanel />
        <ResizableHandle withHandle />
        <ResizablePanel
          defaultSize="65%"
          minSize="50%"
          maxSize="70%"
          className="min-w-0"
        >
          <PreviewPanel />
        </ResizablePanel>
      </ResizablePanelGroup>
      <footer className="flex h-7 shrink-0 items-center justify-between border-t bg-background px-3 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <Layers className="size-3" />
          <span>Home</span>
          <span>›</span>
          <span>Hero section</span>
          <span>›</span>
          <span className="text-foreground">Preview</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" aria-label="Zoom out">
            <Minus className="size-3" />
          </Button>
          <span className="min-w-8 text-center">81%</span>
          <Button variant="ghost" size="icon-xs" aria-label="Zoom in">
            <Plus className="size-3" />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="Fit to screen">
            <Maximize2 className="size-3" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
