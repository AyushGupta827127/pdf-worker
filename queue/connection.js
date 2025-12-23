import "dotenv/config";
import IORedis from "ioredis";

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is not defined");
}

export const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
