# Website Builder

The editor's shared language for composing a website page.

## Language

**Page**:
A website destination containing an ordered tree of nodes.

**Node**:
One selectable item in a page, with a stable identity, content or presentation, and a place in the tree.

**Block**:
A node that renders a website element such as text, an image, a button, or a container.

**Container**:
A block that can own ordered child blocks. A container's layout determines how its children flow.
_Avoid_: Division

**Section**:
A top-level container that groups a meaningful part of a page. It can use any supported container layout.

**Section preset**:
A reusable starting arrangement of ordinary blocks, such as Hero or Content + media. Its inserted blocks remain individually editable.

**Layer**:
A node as represented in the editor's Layers tree. Layer order and nesting mirror the page's rendered structure.

**Preview**:
The editable canvas rendering of the current page at a chosen viewport width.

**Drop target**:
The exact parent and position where a dragged item will be inserted or moved.
