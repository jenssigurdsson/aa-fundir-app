import "dotenv/config";

import { scrapeMeetings } from "./lib/scrapeMeetings.js";
import { writeDataset } from "./lib/storage.js";

async function main() {
  const dataset = await scrapeMeetings();
  await writeDataset(dataset);

  console.log(`Skrifaði ${dataset.total} fundi í apps/api/data/meetings.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

