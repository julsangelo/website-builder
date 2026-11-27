import { useId, useState, type ReactNode } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Breakpoint, EditorNode, StyleValues } from "@/lib/builder-document";

export function StyleInspectorSection({ title, children }: { title: string; children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const id = useId();

  return (
    <ScrollArea
      className="h-full [&_[data-slot=scroll-area-content]]:w-full"
      viewportProps={{
        onScroll: (event) => setScrolled(event.currentTarget.scrollTop > 0),
        style: { scrollPaddingTop: "2.5rem" },
      }}
    >
      <section className="@container min-h-full min-w-0">
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

export function CssValueInput({ id, property, value: resolved, hint, onChange, normalize, pixelUnits = false }: {
  id: string;
  property: keyof StyleValues;
  value?: string | number;
  hint: string;
  normalize?: (value: string) => string | undefined;
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
          const input = text.trim();
          const candidate = normalize ? normalize(input) : input;
          const valid = candidate !== undefined && !/[;{}\\]/.test(candidate) && CSS.supports(cssProperty, candidate);
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

export function InspectorField({ label, id, node, breakpoint, properties, onReset, children }: {
  label: string;
  id?: string;
  node: EditorNode;
  breakpoint: Breakpoint;
  properties: readonly (keyof StyleValues)[];
  onReset: () => void;
  children: ReactNode;
}) {
  const local = properties.some((key) => Object.hasOwn(node.styles[breakpoint] ?? {}, key));
  const inherited = breakpoint !== "base" && properties.some((key) =>
    Object.hasOwn(node.styles.base, key) || (breakpoint === "mobile" && Object.hasOwn(node.styles.tablet ?? {}, key)));
  return (
    <div className="min-w-0 space-y-1" role="group" aria-label={label}>
      <div className="flex min-h-5 flex-wrap items-center gap-x-2 text-[11px]">
        <label htmlFor={id} className="font-medium text-zinc-700">{label}</label>
        <span className="ml-auto text-zinc-500">{local ? (breakpoint === "base" ? "Set" : "Override") : inherited ? "Inherited" : "Default"}</span>
        {local && <Button aria-label={`Reset ${label}`} title={breakpoint === "base" ? "Reset to default" : "Reset to inherited"}
          variant="ghost" size="icon-sm" className="size-6 text-zinc-500 hover:text-orange-600" onClick={onReset}>
          <RotateCcw className="size-3" />
        </Button>}
      </div>
      {children}
    </div>
  );
}

export function AdvancedControls({ children }: { children: ReactNode }) {
  return <details className="min-w-0 border-t border-zinc-200 pt-2">
    <summary className="cursor-pointer rounded text-xs font-medium text-zinc-700 focus-visible:outline-ring">Advanced</summary>
    <div className="mt-3 space-y-3">{children}</div>
  </details>;
}

export function InspectorChoices({ label, options, value, onChange }: {
  label: string;
  options: readonly { value: string; label: string; icon?: ReactNode; hint?: string }[];
  value?: string;
  onChange: (value: string) => void;
}) {
  return <div role="group" aria-label={label} className="flex flex-wrap gap-1">
    {options.map((option) => <Button key={option.value} size="sm" variant="outline"
      aria-pressed={value === option.value} title={option.hint ?? option.label}
      className="h-7 gap-1 px-2 text-[11px] aria-pressed:border-orange-400 aria-pressed:bg-orange-50 aria-pressed:text-orange-800"
      onClick={() => onChange(option.value)}>{option.icon}{option.label}</Button>)}
  </div>;
}

export function InspectorNumber({ label, value, onChange, signed = false, count = false, placeholder }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  signed?: boolean;
  count?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState<{ source: string; text: string; invalid: boolean } | null>(null);
  const active = draft?.source === value ? draft : null;
  return <div className="min-w-0 flex-1">
    <Input aria-label={label} aria-invalid={active?.invalid || undefined} aria-describedby={active?.invalid ? id : undefined}
      inputMode={count ? "numeric" : "decimal"} className="h-8 min-w-0 bg-zinc-50 text-xs md:text-xs"
      value={active?.text ?? value} placeholder={placeholder} onBlur={() => setDraft(null)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setDraft(null);
        if (event.key === "Enter" && !active?.invalid) event.currentTarget.blur();
      }}
      onChange={(event) => {
        const text = event.target.value;
        const number = Number(text);
        const valid = /^-?(?:\d+\.?\d*|\.\d+)$/.test(text) && Number.isFinite(number)
          && (signed || number >= 0) && (!count || (Number.isSafeInteger(number) && number >= 1 && number <= 1000));
        const next = String(number);
        setDraft({ source: valid ? next : value, text, invalid: !valid });
        if (valid && next !== value) onChange(next);
      }} />
    {active?.invalid && <p id={id} className="mt-1 text-xs text-destructive">
      {count ? "Enter a whole number from 1 to 1000." : signed ? "Enter a number." : "Enter zero or a positive number."}
    </p>}
  </div>;
}
