import fs from "fs";
import { getBrowser } from "./browser.js";
import { sanitize } from "./sanitize.js";
import { validateImages } from "./validateImages.js";

const IS_FULL_DOCUMENT = /<html[\s>]/i;

export async function generatePdf(html, outputPath) {
  if (!html || typeof html !== "string") {
    throw new Error("Invalid HTML input");
  }

  if (html.length > 300_000) {
    throw new Error("HTML payload too large");
  }

  validateImages(html);

  const prepared = IS_FULL_DOCUMENT.test(html) ? html : wrapHtml(html);
  const safeHtml = sanitize(prepared);

  const browser = await getBrowser();
  const page = await browser.newPage();

  await page.setViewport({ width: 1200, height: 1600 });
  await page.setContent(safeHtml, { waitUntil: "networkidle0", timeout: 30000 });
  await page.emulateMediaType("print");

  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });

  fs.writeFileSync(outputPath, pdf);
  await page.close();
}

function wrapHtml(content) {
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /></head>
  <body>${content}</body>
</html>`;
}
