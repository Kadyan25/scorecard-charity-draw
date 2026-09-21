// Runs every *.e2e.mjs suite in this folder, one after another.
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const suites = readdirSync("tests/e2e").filter((file) => file.endsWith(".e2e.mjs")).sort();
let failed = 0;
for (const suite of suites) {
  const { status } = spawnSync(process.execPath, [`tests/e2e/${suite}`], { stdio: "inherit" });
  if (status !== 0) failed += 1;
}
console.log(failed === 0 ? `E2E: ${suites.length} suites passed` : `E2E: ${failed} of ${suites.length} suites failed`);
process.exitCode = failed === 0 ? 0 : 1;
