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
  const safeHtml = sanitize(wrapHtml(html));
  const browser = await getBrowser();
  const page = await browser.newPage();

  await page.setContent(safeHtml, { waitUntil: "load" });
  await page.emulateMediaType("print");

  const pdf = await page.pdf({
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

/* Ensures deterministic layout */
function wrapHtml(content) {
  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            font-family: "Times New Roman", serif;
            font-size: 12pt;
            line-height: 1.4;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          p {
            margin: 0 0 8px 0;
          }
         .page-break {
            page-break-before: always;
          }

        </style>
      </head>
      <body>
        ${content}
      </body>
    </html>
  `;
}
