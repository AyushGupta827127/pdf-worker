import "dotenv/config";
import { Worker } from "bullmq";
import { connection } from "./queue/connection.js";
import { generatePdf } from "./pdf/generatePdf.js";
import path from "path";
import fs from "fs";
import fetch from "node-fetch";


const OUTPUT_DIR = path.resolve("./output");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}

const CONCURRENCY = parseInt(process.env.PDF_WORKER_CONCURRENCY, 10) || 1;

new Worker(
  "pdf-jobs",
  async (job) => {
    console.log("🛠 Processing job:", job.id);

    const { html, jobId } = job.data;
    const STATUS_API_URL =
  process.env.STATUS_API_URL || "http://127.0.0.1:8060/internal/job-status";

    try {
      const filePath = `./output/${jobId}.pdf`;

      await generatePdf(html, filePath);
      console.log("✅ PDF generated:", filePath);

      // 🔴 THIS MUST HAPPEN OR UI WILL STUCK
      const res = await fetch(STATUS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-token": process.env.PDF_INTERNAL_TOKEN,
        },
        body: JSON.stringify({
          job_id: jobId,
          status: "done",
        }),
      });

      console.log("⬅️ Status API response:", res.status);

      return { file: filePath };
    } catch (err) {
      console.error("❌ Worker failed:", err);

      await fetch(STATUS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-token": process.env.PDF_INTERNAL_TOKEN,
        },
        body: JSON.stringify({
          job_id: jobId,
          status: "failed",
        }),
      });

      throw err;
    }
  },
  {
    connection,
    concurrency: CONCURRENCY,
  }
);

console.log(`📄 PDF Worker started (concurrency = ${CONCURRENCY})`);
