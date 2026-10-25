import { CircleQuestionMark, Search } from "lucide-react";
import { ResizablePanel } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DesignTab from "@/components/design-tab";
import { Button } from "@/components/ui/button";

export default function LeftPanel() {
  return (
    <ResizablePanel defaultSize="15%" minSize="15%" maxSize="30%" className="border-l h-screen">
        <Tabs defaultValue="design" className="h-full gap-0">
            <div className="flex items-center justify-between border-b p-2">
                <TabsList variant="line">
                    <TabsTrigger
                        value="design"
                        className="group-data-[orientation=horizontal]/tabs:after:-bottom-3 text-xs"
                    >
                        Design
                    </TabsTrigger>
                    <TabsTrigger
                        value="assets"
                        className="group-data-[orientation=horizontal]/tabs:after:-bottom-3 text-xs"
                    >
                        Assets
                    </TabsTrigger>
                </TabsList>
                <Button variant="ghost" size="icon">
                    <Search size="16"/>
                </Button>
            </div>
            <TabsContent value="design" className="flex-1">
                <DesignTab />
            </TabsContent>
        </Tabs>
    </ResizablePanel>
  )
}
