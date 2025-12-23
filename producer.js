import { pdfQueue } from "./queue/pdfQueue.js";

const html = `
  <h1>Queued PDF</h1>
  <p>This PDF was generated via BullMQ queue.</p>
`;

await pdfQueue.add("generate", { html });

console.log("📥 PDF job queued");
process.exit(0);
