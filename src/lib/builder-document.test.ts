import assert from "node:assert/strict";
import { test } from "node:test";
import { applyDocumentOperation, resolveStyles, validatePageTree, type PageDocument, type SiteDocument } from "./builder-document.ts";
import { buildSection, createBlock, sectionPresets } from "./builder-presets.ts";
import { emptyDocument, loadEditorSave } from "./builder-storage.ts";

function blankPage(): PageDocument {
  return { id: "page", name: "Studio", title: "Studio", slug: "studio", nodes: {}, rootIds: [] };
}

function documentWith(page = blankPage()): SiteDocument {
  return { ...emptyDocument, pages: [page] };
}

function insertPreset(id: string) {
  let sequence = 0;
  const preset = sectionPresets.find((candidate) => candidate.id === id)!;
  const subtree = buildSection(preset, () => `node-${++sequence}`);
  return applyDocumentOperation(documentWith(), {
    type: "node.insert", pageId: "page", parentId: null, index: 0, ...subtree,
  });
}

test("Hero and Content + media insert ordered, addressable subtrees atomically", () => {
  for (const [id, copyLabels] of [
    ["hero", ["Eyebrow", "Heading", "Description", "CTA button"]],
    ["content-media", ["Eyebrow", "Heading", "Description"]],
  ] as const) {
    const [page] = insertPreset(id).pages;
    const [sectionId] = page.rootIds;
    const [contentId, mediaId] = page.nodes[sectionId].childIds;
    const content = page.nodes[contentId];
    const children = content.childIds.map((id) => page.nodes[id]);

    validatePageTree(page);
    assert.equal(content.parentId, sectionId);
    assert.equal(page.nodes[mediaId].type, "image");
    assert.deepEqual(children.map((node) => node.metadata?.label), copyLabels);
    assert.ok(children.every((node) => node.parentId === contentId && Object.values(node.content).some(Boolean)));
  }
});

test("Moves update both parents and reject cycles and leaf destinations", () => {
  const document = insertPreset("hero");
  const [page] = document.pages;
  const [sectionId] = page.rootIds;
  const [contentId, mediaId] = page.nodes[sectionId].childIds;
  const [eyebrowId, headingId, descriptionId, buttonId] = page.nodes[contentId].childIds;

  const moved = applyDocumentOperation(document, {
    type: "node.move", pageId: page.id, nodeId: mediaId, parentId: contentId, index: 1,
  });
  validatePageTree(moved.pages[0]);
  assert.deepEqual(moved.pages[0].nodes[sectionId].childIds, [contentId]);
  assert.deepEqual(moved.pages[0].nodes[contentId].childIds, [eyebrowId, mediaId, headingId, descriptionId, buttonId]);
  assert.equal(moved.pages[0].nodes[mediaId].parentId, contentId);
  assert.deepEqual(page.nodes[sectionId].childIds, [contentId, mediaId]);

  assert.throws(() => applyDocumentOperation(document, {
    type: "node.move", pageId: page.id, nodeId: contentId, parentId: contentId, index: 0,
  }), /descendant/);
  assert.throws(() => applyDocumentOperation(document, {
    type: "node.move", pageId: page.id, nodeId: mediaId, parentId: headingId, index: 0,
  }), /container/);
  assert.throws(() => applyDocumentOperation(document, {
    type: "node.insert", pageId: page.id, node: { ...createBlock("broken", "box"), childIds: ["missing"] }, parentId: null, index: 0,
  }), /Missing node/);
  assert.throws(() => applyDocumentOperation(document, {
    type: "node.insert", pageId: page.id, node: createBlock("nested-section", "section"), parentId: contentId, index: 0,
  }), /page root/);
});

test("Deleting a container removes its subtree in a single immutable operation", () => {
  const document = insertPreset("content-media");
  const [page] = document.pages;
  const [rootId] = page.rootIds;
  const [contentId, mediaId] = page.nodes[rootId].childIds;
  const next = applyDocumentOperation(document, { type: "node.delete", pageId: page.id, nodeId: contentId });
  validatePageTree(next.pages[0]);
  assert.deepEqual(Object.keys(next.pages[0].nodes).sort(), [rootId, mediaId].sort());
  assert.equal(page.nodes[contentId].childIds.length, 3);
});

test("v1 migration keeps saved root order, attached blocks, styles and stable IDs", () => {
  const imageUrl = "data:image/png;base64,dGVzdA==";
  const section = {
    ...createBlock("section-4", "section", {}), metadata: { preset: "content-media" },
    childIds: ["section-4:child:0", "section-4:child:2", "section-4:child:1", "section-4:child:3", "block-3"],
  };
  const [copyId, descriptionId, headingId, mediaId, addedId] = section.childIds;
  const page: PageDocument = {
    ...blankPage(), rootIds: ["block-2", section.id],
    nodes: {
      "block-2": createBlock("block-2", "button", { buttonLabel: "My CTA" }),
      [section.id]: section,
      [copyId]: { ...createBlock(copyId, "stack"), parentId: section.id, metadata: { templateIndex: 0 }, visible: false },
      [descriptionId]: { ...createBlock(descriptionId, "text", { body: "My description" }), parentId: section.id, metadata: { templateIndex: 2 } },
      [headingId]: {
        ...createBlock(headingId, "heading", { title: "My heading" }), parentId: section.id, metadata: { templateIndex: 1 },
        styles: { base: { color: "tomato" }, tablet: { fontSize: 23 }, mobile: { fontSize: 17 } },
      },
      [mediaId]: { ...createBlock(mediaId, "image", { imageUrl, alt: "Project photo" }), parentId: section.id, metadata: { templateIndex: 3 } },
      [addedId]: { ...createBlock(addedId, "text", { body: "Added block" }), parentId: section.id },
    },
  };
  const saved = { document: { ...documentWith(page), version: 1 }, selectedPageId: page.id };
  const loaded = loadEditorSave(saved);
  const [migrated] = loaded.document.pages;
  const [eyebrowId, ...copyChildren] = migrated.nodes[copyId].childIds;
  assert.equal(loaded.document.version, 2);
  assert.equal(loaded.selectedPageId, page.id);
  assert.deepEqual(migrated.rootIds, page.rootIds);
  assert.deepEqual(migrated.nodes[section.id].childIds, [copyId, mediaId, addedId]);
  assert.deepEqual(copyChildren, [descriptionId, headingId]);
  assert.equal(migrated.nodes[eyebrowId].content.body, "Our approach");
  assert.equal(migrated.nodes[copyId].visible, false);
  assert.equal(migrated.nodes[headingId].visible, true);
  assert.equal(migrated.nodes[headingId].parentId, copyId);
  assert.equal(migrated.nodes[descriptionId].content.body, "My description");
  assert.equal(migrated.nodes[headingId].content.title, "My heading");
  assert.equal(migrated.nodes[addedId].content.body, "Added block");
  assert.deepEqual(migrated.nodes[mediaId].content, { imageUrl, alt: "Project photo" });
  assert.deepEqual(migrated.nodes[headingId].styles, page.nodes[headingId].styles);
  assert.deepEqual(resolveStyles(migrated.nodes[headingId], "mobile"), { color: "tomato", fontSize: 17 });
  assert.deepEqual(loadEditorSave(JSON.parse(JSON.stringify(loaded))), loaded);
});

test("older browser saves keep edited content, deletion, visibility and empty pages", () => {
  const save = {
    pages: [{ id: "page", name: "Studio", preset: "landing" }, { id: "empty", name: "Empty", preset: "custom" }],
    selectedPageId: "empty",
    pageContent: {
      page: {
        insertedBlocks: [],
        insertedSections: [{
          id: "hero", preset: "hero", visible: true, childOrder: [1, 0, 2, 3, 4],
          deletedChildIndexes: [2], hiddenChildIndexes: [0],
          childContent: { 1: { title: "Edited hero" } },
          addedBlocks: [{ id: "section-block", kind: "section", content: { title: "Nested section" }, visible: true }],
        }],
      },
    },
  };
  const { document, selectedPageId } = loadEditorSave(save);
  const [page, empty] = document.pages;
  const [copyId, mediaId, addedId] = page.nodes.hero.childIds;
  assert.equal(selectedPageId, "empty");
  assert.deepEqual(empty.rootIds, []);
  assert.deepEqual(page.nodes[copyId].childIds, ["hero:child:1", "hero:child:0", "hero:child:3"]);
  assert.equal(page.nodes["hero:child:1"].content.title, "Edited hero");
  assert.equal(page.nodes["hero:child:0"].visible, false);
  assert.equal(Object.hasOwn(page.nodes, "hero:child:2"), false);
  assert.equal(mediaId, "hero:child:4");
  assert.equal(addedId, "section-block");
  assert.equal(page.nodes[addedId].type, "box");
  assert.equal(page.nodes[addedId].content.title, "Nested section");
});

test("rejects corrupt saves explicitly without mutating the supplied data", () => {
  const pages = [
    { ...blankPage(), rootIds: ["missing"] },
    { ...blankPage(), rootIds: ["node", "node"], nodes: { node: createBlock("node", "text") } },
    { ...blankPage(), nodes: { node: createBlock("node", "text") } },
    {
      ...blankPage(), rootIds: ["node"],
      nodes: { node: { ...createBlock("node", "box"), childIds: ["node"] } },
    },
  ];
  for (const page of pages) {
    const saved = { document: documentWith(page), selectedPageId: null };
    const before = JSON.stringify(saved);
    assert.throws(() => loadEditorSave(saved));
    assert.equal(JSON.stringify(saved), before);
  }
  assert.throws(() => loadEditorSave({ document: { ...emptyDocument, version: 3 } }), /Unsupported/);
});
