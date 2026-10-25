"use client";

import { useMemo, useState } from "react";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight,
  BadgeCheck, Bold, Box, Check, ChevronDown, ChevronRight, CircleHelp, Code2, Columns2,
  Copy, Eye, FileCode2, FileImage, FileText, Globe, Grip, Heading1, Image as ImageIcon,
  Layers, LayoutGrid, Link2, List, LockKeyhole, Monitor, MoreHorizontal, MousePointer2,
  PanelLeftClose, Plus, Redo2, Rocket, Search, Settings2, Shapes, Smartphone, Sparkles,
  Tablet, Type, Undo2, WandSparkles, X, ZoomIn, ZoomOut,
} from "lucide-react";

type Block = { id: number; kind: string; label: string; text: string };
const initialBlocks: Block[] = [
  { id: 1, kind: "heading", label: "Heading", text: "Build something remarkable." },
  { id: 2, kind: "text", label: "Paragraph", text: "A little clarity goes a long way. Bring your ideas to life with a website that feels unmistakably yours." },
  { id: 3, kind: "button", label: "Button", text: "Explore the builder" },
];
const blockCatalog = [
  { kind: "heading", label: "Heading", icon: Heading1, hint: "Large title" },
  { kind: "text", label: "Text", icon: Type, hint: "Paragraph copy" },
  { kind: "button", label: "Button", icon: MousePointer2, hint: "Call to action" },
  { kind: "image", label: "Image", icon: ImageIcon, hint: "Visual content" },
  { kind: "card", label: "Card", icon: Box, hint: "Content group" },
  { kind: "badge", label: "Badge", icon: BadgeCheck, hint: "Small label" },
  { kind: "link", label: "Link", icon: Link2, hint: "Text link" },
  { kind: "divider", label: "Divider", icon: Columns2, hint: "Section separator" },
];

export default function Home() {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [selected, setSelected] = useState<number | null>(1);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [viewport, setViewport] = useState("Desktop");
  const [preview, setPreview] = useState(false);
  const [inspectorTab, setInspectorTab] = useState("Design");
  const [zoom, setZoom] = useState(100);
  const [siteName, setSiteName] = useState("Untitled website");
  const [published, setPublished] = useState(false);
  const [undoStack, setUndoStack] = useState<Block[][]>([]);
  const [redoStack, setRedoStack] = useState<Block[][]>([]);
  const [showCode, setShowCode] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const active = blocks.find((b) => b.id === selected) ?? null;
  const catalog = useMemo(() => blockCatalog.filter((b) => (category === "All" || b.kind === category.toLowerCase()) && (b.label.toLowerCase().includes(query.toLowerCase()) || b.hint.toLowerCase().includes(query.toLowerCase()))), [query, category]);

  function update(next: Block[]) { setUndoStack((s) => [...s.slice(-19), blocks]); setRedoStack([]); setBlocks(next); }
  function addBlock(kind: string) {
    const item = blockCatalog.find((b) => b.kind === kind);
    const text = kind === "heading" ? "Your next big idea starts here." : kind === "button" ? "Get started" : kind === "text" ? "Add a little context to tell your story." : item?.label ?? "New element";
    const id = Date.now();
    update([...blocks, { id, kind, label: item?.label ?? kind, text }]); setSelected(id);
  }
  function updateActive(key: "text" | "label", value: string) { if (active) update(blocks.map((b) => b.id === active.id ? { ...b, [key]: value } : b)); }
  function moveBlock(id: number, direction: -1 | 1) { const index = blocks.findIndex((b) => b.id === id); const to = index + direction; if (to < 0 || to >= blocks.length) return; const next = [...blocks]; [next[index], next[to]] = [next[to], next[index]]; update(next); }
  function duplicateBlock() { if (active) { const copy = { ...active, id: Date.now(), label: active.label + " copy" }; update([...blocks, copy]); setSelected(copy.id); } }
  function deleteBlock() { if (active) { update(blocks.filter((b) => b.id !== active.id)); setSelected(null); } }
  function exportHtml() {
    const body = blocks.map((b) => b.kind === "heading" ? `<h1>${escapeHtml(b.text)}</h1>` : b.kind === "text" ? `<p>${escapeHtml(b.text)}</p>` : b.kind === "button" ? `<a class="button" href="#">${escapeHtml(b.text)}</a>` : `<div class="block">${escapeHtml(b.text)}</div>`).join("\n");
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(siteName)}</title><style>body{font-family:Inter,Arial,sans-serif;max-width:960px;margin:0 auto;padding:64px 28px;color:#18181b}h1{font-size:clamp(38px,6vw,64px);letter-spacing:-.06em}p{line-height:1.8;color:#71717a}.button{display:inline-block;background:#ea580c;color:#fff;text-decoration:none;padding:12px 18px;border-radius:9px;font-weight:600}.block{padding:20px;border:1px solid #e4e4e7;border-radius:12px}</style></head><body>${body}</body></html>`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([html], { type: "text/html" })); a.download = "website.html"; a.click(); URL.revokeObjectURL(a.href);
  }
  function escapeHtml(s: string) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c)); }

  return <main className="editor-shell">
    <header className="topbar">
      <div className="toolbar-group">
        <div className="brand"><span className="brand-mark"><Shapes size={18} strokeWidth={2.5} /></span><span>forma</span></div>
        <div style={{ width: 1, height: 26, background: "#e4e4e7", margin: "0 5px" }} />
        <div className="project-meta"><input aria-label="Website name" value={siteName} onChange={(e) => setSiteName(e.target.value)} style={{ border: 0, outline: 0, fontSize: 12, fontWeight: 650, width: 145, color: "#27272a" }} /><div className="subtle">All changes saved locally</div></div>
      </div>
      <div className="toolbar-group hide-mobile">
        <button className="btn btn-icon btn-ghost" title="Undo" disabled={!undoStack.length} onClick={() => { setRedoStack((s) => [...s, blocks]); const prev = undoStack[undoStack.length - 1]; setBlocks(prev); setUndoStack((s) => s.slice(0, -1)); }}><Undo2 size={16}/></button>
        <button className="btn btn-icon btn-ghost" title="Redo" disabled={!redoStack.length} onClick={() => { setUndoStack((s) => [...s, blocks]); setBlocks(redoStack[redoStack.length - 1]); setRedoStack((s) => s.slice(0, -1)); }}><Redo2 size={16}/></button>
        <span style={{ width: 1, height: 24, background: "#e4e4e7", margin: "0 4px" }} />
        <button className={`btn ${viewport === "Desktop" ? "btn-active" : "btn-ghost"} btn-icon`} title="Desktop" onClick={() => setViewport("Desktop")}><Monitor size={15}/></button>
        <button className={`btn ${viewport === "Tablet" ? "btn-active" : "btn-ghost"} btn-icon`} title="Tablet" onClick={() => setViewport("Tablet")}><Tablet size={15}/></button>
        <button className={`btn ${viewport === "Mobile" ? "btn-active" : "btn-ghost"} btn-icon`} title="Mobile" onClick={() => setViewport("Mobile")}><Smartphone size={15}/></button>
      </div>
      <div className="top-actions">
        <button className="btn hide-mobile" onClick={() => setShowCode((v) => !v)}><Code2 size={15}/> Code</button>
        <button className={`btn ${preview ? "btn-active" : ""}`} onClick={() => setPreview((v) => !v)}><Eye size={15}/>{preview ? "Edit mode" : "Preview"}</button>
        <button className="btn btn-primary" onClick={() => { setPublished(true); exportHtml(); }}><Rocket size={15}/> Publish <ArrowUpRight size={14}/></button>
      </div>
    </header>
    <section className="workspace">
      <aside className="sidebar left-sidebar">
        <div className="side-head"><span>Elements</span><button className="btn btn-icon btn-ghost" title="Collapse sidebar"><PanelLeftClose size={15}/></button></div>
        <div className="sidebar-section palette-section">
          <div className="search-wrap"><Search size={14}/><input placeholder="Search elements..." value={query} onChange={(e) => setQuery(e.target.value)}/><span style={{ fontSize: 9 }}>⌘K</span></div>
          <div className="category-row">{["All", "Text", "Button", "Image"].map((c) => <button key={c} className={`chip ${category === c ? "chip-active" : ""}`} onClick={() => setCategory(c)}>{c}</button>)}</div>
          <div className="block-grid">{catalog.map((item) => { const Icon = item.icon; return <button draggable onDragStart={() => setDragging(-1)} onDragEnd={() => setDragging(null)} key={item.kind} className="block-tile" onClick={() => addBlock(item.kind)}><span className="block-icon"><Icon size={16}/></span><span>{item.label}</span><small>{item.hint}</small></button>; })}</div>
        </div>
        <div className="sidebar-section"><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span className="eyebrow">Page layers</span><button className="btn btn-icon btn-ghost" title="Add element" onClick={() => addBlock("text")}><Plus size={14}/></button></div>
          <div className="layers-list">{blocks.map((b) => <button key={b.id} className={`layer-item ${selected === b.id ? "active" : ""}`} onClick={() => setSelected(b.id)}><Grip size={13}/>{b.kind === "heading" ? <Heading1 size={14}/> : b.kind === "button" ? <MousePointer2 size={14}/> : b.kind === "image" ? <ImageIcon size={14}/> : <Type size={14}/>}<span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.label}</span><MoreHorizontal size={14}/></button>)}</div>
        </div>
        <div style={{ marginTop: "auto", padding: 14, borderTop: "1px solid #f4f4f5", color: "#a1a1aa", fontSize: 10, display: "flex", alignItems: "center", gap: 7 }}><span className="status-dot"/> Draft saved in this session</div>
      </aside>
      <section className="canvas-area">
        <div className="canvas-toolbar"><div className="toolbar-group"><span style={{ fontSize: 11, fontWeight: 650, color: "#52525b" }}>Home page</span><ChevronRight size={13} color="#a1a1aa"/><span style={{ fontSize: 11, color: "#a1a1aa" }}>Canvas</span><span style={{ background: "#e4e4e7", width: 1, height: 18, margin: "0 3px" }}/><span style={{ fontSize: 10, color: "#a1a1aa" }}>{viewport} · 1440px</span></div>
          <div className="toolbar-group"><button className="btn btn-icon btn-ghost" title="Zoom out" onClick={() => setZoom((z) => Math.max(50, z - 10))}><ZoomOut size={14}/></button><span style={{ fontSize: 10, color: "#71717a", minWidth: 30, textAlign: "center" }}>{zoom}%</span><button className="btn btn-icon btn-ghost" title="Zoom in" onClick={() => setZoom((z) => Math.min(120, z + 10))}><ZoomIn size={14}/></button></div>
        </div>
        <div className="canvas-center"><div className={`site-frame ${viewport.toLowerCase()}`} style={{ zoom: zoom / 100 }}>
          <div className="site-nav"><div className="site-logo"><span className="logo-dot"/>forma<span style={{ color: "#ea580c" }}>.</span></div>{viewport !== "Mobile" && <div className="site-links"><span>Features</span><span>Templates</span><span>Resources</span></div>}<button className="btn btn-primary" style={{ height: 31, fontSize: 10, padding: "0 10px" }} onClick={() => setPreview(true)}>Get started <ArrowRight size={12}/></button></div>
          <div className="site-hero">
            {!preview && <span className="hero-kicker"><Sparkles size={12}/> The visual website builder</span>}
            {blocks.map((b) => <div key={b.id} className={`selectable ${selected === b.id && !preview ? "selected" : ""}`} onClick={() => !preview && setSelected(b.id)} style={{ marginTop: b.kind === "heading" ? 15 : 12 }}>
              {b.kind === "heading" ? <h1 className="hero-title">{b.text.includes("remarkable") ? <>Build something <em>remarkable.</em></> : b.text}</h1> : b.kind === "text" ? <p className="hero-copy">{b.text}</p> : b.kind === "button" ? <button className="btn btn-primary" style={{ height: 42, padding: "0 17px", fontSize: 12 }} onClick={(e) => { e.stopPropagation(); if (!preview) setSelected(b.id); }}>{b.text}<ArrowRight size={14}/></button> : b.kind === "image" ? <div className="preview-art" style={{ margin: "14px 0" }}><div className="art-card"><div className="art-thumb"/><div className="art-lines"><div className="art-line strong"/><div className="art-line"/><div className="art-line orange"/></div></div></div> : b.kind === "badge" ? <span className="hero-kicker">{b.text}</span> : b.kind === "divider" ? <hr style={{ border: 0, borderTop: "1px solid #e4e4e7", margin: "18px 0" }}/> : b.kind === "link" ? <a style={{ color: "#ea580c", fontSize: 12, textDecoration: "underline" }}>{b.text}</a> : <div style={{ border: "1px solid #e4e4e7", borderRadius: 12, padding: 18, marginTop: 14 }}>{b.text}</div>}
            </div>)}
            {!preview && <div className="hero-stats"><div><strong>10k+</strong>Creators</div><div><strong>2 min</strong>To get started</div><div><strong>100%</strong>Your style</div></div>}
          </div>
          {!preview && <div className="preview-art"><div className="art-card"><div className="art-thumb"/><div className="art-lines"><div className="art-line strong"/><div className="art-line"/><div className="art-line orange"/></div></div></div>}
        </div></div>
        <footer className="bottom-status"><span><span className="status-dot"/>All changes saved</span><span>Made with <span style={{ color: "#ea580c" }}>♥</span> in Forma</span></footer>
      </section>
      <aside className="sidebar right-sidebar">
        <div className="side-head"><span>Properties</span><Settings2 size={15} color="#71717a"/></div>
        <div className="inspector-tabs">{["Design", "Content"].map((t) => <button key={t} className={`inspector-tab ${inspectorTab === t ? "active" : ""}`} onClick={() => setInspectorTab(t)}>{t}</button>)}</div>
        {active ? <>
          <div className="inspector-section"><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div className="block-icon" style={{ background: "#fff7ed", color: "#ea580c" }}>{active.kind === "heading" ? <Heading1 size={16}/> : active.kind === "button" ? <MousePointer2 size={15}/> : <Type size={15}/>}</div><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{active.label}</div><div className="subtle">Selected element</div></div><button className="btn btn-icon" title="Duplicate element" onClick={duplicateBlock}><Copy size={14}/></button><button className="btn btn-icon" title="Delete element" onClick={deleteBlock}><X size={14}/></button></div>
          </div>
          {inspectorTab === "Content" ? <div className="inspector-section"><label className="field-label" htmlFor="content">Text content</label><textarea id="content" className="field field-area" value={active.text} onChange={(e) => updateActive("text", e.target.value)}/><div className="field-group"><label className="field-label" htmlFor="label">Layer name</label><input id="label" className="field" value={active.label} onChange={(e) => updateActive("label", e.target.value)}/></div></div> : <>
            <div className="inspector-section"><div className="eyebrow" style={{ marginBottom: 15 }}>Layout</div><div className="field-row" style={{ marginTop: 0 }}><div><label className="field-label">Width</label><input className="field" value="Auto" readOnly/></div><div><label className="field-label">Height</label><input className="field" value="Auto" readOnly/></div></div><div className="field-group"><label className="field-label">Alignment</label><div className="toolbar-group">{[AlignLeft, AlignCenter, AlignRight].map((Icon, i) => <button key={i} className={`btn btn-icon ${i === 0 ? "btn-active" : ""}`}><Icon size={14}/></button>)}</div></div></div>
            <div className="inspector-section"><div className="eyebrow" style={{ marginBottom: 15 }}>Typography</div><div className="field-group"><label className="field-label">Font family</label><button className="btn" style={{ width: "100%", justifyContent: "space-between" }}>Inter <ChevronDown size={14}/></button></div><div className="field-row"><div><label className="field-label">Font size</label><input className="field" value={active.kind === "heading" ? "48 px" : "14 px"} readOnly/></div><div><label className="field-label">Weight</label><button className="btn" style={{ width: "100%" }}><Bold size={13}/> {active.kind === "heading" ? "Bold" : "Regular"}</button></div></div></div>
            <div className="inspector-section"><div className="eyebrow" style={{ marginBottom: 15 }}>Appearance</div><label className="field-label">Text color</label><div className="color-row"><span className="color-swatch" style={{ background: "#18181b" }}/><input className="field" value="#18181B" readOnly/></div><div className="field-group"><label className="field-label">Accent color</label><div className="color-row"><span className="color-swatch" style={{ background: "#ea580c" }}/><input className="field" value="#EA580C" readOnly/></div></div></div>
          </>}
          <div className="inspector-section"><div className="eyebrow" style={{ marginBottom: 12 }}>Arrange</div><div className="toolbar-group"><button className="btn btn-icon" title="Move up" onClick={() => moveBlock(active.id, -1)}><ArrowUp size={14}/></button><button className="btn btn-icon" title="Move down" onClick={() => moveBlock(active.id, 1)}><ArrowDown size={14}/></button><button className="btn" style={{ flex: 1 }} onClick={duplicateBlock}><Copy size={13}/> Duplicate</button></div></div>
        </> : <div className="empty-inspector"><div className="empty-icon"><MousePointer2 size={19}/></div><strong style={{ display: "block", color: "#52525b", marginBottom: 5 }}>Nothing selected</strong>Select an element on the canvas to edit its properties.</div>}
        <div style={{ marginTop: "auto", padding: 14, borderTop: "1px solid #f4f4f5", fontSize: 10, color: "#a1a1aa", display: "flex", gap: 6, alignItems: "center" }}><LockKeyhole size={12}/> Changes are stored locally</div>
      </aside>
    </section>
    {showCode && <div style={{ position: "fixed", inset: 0, background: "#18181b55", zIndex: 10, display: "grid", placeItems: "center", padding: 24 }}><div style={{ background: "#18181b", color: "#fafafa", width: "min(760px,100%)", borderRadius: 14, padding: 22, boxShadow: "0 25px 80px #0003" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}><div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}><FileCode2 size={17}/> Export preview</div><button className="btn btn-icon" onClick={() => setShowCode(false)}><X size={14}/></button></div><p style={{ color: "#a1a1aa", fontSize: 12, lineHeight: 1.7 }}>Export a standalone HTML file with your current content and orange theme.</p><button className="btn btn-primary" onClick={exportHtml}><FileText size={14}/> Export HTML</button></div></div>}
    {published && <div style={{ position: "fixed", bottom: 42, left: "50%", transform: "translateX(-50%)", background: "#18181b", color: "#fff", borderRadius: 10, padding: "12px 16px", fontSize: 12, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 8px 24px #0002", zIndex: 20 }}><Check size={15} color="#4ade80"/> HTML exported — ready to publish <button onClick={() => setPublished(false)} style={{ background: "transparent", color: "#a1a1aa", border: 0 }}><X size={14}/></button></div>}
  </main>;
}