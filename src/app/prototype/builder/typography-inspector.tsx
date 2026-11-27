import { useId } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  resolveStyles,
  type Breakpoint,
  type EditorNode,
  type StyleValues,
} from "@/lib/builder-document";
import { CssValueInput, StyleInspectorSection } from "./style-inspector-controls";

export function ownsText(node: EditorNode) {
  switch (node.type) {
    case "heading":
    case "text":
    case "button":
    case "card":
    case "quote":
    case "stat":
    case "accordion":
    case "form":
    case "navigation":
    case "footer":
      return true;
    case "section":
      return typeof node.metadata?.preset !== "string"
        && (node.content.title !== undefined || node.content.body !== undefined);
    case "box":
      return node.content.body !== undefined;
    case "stack":
      return node.metadata?.appearance !== "split-content"
        && (node.content.title !== undefined || node.content.body !== undefined);
    default:
      return false;
  }
}

const fields = [
  { property: "fontFamily", label: "Font family", hint: 'Enter a CSS font stack such as Georgia, serif.' },
  { property: "fontWeight", label: "Weight", options: [
    ["100", "Thin"], ["200", "Extra light"], ["300", "Light"], ["400", "Regular"], ["500", "Medium"],
    ["600", "Semibold"], ["700", "Bold"], ["800", "Extra bold"], ["900", "Black"],
  ] },
  { property: "fontSize", label: "Size", hint: "Enter a CSS size such as 24px or 1.5rem.", pixelUnits: true },
  { property: "lineHeight", label: "Line height", hint: "Enter a line height such as 1.4, 120%, or 24px." },
  { property: "letterSpacing", label: "Letter spacing", hint: "Enter a CSS length such as -0.02em or 1px.", pixelUnits: true },
  { property: "color", label: "Color", hint: "Enter a CSS color such as #275d38 or rebeccapurple." },
  { property: "textAlign", label: "Alignment", options: [
    ["start", "Start"], ["left", "Left"], ["center", "Center"], ["right", "Right"], ["end", "End"], ["justify", "Justify"],
  ] },
  { property: "textDecorationLine", label: "Decoration", options: [
    ["none", "None"], ["underline", "Underline"], ["overline", "Overline"], ["line-through", "Strikethrough"],
  ] },
  { property: "textTransform", label: "Transform", options: [
    ["none", "None"], ["uppercase", "Uppercase"], ["lowercase", "Lowercase"], ["capitalize", "Capitalize"],
  ] },
  { property: "fontStyle", label: "Style", options: [
    ["normal", "Normal"], ["italic", "Italic"], ["oblique", "Oblique"],
  ] },
  { property: "whiteSpace", label: "Wrapping", options: [
    ["pre-wrap", "Wrap (keep breaks)"], ["normal", "Wrap"],
    ["pre", "No wrap (keep breaks)"], ["nowrap", "No wrap"],
  ] },
] as const satisfies readonly ({ property: keyof StyleValues; label: string } & (
  { hint: string; pixelUnits?: boolean } | { options: readonly (readonly [string, string])[] }
))[];

type TypographyProperty = typeof fields[number]["property"];

export function splitTypographyStyles(style: StyleValues) {
  const frameStyle = { ...style };
  const textStyle = Object.fromEntries(fields.flatMap(({ property }) => {
    const value = frameStyle[property];
    delete frameStyle[property];
    return value === undefined ? [] : [[property, value]];
  })) as Pick<StyleValues, TypographyProperty>;
  return { frameStyle, textStyle };
}

export function TypographyInspector({ breakpoint, node, onChange, onReset }: {
  breakpoint: Breakpoint;
  node: EditorNode;
  onChange: (styles: Partial<StyleValues>) => void;
  onReset: (property: TypographyProperty) => void;
}) {
  const id = useId();
  const styles = resolveStyles(node, breakpoint);

  return (
    <StyleInspectorSection title="Typography">
      {fields.map((field) => {
        const { property, label } = field;
        const fieldId = `${id}-${property}`;
        const value = styles[property];
        return (
          <div className="grid grid-cols-[76px_minmax(0,1fr)_28px] items-start gap-2" key={property}>
            <label className="pt-2 text-[11px] text-zinc-600" htmlFor={fieldId}>{label}</label>
            {"options" in field ? (
              <select
                className="h-8 min-w-0 rounded-lg border border-input bg-zinc-50 px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                id={fieldId}
                onChange={(event) => onChange({ [property]: event.target.value })}
                value={String(value ?? "")}
              >
                <option disabled value="">Default</option>
                {value !== undefined && !field.options.some(([option]) => option === String(value)) && (
                  <option value={value}>{value}</option>
                )}
                {field.options.map(([option, name]) => <option key={option} value={option}>{name}</option>)}
              </select>
            ) : (
              <CssValueInput
                hint={field.hint}
                id={fieldId}
                onChange={(value) => onChange({ [property]: value })}
                pixelUnits={"pixelUnits" in field && field.pixelUnits}
                property={property}
                value={value}
              />
            )}
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
      })}
    </StyleInspectorSection>
  );
}
