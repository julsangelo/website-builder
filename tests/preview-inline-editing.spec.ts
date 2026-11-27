import { openAdvanced } from "./inspector-controls";
import { expect, test, type Page } from "@playwright/test";

import { buildSection, sectionPresets } from "../src/lib/builder-presets";
import { editorStorageKey, emptyDocument } from "../src/lib/builder-storage";

function savedStatus(page: Page) {
  return page.getByRole("status").filter({ hasText: /^All changes saved$/ });
}

test.beforeEach(async ({ page }) => {
  let sequence = 0;
  const sections = sectionPresets
    .filter(({ id }) => id === "hero" || id === "content-media")
    .map((preset) => buildSection(preset, () => `node-${++sequence}`));
  const document = {
    ...emptyDocument,
    pages: [{
      id: "studio",
      name: "Studio",
      title: "Studio",
      slug: "studio",
      rootIds: sections.map(({ node }) => node.id),
      nodes: Object.assign({}, ...sections.map(({ node, descendants }) => ({ [node.id]: node, ...descendants }))),
    }],
  };

  await page.goto("/");
  await expect(savedStatus(page)).toBeVisible();
  await page.evaluate(({ key, saved }) => {
    localStorage.setItem(key, JSON.stringify(saved));
  }, { key: editorStorageKey, saved: { document, selectedPageId: "studio" } });
  await page.reload();
  await expect(savedStatus(page)).toBeVisible();
});

test("Hero single-click selection, cancel, commit, undo and reload", async ({ page }) => {
  const heading = page.locator('article [data-node-id][aria-label="Hero"] h1');
  const original = "Spaces for slower living.";
  const undo = page.getByRole("button", { name: "Undo", exact: true });

  await heading.click();
  await expect(heading.locator("..")).toHaveAttribute("aria-pressed", "true");
  await expect(heading.getByRole("textbox")).toHaveCount(0);
  await heading.dblclick();
  const draft = heading.getByRole("textbox", { name: "Heading" });
  await expect(draft).toBeFocused();
  await expect(draft).toHaveValue(original);
  await draft.fill("Discard this change");
  await draft.press("Escape");
  await expect(heading).toHaveText(original);
  await expect(undo).toBeDisabled();

  await heading.dblclick();
  await draft.press("Control+Enter");
  await expect(undo).toBeDisabled();

  await heading.dblclick();
  await draft.fill("A new");
  await draft.press("End");
  await draft.pressSequentially(" Hero");
  await draft.press("Control+Enter");
  await expect(heading).toHaveText("A new Hero");
  await undo.click();
  await expect(heading).toHaveText(original);
  await expect(undo).toBeDisabled();

  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(savedStatus(page)).toBeVisible();
  await page.reload();
  await expect(heading).toHaveText("A new Hero");
});

test("Content + media commits eyebrow and multiline description in the mobile viewport", async ({ page }) => {
  await page.getByRole("button", { name: "Mobile viewport" }).click();
  const section = page.locator('article [data-node-id][aria-label="Content + media"]');
  const eyebrow = section.locator('[data-node-id][aria-label="Eyebrow"]');
  const description = section.locator('[data-node-id][aria-label="Description"] p');
  const original = "A thoughtful system creates a clear path from first impression to lasting connection.";
  const copy = "First line\n\nLast line";

  await eyebrow.getByText("Our approach").dblclick();
  const eyebrowDraft = eyebrow.getByRole("textbox", { name: "Eyebrow" });
  await expect(eyebrowDraft).toBeFocused();
  await eyebrowDraft.fill("Our process");
  await eyebrowDraft.press("Meta+Enter");
  await expect(eyebrow).toHaveText("Our process");

  await description.dblclick();
  await description.getByRole("textbox", { name: "Description" }).fill(copy);
  await eyebrow.getByText("Our process").click();
  await expect(description).toHaveText(copy);
  await expect(description).toHaveCSS("white-space", "pre-wrap");

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(description).toHaveText(original);
  await expect(eyebrow).toHaveText("Our process");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(savedStatus(page)).toBeVisible();
  await page.reload();
  await expect(eyebrow).toHaveText("Our process");
  expect(await description.textContent()).toBe(copy);
});

test("Hero button label and link are editable without navigation", async ({ page, context }) => {
  await page.getByRole("button", { name: "Tablet viewport" }).click();
  const button = page.locator('article [data-node-id][aria-label="CTA button"]');
  const original = "Explore our work ↗";
  const url = page.url();
  const openLink = async () => {
    await button.getByRole("button", { name: "Edit button link" }).click();
    return page.getByRole("dialog", { name: "Button link" });
  };

  await button.getByText(original).dblclick();
  const draft = button.getByRole("textbox", { name: "Button label" });
  await expect(draft).toBeFocused();
  await draft.fill("View the work");
  await draft.press("Control+Enter");
  const link = await openLink();
  await link.getByRole("textbox", { name: "URL" }).fill("/projects");
  await link.getByRole("combobox", { name: "Open in" }).selectOption("_blank");
  await link.getByRole("button", { name: "Save link" }).click();
  await expect(link).toBeHidden();

  await button.getByText("View the work").click();
  await expect(page).toHaveURL(url);
  expect(context.pages()).toHaveLength(1);

  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await undo.click();
  await expect(button).toHaveText("View the work");
  const undoneLink = await openLink();
  await expect(undoneLink.getByRole("textbox", { name: "URL" })).toHaveValue("");
  await undoneLink.getByRole("textbox", { name: "URL" }).press("Escape");
  await undo.click();
  await expect(button).toHaveText(original);
  await expect(undo).toBeDisabled();

  const redo = page.getByRole("button", { name: "Redo", exact: true });
  await redo.click();
  await redo.click();
  await expect(savedStatus(page)).toBeVisible();
  await page.reload();
  await button.getByText("View the work").click();
  const savedLink = await openLink();
  await expect(savedLink.getByRole("textbox", { name: "URL" })).toHaveValue("/projects");
  await expect(savedLink.getByRole("combobox", { name: "Open in" })).toHaveValue("_blank");
});

test("Hero image replacement validates URLs and uploads, preserves height, and saves one undo step", async ({ page }) => {
  const section = page.locator('article [data-node-id][aria-label="Hero"]');
  const surface = section.locator("[data-image-surface]");
  const image = surface.locator("img");
  const inspector = page.getByRole("tab", { name: "Style", exact: true }).locator("xpath=ancestor::aside");
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  const redo = page.getByRole("button", { name: "Redo", exact: true });
  const source = "/prototype/forma-hero.png";
  const openEditor = async () => {
    await surface.dblclick();
    const editor = page.getByRole("dialog", { name: "Replace image" });
    await expect(editor.getByRole("textbox", { name: "Image URL" })).toBeFocused();
    return editor;
  };

  await section.click({ position: { x: 2, y: 2 } });
  await expect(inspector.getByRole("tab", { name: "Settings", exact: true })).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Layout", exact: true })).toBeVisible();
  await expect(inspector.getByText(/Inheriting|Hero section/)).toHaveCount(0);
  const height = await surface.evaluate((element) => element.clientHeight);
  expect(height).toBe(await section.evaluate((element) => element.clientHeight));

  let editor = await openEditor();
  await expect(inspector.getByRole("textbox", { name: "Image URL" })).toHaveCount(0);
  await editor.getByRole("textbox", { name: "Image URL" }).fill(source);
  await editor.getByRole("textbox", { name: "Alt text" }).fill("Original interior");
  await editor.getByRole("button", { name: "Apply" }).click();
  await expect(image).toHaveAttribute("src", source);
  await expect(image).toHaveAttribute("alt", "Original interior");
  await expect(image).toHaveCSS("object-fit", "cover");

  await page.route("**/invalid-image.png", (route) => route.fulfill({ status: 200, contentType: "text/plain", body: "invalid image" }));
  editor = await openEditor();
  const url = editor.getByRole("textbox", { name: "Image URL" });
  await url.clear();
  await editor.getByRole("button", { name: "Apply" }).click();
  await expect(editor.getByRole("alert")).toContainText("Enter an HTTP or HTTPS image URL");
  await url.fill("/invalid-image.png");
  await editor.getByRole("button", { name: "Apply" }).click();
  await expect(editor.getByRole("alert")).toContainText("This URL could not be loaded as an image");
  await expect(image).toHaveAttribute("src", source);

  const upload = editor.getByLabel("Upload image");
  await upload.setInputFiles({ name: "unsupported.txt", mimeType: "text/plain", buffer: Buffer.from("invalid image") });
  await editor.getByRole("button", { name: "Apply" }).click();
  await expect(editor.getByRole("alert")).toContainText("Choose a supported image file");
  await upload.setInputFiles({ name: "corrupt.png", mimeType: "image/png", buffer: Buffer.from("invalid image") });
  await editor.getByRole("button", { name: "Apply" }).click();
  await expect(editor.getByRole("alert")).toContainText("This file could not be loaded as an image");
  await expect(image).toHaveAttribute("src", source);

  await upload.setInputFiles("public/prototype/forma-project-1.png");
  await editor.getByRole("textbox", { name: "Alt text" }).fill("Uploaded interior");
  await editor.getByRole("combobox", { name: "Object fit" }).selectOption("contain");
  await editor.getByRole("button", { name: "Apply" }).click();
  await expect(editor).toBeHidden();
  await expect(image).toHaveAttribute("src", /^data:image\/png;base64,/);
  await expect(image).toHaveAttribute("alt", "Uploaded interior");
  await expect(image).toHaveCSS("object-fit", "contain");
  expect(await image.evaluate((element) => element.clientHeight)).toBe(height);

  await undo.click();
  await expect(image).toHaveAttribute("src", source);
  await expect(image).toHaveAttribute("alt", "Original interior");
  await expect(image).toHaveCSS("object-fit", "cover");
  await undo.click();
  await expect(image).toHaveCount(0);
  await expect(undo).toBeDisabled();

  await redo.click();
  await redo.click();
  await expect(savedStatus(page)).toBeVisible();
  await page.reload();
  await expect(image).toHaveAttribute("src", /^data:image\/png;base64,/);
  await expect(image).toHaveAttribute("alt", "Uploaded interior");
  await expect(image).toHaveCSS("object-fit", "contain");
  expect(await image.evaluate((element) => element.clientHeight)).toBe(height);
});

for (const viewport of ["Tablet", "Mobile"]) {
  test(`Content + media image can be edited and cancelled in the ${viewport.toLowerCase()} viewport`, async ({ page }) => {
    await page.getByRole("button", { name: `${viewport} viewport` }).click();
    const surface = page.locator('article [data-node-id][aria-label="Content + media"] [data-image-surface]');
    await surface.dblclick();
    const editor = page.getByRole("dialog", { name: "Replace image" });
    const url = editor.getByRole("textbox", { name: "Image URL" });
    await expect(url).toBeFocused();
    await url.fill("/prototype/forma-project-2.png");
    await url.press("Escape");
    await expect(editor).toBeHidden();
    await expect(surface.locator("img")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  });
}

test("Layout changes flex and grid flow while keeping child and Layer order", async ({ page }) => {
  const container = page.locator('article [data-node-id][aria-label="Content + media"] [data-node-id][aria-label="Content"]');
  const childIds = () => container.locator(":scope > [data-node-id]").evaluateAll((children) =>
    children.map((child) => child.getAttribute("data-node-id")));
  const children = await childIds();
  const display = page.getByRole("combobox", { name: "Display" });
  const direction = page.getByRole("combobox", { name: "Direction" });
  const wrap = page.getByRole("combobox", { name: "Wrap" });
  const columns = page.getByRole("textbox", { name: "Grid columns" });
  const rows = page.getByRole("textbox", { name: "Grid rows" });
  const gap = page.getByRole("textbox", { name: "Gap", exact: true });
  const heading = page.getByRole("button", { name: "Layout", exact: true });
  const undo = page.getByRole("button", { name: "Undo", exact: true });

  const id = await container.getAttribute("data-node-id");
  await page.locator(`[data-layer-node-id="${id}"]`).getByRole("button", { name: "Content", exact: true }).click();
  await openAdvanced(page, "Layout");
  await expect(display).toHaveValue("flex");
  await expect(columns).toHaveCount(0);
  await direction.selectOption("row");
  await wrap.selectOption("wrap");
  await page.getByRole("combobox", { name: "Align items" }).selectOption("center");
  await page.getByRole("combobox", { name: "Justify content" }).selectOption("space-between");
  await expect(container).toHaveCSS("flex-direction", "row");
  await expect(container).toHaveCSS("flex-wrap", "wrap");
  await expect(container).toHaveCSS("align-items", "center");
  await expect(container).toHaveCSS("justify-content", "space-between");

  await display.selectOption("grid");
  await expect(container).toHaveCSS("display", "grid");
  await expect(direction).toHaveCount(0);
  await undo.click();
  await expect(container).toHaveCSS("display", "flex");
  await expect(direction).toHaveValue("row");
  await display.selectOption("grid");
  await columns.fill("1fr 1fr");
  await rows.fill("80px 100px");
  await gap.fill("18px");
  await expect(container).toHaveCSS("grid-template-rows", "80px 100px");
  await expect(container).toHaveCSS("gap", "18px");
  await expect.poll(() => container.locator(":scope > [data-node-id]").evaluateAll(([first, second, third]) => {
    const [a, b, c] = [first, second, third].map((child) => child.getBoundingClientRect());
    return b.left > a.left && c.top > a.top;
  })).toBe(true);
  expect(await childIds()).toEqual(children);
  const layerIds = await page.locator("[data-layer-node-id]").evaluateAll((layers) =>
    layers.map((layer) => layer.getAttribute("data-layer-node-id")));
  expect(layerIds.filter((layer) => children.includes(layer))).toEqual(children);

  await page.setViewportSize({ width: 1440, height: 760 });
  const layoutScroll = page.locator('[data-slot="scroll-area-viewport"]').filter({ has: heading });
  await layoutScroll.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(heading).toHaveCSS("position", "sticky");
  await expect(heading).not.toHaveCSS("box-shadow", "none");
  await expect.poll(async () => {
    const [headerBox, scrollBox] = await Promise.all([heading.boundingBox(), layoutScroll.boundingBox()]);
    return Math.abs(headerBox!.y - scrollBox!.y);
  }).toBeLessThan(2);

  await container.getByText("Our approach").click();
  await expect(heading).toHaveCount(0);
});

test("Layout overrides inherit across viewports and survive reload and undo", async ({ page }) => {
  const section = page.locator('article [data-node-id][aria-label="Content + media"]');
  const selectSection = async () => {
    const id = await section.getAttribute("data-node-id");
    await page.locator(`[data-layer-node-id="${id}"]`).getByRole("button", { name: "Content + media", exact: true }).click();
  };
  const desktop = page.getByRole("button", { name: "Desktop viewport" });
  const tablet = page.getByRole("button", { name: "Tablet viewport" });
  const mobile = page.getByRole("button", { name: "Mobile viewport" });
  const display = page.getByRole("combobox", { name: "Display" });
  const columns = page.getByRole("textbox", { name: "Grid columns" });
  const gap = page.getByRole("textbox", { name: "Gap", exact: true });
  const resetGap = page.getByRole("button", { name: "Reset Gap", exact: true });
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  const redo = page.getByRole("button", { name: "Redo", exact: true });

  await selectSection();
  await openAdvanced(page, "Layout");
  await expect(gap).toHaveValue("normal");
  await tablet.click();
  await openAdvanced(page, "Layout");
  await columns.fill("2fr 1fr");
  await gap.fill("24px");
  await expect(section).toHaveCSS("gap", "24px");
  await gap.fill("-3px");
  await expect(gap).toHaveAttribute("aria-invalid", "true");
  await expect(section).toHaveCSS("gap", "24px");
  await mobile.click();
  await openAdvanced(page, "Layout");
  await expect(columns).toHaveValue("2fr 1fr");
  await expect(gap).toHaveValue("24px");
  await expect(resetGap).toHaveCount(0);
  await desktop.click();
  await openAdvanced(page, "Layout");
  await expect(columns).toHaveValue("repeat(2, minmax(0, 1fr))");
  await expect(section).toHaveCSS("gap", "normal");

  await tablet.click();
  await openAdvanced(page, "Layout");
  await resetGap.click();
  await expect(section).toHaveCSS("gap", "normal");
  await undo.click();
  await expect(section).toHaveCSS("gap", "24px");
  await redo.click();
  await expect(section).toHaveCSS("gap", "normal");
  await undo.click();
  await display.selectOption("none");
  await expect(section).toBeHidden();
  await expect(gap).toHaveCount(0);
  await page.getByRole("button", { name: "Reset Display" }).click();
  await expect(section).toHaveCSS("display", "grid");
  await expect(savedStatus(page)).toBeVisible();
  await page.reload();
  await selectSection();
  await tablet.click();
  await openAdvanced(page, "Layout");
  await expect(columns).toHaveValue("2fr 1fr");
  await expect(section).toHaveCSS("gap", "24px");
  await resetGap.click();
  await expect(savedStatus(page)).toBeVisible();
  await page.reload();
  await selectSection();
  await tablet.click();
  await openAdvanced(page, "Layout");
  await expect(gap).toHaveValue("normal");
  await expect(resetGap).toHaveCount(0);
});

test("Spatial Layout fields resize containers, validate values, and apply position and overflow", async ({ page }) => {
  const section = page.locator('article [data-node-id][aria-label="Content + media"]');
  const id = await section.getAttribute("data-node-id");
  await page.locator(`[data-layer-node-id="${id}"]`).getByRole("button", { name: "Content + media", exact: true }).click();
  await expect(section).toHaveAttribute("aria-pressed", "true");
  const field = (name: string) => page.getByRole("textbox", { name, exact: true });

  await openAdvanced(page, "Layout");
  await field("Width").fill("340");
  await expect(field("Width")).toHaveAttribute("aria-invalid", "true");
  await expect(section).not.toHaveCSS("width", "340px");
  await field("Width").fill("340px");
  await expect(section).toHaveCSS("width", "340px");
  await field("Min width").fill("360px");
  await expect(section).toHaveCSS("width", "360px");
  await field("Max width").fill("380px");
  await field("Width").fill("420px");
  await expect(section).toHaveCSS("width", "380px");
  await field("Height").fill("220px");
  await field("Min height").fill("240px");
  await expect(section).toHaveCSS("height", "240px");
  await field("Max height").fill("260px");
  await field("Height").fill("300px");
  await expect(section).toHaveCSS("height", "260px");

  await field("Margin").fill("-4px auto 8px");
  await expect(section).toHaveCSS("margin-top", "-4px");
  await expect(section).toHaveCSS("margin-bottom", "8px");
  await field("Padding").fill("-2px");
  await expect(field("Padding")).toHaveAttribute("aria-invalid", "true");
  await field("Padding").fill("8px 1rem");
  await expect(section).toHaveCSS("padding-top", "8px");
  await expect(section).toHaveCSS("padding-left", "16px");

  await page.getByRole("combobox", { name: "Overflow", exact: true }).selectOption("hidden");
  await expect(section).toHaveCSS("overflow", "hidden");
  await page.getByRole("combobox", { name: "Position", exact: true }).selectOption("absolute");
  await field("Inset").fill("70px auto auto 12px");
  await expect(section).toHaveCSS("position", "absolute");
  await expect(section).toHaveCSS("top", "70px");
  await expect(section).toHaveCSS("left", "12px");
  await field("Z-index").fill("3");
  await expect(section).toHaveCSS("z-index", "3");
  await field("Z-index").fill("2.5");
  await expect(field("Z-index")).toHaveAttribute("aria-invalid", "true");
  await expect(section).toHaveCSS("z-index", "3");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(section).toHaveCSS("z-index", "auto");
});

test("Image Layout overrides fill the padded frame and reset to the wider breakpoint", async ({ page }) => {
  const image = page.locator('article [data-node-id][aria-label="Hero"] [data-node-id][aria-label="Image"]');
  const surface = image.locator("[data-image-surface]");
  const selectImage = async () => {
    const id = await image.getAttribute("data-node-id");
    await page.locator(`[data-layer-node-id="${id}"]`).getByRole("button", { name: "Image", exact: true }).click();
  };
  const desktop = page.getByRole("button", { name: "Desktop viewport" });
  const tablet = page.getByRole("button", { name: "Tablet viewport" });
  const mobile = page.getByRole("button", { name: "Mobile viewport" });
  const width = page.getByRole("textbox", { name: "Width", exact: true });
  const resetWidth = page.getByRole("button", { name: "Reset Width", exact: true });

  await selectImage();
  await openAdvanced(page, "Layout");
  await expect(page.getByRole("combobox", { name: "Display", exact: true })).toHaveCount(0);
  await width.fill("240px");
  await page.getByRole("textbox", { name: "Padding", exact: true }).fill("12px");
  await expect(surface).toHaveCSS("width", "216px");
  await tablet.click();
  await openAdvanced(page, "Layout");
  await expect(width).toHaveValue("240px");
  await expect(resetWidth).toHaveCount(0);
  await width.fill("180px");
  await expect(surface).toHaveCSS("width", "156px");
  await mobile.click();
  await openAdvanced(page, "Layout");
  await expect(width).toHaveValue("180px");
  await expect(resetWidth).toHaveCount(0);
  await width.fill("140px");
  await expect(surface).toHaveCSS("width", "116px");
  await desktop.click();
  await expect(image).toHaveCSS("width", "240px");

  await expect(savedStatus(page)).toBeVisible();
  await page.reload();
  await selectImage();
  await mobile.click();
  await openAdvanced(page, "Layout");
  await expect(image).toHaveCSS("width", "140px");
  await resetWidth.click();
  await expect(image).toHaveCSS("width", "180px");
  await expect(resetWidth).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(image).toHaveCSS("width", "140px");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(image).toHaveCSS("width", "180px");
  await tablet.click();
  await openAdvanced(page, "Layout");
  await expect(width).toHaveValue("180px");
  await resetWidth.click();
  await expect(image).toHaveCSS("width", "240px");

  await page.getByText("Our approach", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Layout", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Typography", exact: true })).toBeVisible();
});

test("Heading typography follows the active breakpoint, resets, and survives reload", async ({ page }) => {
  const hero = page.locator('article [data-node-id][aria-label="Hero"]');
  const title = hero.getByText("Spaces for slower living.", { exact: true });
  const titleNode = hero.locator('[data-node-id][aria-label="Heading"]');
  const size = page.getByRole("textbox", { name: "Size", exact: true });
  const reset = page.getByRole("button", { name: "Reset Size", exact: true });
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  const desktop = page.getByRole("button", { name: "Desktop viewport" });
  const tablet = page.getByRole("button", { name: "Tablet viewport" });
  const mobile = page.getByRole("button", { name: "Mobile viewport" });
  const selectHeading = async () => {
    const id = await titleNode.getAttribute("data-node-id");
    await page.locator(`[data-layer-node-id="${id}"]`).getByRole("button", { name: "Heading", exact: true }).click();
  };

  await selectHeading();
  const defaultSize = await title.evaluate((element) => getComputedStyle(element).fontSize);
  await size.fill("30px");
  await expect(title).toHaveCSS("font-size", "30px");
  await tablet.click();
  await expect(size).toHaveValue("30px");
  await expect(reset).toHaveCount(0);
  await size.fill("24px");
  await mobile.click();
  await expect(title).toHaveCSS("font-size", "24px");
  await size.fill("18px");
  await expect(title).toHaveCSS("font-size", "18px");
  await desktop.click();
  await expect(title).toHaveCSS("font-size", "30px");

  await expect(hero.locator("h1")).toHaveText("Spaces for slower living.");
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("combobox", { name: "Heading level" }).selectOption("h3");
  await expect(hero.locator("h3")).toHaveText("Spaces for slower living.");
  await expect(title).toHaveCSS("font-size", "30px");
  await expect(savedStatus(page)).toBeVisible();
  await page.reload();

  await selectHeading();
  await expect(hero.locator("h3")).toHaveText("Spaces for slower living.");
  await mobile.click();
  await expect(size).toHaveValue("18px");
  await reset.click();
  await expect(size).toHaveValue("24px");
  await expect(title).toHaveCSS("font-size", "24px");
  await undo.click();
  await expect(title).toHaveCSS("font-size", "18px");
  await reset.click();
  await tablet.click();
  await reset.click();
  await expect(title).toHaveCSS("font-size", "30px");
  await mobile.click();
  await expect(title).toHaveCSS("font-size", "30px");
  await expect(reset).toHaveCount(0);
  await desktop.click();
  await reset.click();
  await expect(title).toHaveCSS("font-size", defaultSize);
});

test("Text and Button typography updates owned preview text and the heading stays sticky", async ({ page }) => {
  const hero = page.locator('article [data-node-id][aria-label="Hero"]');
  const section = page.locator('article [data-node-id][aria-label="Content + media"]');
  const copy = section.locator('[data-node-id][aria-label="Description"] p');
  const label = hero.locator('[data-node-id][aria-label="CTA button"] > span');
  const typography = page.getByRole("button", { name: "Typography", exact: true });
  const field = (name: string) => page.getByRole("textbox", { name, exact: true });
  const option = (name: string) => page.getByRole("combobox", { name, exact: true });
  const selectLayer = async (node: ReturnType<Page["locator"]>, name: string) => {
    const id = await node.getAttribute("data-node-id");
    await page.locator(`[data-layer-node-id="${id}"]`).getByRole("button", { name, exact: true }).click();
  };

  await selectLayer(section, "Content + media");
  await expect(typography).toHaveCount(0);
  await selectLayer(copy.locator(".."), "Description");
  await expect(typography).toBeVisible();
  await expect(page.getByRole("button", { name: "Appearance", exact: true })).toHaveCount(0);
  await field("Font family").fill("Georgia, serif");
  await option("Weight").selectOption("700");
  await field("Line height").fill("28px");
  await openAdvanced(page, "Typography");
  await field("Letter spacing").fill("-1px");
  await field("Color").fill("#275d38");
  await option("Alignment").selectOption("right");
  await expect(copy).toHaveCSS("font-family", "Georgia, serif");
  await expect(copy).toHaveCSS("font-weight", "700");
  await expect(copy).toHaveCSS("line-height", "28px");
  await expect(copy).toHaveCSS("letter-spacing", "-1px");
  await expect(copy).toHaveCSS("color", "rgb(39, 93, 56)");
  await expect(copy).toHaveCSS("text-align", "right");
  await field("Color").fill("not-a-color");
  await expect(field("Color")).toHaveAttribute("aria-invalid", "true");
  await expect(copy).toHaveCSS("color", "rgb(39, 93, 56)");

  await selectLayer(label.locator(".."), "CTA button");
  await openAdvanced(page, "Typography");
  await option("Decoration").selectOption("underline");
  await option("Transform").selectOption("uppercase");
  await option("Style").selectOption("italic");
  await openAdvanced(page, "Layout");
  await field("Width").fill("140px");
  await field("Size").fill("20px");
  await option("Wrapping").selectOption("nowrap");
  const singleLineHeight = await label.evaluate((element) => element.clientHeight);
  await option("Wrapping").selectOption("normal");
  await expect.poll(() => label.evaluate((element) => element.clientHeight)).toBeGreaterThan(singleLineHeight);
  await expect(label).toHaveCSS("text-decoration-line", "underline");
  await expect(label).toHaveCSS("text-transform", "uppercase");
  await expect(label).toHaveCSS("font-style", "italic");
  await expect(label).toHaveCSS("white-space", "normal");
  await expect(copy).toHaveCSS("text-transform", "none");

  const scroll = page.locator('[data-slot="scroll-area-viewport"]').filter({ has: typography });
  await scroll.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(typography).toHaveCSS("position", "sticky");
  await expect(typography).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(typography).not.toHaveCSS("box-shadow", "none");
  await expect.poll(async () => {
    const [header, viewport] = await Promise.all([typography.boundingBox(), scroll.boundingBox()]);
    return Math.abs(header!.y - viewport!.y);
  }).toBeLessThan(2);
});

test("Appearance styles the visible Section, Card, and Button surfaces and stays hidden for plain Text", async ({ page }) => {
  const node = (label: string) => page.locator(`article [data-node-id][aria-label="${label}"]`);
  const section = node("Content + media");
  const inspector = page.getByRole("button", { name: "Appearance", exact: true });
  const field = (name: string) => page.getByRole("textbox", { name, exact: true });
  const option = (name: string) => page.getByRole("combobox", { name, exact: true });
  const insert = (name: string) => page.locator('button[draggable="true"]').filter({ hasText: new RegExp(`^${name}$`) }).click();

  await section.getByRole("button", { name: "Description", exact: true }).click();
  await expect(inspector).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Typography", exact: true })).toBeVisible();
  const sectionId = await section.getAttribute("data-node-id");
  await page.locator(`[data-layer-node-id="${sectionId}"]`).getByRole("button", { name: "Content + media", exact: true }).click();
  await expect(option("Object fit")).toHaveCount(0);

  await field("Background color").fill("#275d38");
  await expect(section).toHaveCSS("background-color", "rgb(39, 93, 56)");
  await openAdvanced(page, "Appearance");
  await field("Background image").fill("/prototype/forma-project-1.png");
  await expect(section).toHaveCSS("background-image", /forma-project-1\.png/);
  await field("Background image").fill("url(javascript:example)");
  await expect(field("Background image")).toHaveAttribute("aria-invalid", "true");
  await expect(section).toHaveCSS("background-image", /forma-project-1\.png/);
  await field("Opacity").fill("75%");
  await expect(section).toHaveCSS("opacity", "0.75");
  await field("Opacity").fill("150%");
  await expect(field("Opacity")).toHaveAttribute("aria-invalid", "true");
  await expect(section).toHaveCSS("opacity", "0.75");
  await option("Blend mode").selectOption("multiply");
  await expect(section).toHaveCSS("mix-blend-mode", "multiply");
  await field("Shadow").fill("0 4px 12px rgb(0 0 0 / 30%)");
  await expect(section).toHaveCSS("box-shadow", "rgba(0, 0, 0, 0.3) 0px 4px 12px 0px");
  await expect(section).toHaveCSS("outline-width", "2px");

  const scroll = page.locator('[data-slot="scroll-area-viewport"]').filter({ has: inspector });
  await scroll.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(inspector).toHaveCSS("position", "sticky");
  await expect(inspector).not.toHaveCSS("box-shadow", "none");
  await expect.poll(async () => {
    const [header, viewport] = await Promise.all([inspector.boundingBox(), scroll.boundingBox()]);
    return Math.abs(header!.y - viewport!.y);
  }).toBeLessThan(2);

  await page.getByRole("button", { name: "Tablet viewport" }).click();
  await openAdvanced(page, "Appearance");
  await field("Background image").fill("none");
  await expect(section).toHaveCSS("background-image", "none");
  await page.getByRole("button", { name: "Reset Background image", exact: true }).click();
  await expect(section).toHaveCSS("background-image", /forma-project-1\.png/);
  await page.getByRole("button", { name: "Desktop viewport" }).click();

  await insert("Card");
  const card = node("Card").getByText("Card title", { exact: true }).locator("xpath=ancestor::div[@data-slot='card']");
  await field("Background color").fill("#f5eee0");
  await field("Border width").fill("4px");
  await option("Border style").selectOption("dashed");
  await field("Border color").fill("#275d38");
  await field("Radius").fill("20px");
  await expect(card).toHaveCSS("background-color", "rgb(245, 238, 224)");
  await expect(card).toHaveCSS("border-top-width", "4px");
  await expect(card).toHaveCSS("border-top-style", "dashed");
  await expect(card).toHaveCSS("border-top-color", "rgb(39, 93, 56)");
  await expect(card).toHaveCSS("border-top-left-radius", "20px");

  await insert("Button");
  const button = node("Button").locator(":scope > span");
  await field("Background color").fill("rebeccapurple");
  await field("Radius").fill("22px");
  await expect(button).toHaveCSS("background-color", "rgb(102, 51, 153)");
  await expect(button).toHaveCSS("border-top-left-radius", "22px");
});

test("Image appearance inherits across breakpoints and keeps edits and resets through reload and undo", async ({ page }) => {
  const image = page.locator('article [data-node-id][aria-label="Hero"] [data-node-id][aria-label="Image"]');
  const asset = image.locator("img");
  const selectImage = async () => {
    const id = await image.getAttribute("data-node-id");
    await page.locator(`[data-layer-node-id="${id}"]`).getByRole("button", { name: "Image", exact: true }).click();
  };
  const field = (name: string) => page.getByRole("textbox", { name, exact: true });
  const fit = page.getByRole("combobox", { name: "Object fit", exact: true });
  const position = field("Object position");
  const resetPosition = page.getByRole("button", { name: "Reset Object position", exact: true });
  const viewport = (name: string) => page.getByRole("button", { name: `${name} viewport` }).click();

  await selectImage();
  await image.getByRole("button", { name: "Edit image", exact: true }).click();
  const replace = page.getByRole("dialog", { name: "Replace image" });
  await replace.getByRole("textbox", { name: "Image URL" }).fill("/prototype/forma-project-2.png");
  await replace.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(asset).toBeVisible();
  await fit.selectOption("contain");
  await openAdvanced(page, "Appearance");
  await position.fill("left top");
  await field("Radius").fill("18px");
  await expect(asset).toHaveCSS("object-fit", "contain");
  await expect(asset).toHaveCSS("object-position", "0% 0%");
  await expect(image.locator("[data-image-surface]")).toHaveCSS("border-top-left-radius", "18px");

  await viewport("Tablet");
  await expect(resetPosition).toHaveCount(0);
  await fit.selectOption("cover");
  await openAdvanced(page, "Appearance");
  await position.fill("25% 75%");
  await viewport("Mobile");
  await expect(asset).toHaveCSS("object-fit", "cover");
  await expect(asset).toHaveCSS("object-position", "25% 75%");
  await openAdvanced(page, "Appearance");
  await position.fill("right bottom");
  await expect(asset).toHaveCSS("object-position", "100% 100%");
  await viewport("Desktop");
  await expect(asset).toHaveCSS("object-fit", "contain");
  await expect(asset).toHaveCSS("object-position", "0% 0%");

  await expect(savedStatus(page)).toBeVisible();
  await page.reload();
  await selectImage();
  await viewport("Mobile");
  await openAdvanced(page, "Appearance");
  await expect(position).toHaveValue("right bottom");
  await resetPosition.click();
  await expect(asset).toHaveCSS("object-position", "25% 75%");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(asset).toHaveCSS("object-position", "100% 100%");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(savedStatus(page)).toBeVisible();
  await page.reload();
  await selectImage();
  await viewport("Mobile");
  await expect(asset).toHaveCSS("object-position", "25% 75%");
  await expect(resetPosition).toHaveCount(0);
});
