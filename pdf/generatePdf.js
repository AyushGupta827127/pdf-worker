import fs from "fs";
import { getBrowser } from "./browser.js";
import { sanitize } from "./sanitize.js";
import { validateImages } from "./validateImages.js";

export async function generatePdf(html, outputPath) {
  if (!html || typeof html !== "string") {
    throw new Error("Invalid HTML input");
  }

  if (html.length > 300_000) {
    throw new Error("HTML payload too large");
  }

  validateImages(html);

  // sanitize USER HTML, do not restyle it
  const safeHtml = sanitize(wrapHtml(html));

  const browser = await getBrowser();
  const page = await browser.newPage();

  await page.setContent(safeHtml, { waitUntil: "load" });
  await page.emulateMediaType("print");

  const pdf = await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    margin: {
      top: "20mm",
      right: "20mm",
      bottom: "20mm",
      left: "20mm",
    },
  });

  fs.writeFileSync(outputPath, pdf);
  await page.close();
}

/**
 * Minimal wrapper.
 * Does NOT inject any CSS.
 * User styles remain untouched.
 */
function wrapHtml(content) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
      </head>
      <body>
        ${content}
      </body>
    </html>
  `;
}
