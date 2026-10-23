"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, Columns2, Download, GripVertical, Heading1, Image as ImageIcon, Layers3, Minus, Monitor, MousePointer2, Palette, Plus, RectangleHorizontal, Redo2, Save, SlidersHorizontal, Smartphone, Sparkles, Tablet, Trash2, Type, Undo2, X } from "lucide-react";
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
type Block = { id: string; type: Kind; text: string; size: number; color: string; align: Align; tailwindClasses?: string };
type SiteConfig = { backgroundColor: string; textColor: string; bodyTextColor: string; borderColor: string; primaryColor: string; secondaryColor: string; buttonTextColor: string; linkColor: string; fontFamily: string; headingFontFamily: string; pagePadding: number; paddingTop: number; paddingBottom: number; contentMaxWidth: number; sectionGap: number; baseFontSize: number; headingFontSize: number; lineHeight: number; letterSpacing: number; borderRadius: number; buttonRadius: number; buttonPaddingX: number; buttonPaddingY: number; buttonFontSize: number; buttonFontWeight: string; borderWidth: number };
const defaultSiteConfig: SiteConfig = { backgroundColor: "#ffffff", textColor: "#111827", bodyTextColor: "#475569", borderColor: "#e2e8f0", primaryColor: "#4f46e5", secondaryColor: "#0ea5e9", buttonTextColor: "#ffffff", linkColor: "#4f46e5", fontFamily: "Arial, Helvetica, sans-serif", headingFontFamily: "Arial, Helvetica, sans-serif", pagePadding: 16, paddingTop: 16, paddingBottom: 16, contentMaxWidth: 1200, sectionGap: 24, baseFontSize: 16, headingFontSize: 36, lineHeight: 1.7, letterSpacing: 0, borderRadius: 12, buttonRadius: 12, buttonPaddingX: 24, buttonPaddingY: 14, buttonFontSize: 14, buttonFontWeight: "600", borderWidth: 1 };
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
  text: { text: "Tell your story here. Add a paragraph to explain what makes your website special.", size: 16, color: "#475569", align: "center" },
  button: { text: "Get started", size: 14, color: "#ffffff", align: "center" },
  image: { text: "Image placeholder", size: 14, color: "#64748b", align: "center" },
  divider: { text: "", size: 1, color: "#e2e8f0", align: "center" },
  spacer: { text: "", size: 48, color: "#64748b", align: "center" },
};
function makeBlock(type: Kind, config: SiteConfig): Block {
  const base = { ...defaults[type] };
  if (type === "heading") base.color = config.textColor;
  if (type === "text") { base.color = config.bodyTextColor; base.size = config.baseFontSize; }
  if (type === "divider") base.color = config.borderColor;
  if (type === "image") base.color = config.bodyTextColor;
  return { id: crypto.randomUUID(), type, ...base, tailwindClasses: "" };
}
function esc(s: string) { return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }

export default function Builder() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(defaultSiteConfig);
  const [themeOpen, setThemeOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [advancedStylesOpen, setAdvancedStylesOpen] = useState(false);
  const [leftTab, setLeftTab] = useState<"elements" | "layers">("elements");
  const [leftPanelWidth, setLeftPanelWidth] = useState(250);
  const [settingsPanelWidth, setSettingsPanelWidth] = useState(320);
  const [resizingPanel, setResizingPanel] = useState<"left" | "settings" | null>(null);
  const [drag, setDrag] = useState<{ kind: "palette" | "block"; type?: Kind; id?: string } | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState<Block[][]>([]);
  const [future, setFuture] = useState<Block[][]>([]);
  const active = blocks.find((b) => b.id === selected) ?? null;

  useEffect(() => {
    if (!resizingPanel) return;
    const onMove = (event: PointerEvent) => {
      if (resizingPanel === "left") setLeftPanelWidth(Math.max(180, Math.min(420, event.clientX)));
      else setSettingsPanelWidth(Math.max(260, Math.min(560, window.innerWidth - event.clientX)));
    };
    const onUp = () => setResizingPanel(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizingPanel]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("canvas-builder-project");
      if (saved) setBlocks(JSON.parse(saved) as Block[]);
      const savedConfig = localStorage.getItem("canvas-builder-theme");
      if (savedConfig) setSiteConfig({ ...defaultSiteConfig, ...JSON.parse(savedConfig) });
    } catch {}
  }, []);
  function updateSiteConfig(patch: Partial<SiteConfig>) {
    const next = { ...siteConfig, ...patch };
    setSiteConfig(next);
    try { localStorage.setItem("canvas-builder-theme", JSON.stringify(next)); } catch {}
    setBlocks((current) => {
      const updatedBlocks = current.map((block) => {
        const updated = { ...block };
        if (patch.textColor && block.type === "heading" && block.color === siteConfig.textColor) updated.color = patch.textColor;
        if (patch.bodyTextColor && (block.type === "text" || block.type === "image") && block.color === siteConfig.bodyTextColor) updated.color = patch.bodyTextColor;
        if (patch.borderColor && block.type === "divider" && block.color === siteConfig.borderColor) updated.color = patch.borderColor;
        if (patch.baseFontSize && block.type === "text" && block.size === siteConfig.baseFontSize) updated.size = patch.baseFontSize;
        return updated;
      });
      try { localStorage.setItem("canvas-builder-project", JSON.stringify(updatedBlocks)); } catch {}
      return updatedBlocks;
    });
  }
  function commit(next: Block[]) {
    setHistory((h) => [...h.slice(-29), blocks]); setFuture([]); setBlocks(next);
    try { localStorage.setItem("canvas-builder-project", JSON.stringify(next)); } catch {}
  }
  function add(type: Kind, index = blocks.length) { const b = makeBlock(type, siteConfig); const next = [...blocks]; next.splice(index, 0, b); commit(next); setSelected(b.id); }
  function remove(id: string) { commit(blocks.filter((b) => b.id !== id)); if (selected === id) setSelected(null); }
  function update(id: string, patch: Partial<Block>) { commit(blocks.map((b) => b.id === id ? { ...b, ...patch } : b)); }
  function applyStylePreset(id: string, group: string, value: string) {
    const current = blocks.find((b) => b.id === id);
    if (!current) return;
    const tokens = (current.tailwindClasses || "").split(/\s+/).filter(Boolean);
    const groups: Record<string, RegExp> = { background: /^(?:bg-|text-(?:white|black)(?:$|-)|text-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-)/, shape: /^rounded(?:-|$)/, shadow: /^shadow(?:-|$)/, border: /^border(?:-|$)/, weight: /^font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/, fontStyle: /^(?:italic|not-italic)$/, case: /^(?:uppercase|lowercase|capitalize|normal-case)$/, decoration: /^(?:underline|overline|line-through|no-underline)$/, textSize: /^text-(?:xs|sm|base|lg|xl|[2-9]xl)$/, padding: /^p[xytrblse]?-/ , margin: /^m[xytrblse]?-/ , width: /^(?:w-full|w-auto|w-fit|w-screen)$/, align: /^(?:mx-auto|mx-0)$/ };
    const matcher = groups[group];
    const remaining = tokens.filter((token) => !matcher.test(token));
    const alreadyApplied = value.split(/\s+/).every((token) => tokens.includes(token));
    const next = alreadyApplied ? remaining : [...remaining, ...value.split(/\s+/)];
    update(id, { tailwindClasses: next.join(" ") });
  }
  function hasStylePreset(value: string) { const tokens = (active?.tailwindClasses || "").split(/\s+/).filter(Boolean); return value.split(/\s+/).every((token) => tokens.includes(token)); }
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
      if (b.type === "heading") return '<h1 class="' + esc(b.tailwindClasses || "") + '" style="font-size:' + b.size + 'px;color:' + b.color + ';text-align:' + b.align + ';line-height:1.2;margin:0;padding:8px 0;font-weight:700;letter-spacing:-.025em;font-family:' + siteConfig.headingFontFamily + '">' + esc(b.text) + '</h1>';
      if (b.type === "text") return '<p class="' + esc(b.tailwindClasses || "") + '" style="font-size:' + b.size + 'px;color:' + b.color + ';text-align:' + b.align + ';line-height:' + siteConfig.lineHeight + ';margin:0">' + esc(b.text) + '</p>';
      if (b.type === "button") return '<div style="text-align:' + b.align + '"><button class="cta ' + esc(b.tailwindClasses || "") + '">' + esc(b.text) + '</button></div>';
      if (b.type === "image") return '<div class="' + esc(b.tailwindClasses || "") + '" style="height:220px;background:' + siteConfig.backgroundColor + ';display:grid;place-items:center;color:' + siteConfig.bodyTextColor + ';border:1px dashed ' + siteConfig.borderColor + ';border-radius:' + siteConfig.borderRadius + 'px">' + esc(b.text) + '</div>';
      if (b.type === "divider") return '<hr class="' + esc(b.tailwindClasses || "") + '" style="border:0;border-top:' + b.size + 'px solid ' + b.color + ';margin:12px 0">';
      return '<div class="' + esc(b.tailwindClasses || "") + '" style="height:' + b.size + 'px"></div>';
    }).join("\n");
    const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><script src="https://cdn.tailwindcss.com"></script><title>My website</title><style>*{box-sizing:border-box}html,body{margin:0;min-height:100%;width:100%}body{font-family:' + siteConfig.fontFamily + ';padding:' + siteConfig.paddingTop + 'px ' + siteConfig.pagePadding + 'px ' + siteConfig.paddingBottom + 'px;background:' + siteConfig.backgroundColor + ';color:' + siteConfig.textColor + ';font-size:' + siteConfig.baseFontSize + 'px;line-height:' + siteConfig.lineHeight + '}h1,h2,h3,h4,h5,h6{font-family:' + siteConfig.headingFontFamily + ';color:' + siteConfig.textColor + '}button.cta{display:inline-block;background:' + siteConfig.primaryColor + ';color:#ffffff;padding:14px 24px;border:0;border-radius:' + siteConfig.borderRadius + 'px;cursor:pointer;font-size:' + siteConfig.buttonFontSize + 'px;font-weight:' + siteConfig.buttonFontWeight + ';padding:' + siteConfig.buttonPaddingY + 'px ' + siteConfig.buttonPaddingX + 'px;border-radius:' + siteConfig.buttonRadius + 'px;color:' + siteConfig.buttonTextColor + '}a{color:' + siteConfig.linkColor + '}p{line-height:' + siteConfig.lineHeight + '}h1{font-size:' + siteConfig.headingFontSize + 'px;letter-spacing:' + siteConfig.letterSpacing + 'em}hr{border-color:#e2e8f0}@media(max-width:600px){body{padding:' + Math.max(0,Math.round(siteConfig.paddingTop/2)) + 'px ' + Math.max(0,Math.round(siteConfig.pagePadding/2)) + 'px ' + Math.max(0,Math.round(siteConfig.paddingBottom/2)) + 'px}}</style></head><body>' + body + '</body></html>';
    download("my-website.html", html, "text/html");
  }
  const IconButton = ({ label, onClick, children, disabled = false }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) =>
    <Button type="button" variant="outline" size="icon" title={label} aria-label={label} disabled={disabled} onClick={onClick} className="h-8 w-8">{children}</Button>;

  return <main className="flex h-screen min-h-[620px] flex-col overflow-hidden bg-background">
    <header className="z-10 flex h-[62px] shrink-0 items-center justify-between border-b bg-card/95 px-4 shadow-sm backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Layers3 size={19} /></div><div><div className="text-sm font-bold tracking-tight">Canvas</div><div className="text-[11px] text-muted-foreground">Website builder <span className="mx-1">·</span> Draft</div></div><Separator orientation="vertical" className="mx-2 hidden h-7 sm:block" /><Button variant="ghost" size="sm" className="hidden text-muted-foreground sm:flex">Untitled website <ChevronDown size={14} /></Button></div>
      <div className="flex items-center gap-1.5 sm:gap-2"><span className="hidden items-center text-xs text-emerald-600 md:flex"><Check size={13} className="mr-1" />Auto-saves locally</span><IconButton label="Undo" onClick={undo} disabled={!history.length}><Undo2 /></IconButton><IconButton label="Redo" onClick={redo} disabled={!future.length}><Redo2 /></IconButton><Button variant="ghost" size="sm" onClick={() => setThemeOpen(true)} className="hidden sm:flex"><Palette /> Theme</Button><Button variant="outline" size="sm" onClick={save} className="hidden sm:flex"><Save /> Save</Button><Button size="sm" onClick={exportHtml}><Download /><span className="hidden sm:inline">Export HTML</span><span className="sm:hidden">Export</span></Button><Button variant="ghost" size="icon" title="Export layout JSON" onClick={exportJson} className="hidden sm:inline-flex"><span className="text-[10px] font-bold">JSON</span></Button></div>
    </header>
    <div className="flex min-h-0 flex-1">
      <aside className="relative flex shrink-0 flex-col border-r bg-card" style={{ width: leftPanelWidth }}>
        <div className="grid grid-cols-2 gap-1 border-b bg-muted/30 p-2"><Button type="button" size="sm" variant={leftTab === "elements" ? "secondary" : "ghost"} onClick={() => setLeftTab("elements")} className="h-9 text-xs"><Plus size={14} className="mr-1" />Elements</Button><Button type="button" size="sm" variant={leftTab === "layers" ? "secondary" : "ghost"} onClick={() => setLeftTab("layers")} className="h-9 text-xs"><Layers3 size={14} className="mr-1" />Layers</Button></div>
        {leftTab === "elements" ? <>
        <div className="border-b px-4 py-4 sm:px-5"><h2 className="text-sm font-semibold">Button</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Let’s focus on buttons first. Drag one onto your page or click to add it.</p></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3"><div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Button element</div><div className="grid grid-cols-1 gap-2">
          {catalog.filter((item) => item.type === "button").map((item) => { const I = item.icon; return <Card key={item.type} draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = "copy"; e.dataTransfer.setData("text/plain", item.type); setDrag({ kind: "palette", type: item.type }); }} onDragEnd={() => { setDrag(null); setDropIndex(null); }} onClick={() => add(item.type)} className="group cursor-grab rounded-xl border-primary/20 bg-primary/[0.03] shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-accent/50 hover:shadow-md active:cursor-grabbing active:translate-y-0"><CardContent className="flex items-center gap-2.5 p-2.5 sm:gap-3 sm:p-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><I size={18} /></div><div className="min-w-0 flex-1"><div className="text-xs font-semibold">{item.label}</div><div className="mt-1 text-[10px] text-muted-foreground">{item.detail}</div></div><GripVertical size={14} className="text-muted-foreground/50" /></CardContent></Card>; })}
        </div><Card className="mt-6 bg-muted/60 shadow-none"><CardHeader className="p-3.5 pb-2"><CardTitle className="flex items-center gap-2 text-xs"><MousePointer2 size={14} /> Quick tip</CardTitle></CardHeader><CardContent className="p-3.5 pt-0"><CardDescription className="text-[11px] leading-5">Add a button, select it on the canvas, then edit its label and style in the settings panel.</CardDescription></CardContent></Card></div>
        <div className="border-t p-4"><div className="flex items-center gap-2 text-xs font-medium"><div className="grid h-8 w-8 place-items-center rounded-lg bg-muted"><Columns2 size={15} /></div><div>Home page<div className="mt-0.5 text-[10px] font-normal text-muted-foreground">{blocks.length} elements</div></div></div></div>
        </> : <div className="min-h-0 flex-1 overflow-y-auto p-3">{blocks.length === 0 ? <div className="px-3 py-12 text-center"><Layers3 size={24} className="mx-auto mb-3 text-muted-foreground/40" /><p className="text-xs font-medium">No elements yet</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Add elements to see the layer list.</p></div> : blocks.map((b, i) => { const item = catalog.find((c) => c.type === b.type)!; const I = item.icon; return <div key={b.id} onClick={() => setSelected(b.id)} className={"mb-1 flex items-center gap-2 rounded-lg px-2 py-2 text-xs " + (selected === b.id ? "bg-accent text-accent-foreground ring-1 ring-primary/30" : "text-muted-foreground hover:bg-muted/70")}><GripVertical size={12} className="shrink-0 opacity-50" /><I size={14} /><span className="flex-1 truncate">{b.text || item.label}</span><Button variant="ghost" size="icon" title="Move up" disabled={i === 0} onClick={(e) => { e.stopPropagation(); move(b.id, i - 1); }} className="h-6 w-6"><ArrowUp /></Button><Button variant="ghost" size="icon" title="Move down" disabled={i === blocks.length - 1} onClick={(e) => { e.stopPropagation(); move(b.id, i + 2); }} className="h-6 w-6"><ArrowDown /></Button></div>; })}</div>}
      </aside>
      <div role="separator" aria-label="Resize elements and layers panel" aria-orientation="vertical" title="Drag to resize sidebar" onPointerDown={(event) => { event.preventDefault(); setResizingPanel("left"); }} className="z-20 w-1 shrink-0 cursor-col-resize bg-border/50 hover:bg-primary/60 active:bg-primary" />
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center justify-between border-b bg-card/80 px-3 md:px-6"><div className="text-xs text-muted-foreground">Pages <span className="mx-2">/</span><b className="text-foreground">Home</b></div><div className="flex items-center gap-1.5">
          {([{ id: "desktop", icon: Monitor }, { id: "tablet", icon: Tablet }, { id: "mobile", icon: Smartphone }] as const).map((v) => { const I = v.icon; return <Button key={v.id} variant={viewport === v.id ? "secondary" : "ghost"} size="icon" onClick={() => setViewport(v.id)} title={v.id} className="h-8 w-8"><I /></Button>; })}
          <span className="ml-1 hidden text-[11px] text-muted-foreground sm:inline">{viewport === "desktop" ? "100%" : viewport === "tablet" ? "768 px" : "390 px"}</span>
        </div></div>
        <div className="min-h-0 flex-1 overflow-auto p-3 md:p-8"><div className="mx-auto w-full transition-all" style={{ maxWidth: viewport === "desktop" ? Math.min(siteConfig.contentMaxWidth, 1600) : viewport === "tablet" ? 768 : 390 }}>
          <div className="mb-3 flex items-center justify-between"><div><div className="text-xs font-semibold">Home page</div><div className="mt-1 text-[10px] text-muted-foreground">Live preview <span className="mx-1">·</span> {blocks.length} {blocks.length === 1 ? "element" : "elements"}</div></div><span className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-[10px] font-medium text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Autosaved locally</span></div>
          <Card className="min-h-[620px] overflow-hidden rounded-xl border-border/80 bg-card shadow-lg shadow-slate-900/5" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = drag?.kind === "palette" ? "copy" : "move"; }} onDrop={(e) => { e.preventDefault(); if (dropIndex === null) { if (drag?.kind === "palette" && drag.type) add(drag.type); else if (drag?.id) move(drag.id, blocks.length); } else dropAt(dropIndex); }}>
            <div className="flex h-9 items-center gap-1.5 border-b bg-muted/50 px-3"><i className="h-2 w-2 rounded-full bg-red-300" /><i className="h-2 w-2 rounded-full bg-amber-300" /><i className="h-2 w-2 rounded-full bg-emerald-300" /><div className="mx-auto flex items-center gap-2 rounded-md border bg-card px-12 py-1 text-[9px] text-muted-foreground shadow-sm"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> yourwebsite.com</div></div>
            <div className="min-h-[580px]" style={{ backgroundColor: siteConfig.backgroundColor, color: siteConfig.textColor, fontFamily: siteConfig.fontFamily, paddingLeft: siteConfig.pagePadding, paddingRight: siteConfig.pagePadding, paddingTop: siteConfig.paddingTop, paddingBottom: siteConfig.paddingBottom }} onClick={() => setSelected(null)}>
              {blocks.length === 0 ? <div className="flex min-h-[480px] flex-col items-center justify-center rounded-xl border-2 border-dashed bg-muted/30 px-5 text-center" onDragOver={(e) => { e.preventDefault(); setDropIndex(0); }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); dropAt(0); }}><div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border bg-card text-primary shadow-sm"><MousePointer2 size={25} /></div><h2 className="text-lg font-semibold">Start building your page</h2><p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Drag an element from the left panel and drop it here.</p><Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); add("heading"); }} className="mt-5"><Plus /> Add a heading</Button></div> :
              <div className="w-full" style={{ color: siteConfig.textColor, fontFamily: siteConfig.fontFamily, fontSize: siteConfig.baseFontSize, lineHeight: siteConfig.lineHeight }} onClick={(e) => e.stopPropagation()}>{blocks.map((b, i) => <div key={b.id}>
                <div onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropIndex(i); }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); dropAt(i); }} className={"my-1 h-2 rounded-full transition " + (dropIndex === i ? "drop-target" : "")} />
                <div draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", b.id); setDrag({ kind: "block", id: b.id }); }} onDragEnd={() => { setDrag(null); setDropIndex(null); }} onClick={() => setSelected(b.id)} className={"group relative my-1 rounded-lg border-2 p-0 transition " + (selected === b.id ? "border-primary bg-primary/[0.04] ring-2 ring-primary/10 shadow-sm" : "border-transparent hover:border-border hover:bg-muted/20") + (drag?.id === b.id ? " dragging" : "")}>
                  {selected === b.id && <div className="absolute -top-[23px] left-[-2px] rounded-t-md bg-primary px-2 py-1 text-[9px] font-semibold uppercase text-primary-foreground">{b.type}</div>}
                  {selected === b.id && <Button variant="destructive" size="icon" title="Delete element" onClick={(e) => { e.stopPropagation(); remove(b.id); }} className="absolute -right-2 -top-3 z-10 h-7 w-7"><Trash2 /></Button>}
                  {b.type === "heading" && <h1 style={{ fontSize: /(?:^|\s)text-(?:xs|sm|base|lg|xl|[2-9]xl)(?:\s|$)/.test(b.tailwindClasses || "") ? undefined : b.size, color: /(?:^|\s)text-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-?/.test(b.tailwindClasses || "") ? undefined : b.color, textAlign: b.align, lineHeight: 1.2, fontFamily: siteConfig.headingFontFamily }} className={"py-2 tracking-tight " + (b.tailwindClasses || "")}>{b.text}</h1>}
                  {b.type === "text" && <p style={{ fontSize: /(?:^|\s)text-(?:xs|sm|base|lg|xl|[2-9]xl)(?:\s|$)/.test(b.tailwindClasses || "") ? undefined : b.size, color: /(?:^|\s)text-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-?/.test(b.tailwindClasses || "") ? undefined : b.color, textAlign: b.align, lineHeight: siteConfig.lineHeight, margin: 0 }} className={"whitespace-pre-wrap " + (b.tailwindClasses || "")}>{b.text}</p>}
                  {b.type === "button" && <div style={{ textAlign: b.align }}><span style={{ fontSize: /(?:^|\s)text-(?:xs|sm|base|lg|xl|[2-9]xl)(?:\s|$)/.test(b.tailwindClasses || "") ? undefined : b.size, backgroundColor: /(?:^|\s)bg-[\w-]+/.test(b.tailwindClasses || "") ? undefined : siteConfig.primaryColor, color: /(?:^|\s)text-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-?/.test(b.tailwindClasses || "") ? undefined : "#ffffff", borderRadius: /(?:^|\s)rounded(?:-|$)/.test(b.tailwindClasses || "") ? undefined : siteConfig.borderRadius }} className={"inline-block px-6 py-3 font-medium " + (b.tailwindClasses || "")}>{b.text}</span></div>}
                  {b.type === "image" && <div style={{ borderRadius: /(?:^|\s)rounded(?:-|$)/.test(b.tailwindClasses || "") ? undefined : siteConfig.borderRadius, color: siteConfig.bodyTextColor }} className={"flex min-h-44 flex-col items-center justify-center gap-3 border-2 border-dashed bg-muted/50 " + (b.tailwindClasses || "")}><ImageIcon size={32} /><span className="text-xs">{b.text}</span><span className="text-[10px]">Image upload not included yet</span></div>}
                  {b.type === "divider" && <hr className={b.tailwindClasses || ""} style={{ border: 0, borderTop: b.size + "px solid " + b.color, margin: "12px 0" }} />}
                  {b.type === "spacer" && <div style={{ height: b.size }} className={"flex items-center justify-center rounded border border-dashed text-[10px] text-muted-foreground " + (b.tailwindClasses || "")}>Spacer · {b.size}px</div>}
                  {selected === b.id && <div className="absolute -bottom-2 left-2 rounded bg-primary px-1.5 py-0.5 text-[9px] text-primary-foreground">Selected</div>}
                </div>
              </div>)}<div onDragOver={(e) => { e.preventDefault(); setDropIndex(blocks.length); }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); dropAt(blocks.length); }} className={"mt-2 flex min-h-16 items-center justify-center rounded-lg border-2 border-dashed text-xs transition " + (dropIndex === blocks.length ? "drop-target border-primary" : "text-muted-foreground hover:border-primary/50")}><Plus className="mr-2" size={14} /> Drop here to add an element</div></div>}
            </div>
          </Card><div className="mt-3 flex justify-between text-[10px] text-muted-foreground"><span>Canvas · {blocks.length} elements</span><span>Autosaved in this browser</span></div>
        </div></div>
      </section>
      <aside className="relative hidden min-h-0 shrink-0 flex-col border-l bg-card xl:flex" style={{ width: settingsPanelWidth, minWidth: 260, maxWidth: 560 }}>
        <div role="separator" aria-label="Resize element settings panel" aria-orientation="vertical" title="Drag to resize settings" onPointerDown={(event) => { event.preventDefault(); setResizingPanel("settings"); }} className="absolute inset-y-0 -left-1 z-20 w-2 cursor-col-resize bg-transparent hover:bg-primary/30 active:bg-primary/50" />
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4"><SlidersHorizontal size={15} /><span className="text-sm font-semibold">Element settings</span><span className="ml-auto text-[10px] text-muted-foreground">Drag left edge to resize</span></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3"><div className="mb-3 flex items-center justify-between"><div className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Properties & styling</div><span className="rounded-full bg-muted px-2 py-1 text-[9px] font-medium text-muted-foreground">{active ? "Editing" : "No selection"}</span></div>
          {active ? <div className="space-y-4"><div className="flex items-center justify-between"><span className="text-xs font-semibold capitalize">{active.type}</span><Button variant="ghost" size="icon" onClick={() => setSelected(null)} className="h-7 w-7"><X /></Button></div>
            {active.type !== "divider" && active.type !== "spacer" && <div className="space-y-2"><Label htmlFor="element-text" className="text-xs text-muted-foreground">Text / label</Label><Textarea id="element-text" value={active.text} onChange={(e) => update(active.id, { text: e.target.value })} rows={3} className="min-h-20 resize-y text-xs" /></div>}
            {active.type !== "divider" && active.type !== "spacer" && <div className="space-y-2"><Label className="text-xs text-muted-foreground">Alignment</Label><Select aria-label="Alignment" value={active.align} onValueChange={(value) => update(active.id, { align: value as Align })} className="h-9 text-xs" options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} /></div>}
            {active.type !== "divider" && <div className="space-y-3"><div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">{active.type === "spacer" ? "Height" : active.type === "image" ? "Label size" : "Font size"}</Label><span className="text-[11px] tabular-nums text-muted-foreground">{active.size}px</span></div><Slider min={active.type === "spacer" ? 8 : 10} max={active.type === "spacer" ? 200 : active.type === "heading" ? 72 : 36} step={1} value={[active.size]} onValueChange={([size]) => update(active.id, { size })} /></div>}
            {active.type !== "button" && active.type !== "image" && active.type !== "spacer" && <div className="space-y-2"><Label htmlFor="element-color" className="text-xs text-muted-foreground">Color</Label><div className="flex items-center gap-2"><Input id="element-color" type="color" value={active.color} onChange={(e) => update(active.id, { color: e.target.value })} className="!h-9 !w-9 !min-w-9 shrink-0 cursor-pointer overflow-hidden !rounded-full !border-0 !p-0 shadow-sm [&::-webkit-color-swatch-wrapper]:!p-0 [&::-webkit-color-swatch]:!rounded-full [&::-webkit-color-swatch]:!border-2 [&::-moz-color-swatch]:!rounded-full [&::-moz-color-swatch]:!border-2" /><span className="font-mono text-[11px] text-muted-foreground">{active.color}</span></div></div>}
            <div className="space-y-3 rounded-xl border p-3">
              <div className="text-xs font-semibold">Quick styling</div>
              <p className="text-[11px] leading-4 text-muted-foreground">Popular Tailwind-style utilities. Pick presets or combine several.</p>
              {[
                { title: "Background", options: [{label:"White",value:"bg-white"},{label:"Light gray",value:"bg-slate-100"},{label:"Dark",value:"bg-slate-900 text-white"},{label:"Primary",value:"bg-indigo-600 text-white"},{label:"Blue",value:"bg-sky-100"}] },
                { title: "Shape & effects", options: [{label:"Rounded",value:"rounded-xl"},{label:"Pill",value:"rounded-full"},{label:"Shadow",value:"shadow-md"},{label:"Large shadow",value:"shadow-xl"},{label:"Border",value:"border border-slate-200"},{label:"No shadow",value:"shadow-none"}] },
                { title: "Typography", options: [{label:"Bold",value:"font-bold"},{label:"Semibold",value:"font-semibold"},{label:"Italic",value:"italic"},{label:"Uppercase",value:"uppercase"},{label:"Underline",value:"underline"},{label:"Small text",value:"text-sm"}] },
                { title: "Spacing & layout", options: [{label:"Padding 2",value:"p-2"},{label:"Padding 4",value:"p-4"},{label:"Padding 6",value:"p-6"},{label:"Margin top",value:"mt-4"},{label:"Full width",value:"w-full"},{label:"Centered",value:"mx-auto"}] }
              ].map((group) => <div key={group.title} className="space-y-2"><Label className="text-[11px] text-muted-foreground">{group.title}</Label><div className="flex flex-wrap gap-1.5">{group.options.map((preset) => <Button key={preset.value} type="button" size="sm" aria-pressed={hasStylePreset(preset.value)} variant={hasStylePreset(preset.value) ? "secondary" : "outline"} className={"h-8 rounded-lg px-2.5 text-[10px] transition-all " + (hasStylePreset(preset.value) ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/40 shadow-sm" : "border-border/80 hover:border-primary/40 hover:bg-accent")} onClick={() => applyStylePreset(active.id, group.title === "Background" ? "background" : group.title === "Shape & effects" ? (preset.value.startsWith("shadow") ? "shadow" : preset.value.startsWith("border") ? "border" : "shape") : group.title === "Typography" ? (preset.value.startsWith("font-") ? "weight" : preset.value === "italic" ? "fontStyle" : preset.value === "text-sm" ? "textSize" : preset.value === "underline" ? "decoration" : "case") : (preset.value.startsWith("p-") ? "padding" : preset.value.startsWith("mt-") ? "margin" : preset.value.startsWith("w-") ? "width" : "align"), preset.value)}>{preset.label}</Button>)}</div></div>)}
              <Button type="button" variant="ghost" size="sm" className="h-7 px-0 text-xs text-muted-foreground" onClick={() => setAdvancedStylesOpen((open) => !open)}>{advancedStylesOpen ? "Hide advanced styling" : "Advanced styling · all Tailwind utilities"} <ChevronDown size={14} className={advancedStylesOpen ? "rotate-180" : ""} /></Button>
              {advancedStylesOpen && <div className="space-y-2"><Label htmlFor="tailwind-classes" className="text-xs">Tailwind CSS classes</Label><Textarea id="tailwind-classes" value={active.tailwindClasses || ""} onChange={(e) => update(active.id, { tailwindClasses: e.target.value })} rows={4} placeholder="e.g. flex items-center gap-4 p-6 rounded-2xl shadow-lg hover:scale-105 transition" className="text-xs" /><p className="text-[10px] leading-4 text-muted-foreground">Use Tailwind utilities for layout, spacing, colors, borders, effects, responsive prefixes (md:, lg:) and hover states. Advanced classes apply to the preview and exported HTML.</p><Button type="button" variant="outline" size="sm" onClick={() => update(active.id, { tailwindClasses: "" })}>Clear classes</Button></div>}
            </div>
            <Button variant="destructive" size="sm" onClick={() => remove(active.id)} className="w-full"><Trash2 /> Delete element</Button>
          </div> : <p className="text-xs leading-5 text-muted-foreground">Select a canvas element to edit its text, size, alignment, and color.</p>}
        </div>
      </aside>
    </div>
    {themeOpen && <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" onMouseDown={(event) => { if (event.target === event.currentTarget) setThemeOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="site-theme-title" className="flex h-full w-full max-w-lg flex-col overflow-y-auto border-l bg-card shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-5 py-4">
          <div><h2 id="site-theme-title" className="flex items-center gap-2 text-base font-semibold"><Palette size={18} /> Global website settings</h2><p className="mt-1 text-xs text-muted-foreground">Changes apply to the canvas preview and exported HTML.</p></div>
          <Button variant="ghost" size="icon" aria-label="Close global website settings" onClick={() => setThemeOpen(false)}><X /></Button>
        </div>
        <div className="space-y-6 p-5">
          <div><h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Theme colors</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="theme-background">Page background</Label><div className="flex items-center gap-2"><Input id="theme-background" type="color" value={siteConfig.backgroundColor} onChange={(e) => updateSiteConfig({ backgroundColor: e.target.value })} className="!h-9 !w-9 !min-w-9 shrink-0 cursor-pointer overflow-hidden !rounded-full !border-0 !p-0 shadow-sm [&::-webkit-color-swatch-wrapper]:!p-0 [&::-webkit-color-swatch]:!rounded-full [&::-webkit-color-swatch]:!border-2 [&::-moz-color-swatch]:!rounded-full [&::-moz-color-swatch]:!border-2" /><span className="font-mono text-xs text-muted-foreground">{siteConfig.backgroundColor}</span></div></div>
              <div className="space-y-2"><Label htmlFor="theme-heading">Heading color</Label><div className="flex items-center gap-2"><Input id="theme-heading" type="color" value={siteConfig.textColor} onChange={(e) => updateSiteConfig({ textColor: e.target.value })} className="!h-9 !w-9 !min-w-9 shrink-0 cursor-pointer overflow-hidden !rounded-full !border-0 !p-0 shadow-sm [&::-webkit-color-swatch-wrapper]:!p-0 [&::-webkit-color-swatch]:!rounded-full [&::-webkit-color-swatch]:!border-2 [&::-moz-color-swatch]:!rounded-full [&::-moz-color-swatch]:!border-2" /><span className="font-mono text-xs text-muted-foreground">{siteConfig.textColor}</span></div></div>
              <div className="space-y-2"><Label htmlFor="theme-body-text">Body text color</Label><div className="flex items-center gap-2"><Input id="theme-body-text" type="color" value={siteConfig.bodyTextColor} onChange={(e) => updateSiteConfig({ bodyTextColor: e.target.value })} className="!h-9 !w-9 !min-w-9 shrink-0 cursor-pointer overflow-hidden !rounded-full !border-0 !p-0 shadow-sm [&::-webkit-color-swatch-wrapper]:!p-0 [&::-webkit-color-swatch]:!rounded-full [&::-webkit-color-swatch]:!border-2 [&::-moz-color-swatch]:!rounded-full [&::-moz-color-swatch]:!border-2" /><span className="font-mono text-xs text-muted-foreground">{siteConfig.bodyTextColor}</span></div></div>
              <div className="space-y-2"><Label htmlFor="theme-primary">Primary color</Label><div className="flex items-center gap-2"><Input id="theme-primary" type="color" value={siteConfig.primaryColor} onChange={(e) => updateSiteConfig({ primaryColor: e.target.value })} className="!h-9 !w-9 !min-w-9 shrink-0 cursor-pointer overflow-hidden !rounded-full !border-0 !p-0 shadow-sm [&::-webkit-color-swatch-wrapper]:!p-0 [&::-webkit-color-swatch]:!rounded-full [&::-webkit-color-swatch]:!border-2 [&::-moz-color-swatch]:!rounded-full [&::-moz-color-swatch]:!border-2" /><span className="font-mono text-xs text-muted-foreground">{siteConfig.primaryColor}</span></div></div>
              <div className="space-y-2"><Label htmlFor="theme-secondary">Secondary color</Label><div className="flex items-center gap-2"><Input id="theme-secondary" type="color" value={siteConfig.secondaryColor} onChange={(e) => updateSiteConfig({ secondaryColor: e.target.value })} className="!h-9 !w-9 !min-w-9 shrink-0 cursor-pointer overflow-hidden !rounded-full !border-0 !p-0 shadow-sm [&::-webkit-color-swatch-wrapper]:!p-0 [&::-webkit-color-swatch]:!rounded-full [&::-webkit-color-swatch]:!border-2 [&::-moz-color-swatch]:!rounded-full [&::-moz-color-swatch]:!border-2" /><span className="font-mono text-xs text-muted-foreground">{siteConfig.secondaryColor}</span></div></div>
              <div className="space-y-2"><Label htmlFor="theme-border">Border color</Label><div className="flex items-center gap-2"><Input id="theme-border" type="color" value={siteConfig.borderColor} onChange={(e) => updateSiteConfig({ borderColor: e.target.value })} className="!h-9 !w-9 !min-w-9 shrink-0 cursor-pointer overflow-hidden !rounded-full !border-0 !p-0 shadow-sm [&::-webkit-color-swatch-wrapper]:!p-0 [&::-webkit-color-swatch]:!rounded-full [&::-webkit-color-swatch]:!border-2 [&::-moz-color-swatch]:!rounded-full [&::-moz-color-swatch]:!border-2" /><span className="font-mono text-xs text-muted-foreground">{siteConfig.borderColor}</span></div></div>
              <div className="space-y-2"><Label htmlFor="theme-button-text">Button text</Label><div className="flex items-center gap-2"><Input id="theme-button-text" type="color" value={siteConfig.buttonTextColor} onChange={(e) => updateSiteConfig({ buttonTextColor: e.target.value })} className="!h-9 !w-9 !min-w-9 shrink-0 cursor-pointer overflow-hidden !rounded-full !border-0 !p-0 shadow-sm [&::-webkit-color-swatch-wrapper]:!p-0 [&::-webkit-color-swatch]:!rounded-full [&::-webkit-color-swatch]:!border-2 [&::-moz-color-swatch]:!rounded-full [&::-moz-color-swatch]:!border-2" /><span className="font-mono text-xs text-muted-foreground">{siteConfig.buttonTextColor}</span></div></div>
              <div className="space-y-2"><Label htmlFor="theme-link">Link color</Label><div className="flex items-center gap-2"><Input id="theme-link" type="color" value={siteConfig.linkColor} onChange={(e) => updateSiteConfig({ linkColor: e.target.value })} className="!h-9 !w-9 !min-w-9 shrink-0 cursor-pointer overflow-hidden !rounded-full !border-0 !p-0 shadow-sm [&::-webkit-color-swatch-wrapper]:!p-0 [&::-webkit-color-swatch]:!rounded-full [&::-webkit-color-swatch]:!border-2 [&::-moz-color-swatch]:!rounded-full [&::-moz-color-swatch]:!border-2" /><span className="font-mono text-xs text-muted-foreground">{siteConfig.linkColor}</span></div></div>
            </div>
          </div>
          <Separator />
          <div className="space-y-2"><Label htmlFor="theme-font">Body font</Label><Select id="theme-font" aria-label="Body font" value={siteConfig.fontFamily} onValueChange={(value) => updateSiteConfig({ fontFamily: value })} options={[{ value: "Arial, Helvetica, sans-serif", label: "Arial" }, { value: "system-ui, sans-serif", label: "System UI" }, { value: "Georgia, serif", label: "Georgia" }, { value: "Trebuchet MS, sans-serif", label: "Trebuchet MS" }, { value: "Verdana, sans-serif", label: "Verdana" }, { value: "Tahoma, sans-serif", label: "Tahoma" }, { value: "'Courier New', monospace", label: "Courier New" }, { value: "'Times New Roman', serif", label: "Times New Roman" }]} /></div><div className="space-y-2"><Label htmlFor="theme-heading-font">Heading font</Label><Select id="theme-heading-font" aria-label="Heading font" value={siteConfig.headingFontFamily} onValueChange={(value) => updateSiteConfig({ headingFontFamily: value })} options={[{ value: "Arial, Helvetica, sans-serif", label: "Arial" }, { value: "system-ui, sans-serif", label: "System UI" }, { value: "Georgia, serif", label: "Georgia" }, { value: "Trebuchet MS, sans-serif", label: "Trebuchet MS" }, { value: "Verdana, sans-serif", label: "Verdana" }, { value: "Tahoma, sans-serif", label: "Tahoma" }, { value: "'Courier New', monospace", label: "Courier New" }, { value: "'Times New Roman', serif", label: "Times New Roman" }]} /><p className="text-xs text-muted-foreground">Fonts use local/system fallbacks; web fonts need to be loaded separately.</p></div>
          <Separator />
          
          <Separator />
          <div><h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Page layout</h3><div className="space-y-4">
            <div className="space-y-2"><div className="flex items-center justify-between"><Label>Content max width</Label><span className="text-xs tabular-nums text-muted-foreground">{siteConfig.contentMaxWidth}px</span></div><Slider min={480} max={1600} step={40} value={[siteConfig.contentMaxWidth]} onValueChange={([value]) => updateSiteConfig({ contentMaxWidth: value })} /></div>
            <div className="space-y-2"><div className="flex items-center justify-between"><Label>Horizontal page padding</Label><span className="text-xs tabular-nums text-muted-foreground">{siteConfig.pagePadding}px</span></div><Slider min={0} max={96} step={4} value={[siteConfig.pagePadding]} onValueChange={([value]) => updateSiteConfig({ pagePadding: value })} /></div>
            <div className="space-y-2"><div className="flex items-center justify-between"><Label>Top padding</Label><span className="text-xs tabular-nums text-muted-foreground">{siteConfig.paddingTop}px</span></div><Slider min={0} max={160} step={4} value={[siteConfig.paddingTop]} onValueChange={([value]) => updateSiteConfig({ paddingTop: value })} /></div>
            <div className="space-y-2"><div className="flex items-center justify-between"><Label>Bottom padding</Label><span className="text-xs tabular-nums text-muted-foreground">{siteConfig.paddingBottom}px</span></div><Slider min={0} max={160} step={4} value={[siteConfig.paddingBottom]} onValueChange={([value]) => updateSiteConfig({ paddingBottom: value })} /></div>
            <div className="space-y-2"><div className="flex items-center justify-between"><Label>Space between elements</Label><span className="text-xs tabular-nums text-muted-foreground">{siteConfig.sectionGap}px</span></div><Slider min={0} max={80} step={4} value={[siteConfig.sectionGap]} onValueChange={([value]) => updateSiteConfig({ sectionGap: value })} /></div>
          </div></div>
          <Separator />
          <div><h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Typography</h3><div className="space-y-4">
            <div className="space-y-2"><div className="flex items-center justify-between"><Label>Base font size</Label><span className="text-xs tabular-nums text-muted-foreground">{siteConfig.baseFontSize}px</span></div><Slider min={10} max={28} step={1} value={[siteConfig.baseFontSize]} onValueChange={([value]) => updateSiteConfig({ baseFontSize: value })} /></div>
            <div className="space-y-2"><div className="flex items-center justify-between"><Label>Heading font size</Label><span className="text-xs tabular-nums text-muted-foreground">{siteConfig.headingFontSize}px</span></div><Slider min={20} max={72} step={2} value={[siteConfig.headingFontSize]} onValueChange={([value]) => updateSiteConfig({ headingFontSize: value })} /></div>
            <div className="space-y-2"><div className="flex items-center justify-between"><Label>Line height</Label><span className="text-xs tabular-nums text-muted-foreground">{siteConfig.lineHeight.toFixed(1)}</span></div><Slider min={1} max={2.4} step={0.1} value={[siteConfig.lineHeight]} onValueChange={([value]) => updateSiteConfig({ lineHeight: value })} /></div>
            <div className="space-y-2"><div className="flex items-center justify-between"><Label>Letter spacing</Label><span className="text-xs tabular-nums text-muted-foreground">{siteConfig.letterSpacing.toFixed(2)}em</span></div><Slider min={-0.1} max={0.2} step={0.01} value={[siteConfig.letterSpacing]} onValueChange={([value]) => updateSiteConfig({ letterSpacing: value })} /></div>
          </div></div>
          <Separator />
          <div><h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Buttons & borders</h3><div className="space-y-4">
            <div className="space-y-2"><div className="flex items-center justify-between"><Label>Button corner radius</Label><span className="text-xs tabular-nums text-muted-foreground">{siteConfig.buttonRadius}px</span></div><Slider min={0} max={40} step={1} value={[siteConfig.buttonRadius]} onValueChange={([value]) => updateSiteConfig({ buttonRadius: value })} /></div>
            <div className="space-y-2"><div className="flex items-center justify-between"><Label>Button horizontal padding</Label><span className="text-xs tabular-nums text-muted-foreground">{siteConfig.buttonPaddingX}px</span></div><Slider min={8} max={48} step={2} value={[siteConfig.buttonPaddingX]} onValueChange={([value]) => updateSiteConfig({ buttonPaddingX: value })} /></div>
            <div className="space-y-2"><div className="flex items-center justify-between"><Label>Button vertical padding</Label><span className="text-xs tabular-nums text-muted-foreground">{siteConfig.buttonPaddingY}px</span></div><Slider min={4} max={32} step={2} value={[siteConfig.buttonPaddingY]} onValueChange={([value]) => updateSiteConfig({ buttonPaddingY: value })} /></div>
            <div className="space-y-2"><div className="flex items-center justify-between"><Label>Button font size</Label><span className="text-xs tabular-nums text-muted-foreground">{siteConfig.buttonFontSize}px</span></div><Slider min={10} max={24} step={1} value={[siteConfig.buttonFontSize]} onValueChange={([value]) => updateSiteConfig({ buttonFontSize: value })} /></div>
            <div className="space-y-2"><Label>Button font weight</Label><Select aria-label="Button font weight" value={siteConfig.buttonFontWeight} onValueChange={(value) => updateSiteConfig({ buttonFontWeight: value })} options={[{ value: "400", label: "Normal" }, { value: "500", label: "Medium" }, { value: "600", label: "Semibold" }, { value: "700", label: "Bold" }]} /></div>
            <div className="space-y-2"><div className="flex items-center justify-between"><Label>Border width</Label><span className="text-xs tabular-nums text-muted-foreground">{siteConfig.borderWidth}px</span></div><Slider min={0} max={4} step={1} value={[siteConfig.borderWidth]} onValueChange={([value]) => updateSiteConfig({ borderWidth: value })} /></div>
            <div className="space-y-2"><div className="flex items-center justify-between"><Label>Default corner radius</Label><span className="text-xs tabular-nums text-muted-foreground">{siteConfig.borderRadius}px</span></div><Slider min={0} max={32} step={1} value={[siteConfig.borderRadius]} onValueChange={([value]) => updateSiteConfig({ borderRadius: value })} /></div>
          </div></div>
          <div className="flex flex-wrap justify-between gap-2 border-t pt-4"><Button variant="outline" onClick={() => updateSiteConfig(defaultSiteConfig)}>Reset to defaults</Button><Button onClick={() => setThemeOpen(false)}>Done</Button></div>
          <p className="text-[11px] leading-5 text-muted-foreground">Settings are saved automatically in this browser, separately from your page elements.</p>
        </div>
      </section>
    </div>}
    {notice && <div role="status" className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-xl bg-foreground px-4 py-3 text-xs font-medium text-background shadow-lg">{notice}</div>}
  </main>;
}
