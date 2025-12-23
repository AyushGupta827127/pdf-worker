import { Worker } from "bullmq";
import { connection } from "./queue/connection.js";
import { generatePdf } from "./pdf/generatePdf.js";
import path from "path";
import fs from "fs";
import fetch from "node-fetch";
import "dotenv/config";


const OUTPUT_DIR = path.resolve("./output");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}

new Worker(
  "pdf-jobs",
  async (job) => {
    console.log("🛠 Processing job:", job.id);

    const { html, jobId } = job.data;

    try {
      const filePath = `./output/${jobId}.pdf`;

      await generatePdf(html, filePath);
      console.log("✅ PDF generated:", filePath);

      // 🔴 THIS MUST HAPPEN OR UI WILL STUCK
      const res = await fetch("http://localhost:4000/internal/job-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-token": process.env.PDF_INTERNAL_TOKEN,
        },
        body: JSON.stringify({
          job_id: jobId,
          status: "completed",
        }),
      });

      console.log("⬅️ Status API response:", res.status);

      return { file: filePath };
    } catch (err) {
      console.error("❌ Worker failed:", err);

      await fetch("http://localhost:4000/internal/job-status", {
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
    concurrency: 1,
  }
);

console.log("📄 PDF Worker started (concurrency = 1)");
