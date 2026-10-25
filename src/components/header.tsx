import Link from "next/link";
import { CloudCheck, Play, Redo2, Undo2 } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const pages = [
  { label: "Apple", value: "apple" },
  { label: "Banana", value: "banana" },
  { label: "Blueberry", value: "blueberry" },
  { label: "Grapes", value: "grapes" },
  { label: "Pineapple", value: "pineapple" },
];

export default function Header() {
  return (
    <header className="flex items-center justify-between border-b px-5 py-3">
      <div className="flex items-center gap-5">
        <Link href="/">
          <Avatar size="lg" shape="square">
            <AvatarImage
              src="https://github.com/shadcn.png"
              alt="Workspace logo"
            />
            <AvatarFallback>WB</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Workspace</span>
          <span className="text-sm text-muted-foreground">/</span>
          <Select variant="ghost" defaultValue="apple">
            <SelectTrigger className="p-0 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {pages.map((page) => (
                <SelectItem key={page.value} value={page.value}>
                  {page.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Separator orientation="vertical" className="my-1" />
        <div className="flex text-muted-foreground">
          <Button variant="ghost" size="icon" aria-label="Undo">
            <Undo2 />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Redo">
            <Redo2 />
          </Button>
        </div>
        <div className="flex items-center gap-2.5 text-muted-foreground">
          <CloudCheck size={20} />
          <span className="text-sm">All changes saved</span>
        </div>
      </div>
      <div className="flex items-center gap-5">
        <AvatarGroup>
          <Avatar>
            <AvatarImage
              src="https://github.com/shadcn.png"
              alt="@shadcn"
            />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarImage
              src="https://github.com/maxleiter.png"
              alt="@maxleiter"
            />
            <AvatarFallback>LR</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarImage
              src="https://github.com/evilrabbit.png"
              alt="@evilrabbit"
            />
            <AvatarFallback>ER</AvatarFallback>
          </Avatar>
          <AvatarGroupCount>+3</AvatarGroupCount>
        </AvatarGroup>
        <Button variant="outline" size="lg">
          <Play />
          Preview
        </Button>
        <Button size="lg">Publish</Button>
      </div>
    </header>
  );
}
