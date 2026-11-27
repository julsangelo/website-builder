# Layers and inspector usability SDD

Status: Ready for implementation  
Scope: Layers panel; Layout, Typography, and Appearance inspector groups  
Related spec: [Editor composition, inspector, and preview](editor-composition-and-inspector.md)

## Goal

People should be able to find, select, and manage any layer in a narrow panel, and style a selected element without knowing CSS. Keep the editor's existing visual language: white panels, compact controls, subtle borders, orange selection, sticky group headings, and immediate canvas feedback. This document refines the related spec; its document model, selection rules, and responsive style inheritance still apply.

## Evidence and current problems

The supplied Layers screenshot shows deeper rows whose move, visibility, and delete actions are cut off at the right edge. The current tree renders descendants inside increasingly narrow wrappers. Row labels truncate, but the trailing actions do not have a stable panel-wide right edge. The inspector currently presents many raw CSS strings and technical option names (for example `gridTemplateColumns`, `space-evenly`, `objectPosition`, and `mixBlendMode`) as equally prominent controls. This makes routine styling harder to discover and easy to misconfigure.

## 1. Layers panel

### 1.1 Row layout

- Every visible layer occupies one full-width row of the scroll viewport, regardless of tree depth. Represent depth with an inset disclosure/icon area and optional guide lines; do not make a nested subtree's available row width narrower than its parent.
- Use a three-part row: **hierarchy affordance** (disclosure and type icon), **name** (`min-width: 0`, one line, ellipsis), and **actions** (fixed-width right rail). The name uses all remaining space. The action rail never shrinks, wraps, or extends behind the panel edge or vertical scroll thumb.
- Keep move, visibility, and delete actions in the same order and aligned to the same right edge for every depth. Existing hover/focus reveal behavior may remain, but a selected row and a keyboard-focused row must expose its actions. Preserve the existing selected and inherited-hidden visual states.
- Reserve enough horizontal space for row padding and the action rail before calculating name width. Limit the visible depth indent at deep levels; continue to communicate the exact level through guide lines, a depth badge, or a full ancestry tooltip. Do not hide actions to make room for indentation.
- Show the full layer name and ancestry on hover/focus of a truncated label, and expose the full name to assistive technology. A selected truncated name remains readable through the same mechanism.
- Keep drag targets and drop indicators aligned with the actual parent/child relationship. Capping the visual indent must not alter nesting, keyboard navigation, or document order.
- No **horizontal** scrollbar appears in Layers at any supported panel width or tree depth. Keep vertical scrolling for long trees; the sticky Layers heading and its scrolled shadow remain visible.

### 1.2 Interaction and accessibility

- Selecting a row, expanding it, moving it, toggling its eye, and deleting it retain their current behavior and document semantics. A hidden parent's children remain selectable and retain independent eye/delete controls.
- Icon buttons have discernible names (for example, “Hide Heading”), tooltips, visible keyboard focus, and comfortable targets consistent with the panel's compact controls. Delete confirmation remains required.
- Pointer and keyboard focus do not change the row's width or move the action rail. Hovering a selected row follows the established selected-hover style; leaving it restores the selected state.
- When the panel is resized while a row is selected, keep selection and tree expansion. Recalculate truncation without changing scroll position or creating horizontal overflow.

### 1.3 Suggested structure

Render the tree as a depth-first sequence of full-width rows. Each row carries its node ID, depth, expanded state, visibility state, and parent relationship. The document's `parentId`/`childIds` remain the source of truth; flattening is only a rendering strategy. Use the scroll viewport width for row layout, a bounded indentation token, `min-w-0` for the label, and a nonshrinking trailing action group. Keep tree semantics (`aria-level`, `aria-expanded` on containers, and appropriate selected state).

## 2. Inspector design rules

- Retain the existing right panel, Style/Settings tabs, sticky section headings, spacing, colors, and typography. Reorganize controls within Layout, Typography, and Appearance instead of adding a new panel or a separate editing workflow.
- Show a concise set of common controls first. Put uncommon technical controls in a collapsed **Advanced** area within the relevant group. Advanced controls remain available so existing style capabilities and persisted values are not lost.
- Use plain-language labels, icons with tooltips where helpful, segmented choices for small sets, visual previews for colors and alignment, and direct manipulation for values that benefit from it. Never require a user to type a CSS declaration for a common task.
- Controls display the **resolved value** for the active desktop/tablet/mobile breakpoint and distinguish an explicit override from an inherited value. Reset removes only the active breakpoint's override; it must not overwrite the base or another breakpoint.
- Changes update the selected node on the canvas immediately through the existing document/style update path. One continuous gesture, such as a slider drag, should be one undoable edit. Invalid input does not change the document and explains the valid range in plain language.
- Show only controls that apply to the selected node. An unavailable control must be omitted or disabled with an explanation, not silently accept a change that has no visible effect.
- Respect the current panel width: controls reflow to one column when necessary, labels stay readable, and no inspector group introduces horizontal scrolling.

## 3. Layout group

### Common controls

| User-facing control | Behavior and underlying style |
| --- | --- |
| Arrange children: Free, Horizontal, Vertical, Grid | For containers only. Maps to `display` and `flexDirection`; changing modes preserves child IDs and order. Explain the resulting flow with a small visual icon. |
| Alignment | For flex/grid containers, use a compact alignment matrix or labeled icon choices for `alignItems` and `justifyContent`. Show only valid choices for the current mode. |
| Gap | Numeric field with unit selector and optional stepper for flex/grid spacing. Show the separation between children in the canvas. |
| Size: Width and Height | Offer **Fill**, **Fit content**, and **Fixed** where the mode supports them. Fixed reveals a numeric field and unit. Show the resolved value without exposing raw CSS as the primary label. |
| Spacing: Padding and Margin | A small box-model editor with linked sides by default and an unlink action for four-side editing. Clearly identify inside versus outside spacing. |
| Grid columns | Presets such as 1, 2, 3, and 4 columns plus an editable count; keep custom track syntax under Advanced. Preview reflows immediately. |

Use **Advanced** for min/max dimensions, wrapping, precise grid tracks/rows, position and offsets, overflow, stacking order, and any raw CSS value editing. If a preset cannot represent a persisted custom value, show “Custom” with the actual value in Advanced; do not reset it merely because the inspector opened. Avoid duplicate controls that write conflicting values.

The layout group is available for containers and any node with meaningful size/spacing controls. Child arrangement and alignment appear only for containers. Preserve the related spec's applicability rules for noncontainers.

## 4. Typography group

### Common controls

| User-facing control | Behavior and underlying style |
| --- | --- |
| Font | Searchable font-family picker with a live sample and an explicit inherited/default state. Keep an existing custom family visible even if it is absent from the picker. |
| Weight and style | Human names (Regular, Medium, Semibold, Bold; Italic) with supported values only. Preserve any custom weight in Advanced. |
| Size | Numeric input with visible unit and stepper; avoid making the user type `px`. |
| Line spacing | Numeric/percentage control with a short explanation such as “Space between lines.” |
| Alignment | Left, center, right, and justified segmented controls with clear selected state. |
| Text color | Swatch plus value field and picker; changing color updates the selected text live. |

Use **Advanced** for letter spacing, decoration, capitalization, wrapping, and custom font values. Keep the full terminology available as help text, not as the only way to understand the control. Typography appears only for nodes that own editable text under the existing `ownsText` rule. Editing wording remains an in-canvas action, separate from styling.

## 5. Appearance group

### Common controls

| User-facing control | Behavior and underlying style |
| --- | --- |
| Fill | Color swatch/picker with a clear transparent state. Existing background images remain available through an image choice. |
| Opacity | Slider paired with a 0–100% numeric field; both stay synchronized. |
| Border | Enable/style, width, and color in one compact group; show the actual border on the canvas. |
| Corners | Radius field with linked corners by default and independent corners when supported. |
| Shadow | Simple presets (None, Subtle, Medium, Strong) and an editable custom shadow in Advanced. Preserve a custom persisted value. |
| Image fit | For image nodes only: Fill/Cover, Fit/Contain, and Original where supported, with a visual explanation and position control. |

Use **Advanced** for custom background image URL, exact shadow string, blend mode, and precise image position. Appearance is shown only when a visible surface property applies under the existing `ownsSurface` rule; image-specific options never appear for other nodes. A text node's text color belongs to Typography, not a duplicate Appearance control.

## 6. State, errors, and edge cases

- Opening the inspector must never normalize or rewrite stored styles. If a value is inherited, display it as inherited; if a value is custom, display it as custom rather than selecting an incorrect preset.
- A change to one style property must preserve unrelated properties and the selected node's content, visibility, nesting, and order. Layout mode changes that require several style properties are a single coherent edit.
- Color, size, opacity, and grid inputs accept only values the renderer supports. Show a short inline error for invalid values, retain the last valid canvas result, and let Escape restore it.
- If a selected node is removed, hidden, or moved, the inspector follows the editor's selection contract. Hidden nodes remain styleable from Layers even while absent from the canvas.
- Keyboard users can reach every control and action. Segmented choices announce their labels and selected state; icon-only controls have accessible names. Respect reduced-motion preferences for transitions.

## 7. Acceptance criteria

1. At minimum supported left-panel width and at nesting depths 0, 3, 6, and 10, every layer row fits horizontally. Its action rail remains fully usable, its name ellipsizes, and no horizontal scrollbar appears. The Layers header remains sticky during vertical scrolling.
2. A deeply nested selected or hidden row preserves the existing selection/visibility styling. Its full name can be discovered by mouse and keyboard. Move, eye, and delete remain reachable; delete still confirms.
3. Resizing the left panel does not change the document tree, selection, expanded rows, or scroll position unexpectedly.
4. A novice can make a two-column grid, switch it to a vertical stack, set gap/padding, choose Fill or Fixed width, and see each change on the canvas without entering CSS text. Existing children and order survive layout changes.
5. A novice can set font, weight, size, line spacing, alignment, text color, fill, opacity, border, corner radius, and shadow using labeled or visual controls. The canvas reflects each supported edit immediately.
6. Desktop, tablet, and mobile show their resolved values. Editing or resetting one breakpoint changes only that breakpoint's override; custom persisted values remain intact when the inspector opens or switches breakpoints.
7. Inapplicable controls do not appear. Invalid values show understandable feedback and do not modify the saved document. Undo/redo restores a completed edit correctly.
8. At the smallest supported right-panel width, labels and controls remain readable and usable without horizontal scrolling. Sticky inspector headings and their scroll shadows continue to work.

## 8. Delivery and verification

Implement Layers row geometry first, then the shared inspector control patterns (labeled fields, segmented choices, reset/inherited state, validation), then each inspector group. Reuse the existing shadcn components and style update APIs. Verify with a deeply nested document and nodes carrying base/tablet/mobile overrides and custom CSS values. Check panel resizing, pointer and keyboard access, drag/drop, hide/delete, undo/redo, reload persistence, and canvas rendering at desktop/tablet/mobile widths. Keep changes within this SDD's scopes; the related composition spec remains the authority for document structure and preview editing.
