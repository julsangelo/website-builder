import { useId, useState, type ReactNode } from "react";
import {
  AlignHorizontalJustifyStart, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignHorizontalSpaceBetween,
  AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalSpaceBetween,
  ArrowDown, ArrowRight, Grid2X2, Link2, Rows2, StretchHorizontal, StretchVertical, Unlink2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { isContainer, resolveStyles, type Breakpoint, type EditorNode, type StyleValues } from "@/lib/builder-document";
import { AdvancedControls, CssValueInput, InspectorChoices, InspectorField, InspectorNumber, StyleInspectorSection } from "./style-inspector-controls";

const selectClass = "h-8 w-full min-w-0 rounded-lg border border-input bg-zinc-50 px-2 text-xs focus-visible:outline-ring";
const units = ["px", "%", "rem", "em", "vw", "vh"];
const sides = ["Top", "Right", "Bottom", "Left"];
const arrange = [
  { value: "block", label: "Free", icon: <Rows2 />, hint: "Use the natural flow of each child" },
  { value: "row", label: "Horizontal", icon: <ArrowRight />, hint: "Place children in a row" },
  { value: "column", label: "Vertical", icon: <ArrowDown />, hint: "Stack children from top to bottom" },
  { value: "grid", label: "Grid", icon: <Grid2X2 />, hint: "Arrange children in columns and rows" },
];
const alignments = [
  { value: "start", label: "Start", horizontal: AlignHorizontalJustifyStart, vertical: AlignVerticalJustifyStart },
  { value: "center", label: "Center", horizontal: AlignHorizontalJustifyCenter, vertical: AlignVerticalJustifyCenter },
  { value: "end", label: "End", horizontal: AlignHorizontalJustifyEnd, vertical: AlignVerticalJustifyEnd },
  { value: "stretch", label: "Stretch", horizontal: StretchHorizontal, vertical: StretchVertical },
  { value: "space-between", label: "Spread out", horizontal: AlignHorizontalSpaceBetween, vertical: AlignVerticalSpaceBetween },
];
const dimensions = [["minWidth", "Min width"], ["maxWidth", "Max width"], ["minHeight", "Min height"], ["maxHeight", "Max height"]] as const;

function length(value: unknown) {
  if (typeof value === "number" || value === "0") return { amount: String(value), unit: "px" };
  const match = typeof value === "string" && value.match(/^(-?(?:\d+\.?\d*|\.\d+))(px|%|rem|em|vw|vh)$/i);
  return match ? { amount: match[1], unit: match[2].toLowerCase() } : undefined;
}

function LengthField({ label, value, onChange, signed, placeholder = "Default" }: {
  label: string; value: unknown; signed?: boolean; placeholder?: string; onChange: (value: string) => void;
}) {
  const parsed = length(value);
  const [preferredUnit, setUnit] = useState("px");
  const unit = parsed?.unit ?? preferredUnit;
  return <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_4rem] gap-1">
    <InspectorNumber label={label} signed={signed} value={parsed?.amount ?? ""} placeholder={placeholder}
      onChange={(amount) => onChange(amount + unit)} />
    <select aria-label={label + " unit"} className={selectClass} value={unit} onChange={(event) => {
      setUnit(event.target.value);
      if (parsed) onChange(parsed.amount + event.target.value);
    }}>{units.map((item) => <option key={item}>{item}</option>)}</select>
  </div>;
}

function Spacing({ label, value, signed, onChange }: {
  label: string; value: string | number | undefined; signed?: boolean; onChange: (value: string) => void;
}) {
  const tokens = typeof value === "number" ? [value + "px"] : value?.trim().split(/\s+/);
  const simple = tokens && tokens.length <= 4 && tokens.every((token) => length(token));
  const [top, right = top, bottom = top, left = right] = simple ? tokens : [];
  const values = [top, right, bottom, left];
  const [unlinked, setUnlinked] = useState(false);
  const separate = unlinked || values.some((side) => side !== top);
  const custom = value !== undefined && !simple;
  return <div className="space-y-1.5 rounded-lg border border-zinc-200 p-2">
    <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-zinc-600">
      {signed ? "Outside spacing" : "Inside spacing"}
      <Button size="sm" variant="ghost" className="h-6 gap-1 px-1 text-[11px]"
        aria-label={(separate ? "Link " : "Unlink ") + label.toLowerCase() + " sides"}
        disabled={custom} title={custom ? "Enter a uniform value or edit the custom spacing in Advanced" : undefined}
        onClick={() => {
          if (separate && top && values.some((side) => side !== top)) onChange(top);
          setUnlinked(!separate);
        }}>{separate ? <Unlink2 /> : <Link2 />}{separate ? "Unlinked" : "Linked"}</Button>
    </div>
    {separate && !custom ? sides.map((side, index) => <div key={side}>
      <span className="text-[11px] text-zinc-500">{side}</span>
      <LengthField label={label + " " + side.toLowerCase()} signed={signed} value={values[index]} onChange={(next) => {
        setUnlinked(true);
        onChange(values.map((old, i) => i === index ? next : old ?? "0px").join(" "));
      }} />
    </div>) : <LengthField label={label + " all sides"} signed={signed} value={top} placeholder={custom ? "Custom" : "Default"} onChange={onChange} />}
  </div>;
}

function columnCount(tracks?: string | number) {
  if (typeof tracks !== "string") return "";
  const track = "(?:1fr|minmax\\(0,\\s*1fr\\))";
  const repeat = tracks.match(new RegExp("^repeat\\((\\d+),\\s*" + track + "\\)$"));
  if (repeat) return repeat[1];
  return new RegExp("^" + track + "(?:\\s+" + track + ")*$").test(tracks) ? String(tracks.match(/1fr/g)?.length) : "";
}

type Property = keyof StyleValues;
export function LayoutInspector({ breakpoint, node, onChange, onReset }: {
  breakpoint: Breakpoint; node: EditorNode; onChange: (styles: StyleValues) => void;
  onReset: (property: Property | readonly Property[]) => void;
}) {
  const id = useId();
  const style = resolveStyles(node, breakpoint);
  const display = style.display ?? "block";
  const container = isContainer(node.type);
  const arrangeable = container && node.metadata?.appearance !== "preset-question";
  const flex = arrangeable && ["flex", "inline-flex"].includes(display);
  const grid = arrangeable && ["grid", "inline-grid"].includes(display);
  const direction = style.flexDirection ?? "row";
  const mode = display === "flex" ? direction : display;
  const visible = display !== "none";
  const count = columnCount(style.gridTemplateColumns);
  const field = (properties: Property[], label: string, body: ReactNode, fieldId?: string) =>
    <InspectorField key={label} id={fieldId} label={label} breakpoint={breakpoint} node={node}
      properties={properties} onReset={() => onReset(properties)}>{body}</InspectorField>;
  function raw(property: Property, label: string, hint: string, fallback?: string, common = false) {
    const fieldId = id + property;
    const input = <CssValueInput id={fieldId} property={property} hint={hint} pixelUnits={property !== "zIndex"}
      value={style[property] ?? fallback} onChange={(value) => onChange({ [property]: value })} />;
    return common ? <div key={property}><label className="text-[11px] text-zinc-600" htmlFor={fieldId}>{label}</label>{input}</div>
      : field([property], label, input, fieldId);
  }
  function select(property: Property, label: string, fallback: string, options: string[]) {
    const value = String(style[property] ?? fallback);
    return field([property], label, <select className={selectClass} id={id + property} value={value}
      onChange={(event) => onChange({ [property]: event.target.value })}>
      {!options.includes(value) && <option>{value}</option>}
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>, id + property);
  }
  function alignment(property: "alignItems" | "justifyContent", horizontal: boolean) {
    const align = property === "alignItems";
    const label = (align ? "Align " : "Distribute ") + (horizontal ? "horizontally" : "vertically");
    const value = style[property] ?? "normal";
    const choices = alignments.filter((item) => item.value !== (align ? "space-between" : "stretch")).map((item) => {
      const Icon = horizontal ? item.horizontal : item.vertical;
      return { value: item.value, label: item.label, icon: <Icon /> };
    });
    return field([property], label, <>
      <InspectorChoices label={label + " choices"} options={choices} value={value} onChange={(next) => onChange({ [property]: next })} />
      {!choices.some((item) => item.value === value) && <small>{value === "normal" ? "Automatic" : "Custom"}</small>}
    </>);
  }
  function size(property: "width" | "height", label: string) {
    const value = style[property];
    const mode = value === "100%" ? "Fill" : value === "fit-content" ? "Fit content" : length(value) ? "Fixed" : undefined;
    const presets = { Fill: "100%", "Fit content": "fit-content", Fixed: mode === "Fixed" ? value : "100px" };
    return field([property], label, <>
      <InspectorChoices label={label + " choices"} value={mode}
        options={Object.keys(presets).map((name) => ({ value: name, label: name }))}
        onChange={(next) => onChange({ [property]: presets[next as keyof typeof presets] })} />
      {mode === "Fixed" && <LengthField label={label + " value"} value={value} onChange={(next) => onChange({ [property]: next })} />}
      {!mode && <small>{value === undefined || value === "auto" ? "Automatic" : "Custom"}</small>}
    </>);
  }
  const setCount = (next: string) => onChange({ gridTemplateColumns: `repeat(${next}, minmax(0, 1fr))` });
  return <StyleInspectorSection title="Layout">
    {arrangeable && field(["display", "flexDirection"], "Arrange children", <>
      <InspectorChoices label="Arrangement" options={arrange} value={mode} onChange={(next) =>
        onChange(next === "row" || next === "column" ? { display: "flex", flexDirection: next } : { display: next })} />
      {!arrange.some((option) => option.value === mode) && <small>{display === "none" ? "Hidden" : "Custom"}</small>}
    </>)}
    {grid && field(["gridTemplateColumns"], "Grid columns", <>
      <InspectorChoices label="Column presets" value={count} onChange={setCount}
        options={["1", "2", "3", "4"].map((n) => ({ value: n, label: n }))} />
      <InspectorNumber label="Column count" value={count} placeholder={style.gridTemplateColumns ? "Custom" : "Automatic"} onChange={setCount} count />
    </>)}
    {(flex || grid) && <>
      {alignment("alignItems", flex && direction.startsWith("column"))}
      {alignment("justifyContent", grid || direction.startsWith("row"))}
      {field(["gap"], "Gap", <LengthField label="Gap amount" value={style.gap} placeholder={style.gap && style.gap !== "normal" ? "Custom" : "Automatic"} onChange={(gap) => onChange({ gap })} />)}
    </>}
    {visible && <>
      {size("width", "Width")}{size("height", "Height")}
      {field(["padding"], "Padding", <Spacing label="Padding" value={style.padding} onChange={(padding) => onChange({ padding })} />)}
      {field(["margin"], "Margin", <Spacing label="Margin" value={style.margin} signed onChange={(margin) => onChange({ margin })} />)}
    </>}
    <AdvancedControls>
      {container && select("display", "Display", "block", arrangeable ? ["block", "flex", "inline-flex", "grid", "inline-grid", "none"] : ["block", "none"])}
      {flex && select("flexDirection", "Direction", "row", ["row", "column", "row-reverse", "column-reverse"])}
      {flex && select("flexWrap", "Wrap", "nowrap", ["nowrap", "wrap", "wrap-reverse"])}
      {(flex || grid) && <>
        {select("alignItems", "Align items", "normal", ["normal", "start", "center", "end", "stretch", "baseline"])}
        {select("justifyContent", "Justify content", "normal", ["normal", "start", "center", "end", "space-between", "space-around", "space-evenly", ...(grid ? ["stretch"] : [])])}
        {raw("gap", "Gap", "Enter a spacing value such as 12px or 1rem.", "normal", true)}
      </>}
      {grid && <>
        {raw("gridTemplateColumns", "Grid columns", "Enter column sizes such as 1fr 2fr.", "none", true)}
        {raw("gridTemplateRows", "Grid rows", "Enter row sizes such as 80px auto.", "none")}
      </>}
      {visible && <>
        {raw("width", "Width", "Enter a size such as 320px or 50%.", undefined, true)}
        {raw("height", "Height", "Enter a size such as 320px or 50%.", undefined, true)}
        {dimensions.map(([key, label]) => raw(key, label, "Enter a size such as 320px or 50%."))}
        {raw("padding", "Padding", "Enter one to four nonnegative lengths.", undefined, true)}
        {raw("margin", "Margin", "Enter one to four lengths or auto.", undefined, true)}
        {select("position", "Position", "relative", ["relative", "absolute"])}
        {style.position !== "static" && raw("inset", "Inset", "Enter one to four offsets such as 8px or auto.", "auto")}
        {select("overflow", "Overflow", "visible", ["visible", "hidden", "clip", "auto", "scroll"])}
        {raw("zIndex", "Z-index", "Enter a whole number or auto.", "auto")}
      </>}
    </AdvancedControls>
  </StyleInspectorSection>;
}
