import { type CSSProperties, type FormEvent, useEffect, useRef, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { NodeContent } from "@/lib/builder-document";

export const objectFits = ["cover", "contain", "fill", "none", "scale-down"] as const;
export type ImageFit = typeof objectFits[number];
export type ImageEdit = { imageUrl?: string; alt: string; objectFit: ImageFit };

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject();
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function PreviewImage({ content, objectFit, objectPosition, placeholderClassName, selected, onSelect, onCommit, standalone }: {
  content: NodeContent;
  objectFit: CSSProperties["objectFit"];
  objectPosition: CSSProperties["objectPosition"];
  placeholderClassName: string;
  selected: boolean;
  onSelect: () => void;
  onCommit: (edit: ImageEdit) => void;
  standalone: boolean;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const showEditor = selected && open;

  return (
    <Popover.Root open={showEditor} onOpenChange={setOpen}>
      <div
        className={`relative min-h-0 flex-1 overflow-hidden rounded-[inherit] ${content.imageUrl ? "" : placeholderClassName}`}
        data-image-surface
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onSelect();
          setOpen(true);
        }}
      >
        {content.imageUrl ? (
          // User-supplied URLs and data URLs load directly in the browser.
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={content.alt ?? ""} className="absolute inset-0 block size-full" draggable={false} src={content.imageUrl} style={{ objectFit: objectFit ?? "cover", objectPosition }} />
        ) : standalone && (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_35%,rgba(255,255,255,.55),transparent_26%),radial-gradient(circle_at_25%_80%,rgba(36,46,39,.45),transparent_36%)]" />
        )}
      </div>
      {selected && (
        <Popover.Trigger
          aria-label="Edit image"
          className="absolute top-0 left-0 z-10 grid size-7 place-items-center rounded-br-md bg-white text-zinc-700 shadow-sm hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-orange-600"
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          ref={trigger}
        >
          <Pencil aria-hidden="true" className="size-4" />
        </Popover.Trigger>
      )}
      <Popover.Portal>
        <Popover.Positioner align="start" className="z-50" sideOffset={6}>
          <Popover.Popup className="w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-zinc-200 bg-white p-3 text-zinc-900 shadow-lg" finalFocus={trigger}>
            <Popover.Title className="mb-2 text-xs font-semibold">Replace image</Popover.Title>
            {showEditor && <ImageEditForm content={content} objectFit={objectFit} onCommit={(edit) => {
              onCommit(edit);
              setOpen(false);
            }} />}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ImageEditForm({ content, objectFit, onCommit }: {
  content: NodeContent;
  objectFit: CSSProperties["objectFit"];
  onCommit: (edit: ImageEdit) => void;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const active = useRef(false);
  const urlInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const initialUrl = content.imageUrl?.startsWith("data:") ? "" : content.imageUrl ?? "";

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const fields = new FormData(event.currentTarget);
    const url = String(fields.get("url") ?? "").trim();
    const file = fileInput.current?.files?.[0];
    const alt = String(fields.get("alt") ?? "");
    const fit = objectFits.find((value) => value === fields.get("fit")) ?? "cover";
    let imageUrl: string | undefined;
    if (file && !file.type.startsWith("image/")) {
      setError("Choose a supported image file, such as PNG, JPEG, or WebP.");
      return;
    }
    if (!file && url !== initialUrl && !/^https?:\/\//i.test(url) && !/^\/(?![\\/])/.test(url)) {
      setError("Enter an HTTP or HTTPS image URL, or a path starting with /.");
      return;
    }

    setError("");
    setPending(true);
    try {
      imageUrl = file ? await readImage(file) : (url && url !== initialUrl ? url : undefined);
      if (imageUrl) {
        const image = new Image();
        image.src = imageUrl;
        await image.decode();
      }
    } catch {
      if (active.current) {
        setError(file ? "This file could not be loaded as an image. Try another file." : "This URL could not be loaded as an image. Check the link and try again.");
        setPending(false);
      }
      return;
    }
    if (active.current) onCommit({ imageUrl, alt, objectFit: fit });
  }

  return (
    <form className="text-xs" onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()} onSubmit={apply}>
      <fieldset className="grid gap-2" disabled={pending}>
        <label className="grid gap-1">Image URL
          <Input className="text-xs md:text-xs" defaultValue={initialUrl} name="url" placeholder="https://…" ref={urlInput} onChange={() => {
            if (fileInput.current) fileInput.current.value = "";
            setError("");
          }} />
        </label>
        <label className="grid gap-1">Upload image
          <Input accept="image/*" className="text-xs md:text-xs" ref={fileInput} type="file" onChange={(event) => {
            if (event.currentTarget.files?.length && urlInput.current) urlInput.current.value = "";
            setError("");
          }} />
        </label>
        <label className="grid gap-1">Alt text
          <Input className="text-xs md:text-xs" defaultValue={content.alt ?? ""} name="alt" />
        </label>
        <label className="grid gap-1">Object fit
          <select className="h-8 rounded-lg border border-input bg-transparent px-2 capitalize focus-visible:outline-orange-500" defaultValue={objectFit ?? "cover"} name="fit">
            {objectFits.map((fit) => <option key={fit} value={fit}>{fit.replace("-", " ")}</option>)}
          </select>
        </label>
        {error && <p className="text-red-700" role="alert">{error}</p>}
        <Button className="justify-self-end" size="xs" type="submit">{pending ? "Checking image…" : "Apply"}</Button>
      </fieldset>
    </form>
  );
}
