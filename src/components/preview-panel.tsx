"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Code2,
  Expand,
  Globe,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Smartphone,
  Tablet,
  Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PreviewPanel() {
  const [device, setDevice] = useState("desktop");
  const [width, setWidth] = useState("1200 px");

  return (
    <section className="flex h-full min-h-0 flex-col bg-[#f5f5f6]">
      <div className="flex h-11 shrink-0 items-center justify-between border-b bg-background px-3">
        <div className="flex items-center gap-2 text-xs">
          <Button variant="ghost" size="icon-sm" aria-label="Home">
            <Globe className="size-3.5" />
          </Button>
          <span className="font-medium">Home</span>
          <span className="text-muted-foreground">⌄</span>
          <span className="text-muted-foreground">/</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={device === "desktop" ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Desktop preview"
            onClick={() => setDevice("desktop")}
          >
            <Monitor className="size-3.5" />
          </Button>
          <Button
            variant={device === "tablet" ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Tablet preview"
            onClick={() => setDevice("tablet")}
          >
            <Tablet className="size-3.5" />
          </Button>
          <Button
            variant={device === "mobile" ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Mobile preview"
            onClick={() => setDevice("mobile")}
          >
            <Smartphone className="size-3.5" />
          </Button>
          <div className="mx-2 h-5 w-px bg-border" />
          <Select value={width} onValueChange={setWidth}>
            <SelectTrigger className="h-7 w-[104px] border-0 bg-transparent text-xs shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1440 px">1440 px</SelectItem>
              <SelectItem value="1200 px">1200 px</SelectItem>
              <SelectItem value="1024 px">1024 px</SelectItem>
              <SelectItem value="768 px">768 px</SelectItem>
              <SelectItem value="390 px">390 px</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="View code">
            <Code2 className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="More options">
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-3 pt-4 sm:px-8">
        <div className="mb-3 flex shrink-0 items-center justify-between text-[11px] text-muted-foreground">
          <span>Home · {device === "desktop" ? "Desktop" : device === "tablet" ? "Tablet" : "Mobile"}</span>
          <span>{width.replace(" px", "")} × Auto</span>
        </div>

        <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto">
          <div
            className="flex h-full min-h-[360px] max-h-full flex-col overflow-hidden rounded-xl border border-[#d9d9dc] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-[width] duration-200"
            style={{ width: device === "mobile" ? "390px" : device === "tablet" ? "768px" : "100%", maxWidth: "100%" }}
          >
            <div className="flex h-10 shrink-0 items-center gap-3 border-b bg-[#f7f7f8] px-3">
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                <span className="size-2.5 rounded-full bg-[#febc2e]" />
                <span className="size-2.5 rounded-full bg-[#28c840]" />
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <ArrowLeft className="size-3.5" />
                <ArrowRight className="size-3.5 opacity-40" />
                <RefreshCw className="size-3" />
              </div>
              <div className="mx-auto flex h-6 min-w-0 max-w-[520px] flex-1 items-center justify-center gap-1.5 rounded-md border bg-white px-3 text-[10px] text-muted-foreground shadow-sm">
                <LockKeyhole className="size-2.5" />
                <span className="truncate">yourwebsite.com</span>
              </div>
              <Button variant="ghost" size="icon-xs" aria-label="Open preview">
                <Expand className="size-3" />
              </Button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center bg-white">
              <div className="flex max-w-xs flex-col items-center gap-2 px-6 text-center">
                <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
                  <Globe className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">Your website preview</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Your page will appear here as you build it.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none flex h-12 shrink-0 items-end justify-center">
          <div className="pointer-events-auto flex items-center gap-1 rounded-xl border bg-background p-1 shadow-lg">
            <Button variant="secondary" size="icon-sm" aria-label="Select tool">
              <span className="text-sm">↖</span>
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Pan tool">
              <span className="text-sm">✋</span>
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Add element">
              <Plus className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Comments">
              <span className="text-sm">▱</span>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
