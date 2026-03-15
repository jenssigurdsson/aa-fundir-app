import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { MeetingDataset } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.resolve(__dirname, "../../data/meetings.json");

const EMPTY_DATASET: MeetingDataset = {
  source: "https://aa.is/aa-fundir/allir-fundir",
  updatedAt: null,
  total: 0,
  meetings: [],
};

export async function readDataset(): Promise<MeetingDataset> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    return JSON.parse(raw) as MeetingDataset;
  } catch {
    return EMPTY_DATASET;
  }
}

export async function writeDataset(dataset: MeetingDataset): Promise<void> {
  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(dataset, null, 2), "utf8");
}

