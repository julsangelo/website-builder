import LeftPanel from "@/components/left-panel";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

export default function MainContent() {
  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="min-h-0 flex-1"
    >
      <LeftPanel />
      <ResizableHandle />
      <ResizablePanel defaultSize="80%" className="min-w-0">
        <main className="flex h-full items-center justify-center bg-muted/30">
          <div className="flex h-[80%] w-[90%] items-center justify-center rounded-lg border bg-background text-sm text-muted-foreground">
            Your page canvas
          </div>
        </main>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
