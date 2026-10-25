import { Search } from "lucide-react";
import DesignTab from "@/components/design-tab";
import { Button } from "@/components/ui/button";
import { ResizablePanel } from "@/components/ui/resizable";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export default function LeftPanel() {
  return (
    <ResizablePanel
      defaultSize="20%"
      minSize="15%"
      maxSize="30%"
      className="h-full border-r"
    >
      <Tabs defaultValue="design" className="h-full gap-0">
        <div className="flex items-center justify-between border-b p-2">
          <TabsList variant="line">
            <TabsTrigger value="design" className="group-data-[orientation=horizontal]/tabs:after:-bottom-3 text-xs">
              Design
            </TabsTrigger>
            <TabsTrigger value="assets" className="group-data-[orientation=horizontal]/tabs:after:-bottom-3 text-xs">
              Assets
            </TabsTrigger>
          </TabsList>
          <Button variant="ghost" size="icon" aria-label="Search">
            <Search size={16} />
          </Button>
        </div>
        <TabsContent value="design" className="min-h-0 flex-1">
          <DesignTab />
        </TabsContent>
        <TabsContent
          value="assets"
          className="p-4 text-xs text-muted-foreground"
        >
          Assets will appear here.
        </TabsContent>
      </Tabs>
    </ResizablePanel>
  );
}
