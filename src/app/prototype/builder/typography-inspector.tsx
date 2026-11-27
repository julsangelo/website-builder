import { useId, useState, type ReactNode } from "react";

import {
  resolveStyles,
  type Breakpoint,
  type EditorNode,
  type StyleValues,
} from "@/lib/builder-document";
import { Combobox } from "@base-ui/react/combobox";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AdvancedControls, CssValueInput, InspectorChoices, InspectorField, InspectorNumber, StyleInspectorSection,
} from "./style-inspector-controls";

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


const advancedFields = [
  ["textDecorationLine", "Decoration", [
    ["none", "None"], ["underline", "Underline"], ["overline", "Overline"], ["line-through", "Strikethrough"],
  ]],
  ["textTransform", "Capitalization", [
    ["none", "None"], ["uppercase", "Uppercase"], ["lowercase", "Lowercase"], ["capitalize", "Capitalize"],
  ]],
  ["whiteSpace", "Wrapping", [
    ["normal", "Wrap"], ["pre-wrap", "Wrap (keep breaks)"], ["pre", "No wrap (keep breaks)"], ["nowrap", "No wrap"],
  ]],
] as const;

const properties = [
  "fontFamily", "fontWeight", "fontSize", "lineHeight", "color", "textAlign", "fontStyle", "letterSpacing",
  ...advancedFields.map(([property]) => property),
] as const;
type TypographyProperty = typeof properties[number];

const selectClass = "h-8 min-w-0 rounded-lg border border-input bg-zinc-50 px-2 text-xs focus-visible:outline-ring";
const fonts = [
  ["System sans", "system-ui"], ["Arial", "Arial, sans-serif"], ["Georgia", "Georgia, serif"],
  ["Times New Roman", '"Times New Roman", serif'], ["Verdana", "Verdana, sans-serif"],
  ["Courier New", '"Courier New", monospace'],
].map(([label, value]) => ({ label, value }));

function FontPicker({ id, value, onChange }: {
  id: string; value?: string; onChange: (value: string) => void;
}) {
  const selected = fonts.find((font) => font.value === value);
  return (
    <div className="min-w-0 space-y-1">
      <Combobox.Root items={fonts} value={selected ?? null} onValueChange={(font) => {
        if (font) onChange(font.value);
      }}>
        <div className="relative">
          <Combobox.Input id={id} className={selectClass + " w-full pr-8"} placeholder="Search fonts" />
          <Combobox.Trigger aria-label="Show fonts" className="absolute inset-y-0 right-0 grid w-8 place-items-center rounded-lg focus-visible:outline-ring">
            <ChevronDown aria-hidden="true" className="size-3.5" />
          </Combobox.Trigger>
        </div>
        <Combobox.Portal>
          <Combobox.Positioner sideOffset={4} className="z-50">
            <Combobox.Popup className="max-h-56 w-[var(--anchor-width)] overflow-auto rounded-lg border bg-white p-1 text-xs shadow-md">
              <Combobox.Empty className="p-2">No matching fonts</Combobox.Empty>
              <Combobox.List>
                {(font: typeof fonts[number]) => (
                  <Combobox.Item key={font.value} value={font}
                    className="cursor-default rounded px-2 py-1.5 data-highlighted:bg-orange-50 data-selected:font-semibold"
                    style={{ fontFamily: font.value }}
                  >{font.label}</Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
      <p className="break-words rounded border border-zinc-100 px-2 py-1 text-sm" style={{ fontFamily: value }}>
        {value && !selected ? value : "Aa Bb Cc"}
      </p>
    </div>
  );
}

const sizeUnits = [["px", "px"], ["rem", "rem"], ["em", "em"], ["%", "%"], ["vw", "vw"], ["vh", "vh"]] as const;
const spacingUnits = [["", "×"], ...sizeUnits] as const;

function TypographyMeasure({ label, value, onChange, lineSpacing }: {
  label: string; value?: string | number; onChange: (value: string) => void; lineSpacing?: boolean;
}) {
  const units = lineSpacing ? spacingUnits : sizeUnits;
  const [preferredUnit, setPreferredUnit] = useState(lineSpacing ? "" : "px");
  const cssValue = typeof value === "number" && !lineSpacing ? value + "px" : String(value ?? "");
  const match = /^(?:([+]?(?:\d+\.?\d*|\.\d+))([a-z%]*))$/i.exec(cssValue);
  const parsed = match && units.some(([unit]) => unit === match[2].toLowerCase()) ? match : null;
  const amount = parsed?.[1] ?? (cssValue === "0" ? "0" : "");
  const unit = parsed?.[2].toLowerCase() ?? preferredUnit;
  const step = unit === "" || unit === "em" || unit === "rem" ? 0.1 : 1;

  function stepValue(direction: number) {
    const start = amount === "" ? (lineSpacing ? (unit === "%" ? 100 : unit === "" ? 1 : 16) : 16) : Number(amount);
    const next = Math.max(0, Number((start + direction * step).toFixed(8)));
    onChange(next + unit);
  }

  return (
    <div className="space-y-1">
      <div className="flex min-w-0 items-start gap-1">
        <InspectorNumber label={label} value={amount} placeholder={cssValue && !amount ? "Custom" : "Default"}
          onChange={(number) => onChange(number + unit)} />
        <select aria-label={label + " unit"} className={selectClass + " w-14 shrink-0"} value={unit}
          onChange={(event) => {
            setPreferredUnit(event.target.value);
            if (amount !== "") onChange(amount + event.target.value);
          }}>
          {units.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
        </select>
        <Button size="icon-sm" variant="outline" className="h-8 shrink-0" aria-label={"Decrease " + label.toLowerCase()}
          onClick={() => stepValue(-1)}>−</Button>
        <Button size="icon-sm" variant="outline" className="h-8 shrink-0" aria-label={"Increase " + label.toLowerCase()}
          onClick={() => stepValue(1)}>+</Button>
      </div>
      {cssValue && !amount && <p className="break-words text-xs text-zinc-500">{cssValue}</p>}
      {lineSpacing && <p className="text-xs text-zinc-500">Space between lines. Use × for a multiple of the text size.</p>}
    </div>
  );
}

export function splitTypographyStyles(style: StyleValues) {
  const frameStyle = { ...style };
  const textStyle = Object.fromEntries(properties.flatMap((property) => {
    const value = frameStyle[property];
    delete frameStyle[property];
    return value === undefined ? [] : [[property, value]];
  })) as Pick<StyleValues, TypographyProperty>;
  return { frameStyle, textStyle };
}

const alignmentOptions = [
  { value: "left", label: "Left", icon: <AlignLeft aria-hidden="true" /> },
  { value: "center", label: "Center", icon: <AlignCenter aria-hidden="true" /> },
  { value: "right", label: "Right", icon: <AlignRight aria-hidden="true" /> },
  { value: "justify", label: "Justify", icon: <AlignJustify aria-hidden="true" /> },
];

export function TypographyInspector({ breakpoint, node, onChange, onReset }: {
  breakpoint: Breakpoint;
  node: EditorNode;
  onChange: (styles: Partial<StyleValues>) => void;
  onReset: (property: TypographyProperty) => void;
}) {
  const id = useId();
  const styles = resolveStyles(node, breakpoint);
  const fieldId = (property: TypographyProperty) => id + "-" + property;

  function field(property: TypographyProperty, label: string, children: ReactNode, controlId?: string) {
    return (
      <InspectorField key={property} id={controlId} label={label} properties={[property]} node={node}
        breakpoint={breakpoint} onReset={() => onReset(property)}>
        {children}
      </InspectorField>
    );
  }

  function raw(property: TypographyProperty, hint: string, controlId = fieldId(property)) {
    return (
      <CssValueInput id={controlId} property={property} hint={hint} value={styles[property]}
        pixelUnits={property === "fontSize" || property === "letterSpacing"}
        onChange={(value) => onChange({ [property]: value })} />
    );
  }

  function select(property: TypographyProperty, label: string, options: readonly (readonly [string, string])[]) {
    const value = String(styles[property] ?? "");
    return field(property, label, (
      <select className={selectClass + " w-full"} id={fieldId(property)} value={value}
        onChange={(event) => onChange({ [property]: event.target.value })}>
        <option disabled value="">Default</option>
        {value && !options.some(([option]) => value === option) && <option value={value}>Custom · {value}</option>}
        {options.map(([option, name]) => <option key={option} value={option}>{name}</option>)}
      </select>
    ), fieldId(property));
  }

  const color = styles.color;
  const alignment = styles.textAlign;
  return (
    <StyleInspectorSection title="Typography">
      {field("fontFamily", "Font", <FontPicker id={fieldId("fontFamily")} value={styles.fontFamily}
        onChange={(value) => onChange({ fontFamily: value })} />, fieldId("fontFamily"))}
      {select("fontWeight", "Weight", [["400", "Regular"], ["500", "Medium"], ["600", "Semibold"], ["700", "Bold"]])}
      {select("fontStyle", "Style", [["normal", "Normal"], ["italic", "Italic"]])}
      {field("fontSize", "Size", <TypographyMeasure label="Size" value={styles.fontSize}
        onChange={(value) => onChange({ fontSize: value })} />)}
      {field("lineHeight", "Line spacing", <TypographyMeasure label="Line spacing" value={styles.lineHeight}
        onChange={(value) => onChange({ lineHeight: value })} lineSpacing />)}
      {field("textAlign", "Alignment", <>
        <InspectorChoices label="Text alignment" options={alignmentOptions} value={alignment}
          onChange={(value) => onChange({ textAlign: value as StyleValues["textAlign"] })} />
        {alignment && !alignmentOptions.some(({ value }) => value === alignment) &&
          <p className="break-words text-xs text-zinc-500">{alignment}</p>}
      </>)}
      {field("color", "Text color", (
        <div className="flex min-w-0 items-start gap-2">
          <div className="relative size-8 shrink-0 rounded-md border border-input focus-within:ring-2 focus-within:ring-ring"
            style={{ backgroundColor: color }}>
            <input type="color" aria-label="Pick text color" title="Pick text color"
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              value={color ?? "#000000"}
              onInput={(event) => onChange({ color: event.currentTarget.value })} />
          </div>
          <div className="min-w-0 flex-1">{raw("color", "Enter a color such as #275d38 or red.")}</div>
        </div>
      ), fieldId("color"))}
      <AdvancedControls>
        {field("letterSpacing", "Letter spacing", raw("letterSpacing", "Enter a length such as -0.02em or 1px."),
          fieldId("letterSpacing"))}
        {([
          ["fontFamily", "Custom font family", 'Enter a font family or stack such as Georgia, serif.'],
          ["fontWeight", "Custom weight", "Enter a weight from 1 to 1000, or use a name such as bold."],
          ["fontStyle", "Custom style", "Enter normal, italic, or an oblique angle such as oblique 12deg."],
          ["fontSize", "Custom size", "Enter a nonnegative CSS size such as 24px or clamp(1rem, 3vw, 2rem)."],
          ["lineHeight", "Custom line height", "Enter a nonnegative multiple, percentage, or length, or use normal."],
          ["textAlign", "Custom alignment", "Enter a text alignment such as start or end."],
        ] as const).map(([property, label, hint]) => {
          const controlId = fieldId(property) + "-advanced";
          return <div key={property}>
            <label className="text-[11px] font-medium text-zinc-700" htmlFor={controlId}>{label}</label>
            {raw(property, hint, controlId)}
          </div>;
        })}
        {advancedFields.map(([property, label, options]) => select(property, label, options))}
      </AdvancedControls>
    </StyleInspectorSection>
  );
}
