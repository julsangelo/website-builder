import type { Page } from "@playwright/test";

export async function openAdvanced(page: Page, title = "Layout") {
  const section = page.getByRole("button", { name: title, exact: true }).locator("xpath=ancestor::section[1]");
  const details = section.locator("details");
  if (await details.getAttribute("open") === null) await details.locator("summary").click();
}
