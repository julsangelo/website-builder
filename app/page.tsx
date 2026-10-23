"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, Columns2, Download, GripVertical, Heading1, Image as ImageIcon, Layers3, Minus, Monitor, MousePointer2, Plus, RectangleHorizontal, Redo2, Save, Smartphone, Tablet, Trash2, Type, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";

type Kind = "heading" | "text" | "button" | "image" | "divider" | "spacer";
type Align = "left" | "center" | "right";
type Block = { id: string; type: Kind; text: string; size: number; color: string; align: Align };
const catalog: { type: Kind; label: string; detail: string; icon: typeof Type }[] = [
  { type: "heading", label: "Heading", detail: "Large title", icon: Heading1 },
  { type: "text", label: "Text", detail: "Paragraph", icon: Type },
  { type: "button", label: "Button", detail: "Call to action", icon: RectangleHorizontal },
  { type: "image", label: "Image", detail: "Image placeholder", icon: ImageIcon },
  { type: "divider", label: "Divider", detail: "Horizontal line", icon: Minus },
  { type: "spacer", label: "Spacer", detail: "Vertical space", icon: ArrowDown },
];
const defaults: Record<Kind, Omit<Block, "id" | "type">> = {
  heading: { text: "Build something beautiful.", size: 36, color: "#111827", align: "center" },
  text: { text: "Tell your story here. Add a paragraph to explain what makes your website special.", size: 16, color: "#64748b", align: "center" },
  button: { text: "Get started", size: 14, color: "#ffffff", align: "center" },
  image: { text: "Image placeholder", size: 14, color: "#64748b", align: "center" },
  divider: { text: "", size: 1, color: "#e2e8f0", align: "center" },
  spacer: { text: "", size: 48, color: "#64748b", align: "center" },
};
function makeBlock(type: Kind): Block { return { id: crypto.randomUUID(), type, ...defaults[type] }; }
function esc(s: string) { return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }

export default function Builder() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ kind: "palette" | "block"; type?: Kind; id?: string } | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState<Block[][]>([]);
  const [future, setFuture] = useState<Block[][]>([]);
  const active = blocks.find((b) => b.id === selected) ?? null;

  useEffect(() => { try { const saved = localStorage.getItem("canvas-builder-project"); if (saved) setBlocks(JSON.parse(saved) as Block[]); } catch {} }, []);
  function commit(next: Block[]) {
    setHistory((h) => [...h.slice(-29), blocks]); setFuture([]); setBlocks(next);
    try { localStorage.setItem("canvas-builder-project", JSON.stringify(next)); } catch {}
  }
  function add(type: Kind, index = blocks.length) { const b = makeBlock(type); const next = [...blocks]; next.splice(index, 0, b); commit(next); setSelected(b.id); }
  function remove(id: string) { commit(blocks.filter((b) => b.id !== id)); if (selected === id) setSelected(null); }
  function update(id: string, patch: Partial<Block>) { commit(blocks.map((b) => b.id === id ? { ...b, ...patch } : b)); }
  function move(id: string, to: number) {
    const from = blocks.findIndex((b) => b.id === id); if (from < 0) return;
    const next = [...blocks]; const item = next.splice(from, 1)[0];
    const adjusted = Math.max(0, Math.min(next.length, to > from ? to - 1 : to)); next.splice(adjusted, 0, item); commit(next);
  }
  function dropAt(index: number) {
    if (!drag) return;
    if (drag.kind === "palette" && drag.type) add(drag.type, index); else if (drag.kind === "block" && drag.id) move(drag.id, index);
    setDrag(null); setDropIndex(null);
  }
  function undo() {
    if (!history.length) return; const prev = history[history.length - 1];
    setFuture((f) => [blocks, ...f]); setHistory((h) => h.slice(0, -1)); setBlocks(prev);
    localStorage.setItem("canvas-builder-project", JSON.stringify(prev));
  }
  function redo() {
    if (!future.length) return; const next = future[0];
    setHistory((h) => [...h, blocks]); setFuture((f) => f.slice(1)); setBlocks(next);
    localStorage.setItem("canvas-builder-project", JSON.stringify(next));
  }
  function save() { localStorage.setItem("canvas-builder-project", JSON.stringify(blocks)); setNotice("Saved in this browser"); setTimeout(() => setNotice(""), 2200); }
  function download(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  }
  function exportJson() { download("website-layout.json", JSON.stringify(blocks, null, 2), "application/json"); }
  function exportHtml() {
    const body = blocks.map((b) => {
      if (b.type === "heading") return '<h1 style="font-size:' + b.size + 'px;color:' + b.color + ';text-align:' + b.align + '">' + esc(b.text) + '</h1>';
      if (b.type === "text") return '<p style="font-size:' + b.size + 'px;color:' + b.color + ';text-align:' + b.align + '">' + esc(b.text) + '</p>';
      if (b.type === "button") return '<div style="text-align:' + b.align + '"><button>' + esc(b.text) + '</button></div>';
      if (b.type === "image") return '<div style="height:220px;background:#f1f5f9;display:grid;place-items:center;color:#64748b;border:1px dashed #cbd5e1">' + esc(b.text) + '</div>';
      if (b.type === "divider") return '<hr style="border:0;border-top:' + b.size + 'px solid ' + b.color + ';margin:24px 0">';
      return '<div style="height:' + b.size + 'px"></div>';
    }).join("\n");
    const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>My website</title><style>body{font-family:Arial,sans-serif;max-width:1000px;margin:0 auto;padding:48px 24px;color:#111827}button{background:#111827;color:white;padding:14px 24px;border:0;border-radius:8px}p{line-height:1.7}</style></head><body>' + body + '</body></html>';
    download("my-website.html", html, "text/html");
  }
  const IconButton = ({ label, onClick, children, disabled = false }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) =>
    <Button type="button" variant="outline" size="icon" title={label} aria-label={label} disabled={disabled} onClick={onClick} className="h-8 w-8">{children}</Button>;

  return <main className="flex h-screen min-h-[620px] flex-col overflow-hidden bg-background">
    <header className="z-10 flex h-[62px] shrink-0 items-center justify-between border-b bg-card px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Layers3 size={19} /></div><div><div className="text-sm font-bold">Canvas</div><div className="text-[11px] text-muted-foreground">Website builder</div></div><Separator orientation="vertical" className="mx-2 hidden h-7 sm:block" /><Button variant="ghost" size="sm" className="hidden text-muted-foreground sm:flex">Untitled website <ChevronDown size={14} /></Button></div>
      <div className="flex items-center gap-1.5 sm:gap-2"><span className="hidden items-center text-xs text-emerald-600 md:flex"><Check size={13} className="mr-1" />Auto-saves locally</span><IconButton label="Undo" onClick={undo} disabled={!history.length}><Undo2 /></IconButton><IconButton label="Redo" onClick={redo} disabled={!future.length}><Redo2 /></IconButton><Button variant="outline" size="sm" onClick={save} className="hidden sm:flex"><Save /> Save</Button><Button size="sm" onClick={exportHtml}><Download /><span className="hidden sm:inline">Export HTML</span><span className="sm:hidden">Export</span></Button><Button variant="ghost" size="icon" title="Export layout JSON" onClick={exportJson} className="hidden sm:inline-flex"><span className="text-[10px] font-bold">JSON</span></Button></div>
    </header>
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-[190px] shrink-0 flex-col border-r bg-card sm:w-[220px] md:w-[250px]">
        <div className="border-b px-4 py-5 sm:px-5"><h2 className="text-sm font-semibold">Elements</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Drag an element onto your page, or click to add it.</p></div>
        <div className="flex-1 overflow-y-auto p-3"><div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Basic</div><div className="grid grid-cols-1 gap-2">
          {catalog.map((item) => { const I = item.icon; return <Card key={item.type} draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = "copy"; e.dataTransfer.setData("text/plain", item.type); setDrag({ kind: "palette", type: item.type }); }} onDragEnd={() => { setDrag(null); setDropIndex(null); }} onClick={() => add(item.type)} className="group cursor-grab rounded-xl transition hover:border-primary/50 hover:bg-accent/50 active:cursor-grabbing"><CardContent className="flex items-center gap-2.5 p-2.5 sm:gap-3 sm:p-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"><I size={18} /></div><div className="min-w-0 flex-1"><div className="text-xs font-semibold">{item.label}</div><div className="mt-1 text-[10px] text-muted-foreground">{item.detail}</div></div><GripVertical size={14} className="text-muted-foreground/50" /></CardContent></Card>; })}
        </div><Card className="mt-6 bg-muted/60 shadow-none"><CardHeader className="p-3.5 pb-2"><CardTitle className="flex items-center gap-2 text-xs"><MousePointer2 size={14} /> Quick tip</CardTitle></CardHeader><CardContent className="p-3.5 pt-0"><CardDescription className="text-[11px] leading-5">Drag elements into the page, click any element to edit it, and use the layer list to reorder items.</CardDescription></CardContent></Card></div>
        <div className="border-t p-4"><div className="flex items-center gap-2 text-xs font-medium"><div className="grid h-8 w-8 place-items-center rounded-lg bg-muted"><Columns2 size={15} /></div><div>Home page<div className="mt-0.5 text-[10px] font-normal text-muted-foreground">{blocks.length} elements</div></div></div></div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center justify-between border-b bg-card/80 px-3 md:px-6"><div className="text-xs text-muted-foreground">Pages <span className="mx-2">/</span><b className="text-foreground">Home</b></div><div className="flex items-center gap-1.5">
          {([{ id: "desktop", icon: Monitor }, { id: "tablet", icon: Tablet }, { id: "mobile", icon: Smartphone }] as const).map((v) => { const I = v.icon; return <Button key={v.id} variant={viewport === v.id ? "secondary" : "ghost"} size="icon" onClick={() => setViewport(v.id)} title={v.id} className="h-8 w-8"><I /></Button>; })}
          <span className="ml-1 hidden text-[11px] text-muted-foreground sm:inline">{viewport === "desktop" ? "100%" : viewport === "tablet" ? "768 px" : "390 px"}</span>
        </div></div>
        <div className="min-h-0 flex-1 overflow-auto p-3 md:p-8"><div className="mx-auto transition-all" style={{ maxWidth: viewport === "desktop" ? 1050 : viewport === "tablet" ? 768 : 390 }}>
          <div className="mb-3 flex items-center justify-between"><div><div className="text-xs font-semibold">Home page</div><div className="mt-1 text-[10px] text-muted-foreground">Drag and drop canvas</div></div><span className="text-[10px] text-muted-foreground">Changes saved locally</span></div>
          <Card className="min-h-[620px] overflow-hidden rounded-lg shadow-sm" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = drag?.kind === "palette" ? "copy" : "move"; }} onDrop={(e) => { e.preventDefault(); if (dropIndex === null) { if (drag?.kind === "palette" && drag.type) add(drag.type); else if (drag?.id) move(drag.id, blocks.length); } else dropAt(dropIndex); }}>
            <div className="flex h-9 items-center gap-1.5 border-b bg-muted/70 px-3"><i className="h-2 w-2 rounded-full bg-red-300" /><i className="h-2 w-2 rounded-full bg-amber-300" /><i className="h-2 w-2 rounded-full bg-emerald-300" /><div className="mx-auto rounded-md border bg-card px-12 py-1 text-[9px] text-muted-foreground">yourwebsite.com</div></div>
            <div className="min-h-[580px] p-4 md:p-10" onClick={() => setSelected(null)}>
              {blocks.length === 0 ? <div className="flex min-h-[480px] flex-col items-center justify-center rounded-xl border-2 border-dashed bg-muted/30 px-5 text-center" onDragOver={(e) => { e.preventDefault(); setDropIndex(0); }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); dropAt(0); }}><div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border bg-card text-primary shadow-sm"><MousePointer2 size={25} /></div><h2 className="text-lg font-semibold">Start building your page</h2><p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Drag an element from the left panel and drop it here.</p><Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); add("heading"); }} className="mt-5"><Plus /> Add a heading</Button></div> :
              <div className="mx-auto max-w-3xl" onClick={(e) => e.stopPropagation()}>{blocks.map((b, i) => <div key={b.id}>
                <div onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropIndex(i); }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); dropAt(i); }} className={"my-1 h-2 rounded-full transition " + (dropIndex === i ? "drop-target" : "")} />
                <div draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", b.id); setDrag({ kind: "block", id: b.id }); }} onDragEnd={() => { setDrag(null); setDropIndex(null); }} onClick={() => setSelected(b.id)} className={"group relative my-1 rounded-lg border-2 p-4 transition " + (selected === b.id ? "border-primary bg-primary/5" : "border-transparent hover:border-border") + (drag?.id === b.id ? " dragging" : "")}>
                  {selected === b.id && <div className="absolute -top-[23px] left-[-2px] rounded-t-md bg-primary px-2 py-1 text-[9px] font-semibold uppercase text-primary-foreground">{b.type}</div>}
                  {selected === b.id && <Button variant="destructive" size="icon" title="Delete element" onClick={(e) => { e.stopPropagation(); remove(b.id); }} className="absolute -right-2 -top-3 z-10 h-7 w-7"><Trash2 /></Button>}
                  {b.type === "heading" && <h1 style={{ fontSize: b.size, color: b.color, textAlign: b.align, lineHeight: 1.2 }} className="py-2 font-bold tracking-tight">{b.text}</h1>}
                  {b.type === "text" && <p style={{ fontSize: b.size, color: b.color, textAlign: b.align }} className="whitespace-pre-wrap leading-7">{b.text}</p>}
                  {b.type === "button" && <div style={{ textAlign: b.align }}><span style={{ fontSize: b.size }} className="inline-block rounded-lg bg-slate-900 px-6 py-3 font-medium text-white">{b.text}</span></div>}
                  {b.type === "image" && <div className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-muted/50 text-muted-foreground"><ImageIcon size={32} /><span className="text-xs">{b.text}</span><span className="text-[10px]">Image upload not included yet</span></div>}
                  {b.type === "divider" && <hr style={{ border: 0, borderTop: b.size + "px solid " + b.color, margin: "12px 0" }} />}
                  {b.type === "spacer" && <div style={{ height: b.size }} className="flex items-center justify-center rounded border border-dashed text-[10px] text-muted-foreground">Spacer · {b.size}px</div>}
                  {selected === b.id && <div className="absolute -bottom-2 left-2 rounded bg-primary px-1.5 py-0.5 text-[9px] text-primary-foreground">Selected</div>}
                </div>
              </div>)}<div onDragOver={(e) => { e.preventDefault(); setDropIndex(blocks.length); }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); dropAt(blocks.length); }} className={"mt-2 flex min-h-16 items-center justify-center rounded-lg border-2 border-dashed text-xs transition " + (dropIndex === blocks.length ? "drop-target border-primary" : "text-muted-foreground hover:border-primary/50")}><Plus className="mr-2" size={14} /> Drop here to add an element</div></div>}
            </div>
          </Card><div className="mt-3 flex justify-between text-[10px] text-muted-foreground"><span>Canvas · {blocks.length} elements</span><span>Autosaved in this browser</span></div>
        </div></div>
      </section>
      <aside className="hidden w-[235px] shrink-0 flex-col border-l bg-card xl:flex">
        <div className="flex h-12 items-center gap-2 border-b px-4"><Layers3 size={15} /><span className="text-sm font-semibold">Layers</span><span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px]">{blocks.length}</span></div>
        <div className="flex-1 overflow-y-auto p-3">{blocks.length === 0 ? <div className="px-3 py-12 text-center"><Layers3 size={24} className="mx-auto mb-3 text-muted-foreground/40" /><p className="text-xs font-medium">No elements yet</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Add elements to see the layer list.</p></div> : blocks.map((b, i) => { const item = catalog.find((c) => c.type === b.type)!; const I = item.icon; return <div key={b.id} onClick={() => setSelected(b.id)} className={"mb-1 flex items-center gap-2 rounded-lg px-2 py-2 text-xs " + (selected === b.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted/70")}><GripVertical size={12} className="shrink-0 opacity-50" /><I size={14} /><span className="flex-1 truncate">{b.text || item.label}</span><Button variant="ghost" size="icon" title="Move up" disabled={i === 0} onClick={(e) => { e.stopPropagation(); move(b.id, i - 1); }} className="h-6 w-6"><ArrowUp /></Button><Button variant="ghost" size="icon" title="Move down" disabled={i === blocks.length - 1} onClick={(e) => { e.stopPropagation(); move(b.id, i + 2); }} className="h-6 w-6"><ArrowDown /></Button></div>; })}</div>
        <Separator /><div className="p-4"><div className="mb-3 text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Element settings</div>
          {active ? <div className="space-y-4"><div className="flex items-center justify-between"><span className="text-xs font-semibold capitalize">{active.type}</span><Button variant="ghost" size="icon" onClick={() => setSelected(null)} className="h-7 w-7"><X /></Button></div>
            {active.type !== "divider" && active.type !== "spacer" && <div className="space-y-2"><Label htmlFor="element-text" className="text-xs text-muted-foreground">Text / label</Label><Textarea id="element-text" value={active.text} onChange={(e) => update(active.id, { text: e.target.value })} rows={3} className="min-h-20 resize-y text-xs" /></div>}
            {active.type !== "divider" && active.type !== "spacer" && <div className="space-y-2"><Label className="text-xs text-muted-foreground">Alignment</Label><Select aria-label="Alignment" value={active.align} onValueChange={(value) => update(active.id, { align: value as Align })} className="h-9 text-xs"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></Select></div>}
            {active.type !== "divider" && <div className="space-y-3"><div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">{active.type === "spacer" ? "Height" : active.type === "image" ? "Label size" : "Font size"}</Label><span className="text-[11px] tabular-nums text-muted-foreground">{active.size}px</span></div><Slider min={active.type === "spacer" ? 8 : 10} max={active.type === "spacer" ? 200 : active.type === "heading" ? 72 : 36} step={1} value={[active.size]} onValueChange={([size]) => update(active.id, { size })} /></div>}
            {active.type !== "button" && active.type !== "image" && active.type !== "spacer" && <div className="space-y-2"><Label htmlFor="element-color" className="text-xs text-muted-foreground">Color</Label><div className="flex items-center gap-2"><Input id="element-color" type="color" value={active.color} onChange={(e) => update(active.id, { color: e.target.value })} className="h-9 w-12 cursor-pointer p-1" /><span className="font-mono text-[11px] text-muted-foreground">{active.color}</span></div></div>}
            <Button variant="destructive" size="sm" onClick={() => remove(active.id)} className="w-full"><Trash2 /> Delete element</Button>
          </div> : <p className="text-xs leading-5 text-muted-foreground">Select a canvas element to edit its text, size, alignment, and color.</p>}
        </div>
      </aside>
    </div>
    {notice && <div role="status" className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-xl bg-foreground px-4 py-3 text-xs font-medium text-background shadow-lg">{notice}</div>}
  </main>;
}
