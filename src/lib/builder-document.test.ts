import assert from "node:assert/strict";
import { test } from "node:test";
import { applyDocumentOperation, canInsertAt, insertionAtSelection, proposeNodeMove, proposeNodeMoveAt, resolveStyles, selectionAfterDelete, validatePageTree, type InsertionTarget, type PageDocument, type SiteDocument } from "./builder-document.ts";
import { buildSection, createBlock, createSection, sectionPresets } from "./builder-presets.ts";
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
    assert.equal(content.type, "stack");
    assert.equal(page.nodes[sectionId].styles.base.display, "grid");
    assert.equal(page.nodes[mediaId].parentId, sectionId);
    assert.equal(page.nodes[mediaId].type, "image");
    assert.deepEqual(children.map((node) => node.metadata?.label), copyLabels);
    assert.equal(children[0].content.body, id === "hero" ? "Interior architecture" : "Our approach");
    assert.ok(children.every((node) => node.parentId === contentId && Object.values(node.content).some(Boolean)));
  }
});

test("Quick insert uses sibling and container positions and keeps Sections at the root", () => {
  const document = insertPreset("hero");
  const [page] = document.pages;
  const [sectionId] = page.rootIds;
  const [contentId] = page.nodes[sectionId].childIds;
  const [eyebrowId, headingId] = page.nodes[contentId].childIds;

  const afterLeaf = insertionAtSelection(page, "text", page.nodes[eyebrowId]);
  assert.deepEqual(afterLeaf, { pageId: page.id, parentId: contentId, index: 1, placement: "after" });
  assert.deepEqual(insertionAtSelection(page, "text", page.nodes[contentId]), {
    pageId: page.id, parentId: contentId, index: page.nodes[contentId].childIds.length, placement: "inside",
  });
  const rootEnd = { pageId: page.id, parentId: null, index: 1, placement: "after" };
  assert.deepEqual(insertionAtSelection(page, "section", page.nodes[eyebrowId]), rootEnd);
  assert.deepEqual(insertionAtSelection(page, "text", null), rootEnd);
  assert.ok(canInsertAt(page, "text", afterLeaf));
  assert.ok(!canInsertAt(page, "section", afterLeaf));
  assert.ok(!canInsertAt(page, "text", { ...afterLeaf, parentId: eyebrowId }));
  assert.ok(!canInsertAt(page, "text", { ...afterLeaf, pageId: "other-page" }));
  assert.ok(!canInsertAt(page, "text", { ...afterLeaf, index: -1 }));
  assert.ok(!canInsertAt(page, "text", { ...afterLeaf, index: page.nodes[contentId].childIds.length + 1 }));

  const updated = applyDocumentOperation(document, { ...afterLeaf, type: "node.insert", node: createBlock("new-text", "text") });
  validatePageTree(updated.pages[0]);
  assert.deepEqual(updated.pages[0].nodes[contentId].childIds.slice(0, 3), [eyebrowId, "new-text", headingId]);
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

test("Layer move proposals resolve before and after against the order after removing the source", () => {
  const document = insertPreset("hero");
  const [page] = document.pages;
  const [sectionId] = page.rootIds;
  const [contentId] = page.nodes[sectionId].childIds;
  const [eyebrow, heading, description, button] = page.nodes[contentId].childIds;
  const after = proposeNodeMove(page, eyebrow, description, "after");
  const before = proposeNodeMove(page, button, heading, "before");
  assert.ok(after.operation && before.operation);
  assert.deepEqual(applyDocumentOperation(document, after.operation).pages[0].nodes[contentId].childIds, [heading, description, eyebrow, button]);
  assert.deepEqual(applyDocumentOperation(document, before.operation).pages[0].nodes[contentId].childIds, [eyebrow, button, heading, description]);
  assert.equal(proposeNodeMove(page, eyebrow, heading, "before").operation, null);
  assert.equal(proposeNodeMove(page, heading, eyebrow, "after").operation, null);
  assert.equal(applyDocumentOperation(document, { ...after.operation, index: 0 }), document);
});

test("Layer move proposals support root and nested destinations and reject invalid parents", () => {
  const document = insertPreset("hero");
  const [page] = document.pages;
  const [sectionId] = page.rootIds;
  const [contentId, mediaId] = page.nodes[sectionId].childIds;
  const [eyebrow, heading] = page.nodes[contentId].childIds;
  const before = proposeNodeMove(page, mediaId, heading, "before");
  const inside = proposeNodeMove(page, mediaId, contentId, "inside");
  const root = proposeNodeMove(page, heading, sectionId, "after");
  assert.ok(before.operation && inside.operation && root.operation);
  const [beforePage] = applyDocumentOperation(document, before.operation).pages;
  assert.deepEqual(beforePage.nodes[contentId].childIds.slice(0, 3), [eyebrow, mediaId, heading]);
  const [insidePage] = applyDocumentOperation(document, inside.operation).pages;
  assert.equal(insidePage.nodes[contentId].childIds.at(-1), mediaId);
  assert.equal(insidePage.nodes[mediaId].parentId, contentId);
  const [rootPage] = applyDocumentOperation(document, root.operation).pages;
  assert.deepEqual(rootPage.rootIds, [sectionId, heading]);
  for (const candidate of [beforePage, insidePage, rootPage]) validatePageTree(candidate);

  const snapshot = JSON.stringify(document);
  const cycle = proposeNodeMove(page, contentId, heading, "before");
  const leaf = proposeNodeMove(page, mediaId, heading, "inside");
  const nestedSection = proposeNodeMove(page, sectionId, mediaId, "before");
  assert.equal(cycle.operation, null);
  assert.match(cycle.reason, /descendant/);
  assert.equal(leaf.operation, null);
  assert.match(leaf.reason, /container/);
  assert.equal(nestedSection.operation, null);
  assert.match(nestedSection.reason, /page root/);
  assert.equal(JSON.stringify(document), snapshot);
});

test("Canvas move boundaries support pointer-derived positions and empty containers", () => {
  const initial = insertPreset("hero");
  const [sectionId] = initial.pages[0].rootIds;
  const [contentId, mediaId] = initial.pages[0].nodes[sectionId].childIds;
  const document = applyDocumentOperation(initial, {
    type: "node.insert", pageId: "page", parentId: sectionId, index: 2, node: createBlock("empty", "box"),
  });
  const [page] = document.pages;
  const [eyebrow, heading, description, button] = page.nodes[contentId].childIds;
  const target: InsertionTarget = { pageId: page.id, parentId: contentId, index: 3, placement: "inside" };
  const reorder = proposeNodeMoveAt(page, eyebrow, target);
  assert.ok(reorder.operation);
  assert.deepEqual(applyDocumentOperation(document, reorder.operation).pages[0].nodes[contentId].childIds, [heading, description, eyebrow, button]);
  assert.equal(proposeNodeMoveAt(page, eyebrow, { ...target, index: 1 }).operation, null);

  const intoEmpty = proposeNodeMoveAt(page, heading, { ...target, parentId: "empty", index: 0 });
  assert.ok(intoEmpty.operation);
  assert.deepEqual(intoEmpty, proposeNodeMove(page, heading, "empty", "inside"));
  const moved = applyDocumentOperation(document, intoEmpty.operation).pages[0];
  validatePageTree(moved);
  assert.deepEqual(moved.nodes.empty.childIds, [heading]);
  assert.deepEqual(moved.nodes[contentId].childIds, [eyebrow, description, button]);
  assert.equal(moved.nodes[heading].parentId, "empty");
  assert.match(proposeNodeMoveAt(page, sectionId, target).reason!, /page root/);
  assert.match(proposeNodeMoveAt(page, contentId, target).reason!, /descendant/);
  assert.match(proposeNodeMoveAt(page, heading, { ...target, parentId: mediaId }).reason!, /container/);
  assert.match(proposeNodeMoveAt(page, heading, { ...target, index: 5 }).reason!, /position/);
  assert.match(proposeNodeMoveAt(page, heading, { ...target, pageId: "other-page" }).reason!, /no longer available/);
});

test("Hiding a container and reloading preserves each descendant's own visibility", () => {
  const document = insertPreset("content-media");
  const [page] = document.pages;
  const [sectionId] = page.rootIds;
  const [contentId] = page.nodes[sectionId].childIds;
  const [eyebrowId, headingId] = page.nodes[contentId].childIds;
  const hideHeading = applyDocumentOperation(document, {
    type: "node.setVisibility", pageId: page.id, nodeId: headingId, visible: false,
  });
  const hideContent = applyDocumentOperation(hideHeading, {
    type: "node.setVisibility", pageId: page.id, nodeId: contentId, visible: false,
  });
  const { document: reloaded } = loadEditorSave(JSON.parse(JSON.stringify({ document: hideContent, selectedPageId: page.id })));
  const [savedPage] = reloaded.pages;
  assert.equal(savedPage.nodes[contentId].visible, false);
  assert.deepEqual(savedPage.nodes[contentId].childIds, page.nodes[contentId].childIds);
  assert.equal(savedPage.nodes[eyebrowId].visible, true);
  assert.equal(savedPage.nodes[headingId].visible, false);

  const showContent = applyDocumentOperation(reloaded, {
    type: "node.setVisibility", pageId: page.id, nodeId: contentId, visible: true,
  });
  assert.deepEqual(showContent.pages, hideHeading.pages);
});

test("Deleting a container removes its subtree in a single immutable operation", () => {
  const document = insertPreset("content-media");
  const [page] = document.pages;
  const [rootId] = page.rootIds;
  const [contentId, mediaId] = page.nodes[rootId].childIds;
  assert.equal(selectionAfterDelete(page, page.nodes[contentId]), mediaId);
  assert.equal(selectionAfterDelete(page, page.nodes[mediaId]), contentId);
  assert.equal(selectionAfterDelete(page, page.nodes[rootId]), null);
  const next = applyDocumentOperation(document, { type: "node.delete", pageId: page.id, nodeId: contentId });
  validatePageTree(next.pages[0]);
  assert.deepEqual(Object.keys(next.pages[0].nodes).sort(), [rootId, mediaId].sort());
  assert.equal(selectionAfterDelete(next.pages[0], next.pages[0].nodes[mediaId]), rootId);
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
  assert.equal(loaded.document.version, 3);
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

test("remaining presets materialize their visible copy, controls, images and repeated items", () => {
  const cases = [
    ["navigation", ["Our studio", "Selected work", "Journal"]],
    ["features", ["Made for teams that care about every detail.", "Made to scale", "Built to adapt", "Easy to share"]],
    ["collection", ["View all work →", "Residences", "Hospitality", "Workplaces", "View project"]],
    ["gallery", []],
    ["testimonials", ["Mia Petersen, Founder at Forma"]],
    ["stats", ["12", "48", "06", "projects completed"]],
    ["faq", ["What does a typical project look like?", "How long does it take?", "Where do you work?"]],
    ["cta", ["Ready to make your next page feel like yours?", "Build a site that is unmistakably your own.", "Start a project"]],
    ["contact", ["Contact", "Your name", "you@example.com", "How can we help?", "Send message"]],
    ["footer", ["Studio", "Work", "Journal", "Privacy", "Terms"]],
  ] as const;

  for (const [preset, expectedCopy] of cases) {
    const document = insertPreset(preset);
    const [page] = document.pages;
    const nodes = Object.values(page.nodes);
    validatePageTree(page);
    for (const copy of expectedCopy) {
      assert.ok(nodes.some((node) => Object.values(node.content).includes(copy)), `${preset}: ${copy}`);
    }
    if (preset === "gallery" || preset === "collection") {
      assert.equal(nodes.filter((node) => node.type === "image").length, preset === "gallery" ? 4 : 3);
    }
    if (preset === "contact") assert.equal(nodes.filter((node) => node.type === "input").length, 3);
    const saved = { document, selectedPageId: page.id };
    assert.deepEqual(loadEditorSave(JSON.parse(JSON.stringify(saved))), saved);
  }
});

test("v2 migration preserves edited content, hidden groups, assets, child order and deterministic IDs", () => {
  const root = { ...createSection("root", sectionPresets.find((preset) => preset.id === "collection")!), childIds: ["grid", "heading"] };
  const grid = { ...createBlock("grid", "grid", {}), metadata: { appearance: "preset-grid" }, parentId: root.id, childIds: ["card"] };
  const heading = { ...createBlock("heading", "heading", { title: "My collection", body: "Read more" }), parentId: root.id };
  const card = {
    ...createBlock("card", "card", { title: "My project", body: "", buttonLabel: "Open", href: "/project", alt: "A studio", imageUrl: "data:image/png;base64,dGVzdA==" }),
    parentId: grid.id, visible: false, styles: { base: { color: "salmon" }, mobile: { padding: 8 } },
  };
  const existing = createBlock("card:media", "text", { body: "Keep this ID" });
  const page: PageDocument = {
    ...blankPage(), rootIds: [existing.id, root.id],
    nodes: { root, grid, heading, card, [existing.id]: existing },
  };
  const saved = { document: { ...documentWith(page), version: 2 }, selectedPageId: page.id };
  const before = JSON.stringify(saved);
  const loaded = loadEditorSave(saved);
  const [migrated] = loaded.document.pages;
  const { nodes } = migrated;
  assert.deepEqual(migrated.rootIds, page.rootIds);
  assert.deepEqual(nodes.root.childIds, ["grid", "heading", "root:heading-action"]);
  assert.deepEqual(nodes.grid.childIds, ["card"]);
  assert.equal(nodes.card.parentId, "grid");
  assert.equal(nodes.card.visible, false);
  assert.deepEqual(nodes.card.styles, card.styles);
  assert.deepEqual(nodes.card.childIds, ["card:media-2", "card:title", "card:body", "card:action"]);
  assert.deepEqual(nodes["card:media-2"].content, { imageUrl: card.content.imageUrl, alt: "A studio" });
  assert.deepEqual(nodes["card:title"].content, { title: "My project" });
  assert.deepEqual(nodes["card:body"].content, { body: "" });
  assert.deepEqual(nodes["card:action"].content, { buttonLabel: "Open", href: "/project" });
  assert.deepEqual(nodes[existing.id], existing);
  assert.equal(nodes["root:heading-action"].content.buttonLabel, "Read more");
  assert.equal(JSON.stringify(saved), before);
  assert.deepEqual(loadEditorSave(JSON.parse(before)), loaded);
  assert.deepEqual(loadEditorSave(JSON.parse(JSON.stringify(loaded))), loaded);
});

test("v2 migration keeps deleted or repositioned Content + media nodes as saved", () => {
  const document = insertPreset("content-media");
  const [page] = document.pages;
  const [content, media] = page.nodes[page.rootIds[0]].childIds;
  const [eyebrow, heading] = page.nodes[content].childIds;
  const edited = applyDocumentOperation(document, {
    type: "node.delete", pageId: page.id, nodeId: eyebrow,
  });
  const moved = applyDocumentOperation(edited, {
    type: "node.move", pageId: page.id, nodeId: heading, parentId: null, index: 0,
  });
  const saved = { document: { ...moved, version: 2 }, selectedPageId: page.id };
  assert.deepEqual(loadEditorSave(saved).document, moved);
  assert.deepEqual(moved.pages[0].nodes[page.rootIds[0]].childIds, [content, media]);
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
  assert.throws(() => loadEditorSave({ document: { ...emptyDocument, version: 4 } }), /Unsupported/);
});
