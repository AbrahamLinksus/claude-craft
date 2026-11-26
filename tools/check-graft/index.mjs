// Stub until the real graft checker exists (LLD 17). Exits 0 when the folder has a graft.json.
import { existsSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (dir === undefined || !existsSync(join(dir, "graft.json"))) {
  process.stderr.write(`check-graft: missing graft.json in ${String(dir)}\n`);
  process.exit(1);
}
