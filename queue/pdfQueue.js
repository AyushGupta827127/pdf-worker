import { Queue } from "bullmq";
import { connection } from "./connection.js";

export const pdfQueue = new Queue("pdf-jobs", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 3000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
});
