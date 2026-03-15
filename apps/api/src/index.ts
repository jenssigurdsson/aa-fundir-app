import "dotenv/config";

import express from "express";
import cors from "cors";

import { scrapeMeetings } from "./lib/scrapeMeetings.js";
import { readDataset, writeDataset } from "./lib/storage.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const refreshToken = process.env.REFRESH_TOKEN ?? null;
const MAX_DATA_AGE_MS = 1000 * 60 * 60 * 24 * 7;

app.use(cors());
app.use(express.json());

async function ensureDataset() {
  const current = await readDataset();

  if (!current.updatedAt) {
    const refreshed = await scrapeMeetings();
    await writeDataset(refreshed);
    return refreshed;
  }

  const ageMs = Date.now() - new Date(current.updatedAt).getTime();
  if (ageMs > MAX_DATA_AGE_MS || current.total === 0) {
    const refreshed = await scrapeMeetings();
    await writeDataset(refreshed);
    return refreshed;
  }

  return current;
}

app.get("/api/health", async (_request, response) => {
  const dataset = await ensureDataset();

  response.json({
    status: "ok",
    updatedAt: dataset.updatedAt,
    total: dataset.total,
  });
});

app.get("/api/meetings", async (_request, response) => {
  const dataset = await ensureDataset();
  response.json(dataset);
});

app.post("/api/refresh", async (request, response) => {
  if (refreshToken) {
    const authorization = request.header("authorization");

    if (authorization !== `Bearer ${refreshToken}`) {
      response.status(401).json({ error: "Óheimilt" });
      return;
    }
  }

  const dataset = await scrapeMeetings();
  await writeDataset(dataset);
  response.json(dataset);
});

app.listen(port, () => {
  console.log(`AA API keyrir á http://localhost:${port}`);
});
