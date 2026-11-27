import { useId, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isContainer, resolveStyles, type Breakpoint, type EditorNode, type StyleValues } from "@/lib/builder-document";
import { CssValueInput, StyleInspectorSection } from "./style-inspector-controls";

const displayOptions = ["block", "flex", "grid", "none"];
const justifyOptions = ["normal", "start", "center", "end", "space-between", "space-around", "space-evenly"];
const overflowOptions = ["visible", "hidden", "clip", "auto", "scroll"];

const dimensionFields = [
  ["width", "Width"], ["height", "Height"],
  ["minWidth", "Min width"], ["maxWidth", "Max width"],
  ["minHeight", "Min height"], ["maxHeight", "Max height"],
] as const;

type CssValueProperty = typeof dimensionFields[number][0]
  | "margin" | "padding" | "inset" | "zIndex" | "gridTemplateColumns" | "gridTemplateRows" | "gap";

type LayoutProperty = CssValueProperty | "display" | "flexDirection" | "flexWrap" | "alignItems"
  | "justifyContent" | "position" | "overflow";

type LayoutInspectorProps = {
  breakpoint: Breakpoint;
  node: EditorNode;
  onChange: (styles: Partial<StyleValues>) => void;
  onReset: (property: LayoutProperty) => void;
};

export function LayoutInspector({ breakpoint, node, onChange, onReset }: LayoutInspectorProps) {
  const id = useId();
  const style = resolveStyles(node, breakpoint);
  const display = style.display ?? "block";
  const container = isContainer(node.type);
  const flex = display === "flex" || display === "inline-flex";
  const grid = display === "grid" || display === "inline-grid";
  const disclosure = node.metadata?.appearance === "preset-question";
  const position = style.position ?? "relative";

  function field(property: LayoutProperty, label: string, render: (id: string) => ReactNode) {
    const fieldId = `${id}-${property}`;
    return (
      <div className="grid grid-cols-[68px_minmax(0,1fr)_28px] items-start gap-2">
        <label className="pt-2 text-[11px] text-zinc-600" htmlFor={fieldId}>{label}</label>
        {render(fieldId)}
        {Object.hasOwn(node.styles[breakpoint] ?? {}, property) && (
          <Button
            aria-label={`Reset ${label}`}
            className="size-7 self-start text-zinc-500 hover:text-orange-600"
            onClick={() => onReset(property)}
            size="icon-sm"
            title={breakpoint === "base" ? "Reset to default" : "Reset to inherited"}
            variant="ghost"
          >
            <RotateCcw aria-hidden="true" className="size-3" />
          </Button>
        )}
      </div>
    );
  }

  function select(property: LayoutProperty, label: string, value: string, options: string[]) {
    return field(property, label, (fieldId) => (
      <select
        className="h-8 min-w-0 rounded-lg border border-input bg-zinc-50 px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        id={fieldId}
        onChange={(event) => onChange({ [property]: event.target.value })}
        value={value}
      >
        {!options.includes(value) && <option value={value}>{value}</option>}
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    ));
  }

  function cssValue(property: CssValueProperty, label: string, hint: string, fallback?: string) {
    return field(property, label, (fieldId) => (
      <CssValueInput
        hint={hint}
        id={fieldId}
        onChange={(value) => onChange({ [property]: value })}
        pixelUnits={property !== "zIndex"}
        property={property}
        value={style[property] ?? fallback}
      />
    ));
  }

  return (
    <StyleInspectorSection title="Layout">
      {container && select("display", "Display", display, disclosure ? ["block", "none"] : displayOptions)}
      {container && !disclosure && flex && (
        <>
          {select("flexDirection", "Direction", style.flexDirection ?? "row", ["row", "column"])}
          {select("flexWrap", "Wrap", style.flexWrap ?? "nowrap", ["nowrap", "wrap"])}
        </>
      )}
      {container && !disclosure && (flex || grid) && (
        <>
          {select("alignItems", "Align items", style.alignItems ?? "normal", ["normal", "start", "center", "end", "stretch", "baseline"])}
          {select("justifyContent", "Justify content", style.justifyContent ?? "normal", grid ? [...justifyOptions, "stretch"] : justifyOptions)}
          {grid && cssValue("gridTemplateColumns", "Grid columns", "Enter CSS tracks such as 1fr 1fr or auto.", "none")}
          {grid && cssValue("gridTemplateRows", "Grid rows", "Enter CSS tracks such as 1fr 1fr or auto.", "none")}
          {cssValue("gap", "Gap", "Enter a CSS gap such as 16px or 1rem.", "normal")}
        </>
      )}
      {display !== "none" && (
        <>
          {dimensionFields.map(([property, label]) => (
            <div key={property}>{cssValue(property, label, "Enter a CSS size such as 320px or 50%.")}</div>
          ))}
          {cssValue("margin", "Margin", "Enter 1–4 values, such as 12px auto.")}
          {cssValue("padding", "Padding", "Enter 1–4 nonnegative values, such as 8px 1rem.")}
          {select("position", "Position", position, ["relative", "absolute"])}
          {position !== "static" && cssValue("inset", "Inset", "Enter 1–4 values in top, right, bottom, left order, such as 0 auto auto 8px.", "auto")}
          {select("overflow", "Overflow", style.overflow ?? "visible", overflowOptions)}
          {cssValue("zIndex", "Z-index", "Enter a whole number or auto.", "auto")}
        </>
      )}
    </StyleInspectorSection>
  );
}
