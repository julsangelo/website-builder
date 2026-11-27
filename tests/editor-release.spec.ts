import { expect, test, type Locator, type Page } from "@playwright/test";

import { type PageDocument, type SiteDocument } from "../src/lib/builder-document";
import { buildSection, createBlock, sectionPresets } from "../src/lib/builder-presets";
import { editorStorageKey, emptyDocument } from "../src/lib/builder-storage";

const preview = (page: Page, id: string) => page.locator(`article [data-node-id="${id}"]`);
const row = (page: Page, id: string) => page.locator(`[data-layer-node-id="${id}"]`);
const button = (page: Page | Locator, name: string) => page.getByRole("button", { name, exact: true });
const field = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });
const savedStatus = (page: Page) => page.getByRole("status").filter({ hasText: /^All changes saved$/ });

function fixture(presets = ["hero", "content-media"], extraCount = 0) {
  const studio: PageDocument = { id: "studio", name: "Studio", title: "Studio", slug: "studio", rootIds: [], nodes: {} };
  for (const name of presets) {
    const preset = sectionPresets.find(({ id }) => id === name)!;
    let sequence = 0;
    const { node, descendants } = buildSection(preset, () => `${name}-${sequence++}`);
    studio.rootIds.push(node.id);
    Object.assign(studio.nodes, { [node.id]: node, ...descendants });
  }
  for (let index = 0; index < extraCount; index++) {
    const node = createBlock(`extra-${index}`, "heading");
    studio.rootIds.push(node.id);
    studio.nodes[node.id] = node;
  }
  const second: PageDocument = { id: "about", name: "About", title: "About", slug: "about", rootIds: [], nodes: {} };
  return { studio, second };
}

async function openEditor(page: Page, pages: PageDocument[]) {
  await page.addInitScript(({ key, document }) => {
    if (localStorage.getItem(key) === null) {
      localStorage.setItem(key, JSON.stringify({ document, selectedPageId: "studio" }));
    }
  }, { key: editorStorageKey, document: { ...emptyDocument, pages } });
  await page.goto("/");
  await expect(savedStatus(page)).toBeVisible();
}

async function stored(page: Page) {
  await expect(savedStatus(page)).toBeVisible();
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!) as {
    document: SiteDocument;
    selectedPageId: string;
  }, editorStorageKey);
}

async function dragOver(page: Page, source: Locator, target: Locator, targetFraction = 0.5) {
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const from = (await source.boundingBox())!;
  const to = (await target.boundingBox())!;
  const x = to.x + to.width / 2;
  const y = to.y + to.height * targetFraction;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 10 });
  await page.mouse.move(x + 1, y);
}

const viewports = ["Desktop", "Tablet", "Mobile"] as const;

for (const viewport of viewports) {
  test.describe(`${viewport} canvas`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
    });

    test("inserts a preset between sections at 60% and keeps the drag indicator mounted until Escape", async ({ page }) => {
      const { studio } = fixture(["hero", "cta"]);
      await openEditor(page, [studio]);
      await button(page, `${viewport} viewport`).click();
      for (let i = 0; i < 4; i++) await button(page, "Decrease canvas zoom").click();

      await button(page, "Sections").click();
      const source = page.getByRole("button", { name: /^Content \+ media / });
      const cta = preview(page, "cta-0");
      // Scroll both independently before starting the drag so the measured drop spans two scroll areas.
      await source.scrollIntoViewIfNeeded();
      await cta.scrollIntoViewIfNeeded();
      const oldTop = await cta.evaluate((element) => (element as HTMLElement).offsetTop);
      await dragOver(page, source, cta, 0.03);
      const indicator = page.locator("[data-insertion-indicator]");
      await expect(indicator).toHaveAttribute("data-insertion-indicator", "before");
      await page.mouse.up();

      const savedPage = (await stored(page)).document.pages[0];
      const [hero, inserted, following] = savedPage.rootIds;
      expect([hero, following]).toEqual(studio.rootIds);
      expect(savedPage.nodes[inserted].metadata?.preset).toBe("content-media");
      const previewOrder = await page.locator("article [data-node-id]").evaluateAll((elements) =>
        elements.filter((element) => !element.parentElement?.closest("[data-node-id]")).map((element) => element.getAttribute("data-node-id")));
      const layersOrder = await page.locator("[data-layer-node-id]").evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("data-layer-node-id")));
      expect(previewOrder).toEqual(savedPage.rootIds);
      expect(layersOrder.filter((id) => id && savedPage.rootIds.includes(id))).toEqual(savedPage.rootIds);
      expect(await cta.evaluate((element) => (element as HTMLElement).offsetTop)).toBeGreaterThan(oldTop);

      await button(page, "Blocks").click();
      const text = button(page, "Text");
      const eyebrow = preview(page, inserted).getByText("Our approach", { exact: true });
      const heading = preview(page, inserted).getByRole("heading");
      await text.scrollIntoViewIfNeeded();
      await eyebrow.scrollIntoViewIfNeeded();
      const headingBox = (await heading.boundingBox())!;
      await dragOver(page, text, eyebrow);
      await expect(indicator).toBeVisible();
      const element = (await indicator.elementHandle())!;
      await page.mouse.move(headingBox.x + headingBox.width / 2, headingBox.y + headingBox.height / 2, { steps: 5 });
      await expect(indicator).toBeVisible();
      expect(await element.evaluate((indicator) => indicator.isConnected)).toBe(true);
      const url = page.url();
      await page.keyboard.press("Escape");
      await page.mouse.up();
      await expect(indicator).toHaveCount(0);
      expect((await stored(page)).document.pages[0]).toEqual(savedPage);
      await expect(page).toHaveURL(url);
    });

    test("syncs Layers, reparents the selected heading, and preserves hidden descendants", async ({ page }) => {
      const { studio } = fixture();
      const find = (preset: string, label: string) => Object.values(studio.nodes)
        .find((node) => node.id.startsWith(preset) && node.metadata?.label === label)!;
      const content = find("content-media", "Content");
      const eyebrow = find("content-media", "Eyebrow");
      const heading = find("content-media", "Heading");
      const description = find("content-media", "Description");
      const heroContainer = studio.nodes[find("hero", "Heading").parentId!];
      await openEditor(page, [studio]);
      await button(page, `${viewport} viewport`).click();

      await button(row(page, content.id), "Collapse Content").click();
      await expect(row(page, eyebrow.id)).toHaveCount(0);
      await preview(page, eyebrow.id).click();
      await expect(button(row(page, eyebrow.id), "Eyebrow")).toHaveAttribute("aria-current", "true");
      await expect(page.locator("main > footer")).toContainText("Studio › Content + media › Content › Eyebrow");
      await preview(page, eyebrow.id).getByText("Our approach").dblclick();
      await expect(field(page, "Eyebrow")).toBeFocused();
      await field(page, "Eyebrow").fill("Our design process");
      await field(page, "Eyebrow").press("Control+Enter");
      await expect(preview(page, eyebrow.id)).toBeFocused();
      await expect(savedStatus(page)).toBeVisible();
      await page.reload();
      await button(page, `${viewport} viewport`).click();
      await expect(preview(page, eyebrow.id)).toHaveText("Our design process");
      await preview(page, eyebrow.id).press("Enter");
      await page.keyboard.press("Tab");
      await expect(preview(page, eyebrow.id).getByText("Our design process")).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(field(page, "Eyebrow")).toBeFocused();
      await field(page, "Eyebrow").fill("Discard this draft");
      await field(page, "Eyebrow").press("Escape");
      await expect(preview(page, eyebrow.id)).toHaveText("Our design process");

      const headingButton = button(row(page, heading.id), "Heading");
      await headingButton.press("Enter");
      await expect(preview(page, heading.id)).toHaveAttribute("aria-pressed", "true");
      const beforeMove = (await stored(page)).document.pages[0];
      const destination = row(page, heroContainer.id);
      await button(destination, "Collapse Content").click();
      await dragOver(page, row(page, heading.id), destination);
      await expect(destination).toHaveClass(/ring-orange-500/);
      await expect(button(destination, "Collapse Content")).toBeVisible();
      await page.mouse.up();
      await expect(preview(page, heroContainer.id).locator(`:scope > [data-node-id="${heading.id}"]`)).toBeVisible();
      await expect(headingButton).toHaveAttribute("aria-current", "true");
      const moved = (await stored(page)).document.pages[0];
      expect(moved.nodes[heading.id].parentId).toBe(heroContainer.id);
      expect(moved.nodes[heroContainer.id].childIds).toEqual([...heroContainer.childIds, heading.id]);
      expect(moved.nodes[content.id].childIds).toEqual(content.childIds.filter((id) => id !== heading.id));
      await button(page, "Undo").click();
      expect((await stored(page)).document.pages[0]).toEqual(beforeMove);
      await button(page, "Redo").click();
      expect((await stored(page)).document.pages[0]).toEqual(moved);
      await button(page, "Undo").click();

      await button(row(page, description.id), "Hide Description").click();
      await button(row(page, content.id), "Hide Content").click();
      await expect(preview(page, heading.id)).toHaveCount(0);
      await expect(preview(page, description.id)).toHaveCount(0);
      await expect(headingButton).toHaveAttribute("aria-description", "Hidden by a parent layer");
      await expect(button(row(page, description.id), "Description")).toHaveAttribute("aria-description", "Hidden by a parent layer");
      await headingButton.press("Space");
      await expect(headingButton).toHaveAttribute("aria-current", "true");
      await expect(button(row(page, heading.id), "Hide Heading")).toBeVisible();
      await button(row(page, content.id), "Show Content").click();
      await expect(preview(page, heading.id)).toBeVisible();
      await expect(preview(page, description.id)).toHaveCount(0);
      await button(row(page, description.id), "Show Description").click();
      await expect(preview(page, description.id)).toBeVisible();

      await button(row(page, eyebrow.id), "Eyebrow").click();
      await expect(button(page, "Typography")).toBeVisible();
      await expect(button(page, "Layout")).toHaveCount(0);
      await expect(button(page, "Appearance")).toHaveCount(0);
      await button(row(page, "content-media-0"), "Content + media").click();
      await expect(button(page, "Layout")).toBeVisible();
      await expect(button(page, "Appearance")).toBeVisible();
      await expect(button(page, "Typography")).toHaveCount(0);
    });
  });
}

test("tablet Grid tracks and gap reflow real children, inherit, reset, and persist", async ({ page }) => {
  const { studio, second } = fixture(["gallery"]);
  const grid = Object.values(studio.nodes).find((node) => node.type === "grid")!;
  await openEditor(page, [studio, second]);
  await row(page, grid.id).getByRole("button", { name: "Image grid", exact: true }).click();
  const frame = preview(page, grid.id);
  const first = preview(page, grid.childIds[0]);
  const secondImage = preview(page, grid.childIds[1]);
  const columns = field(page, "Grid columns");
  const gap = field(page, "Gap");
  const base = await columns.inputValue();
  await button(page, "Tablet viewport").click();
  await columns.fill("minmax(0, 1fr)");
  await expect.poll(async () => (await secondImage.boundingBox())!.y - (await first.boundingBox())!.y).toBeGreaterThan(0);
  await columns.fill("minmax(0, 1fr) minmax(0, 1fr)");
  await gap.fill("24px");
  await expect(frame).toHaveCSS("gap", "24px");
  await expect.poll(async () => (await secondImage.boundingBox())!.y - (await first.boundingBox())!.y).toBe(0);
  await button(page, "Mobile viewport").click();
  await expect(gap).toHaveValue("24px");
  await button(page, "Desktop viewport").click();
  await expect(columns).toHaveValue(base);
  await expect(frame).toHaveCSS("gap", "16px");
  await stored(page);
  await page.reload();
  await button(row(page, grid.id), "Image grid").click();
  await button(page, "Tablet viewport").click();
  await expect(gap).toHaveValue("24px");
  await button(page, "Reset Gap").click();
  await expect(frame).toHaveCSS("gap", "16px");
  await button(page, "About").click();
  await button(page, "Undo").click();
  await expect(page.getByText("About · Tablet")).toBeVisible();
  expect((await stored(page)).selectedPageId).toBe(second.id);
  await button(page, "Studio").click();
  await expect(frame).toHaveCSS("gap", "24px");
  await button(page, "Redo").click();
  await expect(frame).toHaveCSS("gap", "16px");
});

test("invalid Layers drops are inert and a scrolled canvas accepts empty-container drops", async ({ page }) => {
  const { studio } = fixture(["hero", "content-media"], 24);
  const grid = createBlock("empty-grid", "grid");
  studio.rootIds.push(grid.id);
  studio.nodes[grid.id] = grid;
  const content = Object.values(studio.nodes).find((node) => node.metadata?.appearance === "split-content" && node.id.startsWith("content-media"))!;
  const headingId = content.childIds.find((id) => studio.nodes[id].type === "heading")!;
  await openEditor(page, [studio]);

  await button(row(page, "hero-0"), "Collapse Hero").click();
  const contentRow = row(page, content.id);
  await dragOver(page, contentRow, row(page, headingId));
  await expect(page.getByRole("status").filter({ hasText: "The destination is not a container" })).toBeVisible();
  await page.mouse.up();
  expect((await stored(page)).document.pages[0]).toEqual(studio);
  await expect(button(page, "Undo")).toBeDisabled();

  await button(page, "Mobile viewport").click();
  const empty = preview(page, grid.id);
  await empty.scrollIntoViewIfNeeded();
  await expect(empty).toHaveCSS("outline-style", "dashed");
  await empty.click();
  await expect(button(row(page, grid.id), "Grid")).toHaveAttribute("aria-current", "true");
  const layerViewport = row(page, grid.id).locator('xpath=ancestor::div[@data-slot="scroll-area-viewport"]');
  expect(await layerViewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const quick = page.getByText("Quick insert", { exact: true }).locator("..");
  const quickViewport = quick.locator('xpath=ancestor::div[@data-slot="scroll-area-viewport"]');
  await quickViewport.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(quick).toHaveCSS("position", "sticky");
  await expect(quick).not.toHaveCSS("box-shadow", "none");
  await dragOver(page, empty.locator("[data-canvas-move-handle]"), empty);
  await expect(page.getByRole("status").filter({ hasText: "A node cannot be moved into itself or its descendant" })).toBeVisible();
  await page.mouse.up();
  expect((await stored(page)).document.pages[0]).toEqual(studio);

  const source = page.locator('button[draggable="true"]').filter({ hasText: /^Text$/ });
  await dragOver(page, source, empty);
  await expect(page.locator("[data-insertion-indicator]")).toHaveAttribute("data-insertion-indicator", "inside");
  await page.mouse.up();
  const [{ id: insertedId, parentId }] = Object.values((await stored(page)).document.pages[0].nodes)
    .filter((node) => node.parentId === grid.id);
  expect(parentId).toBe(grid.id);
  await expect(empty.locator(`[data-node-id="${insertedId}"]`)).toHaveAttribute("aria-pressed", "true");
  await button(page, "Undo").click();
  await expect(empty.locator("[data-node-id]")).toHaveCount(0);
  await expect(empty).toHaveCSS("outline-style", "dashed");
});

for (const device of [{ name: "Tablet", width: 820, height: 1024 }, { name: "Mobile", width: 390, height: 844 }]) {
  test.describe(`${device.name} touch shell`, () => {
    test.use({ hasTouch: true, viewport: { width: device.width, height: device.height } });

    test("exposes inserts, moves, inspector edits, page switching and undo", async ({ page }) => {
      const { studio, second } = fixture(["hero", "cta"]);
      await openEditor(page, [studio, second]);
      await button(page, `${device.name} viewport`).tap();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(device.width);
      const layersTrigger = button(page, "Open Layers");
      await layersTrigger.press("Enter");
      const layers = page.getByRole("dialog", { name: "Layers" });
      await button(row(page, "hero-0"), "Hero").press("Space");
      await expect(button(row(page, "hero-0"), "Hero")).toHaveAttribute("aria-current", "true");
      await button(layers, "Close").tap();
      await expect(layersTrigger).toBeFocused();

      const quickTrigger = button(page, "Open Quick insert");
      await quickTrigger.tap();
      const quick = page.getByRole("dialog", { name: "Quick insert" });
      await button(quick, "Sections").tap();
      await quick.getByRole("searchbox").fill("split text");
      await quick.getByRole("button", { name: /^Content \+ media / }).press("Enter");
      await button(quick, "Close").tap();
      const inserted = (await stored(page)).document.pages[0].rootIds[1];
      await expect(preview(page, inserted)).toHaveAttribute("aria-label", "Content + media");

      const inspectorTrigger = button(page, "Open Inspector");
      await inspectorTrigger.tap();
      const inspector = page.getByRole("dialog", { name: "Inspector" });
      await expect(button(inspector, "Layout")).toBeVisible();
      await expect(button(inspector, "Appearance")).toBeVisible();
      await expect(inspector.getByRole("tab", { name: "Settings" })).toBeDisabled();
      await field(page, "Gap").fill("24px");
      await button(inspector, "Close").tap();
      await expect(preview(page, inserted)).toHaveCSS("gap", "24px");
      await expect(inspectorTrigger).toBeFocused();

      const savedPage = (await stored(page)).document.pages[0];
      await layersTrigger.tap();
      const container = savedPage.nodes[savedPage.nodes[inserted].childIds[0]];
      const heading = container.childIds.find((id) => savedPage.nodes[id].type === "heading")!;
      const moveTrigger = button(row(page, heading), "Move Heading");
      await moveTrigger.press("Enter");
      const moveDialog = page.getByRole("dialog", { name: "Move Heading" });
      await moveDialog.getByRole("combobox", { name: "Destination layer" }).selectOption("cta-0");
      await moveDialog.getByRole("combobox", { name: "Position" }).selectOption("inside");
      await button(moveDialog, "Move layer").tap();
      await expect(moveTrigger).toBeFocused();
      await button(layers, "Close").tap();
      await expect(preview(page, "cta-0").locator(`[data-node-id="${heading}"]`)).toBeVisible();

      await button(page, "Switch page").tap();
      await page.getByRole("menuitem", { name: "About", exact: true }).tap();
      await button(page, "Undo").tap();
      expect((await stored(page)).selectedPageId).toBe("about");
      await button(page, "Switch page").tap();
      await page.getByRole("menuitem", { name: "Studio", exact: true }).tap();
      await expect(preview(page, container.id).locator(`[data-node-id="${heading}"]`)).toBeVisible();
      await button(page, "Redo").tap();
      await expect(preview(page, "cta-0").locator(`[data-node-id="${heading}"]`)).toBeVisible();
      await stored(page);
      await page.reload();
      await expect(savedStatus(page)).toBeVisible();
      const viewport = button(page, `${device.name} viewport`);
      await viewport.tap();
      await expect(viewport).toHaveAttribute("aria-pressed", "true");
      await expect(preview(page, inserted)).toHaveCSS("gap", "24px");
      await expect(preview(page, "cta-0").locator(`[data-node-id="${heading}"]`)).toBeVisible();
    });
  });
}

test("autosave reports full browser storage and keeps the current edit available", async ({ page }) => {
  const { studio } = fixture(["content-media"]);
  const eyebrow = Object.values(studio.nodes).find((node) => node.metadata?.label === "Eyebrow")!;
  await openEditor(page, [studio]);
  await page.evaluate((editorKey) => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === editorKey) throw new DOMException("Storage full", "QuotaExceededError");
      return setItem.call(this, key, value);
    };
  }, editorStorageKey);
  await preview(page, eyebrow.id).getByText("Our approach").dblclick();
  await field(page, "Eyebrow").fill("Visible unsaved change");
  await field(page, "Eyebrow").press("Control+Enter");
  await expect(page.getByRole("status").filter({ hasText: "Could not save changes to browser storage." })).toBeVisible();
  await expect(preview(page, eyebrow.id)).toHaveText("Visible unsaved change");
  await page.reload();
  await expect(preview(page, eyebrow.id)).toHaveText("Our approach");
});

test("subtree deletion confirms its scope, restores focus, and uses one history step", async ({ page }) => {
  const { studio } = fixture();
  await openEditor(page, [studio]);
  const trigger = button(row(page, "hero-0"), "Delete Hero");
  const dialog = page.getByRole("dialog", { name: "Delete layer?" });
  await trigger.press("Enter");
  await expect(dialog).toContainText("Hero and all its descendants");
  await expect(button(dialog, "Cancel")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.press("Enter");
  await button(dialog, "Delete layer").press("Enter");
  const next = button(row(page, "content-media-0"), "Content + media");
  await expect(next).toBeFocused();
  await expect(next).toHaveAttribute("aria-current", "true");
  await expect(preview(page, "hero-0")).toHaveCount(0);
  await button(page, "Undo").click();
  expect((await stored(page)).document.pages[0]).toEqual(studio);
  await expect(button(page, "Undo")).toBeDisabled();
});

test("deep Layers rows keep aligned actions and readable names in a narrow panel", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { studio } = fixture([], 40);
  const labelAt = (depth: number) => `Layer ${depth} with a deliberately long descriptive name`;
  for (let depth = 0; depth <= 10; depth++) {
    const node = createBlock(`depth-${depth}`, depth === 10 ? "heading" : "box");
    node.metadata = { label: labelAt(depth) };
    node.visible = depth !== 3;
    if (depth === 0) studio.rootIds.unshift(node.id);
    else {
      node.parentId = `depth-${depth - 1}`;
      studio.nodes[node.parentId].childIds.push(node.id);
    }
    studio.nodes[node.id] = node;
  }
  await openEditor(page, [studio]);
  const root = row(page, "depth-0");
  const viewport = root.locator('xpath=ancestor::div[@data-slot="scroll-area-viewport"]');
  const handle = page.locator('[data-slot="resizable-handle"][aria-orientation="vertical"]').first();

  async function resizePanel(distance: number) {
    const bounds = (await handle.boundingBox())!;
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + distance, y, { steps: 6 });
    await page.mouse.up();
  }

  async function checkRows() {
    for (const depth of [0, 3, 6, 10]) {
      const layer = row(page, `depth-${depth}`);
      const select = button(layer, labelAt(depth));
      await expect(layer.locator("..")).toHaveAttribute("aria-level", String(depth + 1));
      const rootBounds = (await root.boundingBox())!;
      const bounds = (await layer.boundingBox())!;
      expect([bounds.x, bounds.width]).toEqual([rootBounds.x, rootBounds.width]);
      const actions = layer.getByRole("button", { name: /^(Move|Hide|Show|Delete) / });
      const actionBounds = await actions.evaluateAll((controls) =>
        controls.map((control) => {
          const { left, width } = control.getBoundingClientRect();
          return [left, width];
        }));
      const rootActionBounds = await root.getByRole("button", { name: /^(Move|Hide|Delete) / })
        .evaluateAll((controls) => controls.map((control) => {
          const { left, width } = control.getBoundingClientRect();
          return [left, width];
        }));
      expect(actionBounds).toEqual(rootActionBounds);
      expect(actionBounds).toHaveLength(3);
      for (const [left, width] of actionBounds) {
        expect(width).toBeGreaterThanOrEqual(24);
        expect(left + width).toBeLessThanOrEqual(bounds.x + bounds.width);
      }
      const text = select.locator("span");
      const labelBounds = await text.evaluate((element) => ({
        width: element.clientWidth,
        contentWidth: element.scrollWidth,
        overflow: getComputedStyle(element).textOverflow,
      }));
      expect(labelBounds.width, `label width at depth ${depth}`).toBeGreaterThan(0);
      expect(labelBounds.contentWidth, `label content width at depth ${depth}`).toBeGreaterThan(labelBounds.width);
      expect(labelBounds.overflow).toBe("ellipsis");
      expect(await text.evaluate((element) => getComputedStyle(element).textDecorationLine))
        .toBe(depth === 0 ? "none" : "line-through");
    }
    expect(await viewport.evaluate((element) => [
      element.scrollWidth === element.clientWidth,
      element.scrollHeight > element.clientHeight,
    ])).toEqual([true, true]);
  }

  await resizePanel(-100);
  expect(Math.round((await viewport.boundingBox())!.width)).toBe(200);
  await checkRows();

  const deep = row(page, "depth-10");
  const select = button(deep, labelAt(10));
  const move = button(deep, `Move ${labelAt(10)}`);
  const eye = button(deep, `Hide ${labelAt(10)}`);
  const remove = button(deep, `Delete ${labelAt(10)}`);
  await select.press("Enter");
  await expect(select).toHaveAttribute("aria-current", "true");
  await expect(select).toHaveAccessibleDescription(/Hidden by a parent layer/);
  await expect(deep).toHaveClass(/bg-orange-100/);
  await expect(remove).toHaveCSS("opacity", "1");
  await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const heading = page.getByRole("heading", { name: "Layers", exact: true }).locator("..");
  expect((await heading.boundingBox())!.y).toBe((await viewport.boundingBox())!.y);
  await expect(heading).not.toHaveCSS("box-shadow", "none");

  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(select).toBeFocused();
  const nameTooltip = page.getByRole("tooltip").filter({ hasText: labelAt(10) });
  await expect(nameTooltip).toContainText(`Studio › ${labelAt(0)}`);
  await expect(nameTooltip).toContainText(labelAt(9));
  await page.keyboard.press("Escape");
  await expect(nameTooltip).toBeHidden();
  await heading.hover();
  await select.hover();
  await expect(nameTooltip).toBeVisible();
  await page.keyboard.press("Escape");

  const scrollTop = await viewport.evaluate((element) => element.scrollTop);
  await resizePanel(24);
  expect(Math.round((await viewport.boundingBox())!.width)).toBe(224);
  expect(await viewport.evaluate((element) => element.scrollTop)).toBe(scrollTop);
  await expect(select).toHaveAttribute("aria-current", "true");
  await expect(button(root, `Collapse ${labelAt(0)}`)).toHaveAttribute("aria-expanded", "true");
  await checkRows();

  await move.click();
  await expect(page.getByRole("dialog", { name: `Move ${labelAt(10)}` })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(move).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(eye).toBeFocused();
  await page.keyboard.press("Space");
  await expect(button(deep, `Show ${labelAt(10)}`)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(remove).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Delete layer?" })).toBeVisible();
  await button(page, "Cancel").click();
  expect((await stored(page)).document.pages[0].nodes["depth-10"].visible).toBe(false);

  const destination = row(page, "depth-6");
  // Keep both rows within the viewport and clear of the sticky heading and drag-scroll edges.
  await destination.evaluate((element) => {
    const viewport = element.closest('[data-slot="scroll-area-viewport"]')!;
    viewport.scrollTop += element.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 72;
  });
  await dragOver(page, deep, destination);
  await expect(destination).toHaveClass(/ring-orange-500/);
  await page.mouse.up();
  expect((await stored(page)).document.pages[0].nodes["depth-10"].parentId).toBe("depth-6");
  await expect(select).toHaveAttribute("aria-current", "true");
  await button(page, "Undo").click();
  expect((await stored(page)).document.pages[0].nodes["depth-10"].parentId).toBe("depth-9");

  await page.setViewportSize({ width: 320, height: 700 });
  await button(page, "Open Layers").press("Enter");
  const compact = page.getByRole("dialog", { name: "Layers" });
  const compactName = button(compact, labelAt(0));
  await compactName.hover();
  const compactTooltip = page.getByRole("tooltip").filter({ hasText: labelAt(0) });
  await expect(compactTooltip).toBeVisible();
  await expect.poll(() => compactTooltip.evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(x + width / 2, y + height / 2));
  })).toBe(true);
});

test("a Layers drag scrolls a long tree and applies the indicated sibling position", async ({ page }) => {
  const { studio } = fixture([], 40);
  await openEditor(page, [studio]);
  const first = row(page, "extra-0");
  const panel = first.locator('xpath=ancestor::div[@data-slot="scroll-area-viewport"]');
  const bounds = (await panel.boundingBox())!;
  const source = (await first.boundingBox())!;
  const x = source.x + source.width / 2;
  await page.mouse.move(x, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, bounds.y + bounds.height - 6, { steps: 10 });
  await page.mouse.move(x + 1, bounds.y + bounds.height - 6);
  await expect.poll(() => panel.evaluate((element) => element.scrollTop)).toBeGreaterThan(300);
  // Leave the panel to stop auto-scroll, then choose a row away from the sticky heading and edges.
  const y = bounds.y + bounds.height / 2;
  await page.mouse.move(bounds.x + bounds.width + 20, y);
  const targetId = await panel.evaluate((element, middle) => {
    return Array.from(element.querySelectorAll<HTMLElement>("[data-layer-node-id]")).find((row) => {
      const { top, height } = row.getBoundingClientRect();
      return top + height / 2 >= middle;
    })?.dataset.layerNodeId;
  }, y);
  expect(targetId).toBeDefined();
  const target = row(page, targetId!);
  const targetBounds = (await target.boundingBox())!;
  const afterY = targetBounds.y + targetBounds.height * 0.85;
  await page.mouse.move(x, afterY);
  await page.mouse.move(x + 1, afterY);
  await expect(target.locator("..").locator(":scope > .-bottom-px")).toBeVisible();
  await page.mouse.up();
  const expected = studio.rootIds.slice(1);
  expected.splice(expected.indexOf(targetId!) + 1, 0, "extra-0");
  expect((await stored(page)).document.pages[0].rootIds).toEqual(expected);
  await button(page, "Undo").click();
  expect((await stored(page)).document.pages[0].rootIds).toEqual(studio.rootIds);

  const beforeTarget = row(page, "extra-2");
  await dragOver(page, row(page, "extra-4"), beforeTarget, 0.15);
  await expect(beforeTarget.locator("..").locator(":scope > .-top-px")).toBeVisible();
  await page.mouse.up();
  expect((await stored(page)).document.pages[0].rootIds.slice(0, 5)).toEqual(["extra-0", "extra-1", "extra-4", "extra-2", "extra-3"]);
});
