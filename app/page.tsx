 "use client";

import { useEffect, useState } from "react";
import {
  AlignLeft, ArrowDown, ArrowUp, Check, ChevronDown, Columns2, Copy,
  GripVertical, Heading1, Image as ImageIcon, Layers3, Minus, MousePointer2,
  Plus, RectangleHorizontal, Trash2, Type, Undo2, Redo2, Monitor, Smartphone,
  Tablet, Download, Save, X
} from "lucide-react";

type Kind = "heading" | "text" | "button" | "image" | "divider" | "spacer";
type Block = { id: string; type: Kind; text: string; size: number; color: string; align: "left"|"center"|"right"; };
const catalog: {type:Kind;label:string;detail:string;icon:typeof Type}[] = [
  {type:"heading",label:"Heading",detail:"Large title",icon:Heading1},
  {type:"text",label:"Text",detail:"Paragraph",icon:Type},
  {type:"button",label:"Button",detail:"Call to action",icon:RectangleHorizontal},
  {type:"image",label:"Image",detail:"Image placeholder",icon:ImageIcon},
  {type:"divider",label:"Divider",detail:"Horizontal line",icon:Minus},
  {type:"spacer",label:"Spacer",detail:"Vertical space",icon:ArrowDown},
];
const defaults: Record<Kind, {text:string;size:number;color:string;align:"left"|"center"|"right"}> = {
  heading:{text:"Build something beautiful.",size:36,color:"#111827",align:"center"},
  text:{text:"Tell your story here. Add a paragraph to explain what makes your website special.",size:16,color:"#64748b",align:"center"},
  button:{text:"Get started",size:14,color:"#ffffff",align:"center"},
  image:{text:"Image placeholder",size:14,color:"#64748b",align:"center"},
  divider:{text:"",size:1,color:"#e2e8f0",align:"center"},
  spacer:{text:"",size:48,color:"#64748b",align:"center"},
};
function makeBlock(type:Kind):Block { return {id:crypto.randomUUID(),type,...defaults[type]}; }

export default function Builder() {
  const [blocks,setBlocks] = useState<Block[]>([]);
  const [selected,setSelected] = useState<string|null>(null);
  const [drag,setDrag] = useState<{kind:"palette"|"block";type?:Kind;id?:string}|null>(null);
  const [dropIndex,setDropIndex] = useState<number|null>(null);
  const [viewport,setViewport] = useState<"desktop"|"tablet"|"mobile">("desktop");
  const [notice,setNotice] = useState("");
  const [history,setHistory] = useState<Block[][]>([]);
  const [future,setFuture] = useState<Block[][]>([]);
  const active = blocks.find(b=>b.id===selected) ?? null;

  useEffect(()=> {
    try {
      const saved = localStorage.getItem("canvas-builder-project");
      if (saved) setBlocks(JSON.parse(saved) as Block[]);
    } catch {}
  }, []);

  function commit(next:Block[]) {
    setHistory(h=>[...h.slice(-29),blocks]);
    setFuture([]);
    setBlocks(next);
    try { localStorage.setItem("canvas-builder-project",JSON.stringify(next)); } catch {}
  }
  function add(type:Kind,index=blocks.length) {
    const b=makeBlock(type); const next=[...blocks];
    next.splice(index,0,b); commit(next); setSelected(b.id);
  }
  function remove(id:string) { commit(blocks.filter(b=>b.id!==id)); if(selected===id)setSelected(null); }
  function update(id:string,patch:Partial<Block>) { commit(blocks.map(b=>b.id===id?{...b,...patch}:b)); }
  function move(id:string,to:number) {
    const from=blocks.findIndex(b=>b.id===id); if(from<0)return;
    const next=[...blocks]; const [item]=next.splice(from,1);
    const adjusted=Math.max(0,Math.min(next.length,to>from?to-1:to));
    next.splice(adjusted,0,item); commit(next);
  }
  function dropAt(index:number) {
    if(!drag)return;
    if(drag.kind==="palette" && drag.type) add(drag.type,index);
    else if(drag.kind==="block" && drag.id) move(drag.id,index);
    setDrag(null); setDropIndex(null);
  }
  function undo() {
    if(!history.length)return;
    const prev=history[history.length-1];
    setFuture(f=>[blocks,...f]); setHistory(h=>h.slice(0,-1)); setBlocks(prev);
    localStorage.setItem("canvas-builder-project",JSON.stringify(prev));
  }
  function redo() {
    if(!future.length)return;
    const next=future[0]; setHistory(h=>[...h,blocks]); setFuture(f=>f.slice(1)); setBlocks(next);
    localStorage.setItem("canvas-builder-project",JSON.stringify(next));
  }
  function save() {
    localStorage.setItem("canvas-builder-project",JSON.stringify(blocks));
    setNotice("Saved in this browser"); setTimeout(()=>setNotice(""),2200);
  }
  function exportJson() {
    const blob=new Blob([JSON.stringify(blocks,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a");
    a.href=url;a.download="website-layout.json";a.click();URL.revokeObjectURL(url);
  }
  function exportHtml() {
    const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>My website</title><style>body{font-family:Arial,sans-serif;max-width:1000px;margin:0 auto;padding:48px 24px;color:#111827}img{max-width:100%}button{background:#111827;color:white;padding:14px 24px;border:0;border-radius:8px}p{line-height:1.7}</style></head><body>${blocks.map(b=>b.type==="heading"?`<h1 style="font-size:${b.size}px;color:${b.color};text-align:${b.align}">${esc(b.text)}</h1>`:b.type==="text"?`<p style="font-size:${b.size}px;color:${b.color};text-align:${b.align}">${esc(b.text)}</p>`:b.type==="button"?`<div style="text-align:${b.align}"><button>${esc(b.text)}</button></div>`:b.type==="image"?`<div style="height:220px;background:#f1f5f9;display:grid;place-items:center;color:#64748b;border:1px dashed #cbd5e1">${esc(b.text)}</div>`:b.type==="divider"?`<hr style="border:0;border-top:${b.size}px solid ${b.color};margin:24px 0">`:`<div style="height:${b.size}px"></div>`).join("\\n")}</body></html>`;
    const blob=new Blob([html],{type:"text/html"}); const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="my-website.html";a.click();URL.revokeObjectURL(url);
  }
  function esc(s:string){return s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");}
  const IconButton=({label,onClick,children,disabled=false}:{label:string;onClick:()=>void;children:React.ReactNode;disabled?:boolean})=><button title={label} aria-label={label} disabled={disabled} onClick={onClick} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-35">{children}</button>;

  return <main className="flex h-screen min-h-[620px] flex-col overflow-hidden">
    <header className="flex h-[62px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
      <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-white"><Layers3 size={19}/></div><div><div className="text-sm font-bold">Canvas</div><div className="text-[11px] text-slate-500">Website builder</div></div><div className="mx-2 hidden h-7 border-l sm:block"/><div className="hidden items-center gap-1.5 text-sm text-slate-600 sm:flex">Untitled website <ChevronDown size={14}/></div></div>
      <div className="flex items-center gap-2"><span className="hidden text-xs text-emerald-600 md:block"><Check size={13} className="mr-1 inline"/>Auto-saves locally</span><IconButton label="Undo" onClick={undo} disabled={!history.length}><Undo2 size={15}/></IconButton><IconButton label="Redo" onClick={redo} disabled={!future.length}><Redo2 size={15}/></IconButton><button onClick={save} className="hidden h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium sm:flex"><Save size={14}/> Save</button><button onClick={exportHtml} className="flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-700"><Download size={14}/> Export HTML</button></div>
    </header>
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-slate-200 bg-white md:w-[250px]">
        <div className="border-b border-slate-100 px-5 py-5"><h2 className="text-sm font-semibold">Elements</h2><p className="mt-1 text-xs leading-5 text-slate-500">Drag an element onto your page.</p></div>
        <div className="flex-1 overflow-y-auto p-3"><div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Basic</div><div className="grid grid-cols-1 gap-2">{catalog.map(item=>{const I=item.icon;return <div key={item.type} draggable onDragStart={e=>{e.dataTransfer.effectAllowed="copy";e.dataTransfer.setData("text/plain",item.type);setDrag({kind:"palette",type:item.type});}} onDragEnd={()=>{setDrag(null);setDropIndex(null)}} onClick={()=>add(item.type)} className="group flex cursor-grab items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-indigo-300 hover:bg-indigo-50/40 active:cursor-grabbing"><div className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700"><I size={18}/></div><div className="min-w-0 flex-1"><div className="text-xs font-semibold">{item.label}</div><div className="mt-1 text-[10px] text-slate-500">{item.detail}</div></div><GripVertical size={14} className="text-slate-300"/></div>})}</div>
          <div className="mt-6 rounded-xl bg-slate-50 p-3.5"><div className="mb-2 flex items-center gap-2 text-xs font-semibold"><MousePointer2 size={14}/> Quick tip</div><p className="text-[11px] leading-5 text-slate-500">Drag elements into the page, click any element to edit it, and use the layer list to select or reorder items.</p></div>
        </div>
        <div className="border-t border-slate-100 p-4"><div className="flex items-center gap-2 text-xs font-medium"><div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100"><Columns2 size={15}/></div><div>Home page<div className="mt-0.5 text-[10px] font-normal text-slate-500">{blocks.length} elements</div></div></div></div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-4 md:px-6"><div className="text-xs text-slate-500">Pages <span className="mx-2">/</span><b className="text-slate-800">Home</b></div><div className="flex items-center gap-1.5">{([{id:"desktop",icon:Monitor},{id:"tablet",icon:Tablet},{id:"mobile",icon:Smartphone}] as const).map(v=>{const I=v.icon;return <button key={v.id} onClick={()=>setViewport(v.id)} title={v.id} className={`grid h-8 w-8 place-items-center rounded-lg ${viewport===v.id?"bg-indigo-50 text-indigo-700":"text-slate-400 hover:bg-slate-100"}`}><I size={15}/></button>})}<span className="ml-2 hidden text-[11px] text-slate-400 sm:inline">{viewport==="desktop"?"100%":viewport==="tablet"?"768 px":"390 px"}</span></div></div>
        <div className="min-h-0 flex-1 overflow-auto p-4 md:p-8"><div className="mx-auto transition-all" style={{maxWidth:viewport==="desktop"?1050:viewport==="tablet"?768:390}}><div className="mb-3 flex items-center justify-between"><div><div className="text-xs font-semibold">Home page</div><div className="mt-1 text-[10px] text-slate-400">Drag and drop canvas</div></div><span className="text-[10px] text-slate-400">Unsaved changes are auto-saved</span></div>
          <div className="min-h-[620px] border border-slate-200 bg-white shadow-sm" onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect=drag?.kind==="palette"?"copy":"move";}} onDrop={e=>{e.preventDefault();if(dropIndex===null) {if(drag?.kind==="palette"&&drag.type)add(drag.type);else if(drag?.id)move(drag.id,blocks.length);}else dropAt(dropIndex);}}>
            <div className="flex h-9 items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-3"><i className="h-2 w-2 rounded-full bg-red-300"/><i className="h-2 w-2 rounded-full bg-amber-300"/><i className="h-2 w-2 rounded-full bg-emerald-300"/><div className="mx-auto rounded-md bg-white px-12 py-1 text-[9px] text-slate-400">yourwebsite.com</div></div>
            <div className="min-h-[580px] p-5 md:p-10" onClick={()=>setSelected(null)}>
              {blocks.length===0?<div className="flex min-h-[480px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 px-5 text-center" onDragOver={e=>{e.preventDefault();setDropIndex(0)}} onDrop={e=>{e.preventDefault();e.stopPropagation();dropAt(0)}}><div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white text-indigo-600 shadow-sm"><MousePointer2 size={25}/></div><h2 className="text-lg font-semibold">Start building your page</h2><p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">Drag an element from the left panel and drop it here.</p><button onClick={e=>{e.stopPropagation();add("heading")}} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50"><Plus size={14}/> Add a heading</button></div>:
              <div className="mx-auto max-w-3xl" onClick={e=>e.stopPropagation()}>
                {blocks.map((b,i)=><div key={b.id}>
                  <div onDragOver={e=>{e.preventDefault();e.stopPropagation();setDropIndex(i)}} onDrop={e=>{e.preventDefault();e.stopPropagation();dropAt(i)}} className={`my-1 h-2 rounded-full transition ${dropIndex===i?"drop-target":""}`}/>
                  <div draggable onDragStart={e=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",b.id);setDrag({kind:"block",id:b.id});}} onDragEnd={()=>{setDrag(null);setDropIndex(null)}} onClick={()=>setSelected(b.id)} className={`group relative my-1 rounded-lg border-2 p-4 transition ${selected===b.id?"border-indigo-500 bg-indigo-50/20":"border-transparent hover:border-slate-200"} ${drag?.id===b.id?"dragging":""}`}>
                    {selected===b.id&&<div className="absolute -top-[23px] left-[-2px] rounded-t-md bg-indigo-600 px-2 py-1 text-[9px] font-semibold uppercase text-white">{b.type}</div>}
                    {selected===b.id&&<button title="Delete element" onClick={e=>{e.stopPropagation();remove(b.id)}} className="absolute -right-2 -top-3 z-10 grid h-7 w-7 place-items-center rounded-md bg-indigo-600 text-white shadow hover:bg-red-500"><Trash2 size={13}/></button>}
                    {b.type==="heading"&&<h1 style={{fontSize:b.size,color:b.color,textAlign:b.align,lineHeight:1.2}} className="py-2 font-bold tracking-tight">{b.text}</h1>}
                    {b.type==="text"&&<p style={{fontSize:b.size,color:b.color,textAlign:b.align}} className="whitespace-pre-wrap leading-7">{b.text}</p>}
                    {b.type==="button"&&<div style={{textAlign:b.align}}><span style={{fontSize:b.size}} className="inline-block rounded-lg bg-slate-900 px-6 py-3 font-medium text-white">{b.text}</span></div>}
                    {b.type==="image"&&<div className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400"><ImageIcon size={32}/><span className="text-xs">{b.text}</span><span className="text-[10px]">Image upload not included yet</span></div>}
                    {b.type==="divider"&&<hr style={{border:0,borderTop:`${b.size}px solid ${b.color}`,margin:"12px 0"}}/>}
                    {b.type==="spacer"&&<div style={{height:b.size}} className="flex items-center justify-center rounded border border-dashed border-slate-200 text-[10px] text-slate-400">Spacer · {b.size}px</div>}
                    {selected===b.id&&<div className="absolute -bottom-2 left-2 rounded bg-indigo-600 px-1.5 py-0.5 text-[9px] text-white">Selected</div>}
                  </div>
                </div>)}
                <div onDragOver={e=>{e.preventDefault();setDropIndex(blocks.length)}} onDrop={e=>{e.preventDefault();e.stopPropagation();dropAt(blocks.length)}} className={`mt-2 flex min-h-16 items-center justify-center rounded-lg border-2 border-dashed text-xs transition ${dropIndex===blocks.length?"drop-target border-indigo-400":"border-slate-200 text-slate-400 hover:border-indigo-300"}`}><Plus size={14} className="mr-2"/> Drop here to add an element</div>
              </div>}
            </div>
          </div><div className="mt-3 flex justify-between text-[10px] text-slate-400"><span>Canvas · {blocks.length} elements</span><span>Autosaved in this browser</span></div>
        </div></div>
      </section>
      <aside className="hidden w-[235px] shrink-0 flex-col border-l border-slate-200 bg-white xl:flex">
        <div className="flex h-12 items-center gap-2 border-b border-slate-100 px-4"><Layers3 size={15}/><span className="text-sm font-semibold">Layers</span><span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px]">{blocks.length}</span></div>
        <div className="flex-1 overflow-y-auto p-3">{blocks.length===0?<div className="px-3 py-12 text-center"><Layers3 size={24} className="mx-auto mb-3 text-slate-300"/><p className="text-xs font-medium">No elements yet</p><p className="mt-1 text-[11px] leading-5 text-slate-400">Add elements to see the layer list.</p></div>:blocks.map((b,i)=>{const item=catalog.find(c=>c.type===b.type)!;const I=item.icon;return <div key={b.id} onClick={()=>setSelected(b.id)} className={`mb-1 flex items-center gap-2 rounded-lg px-2 py-2 text-xs ${selected===b.id?"bg-indigo-50 text-indigo-700":"text-slate-600 hover:bg-slate-50"}`}><GripVertical size={12} className="text-slate-300"/><I size={14}/><span className="flex-1 truncate">{b.text||item.label}</span><button title="Move up" disabled={i===0} onClick={e=>{e.stopPropagation();move(b.id,i-1)}} className="disabled:opacity-20"><ArrowUp size={12}/></button><button title="Move down" disabled={i===blocks.length-1} onClick={e=>{e.stopPropagation();move(b.id,i+2)}} className="disabled:opacity-20"><ArrowDown size={12}/></button></div>})}</div>
        <div className="border-t border-slate-100 p-4"><div className="mb-3 text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Element settings</div>{active?<div className="space-y-4"><div className="flex items-center justify-between"><span className="text-xs font-semibold capitalize">{active.type}</span><button onClick={()=>setSelected(null)}><X size={14} className="text-slate-400"/></button></div>{active.type!=="divider"&&active.type!=="spacer"&&<label className="block text-xs font-medium text-slate-600">Text / label<textarea value={active.text} onChange={e=>update(active.id,{text:e.target.value})} rows={3} className="mt-2 w-full resize-y rounded-lg border border-slate-200 p-2 text-xs outline-none focus:border-indigo-400"/></label>}{active.type!=="divider"&&active.type!=="spacer"&&<label className="block text-xs font-medium text-slate-600">Alignment<select value={active.align} onChange={e=>update(active.id,{align:e.target.value as Block["align"]})} className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>}{active.type!=="divider"&&<label className="block text-xs font-medium text-slate-600">{active.type==="spacer"?"Height":active.type==="image"?"Label size":"Font size"} <span className="float-right text-slate-400">{active.size}px</span><input type="range" min={active.type==="spacer"?8:active.type==="divider"?1:10} max={active.type==="spacer"?200:active.type==="divider"?8:active.type==="heading"?72:36} value={active.size} onChange={e=>update(active.id,{size:Number(e.target.value)})} className="mt-3 w-full accent-indigo-600"/></label>}{active.type!=="button"&&active.type!=="image"&&active.type!=="spacer"&&<label className="block text-xs font-medium text-slate-600">Color<div className="mt-2 flex items-center gap-2"><input type="color" value={active.color} onChange={e=>update(active.id,{color:e.target.value})} className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-white p-1"/><span className="font-mono text-[11px] text-slate-500">{active.color}</span></div></label>}<button onClick={()=>remove(active.id)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-100 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"><Trash2 size={13}/> Delete element</button></div>:<p className="text-xs leading-5 text-slate-400">Select a canvas element to edit its text, size, alignment, and color.</p>}</div>
      </aside>
    </div>
    {notice&&<div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-medium text-white shadow-lg">{notice}</div>}
  </main>;
}