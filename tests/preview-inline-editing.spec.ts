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
