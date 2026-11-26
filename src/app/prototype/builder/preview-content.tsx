import { type FocusEvent, type KeyboardEvent, type MouseEvent, useCallback, useRef, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { NodeContent } from "@/lib/builder-document";

type TextField = "title" | "body" | "buttonLabel";
type TextInput = HTMLInputElement | HTMLTextAreaElement;

export function PreviewText({
  as: Element = "span", className = "", field, label, multiline = true, value = "", onCommit,
}: {
  as?: "h1" | "h2" | "p" | "span";
  className?: string;
  field: TextField;
  label: string;
  multiline?: boolean;
  value?: string;
  onCommit: (content: NodeContent) => void;
}) {
  const [session, setSession] = useState<{ initial: string; caret?: number } | null>(null);
  const finished = useRef(false);
  const focusInput = useCallback((input: TextInput | null) => {
    if (!input || !session) return;
    input.focus({ preventScroll: true });
    if (session.caret === undefined) input.select();
    else input.setSelectionRange(session.caret, session.caret);
  }, [session]);

  function start(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();
    if (session) return;
    event.preventDefault();
    const { clientX, clientY, currentTarget } = event;
    const position = document.caretPositionFromPoint?.(clientX, clientY);
    const range = position ? null : document.caretRangeFromPoint?.(clientX, clientY);
    const textNode = position?.offsetNode ?? range?.startContainer;
    const caret = textNode && currentTarget.contains(textNode) && textNode.nodeType === Node.TEXT_NODE
      ? position?.offset ?? range?.startOffset
      : undefined;
    finished.current = false;
    const initial = multiline ? value.replace(/\r\n?/g, "\n") : value.replace(/[\r\n]/g, "");
    setSession({ initial, caret });
  }

  function finish(input: TextInput, commit: boolean, restoreFocus = false) {
    if (!session || finished.current) return;
    finished.current = true;
    if (commit && input.value !== session.initial) onCommit({ [field]: input.value });
    setSession(null);
    if (restoreFocus) input.closest<HTMLElement>("[data-node-id]")?.focus({ preventScroll: true });
  }

  function handleKeyDown(event: KeyboardEvent<TextInput>) {
    if (event.nativeEvent.isComposing) return;
    const cancel = event.key === "Escape";
    const submit = event.key === "Enter" && (event.ctrlKey || event.metaKey);
    if (!cancel && !submit) return;
    event.preventDefault();
    event.stopPropagation();
    finish(event.currentTarget, submit, true);
  }

  const inputProps = {
    "aria-label": label,
    defaultValue: session?.initial,
    onBlur: (event: FocusEvent<TextInput>) => finish(event.currentTarget, true),
    onClick: (event: MouseEvent<TextInput>) => event.stopPropagation(),
    onKeyDown: handleKeyDown,
    ref: focusInput,
  };
  const inputClass = "field-sizing-content min-w-[1ch] max-w-full cursor-text bg-transparent px-0 text-inherit outline-none [font:inherit]";

  return (
    <Element
      className={`${multiline ? "whitespace-pre-wrap wrap-break-word " : ""}${className}${value || session ? "" : " min-h-[1lh] min-w-[1ch]"}`}
      onDoubleClick={start}
    >
      {session ? multiline
        ? <textarea {...inputProps} className={`${inputClass} block w-full resize-none`} rows={1} />
        : <input {...inputProps} className={inputClass} type="text" />
        : value}
    </Element>
  );
}

export function ButtonLinkControl({ content, onCommit }: {
  content: NodeContent;
  onCommit: (content: NodeContent) => void;
}) {
  const [open, setOpen] = useState(false);
  const urlInput = useRef<HTMLInputElement>(null);
  const href = content.href ?? "";
  const target = content.target === "_blank" ? "_blank" : "_self";

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label="Edit button link"
        className="absolute bottom-full left-0 z-10 grid size-7 place-items-center rounded-tl-md bg-white text-zinc-700 shadow-sm hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-orange-600"
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <Link2 aria-hidden="true" className="size-4" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="end" className="z-50" sideOffset={6}>
          <Popover.Popup className="w-60 rounded-lg border border-zinc-200 bg-white p-3 text-zinc-900 shadow-lg" initialFocus={urlInput}>
            <Popover.Title className="mb-2 text-xs font-semibold">Button link</Popover.Title>
            <form
              className="grid gap-2 text-xs"
              onDoubleClick={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onSubmit={(event) => {
                event.preventDefault();
                const fields = new FormData(event.currentTarget);
                const nextHref = String(fields.get("href") ?? "").trim();
                const nextTarget = fields.get("target") === "_blank" ? "_blank" : "_self";
                if (nextHref !== href || nextTarget !== target) onCommit({ href: nextHref, target: nextTarget });
                setOpen(false);
              }}
            >
              <label className="grid gap-1">URL
                <Input className="text-xs md:text-xs" defaultValue={href} name="href" placeholder="/contact" ref={urlInput} />
              </label>
              <label className="grid gap-1">Open in
                <select className="h-8 rounded-lg border border-input bg-transparent px-2 focus-visible:outline-orange-500" defaultValue={target} name="target">
                  <option value="_self">Same tab</option>
                  <option value="_blank">New tab</option>
                </select>
              </label>
              <Button className="justify-self-end" size="xs" type="submit">Save link</Button>
            </form>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
