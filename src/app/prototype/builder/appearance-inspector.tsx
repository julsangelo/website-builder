import { useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { resolveStyles, type Breakpoint, type EditorNode, type StyleValues } from "@/lib/builder-document";
import { AdvancedControls, CssValueInput, InspectorChoices, InspectorField, InspectorNumber, StyleInspectorSection } from "./style-inspector-controls";

const surfaceProperties = [
  "backgroundColor", "backgroundImage", "opacity", "borderWidth", "borderStyle", "borderColor",
  "borderRadius", "boxShadow", "mixBlendMode",
] as const;
const borderStyles = ["none", "solid", "dashed", "dotted", "double", "hidden", "groove", "ridge", "inset", "outset"] as const;
const blendModes = [
  "normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn",
  "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity",
] as const;

type SurfaceProperty = typeof surfaceProperties[number];
type AppearanceProperty = SurfaceProperty | "objectFit" | "objectPosition";

export function ownsSurface(node: EditorNode) {
  if (node.type !== "text" && node.type !== "heading") return true;
  return Object.values(node.styles).some((styles) =>
    styles && surfaceProperties.some((property) => property !== "opacity" && property !== "mixBlendMode"
      && styles[property] !== undefined));
}

function normalizeBackgroundImage(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  if (value === "none") return value;
  const url = value.match(/^url\(\s*(?:"([^"]+)"|'([^']+)'|([^"'()]+))\s*\)$/i);
  const source = (url?.[1] ?? url?.[2] ?? url?.[3] ?? value).trim();
  if (/[\s"'<>;{}\\]/.test(source)) return;
  if (!/^\/(?!\/)/.test(source) && !(/^https?:\/\//i.test(source) && URL.canParse(source))) return;
  return `url("${source}")`;
}

function normalizeOpacity(value: string) {
  if (!/^(?:\d*\.\d+|\d+\.?\d*)%?$/.test(value)) return;
  const maximum = value.endsWith("%") ? 100 : 1;
  return Number.parseFloat(value) <= maximum ? value : undefined;
}

export function splitAppearanceStyles(style: StyleValues) {
  const { objectFit, objectPosition, ...frameStyle } = style;
  const surfaceStyle = Object.fromEntries(surfaceProperties.flatMap((property) => {
    const value = frameStyle[property];
    delete frameStyle[property];
    return value === undefined ? [] : [[property, value]];
  })) as Pick<StyleValues, SurfaceProperty>;
  if (surfaceStyle.backgroundImage !== undefined) {
    surfaceStyle.backgroundImage = normalizeBackgroundImage(surfaceStyle.backgroundImage);
  }
  if (surfaceStyle.mixBlendMode !== undefined && !blendModes.some((mode) => mode === surfaceStyle.mixBlendMode)) {
    delete surfaceStyle.mixBlendMode;
  }
  return { frameStyle, surfaceStyle, objectFit, objectPosition };
}

const shadows = [
  { value: "none", label: "None" },
  { value: "0 2px 6px #0002", label: "Subtle" },
  { value: "0 6px 16px #0003", label: "Medium" },
  { value: "0 12px 28px #0004", label: "Strong" },
];
const imageFits = [
  { value: "cover", label: "Fill", hint: "Fill the frame, cropping the edges if needed." },
  { value: "contain", label: "Fit", hint: "Show the whole image inside the frame." },
  { value: "none", label: "Original", hint: "Keep the original image size." },
] as const;
const imagePositions = [
  ["left top", "Top left"], ["center top", "Top"], ["right top", "Top right"],
  ["left center", "Left"], ["50% 50%", "Center"], ["right center", "Right"],
  ["left bottom", "Bottom left"], ["center bottom", "Bottom"], ["right bottom", "Bottom right"],
].map(([value, label]) => ({ value, label }));
const corners = ["Top left", "Top right", "Bottom right", "Bottom left"];
const selectClass = "h-8 w-full min-w-0 rounded-lg border border-input bg-zinc-50 px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function pixelValue(value: string | number | undefined) {
  if (value === undefined || typeof value === "number") return value === undefined ? "" : String(value);
  return /^(?:\d+(?:\.\d+)?|\.\d+)px$/.test(value) ? String(Number.parseFloat(value)) : value === "0" ? "0" : "";
}

function radiusValues(value: StyleValues["borderRadius"]) {
  if (value === undefined) return;
  const parts = String(typeof value === "number" ? value + "px" : value).trim().split(/\s+/).map(pixelValue);
  if (parts.length > 4 || parts.some((part) => !part)) return;
  const [topLeft, topRight = topLeft, bottomRight = topLeft, bottomLeft = topRight] = parts;
  return [topLeft, topRight, bottomRight, bottomLeft];
}

function ColorPicker({ id, label, value, onChange }: {
  id: string;
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  const hex = /^#[\da-f]{6}$/i.test(value ?? "") ? value : "#000000";
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="relative size-7 shrink-0 rounded border bg-[conic-gradient(#e4e4e7_25%,white_0_50%,#e4e4e7_0_75%,white_0)] bg-[length:8px_8px] focus-within:ring-2 focus-within:ring-ring">
        <div className="absolute inset-0 rounded-[inherit]" style={{ backgroundColor: value }} />
        <input
          className="absolute inset-0 size-full cursor-pointer opacity-0"
          id={id}
          onInput={(event) => onChange(event.currentTarget.value)}
          title={label}
          type="color"
          value={hex}
        />
      </div>
      <span className="min-w-0 truncate text-xs text-zinc-600" title={value}>
        {value?.toLowerCase() === "transparent" ? "Transparent" : value ?? "Default color"}
      </span>
    </div>
  );
}

export function AppearanceInspector({ breakpoint, node, onChange, onReset }: {
  breakpoint: Breakpoint;
  node: EditorNode;
  onChange: (styles: Partial<StyleValues>) => void;
  onReset: (property: AppearanceProperty) => void;
}) {
  const id = useId();
  const styles = resolveStyles(node, breakpoint);
  const [separateCorners, setSeparateCorners] = useState(false);
  const opacity = String(styles.opacity ?? 1);
  const percentage = /^(?:\d*\.\d+|\d+\.?\d*)%?$/.test(opacity)
    ? String(Number((Number.parseFloat(opacity) * (opacity.endsWith("%") ? 1 : 100)).toPrecision(15))) : "";
  const opacityPercent = Number(percentage);
  const validPercentage = percentage !== "" && opacityPercent >= 0 && opacityPercent <= 100;
  const radius = radiusValues(styles.borderRadius);
  const mixedCorners = radius !== undefined && radius.some((value) => value !== radius[0]);
  const cornerValues = radius ?? (styles.borderRadius === undefined ? ["0", "0", "0", "0"] : undefined);
  const image = normalizeBackgroundImage(styles.backgroundImage);
  const hasBackgroundImage = image !== undefined && image !== "none";
  const borderStyle = styles.borderStyle ?? "default";
  const borderOff = borderStyle === "none" || borderStyle === "hidden";
  const shadow = styles.boxShadow ?? "none";
  const fit = styles.objectFit ?? "cover";
  const position = String(styles.objectPosition ?? "50% 50%");

  function field(property: AppearanceProperty, label: string, render: (fieldId: string) => ReactNode, associateLabel = true) {
    const fieldId = `${id}-${property}-${label.replaceAll(" ", "-").toLowerCase()}`;
    return (
      <InspectorField id={associateLabel ? fieldId : undefined} label={label} properties={[property]} node={node} breakpoint={breakpoint} onReset={() => onReset(property)}>
        {render(fieldId)}
      </InspectorField>
    );
  }

  function cssValue(property: AppearanceProperty, label: string, hint: string, normalize?: (value: string) => string | undefined) {
    return field(property, label, (fieldId) => (
      <CssValueInput
        hint={hint}
        id={fieldId}
        normalize={normalize}
        onChange={(value) => onChange({ [property]: value })}
        pixelUnits={property === "borderWidth" || property === "borderRadius"}
        property={property}
        value={styles[property]}
      />
    ));
  }

  function select<Option extends string>(fieldId: string, value: string, options: readonly { value: Option; label: string }[], change: (value: Option) => void, exact = false) {
    return (
      <select className={selectClass} id={fieldId} onChange={(event) => {
        const selected = options.find((option) => option.value === event.target.value);
        if (selected) change(selected.value);
      }} value={value}>
        {!options.some((option) => option.value === value) && <option value={value}>{exact ? value : "Custom"}</option>}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    );
  }

  function setOpacity(value: string) {
    onChange({ opacity: `${value}%` });
  }

  function openImageField() {
    const input = document.getElementById(`${id}-backgroundImage-background-image-url`);
    const details = input?.closest("details");
    if (details) details.open = true;
    input?.focus();
  }

  return (
    <StyleInspectorSection title="Appearance">
      {field("backgroundColor", "Fill color", (fieldId) => (
        <div className="space-y-1">
          <ColorPicker id={fieldId} label="Pick fill color" value={styles.backgroundColor} onChange={(backgroundColor) => onChange({ backgroundColor })} />
          <InspectorChoices label="Fill color options" value={styles.backgroundColor?.toLowerCase()} options={[{ value: "transparent", label: "Transparent" }]}
            onChange={() => onChange({ backgroundColor: "transparent" })} />
        </div>
      ))}
      {field("backgroundImage", "Fill image", () => (
        <div className="flex flex-wrap gap-1">
          <Button className="h-7 gap-1 px-2 text-[11px]" size="sm" variant="outline" onClick={openImageField}>
            {hasBackgroundImage && <span aria-hidden="true" className="size-4 rounded border bg-cover bg-center" style={{ backgroundImage: image }} />}
            {hasBackgroundImage ? "Change image" : "Add image"}
          </Button>
          {hasBackgroundImage && (
            <Button className="h-7 px-2 text-[11px]" size="sm" variant="outline" onClick={() => onChange({ backgroundImage: "none" })}>
              Remove image
            </Button>
          )}
        </div>
      ), false)}
      {field("opacity", "Opacity", (fieldId) => (
        <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
          <input aria-label="Opacity slider" aria-valuetext={validPercentage ? `${percentage}%` : "Custom opacity"}
            className="h-8 min-w-14 flex-1 accent-orange-600 focus-visible:outline-ring"
            id={fieldId} type="range" min={0} max={100} step="any" value={validPercentage ? percentage : 100}
            onChange={(event) => setOpacity(String(Math.round(event.target.valueAsNumber)))} />
          <div className="flex w-24 items-start gap-1">
            <InspectorNumber label="Opacity percentage" max={100} value={validPercentage ? percentage : ""} placeholder="Custom" onChange={setOpacity} />
            <span aria-hidden="true" className="pt-2 text-xs text-zinc-600">%</span>
          </div>
        </div>
      ))}
      <div role="group" aria-label="Border" className="space-y-2 rounded-lg border border-zinc-200 p-2">
        {field("borderStyle", "Border style", (fieldId) => select(fieldId, borderStyle, [
          { value: "default", label: "Default" }, { value: "none", label: "None" },
          { value: "solid", label: "Solid" }, { value: "dashed", label: "Dashed" },
          { value: "dotted", label: "Dotted" }, { value: "double", label: "Double" },
        ], (value) => {
          if (value === "default") onReset("borderStyle");
          else onChange({
            borderStyle: value,
            ...(value !== "none" && (styles.borderWidth === undefined || pixelValue(styles.borderWidth) === "0") && { borderWidth: "1px" }),
          });
        }))}
        {!borderOff && field("borderWidth", "Border width", () => (
          <div className="flex items-start gap-1.5">
            <InspectorNumber label="Border width in pixels" value={pixelValue(styles.borderWidth)}
              placeholder={styles.borderWidth === undefined ? "Default" : "Custom"} onChange={(borderWidth) => onChange({ borderWidth: borderWidth + "px" })} />
            <span aria-hidden="true" className="pt-2 text-xs text-zinc-600">px</span>
          </div>
        ), false)}
        {!borderOff && field("borderColor", "Border color", (fieldId) => (
          <ColorPicker id={fieldId} label="Pick border color" value={styles.borderColor} onChange={(borderColor) => onChange({ borderColor })} />
        ))}
      </div>
      {field("borderRadius", "Corners", () => (
        <div className="space-y-1">
          <InspectorChoices label="Corner mode" value={separateCorners || mixedCorners ? "separate" : "linked"} options={[
            { value: "linked", label: "Linked", hint: "Set all four corners together." },
            { value: "separate", label: "Separate", hint: "Edit each corner independently." },
          ]} onChange={(mode) => {
            setSeparateCorners(mode === "separate");
            if (mode === "linked" && mixedCorners) onChange({ borderRadius: radius[0] + "px" });
          }} />
          {separateCorners || mixedCorners ? (
            cornerValues ? <div className="grid grid-cols-1 gap-1.5 @min-[16rem]:grid-cols-2">
              {corners.map((corner, index) => (
                <label key={corner} className="text-[11px] text-zinc-600">
                  {corner} (px)
                  <InspectorNumber label={corner + " radius in pixels"} value={cornerValues[index]} onChange={(value) => {
                    onChange({ borderRadius: cornerValues.map((current, i) => (i === index ? value : current) + "px").join(" ") });
                  }} />
                </label>
              ))}
            </div> : <p className="text-xs text-zinc-600">Edit custom corners in Advanced.</p>
          ) : (
            <div className="flex items-start gap-1.5">
              <InspectorNumber label="Corner radius in pixels" value={radius?.[0] ?? ""}
                placeholder={styles.borderRadius === undefined ? "Default" : "Custom"}
                onChange={(value) => onChange({ borderRadius: value + "px" })} />
              <span aria-hidden="true" className="pt-2 text-xs text-zinc-600">px</span>
            </div>
          )}
        </div>
      ), false)}
      {field("boxShadow", "Shadow", () => (
        <>
          <InspectorChoices label="Shadow presets" options={shadows.map((option) => ({
            ...option,
            icon: <span aria-hidden="true" className="size-3 rounded-sm border bg-white" style={{ boxShadow: option.value }} />,
          }))} value={shadow} onChange={(boxShadow) => onChange({ boxShadow })} />
          {!shadows.some((option) => option.value === shadow) && <p className="text-xs text-zinc-600">Custom shadow</p>}
        </>
      ), false)}
      {node.type === "image" && (
        <>
          {field("objectFit", "Image fit", () => (
            <>
              <InspectorChoices label="Image fit options" value={fit} options={imageFits.map((option) => ({
                ...option,
                icon: <span aria-hidden="true" className="relative flex h-3 w-4 items-center justify-center overflow-hidden rounded-sm border">
                  <span className={option.value === "cover" ? "h-full w-full bg-current" : option.value === "contain" ? "h-1.5 w-3 bg-current" : "size-1.5 bg-current"} />
                </span>,
              }))} onChange={(value) => {
                const option = imageFits.find((option) => option.value === value);
                if (option) onChange({ objectFit: option.value });
              }} />
              <p className="text-xs text-zinc-600">{imageFits.find((option) => option.value === fit)?.hint ?? "Custom fit. See Advanced."}</p>
            </>
          ), false)}
          {field("objectPosition", "Image position", (fieldId) => select(fieldId, position, imagePositions,
            (objectPosition) => onChange({ objectPosition })))}
        </>
      )}
      <AdvancedControls>
        {cssValue("backgroundColor", "Exact fill color", "Enter a color such as #275d38, plum, or transparent.")}
        {cssValue("backgroundImage", "Background image URL", "Enter an HTTP(S) URL, a path starting with /, or none.", normalizeBackgroundImage)}
        {cssValue("opacity", "Exact opacity", "Enter a number from 0 to 1 or a percentage from 0% to 100%.", normalizeOpacity)}
        {field("borderStyle", "Exact border style", (fieldId) => select(fieldId, borderStyle, borderStyles.map((value) => ({ value, label: value })),
          (borderStyle) => onChange({ borderStyle }), true))}
        {cssValue("borderWidth", "Exact border width", "Enter a width such as 2px or thin.")}
        {cssValue("borderColor", "Exact border color", "Enter a color such as #275d38 or currentColor.")}
        {cssValue("borderRadius", "Exact corner radius", "Enter a radius such as 12px or 50%.")}
        {cssValue("boxShadow", "Custom shadow", "Enter a shadow such as 0 4px 12px #0003, or none.")}
        {field("mixBlendMode", "Blend mode", (fieldId) => select(fieldId, styles.mixBlendMode ?? "normal",
          blendModes.map((value) => ({ value, label: value.replaceAll("-", " ") })), (mixBlendMode) => onChange({ mixBlendMode })))}
        {node.type === "image" && (
          <>
            {field("objectFit", "Exact image fit", (fieldId) => select(fieldId, fit, [
              ...imageFits, { value: "fill", label: "Stretch" }, { value: "scale-down", label: "Shrink to fit" },
            ] as const, (objectFit) => onChange({ objectFit }), true))}
            {cssValue("objectPosition", "Exact image position", "Enter a position such as top right or 30% 50%.")}
          </>
        )}
      </AdvancedControls>
    </StyleInspectorSection>
  );
}
