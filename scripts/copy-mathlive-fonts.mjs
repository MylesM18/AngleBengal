// Copies MathLive's bundled math fonts into public/ so nothing loads from a
// CDN (global constraint). Runs in postinstall, so the directory is
// regenerated on every install and stays gitignored.
import { cpSync, existsSync, mkdirSync } from "node:fs";

const candidates = ["node_modules/mathlive/fonts", "node_modules/mathlive/dist/fonts"];
const source = candidates.find((path) => existsSync(path));
if (!source) {
  throw new Error("mathlive fonts directory not found; check the package layout");
}
mkdirSync("public/mathlive-fonts", { recursive: true });
cpSync(source, "public/mathlive-fonts", { recursive: true });
console.log(`copied MathLive fonts from ${source}`);
