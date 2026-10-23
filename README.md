# Canvas — Drag and Drop Website Builder

A working Next.js prototype for adding, moving, selecting, editing, and deleting page elements.

## Run locally

Requirements: Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Included

- Drag elements from the left palette onto the canvas
- Reorder existing elements by dragging, or use layer up/down controls
- Click-to-add palette items as an alternative to dragging
- Edit text, font size, alignment, and color in the inspector
- Delete selected elements
- Undo and redo
- Browser-local persistence via localStorage
- Export the current page as a standalone HTML file
- Export layout data as JSON
- Desktop, tablet, and mobile-width canvas modes

## Notes

This is a client-side prototype. Projects are saved in the current browser only; no account, server, or cloud sync is included. The UI uses Tailwind CSS and Lucide icons with shadcn-inspired controls, so it does not depend on generated shadcn component files.
