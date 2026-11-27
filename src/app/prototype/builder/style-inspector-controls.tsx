import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { StyleValues } from "@/lib/builder-document";

export function StyleInspectorSection({ title, children }: { title: string; children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const id = useId();

  return (
    <ScrollArea
      className="h-full"
      viewportProps={{
        onScroll: (event) => setScrolled(event.currentTarget.scrollTop > 0),
        style: { scrollPaddingTop: "2.5rem" },
      }}
    >
      <section className="min-h-full">
        <Button
          aria-controls={id}
          aria-expanded={expanded}
          className={
            "sticky top-0 z-10 h-10 w-full justify-between rounded-none border-b border-zinc-100 bg-white px-4 text-xs font-semibold text-zinc-950 transition-shadow hover:bg-white aria-expanded:bg-white " +
            (scrolled ? "shadow-[0_4px_8px_rgba(24,24,27,0.12)]" : "shadow-none")
          }
          onClick={() => setExpanded(!expanded)}
          variant="ghost"
        >
          {title}
          <ChevronDown aria-hidden="true" className={`size-3.5 text-zinc-500 ${expanded ? "" : "-rotate-90"}`} />
        </Button>
        <div className="space-y-2 p-4" hidden={!expanded} id={id}>{children}</div>
      </section>
    </ScrollArea>
  );
}

export function CssValueInput({ id, property, value: resolved, hint, onChange, pixelUnits = false }: {
  id: string;
  property: keyof StyleValues;
  value?: string | number;
  hint: string;
  pixelUnits?: boolean;
  onChange: (value: string) => void;
}) {
  const value = typeof resolved === "number" && pixelUnits ? `${resolved}px` : String(resolved ?? "");
  const cssProperty = property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  const [draft, setDraft] = useState<{ source: string; text: string; invalid: boolean } | null>(null);
  const activeDraft = draft?.source === value ? draft : null;
  const errorId = `${id}-error`;
  return (
    <div className="min-w-0">
      <Input
        aria-describedby={activeDraft?.invalid ? errorId : undefined}
        aria-invalid={activeDraft?.invalid || undefined}
        className="bg-zinc-50 text-xs md:text-xs"
        id={id}
        onBlur={() => setDraft(null)}
        onChange={(event) => {
          const text = event.target.value;
          const candidate = text.trim();
          const valid = !/[;{}\\]/.test(candidate) && CSS.supports(cssProperty, candidate);
          setDraft({ source: valid ? candidate : value, text, invalid: !valid });
          if (valid && candidate !== value) onChange(candidate);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !activeDraft?.invalid) event.currentTarget.blur();
          if (event.key === "Escape") setDraft(null);
        }}
        placeholder="Default"
        spellCheck={false}
        value={activeDraft?.text ?? value}
      />
      {activeDraft?.invalid && (
        <p className="mt-1 text-xs text-destructive" id={errorId}>
          {hint}
        </p>
      )}
    </div>
  );
}
