# Editor composition, inspector, and preview specification

Status: Ready for implementation

Scope: Left panel Layers and Quick insert; right panel Layout, Typography, and Appearance; editable preview
Source of truth: the versioned page document in `src/lib/builder-document.ts`

## 1. Goal and outcome

A user can compose a website visually from blocks and section presets, arrange those blocks in a nested page tree, and edit their content and styles with immediate feedback. Layers and preview must represent the same page. The existing editor visual language, spacing, controls, orange selection state, and panel framing remain the design baseline.

This specification covers authoring in the editor. Publishing infrastructure, team collaboration, and a remote asset library are outside this scope.

## 2. Canonical model and rules

Use the terms in `GLOSSARY.md`. A Section is the top-level Container; Box, Stack, and Grid are container presets or initial layout configurations, not separate nesting rules. All are represented as nodes with ordered `childIds`. Layout can be changed among block, flex row, flex column, and grid without losing children or IDs. The UI may retain the familiar Section, Box, Stack, and Grid Quick insert labels.

Each page persists `rootIds` and `nodes`. Each node has a stable ID, `parentId`, ordered `childIds`, type, visibility, content, base/tablet/mobile style values, and any preset metadata. Selection, expanded rows, drag state, hover state, and zoom are editor UI state, not document content. The selected node ID points to one node in the current page.

Invariants:

- Every referenced ID exists exactly once in that page; each child has exactly one parent, and each root has `parentId: null`.
- Parent `childIds` order is the rendered sibling order. A move updates old and new parents atomically.
- Only container types accept children. A node cannot be moved into itself or one of its descendants.
- A hidden parent makes all descendants absent from rendered output without changing any descendant's own `visible` flag. Hidden descendants remain selectable in Layers.
- Section presets materialize ordinary child nodes at insertion. No visible text, image, icon, or CTA exists only in a preset renderer.
- Autosave, history, preview, Layers, and inspector consume the same document state. Refresh restores the same tree, content, styles, visibility, and order.
- Invalid persisted trees are rejected or repaired explicitly during load; migrations preserve stable IDs and user content.

### Content + media reference tree

```text
Content + media (Section: grid, two columns)
├── Content (Container: flex column)
│   ├── Eyebrow (Text: “Our approach”)
│   ├── Heading (Heading)
│   └── Description (Text)
└── Media (Image)
```

The same rule applies to Hero and every other preset: each visible, independently editable element has a matching Layer and node. Decorative CSS shapes may remain nonselectable.

## 3. Interaction contract

### 3.1 Selection and Layers

- Clicking a canvas node selects its exact Layer, expands its ancestors, scrolls its row into view, and shows an outline on the matching canvas node. Clicking a Layer selects the same canvas node and reveals it when possible.
- Clicking a container's padding/background selects the container; clicking a child selects the child. Keyboard focus and Enter/Space selection work in Layers.
- The breadcrumb reflects the actual ancestor chain and uses the selected page name.
- Collapse changes only the Layers view. Hide changes the document visibility. Delete of a container confirms that all descendants will be deleted; deletion is one undo step.
- A hidden node has the existing muted/struck style. A hidden parent gives descendants inherited-hidden styling while keeping their own eye controls and selection available.
- The Layers tree supports before/after drop among siblings and inside drop on a container. Indentation and a visible insertion line/inside highlight communicate the exact result before release. Auto-expand a collapsed container after a short hover; auto-scroll when dragging near panel edges.
- Moving a node across parents updates the tree and canvas immediately. Reject cyclic moves, dropping a Section inside a leaf, and unsupported nesting with a non-destructive cue.
- Preserve selection on a move. After deletion select the next sibling, previous sibling, or parent in that order.

### 3.2 Quick insert

- Quick insert keeps Blocks and Sections tabs, search, and the existing item styling. Its heading is sticky at the top of its own scroll area with the same border and scrolled shadow behavior as Pages and Layers.
- Clicking an item inserts after the selected sibling, or at the end of the selected container; with no selection it appends to the page root. The new node is selected.
- Dragging a Block or Section into preview shows a stable drop indicator. Before/after inserts at the indicated sibling position; inside inserts into the highlighted container at the pointer-derived child position. Inserting between two sections makes the following section move down naturally.
- A Section preset may be dropped at the page root. A Block may be dropped at the root or into a container. The drop location is computed from unscaled document coordinates so zoom and canvas scroll do not shift it.
- A drag is tracked as one session with a drag overlay or stable indicator; preview never mounts a blinking full-canvas “Drag to add block” layer on each drag event. `dragenter`/`dragleave` from nested elements do not clear the active target.
- Escape cancels dragging. Releasing outside a valid target makes no document change. Touch and keyboard users have an equivalent insert/move path through accessible menus or controls.

### 3.3 Preview editing and ordering

- Single click selects. Double click a text-bearing node enters inline editing in place, focuses its text, and selects an appropriate caret position. Escape cancels; blur or Ctrl/Cmd+Enter commits. Plain text fields preserve line breaks where appropriate. A single edit session is one undo step.
- Double click an Image opens an in-canvas replace control for URL or local upload. The selected image itself remains visible as context; the control supports alt text and object fit. Unsupported files show a useful error without altering the current image.
- Double click a Button edits its label in place; link destination and target use a compact contextual control. Clicking it in editor mode selects/edits rather than navigating.
- Drag a selected node by a dedicated drag handle so text selection and inline editing do not accidentally start a move. Preview supports before/after and inside drops with the same validation as Layers, and preserves child order according to flex/grid flow.
- Container boundaries and drop targets remain discoverable even when a container is empty. Resizing the canvas reflows responsive layouts while retaining selected node and scroll position.

## 4. Right panel

Remove the selection summary panel above Layout (the area currently showing “Hero section,” class name, and inherited styles). The right panel begins with its existing Style/Settings tabs, followed by only the applicable property groups. Inline content editing lives in preview, not in that removed top panel.

Each visible group has a sticky heading at the top of its own scroll area. Match the Pages/Layers header height, border, scrolled shadow, typography, and spacing. The fields use the existing shadcn control styling. Changes update the selected node in preview on input and persist through the document operation path. A breakpoint edit affects the active breakpoint and inherits from wider values until overridden; each overridden property can be reset to inherited.

| Group | Applies to | First release controls |
| --- | --- | --- |
| Layout | Section, Box/Stack/Grid container, Image, Card, and other spatial blocks where relevant | Display (block/flex/grid/none where valid), direction, wrap, align/justify, gap, grid columns/rows, width/height/min/max, margin, padding, position (relative/absolute), inset, overflow, z-index. Show only properties meaningful to the selected type and display. |
| Typography | Heading, Text, Button label, Quote, Stat text, and other text-bearing nodes | Font family, weight, size, line height, letter spacing, color, alignment, decoration, transform, style, and wrapping. Semantic heading level is a content/HTML setting. |
| Appearance | Container, Image, Card, Button, and visual surfaces; text uses Typography for text color | Background color/image, opacity, border width/style/color, radius, shadow, object fit/position for images, and blend mode when supported. Avoid an Appearance group for plain text nodes unless it owns a visual surface. |

Controls accept explicit CSS units or meaningful presets, validate inputs, and expose reset. Disallow values that cannot be rendered or serialized safely. Do not show a dead/read-only field as though it were functional. CSS grid/flex controls change actual child flow. A text node may expose spacing or sizing only if the property applies to its rendered wrapper; the general Layout group is hidden for simple text as requested.

## 5. State, operations, and persistence

- Extend the existing `EditorNode` model with typed container layout and typed style values. Keep the version field and add a migration when serialized shape changes. Avoid using preset child indexes as identity.
- Route insert, move, reparent, visibility, delete, content edit, and style edit through document operations. Derive Layers and preview from the resulting document; remove parallel `insertedSections`/`insertedBlocks` as authoritative state.
- Model drop as `{ source, nodeId or presetId, pageId, parentId, index, placement }`. Validate once in a shared document service; canvas and Layers only compute a proposed target.
- Preserve undo/redo for a drag as one operation and inline editing as one edit session. Autosave after changes and display accurate saving/saved/error status. Local storage is acceptable for this prototype; asset references need a durable storage strategy before a production publish flow.
- Uploaded images currently use data URLs in browser state. Keep this usable for the prototype, report storage quota failure, and prevent silent loss. A production asset service should replace the data URL with an asset ID.

## 6. Delivery slices and acceptance criteria

Implement in order; each slice leaves the editor usable and includes automated checks plus manual desktop/tablet/mobile review.

1. **Document tree and preset migration.** All visible Hero and Content + media elements have stable nodes, correct parents, and matching Layers. Existing saved pages migrate without content loss. Reload restores hierarchy.
2. **Tree operations and Layers drag.** Reorder and reparent within/across containers; before/after/inside indicators; collapse, visibility, delete, and undo work. Invalid and cyclic drops leave the document unchanged.
3. **Quick insert and canvas drops.** Blocks and presets land at the indicated position at 100%, zoomed, and scrolled states. No blinking overlay; following content reflows. Sticky Quick insert heading behaves like Pages/Layers.
4. **Inline content.** Double click edits heading, eyebrow, description, button, and image in preview. Escape/commit/undo and image failure behavior work. Remove the top selection summary.
5. **Inspector styles.** Applicable Layout, Typography, and Appearance groups expose functional controls, immediate preview updates, responsive overrides/reset, sticky headings, and persistence.
6. **Regression pass.** Verify selection sync, keyboard access, hidden ancestors, empty containers, nested moves, refresh, and undo/redo across page switches.

Release acceptance scenarios:

- Add Content + media between two existing sections at 60% canvas zoom: it appears at that position in preview and Layers, and the following section moves down.
- Move its Heading under another container in Layers: `parentId` and both child lists update, preview reflows, selection remains on Heading, and undo restores the exact prior tree.
- Select “Our approach” in canvas: Layers selects `Content + media > Content > Eyebrow`; double click changes the text and reload retains it.
- Hide Content: Heading and Description disappear from preview, appear inherited-hidden but selectable in Layers, and return with their individual visibility states when Content is shown.
- Select a plain Text node: Typography is available; irrelevant container Layout and surface Appearance controls are absent. A Section shows Layout and Appearance, not Typography.
- Change a Grid's columns and gap at tablet width: preview updates immediately; desktop remains unchanged unless its base styles were changed. Reload and undo preserve the expected breakpoint values.
- Start a Quick insert drag, cross nested targets, and cancel: the indicator does not blink, nothing is inserted, and the browser does not navigate.

## 7. Design and quality constraints

Follow existing panel geometry, scroll areas, tab indicator, selected/hover states, icon sizing, shadows, and shadcn components. Any new drop indicators or inline editors should use the same neutral surfaces and orange accent. Do not redesign the shell.

Automated coverage should focus on tree invariants, insertion/move indices, inherited visibility, migration, responsive style resolution, and undo boundaries. Component or end-to-end tests should cover the concrete acceptance scenarios above. Test keyboard and pointer interaction, invalid drops, small screens, and long Layers trees.
