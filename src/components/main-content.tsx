import LeftPanel from "@/components/left-panel";
import PreviewPanel from "@/components/preview-panel";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

export default function MainContent() {
  return (
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
  );
}
