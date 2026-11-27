import { useId, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { resolveStyles, type Breakpoint, type EditorNode, type StyleValues } from "@/lib/builder-document";
import { objectFits } from "./preview-image";
import { CssValueInput, StyleInspectorSection } from "./style-inspector-controls";

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

export function AppearanceInspector({ breakpoint, node, onChange, onReset }: {
  breakpoint: Breakpoint;
  node: EditorNode;
  onChange: (styles: Partial<StyleValues>) => void;
  onReset: (property: AppearanceProperty) => void;
}) {
  const id = useId();
  const styles = resolveStyles(node, breakpoint);

  function field(property: AppearanceProperty, label: string, render: (fieldId: string) => ReactNode) {
    const fieldId = `${id}-${property}`;
    return (
      <div className="grid grid-cols-[76px_minmax(0,1fr)_28px] items-start gap-2">
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

  function cssValue(property: AppearanceProperty, label: string, hint: string, fallback?: string, normalize?: (value: string) => string | undefined) {
    return field(property, label, (fieldId) => (
      <CssValueInput
        hint={hint}
        id={fieldId}
        normalize={normalize}
        onChange={(value) => onChange({ [property]: value })}
        pixelUnits={property === "borderWidth" || property === "borderRadius"}
        property={property}
        value={styles[property] ?? fallback}
      />
    ));
  }

  function select(property: AppearanceProperty, label: string, options: readonly string[], fallback: string) {
    const value = String(styles[property] ?? fallback);
    return field(property, label, (fieldId) => (
      <select
        className="h-8 min-w-0 rounded-lg border border-input bg-zinc-50 px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        id={fieldId}
        onChange={(event) => {
          const option = options.find((option) => option === event.target.value);
          if (option && CSS.supports(property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`), option)) {
            onChange({ [property]: option });
          }
        }}
        value={value}
      >
        {!options.includes(value) && <option value={value}>{value}</option>}
        {options.map((option) => <option key={option} value={option}>{option.replaceAll("-", " ")}</option>)}
      </select>
    ));
  }

  return (
    <StyleInspectorSection title="Appearance">
      {cssValue("backgroundColor", "Background color", "Enter a CSS color such as #275d38 or transparent.")}
      {cssValue("backgroundImage", "Background image", "Enter an HTTP(S) URL, a path starting with /, or none.", undefined, normalizeBackgroundImage)}
      {cssValue("opacity", "Opacity", "Enter a number from 0 to 1 or a percentage from 0% to 100%.", "1", normalizeOpacity)}
      {cssValue("borderWidth", "Border width", "Enter a CSS width such as 2px or thin.")}
      {select("borderStyle", "Border style", borderStyles, "solid")}
      {cssValue("borderColor", "Border color", "Enter a CSS color such as #275d38 or currentColor.")}
      {cssValue("borderRadius", "Radius", "Enter a CSS radius such as 12px or 50%.")}
      {cssValue("boxShadow", "Shadow", "Enter a CSS shadow such as 0 4px 12px #0003, or none.")}
      {select("mixBlendMode", "Blend mode", blendModes, "normal")}
      {node.type === "image" && (
        <>
          {select("objectFit", "Object fit", objectFits, "cover")}
          {cssValue("objectPosition", "Object position", "Enter a CSS position such as top right or 30% 50%.", "50% 50%")}
        </>
      )}
    </StyleInspectorSection>
  );
}
