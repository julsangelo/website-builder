import { ChevronDown, CloudCheck, Home, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Header() {
  return (
    <header className="z-10 flex h-10 shrink-0 items-center justify-between border-b bg-background px-3">
      <div className="flex items-center gap-2 text-xs">
        <Button variant="ghost" size="icon-sm" aria-label="Home">
          <Home className="size-3.5" />
        </Button>
        <span className="font-medium">Home</span>
        <ChevronDown className="size-3 text-muted-foreground" />
        <span className="text-muted-foreground">/</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="mr-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CloudCheck className="size-3.5" />
          <span>All changes saved</span>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Undo">
          <Undo2 className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Redo">
          <Redo2 className="size-3.5" />
        </Button>
      </div>
    </header>
  );
}
