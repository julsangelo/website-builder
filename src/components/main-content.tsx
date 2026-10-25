import LeftPanel from "./left-panel";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./ui/resizable";

export default function MainContent() {
  return (
    <ResizablePanelGroup
      orientation="horizontal"
    >
        <LeftPanel/>
        <ResizableHandle />
        <ResizablePanel defaultSize='80%'>
            dasdasds
        </ResizablePanel>
        <ResizableHandle withHandle />
    </ResizablePanelGroup>
  )
}
