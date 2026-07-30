import { statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const jobs = [
  {
    source: join(root, "public/desktop/main-avatar.png"),
    output: join(root, "public/desktop/main-avatar.webp"),
  },
  {
    source: join(root, "public/desktop/q-avatar.png"),
    output: join(root, "public/desktop/q-avatar.webp"),
  },
];

await Promise.all(
  jobs.map(({ source, output }) =>
    sharp(source)
      .webp({ quality: 92, alphaQuality: 100, smartSubsample: true })
      .toFile(output),
  ),
);

for (const { output } of jobs) {
  console.log(`${output}: ${statSync(output).size} bytes`);
}
