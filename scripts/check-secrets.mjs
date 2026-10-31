/**
 * Fails when an API key could reach GitHub or the extension bundle.
 *
 * - Every secret-looking value in .env must not appear in any other file
 *   (source, dist/ build output, docs, fixtures).
 * - No VITE_* variable may carry a key: Vite inlines those into the bundle.
 * - Well-known provider key formats must not appear anywhere outside .env.
 *
 * Findings name the file, line and variable, never the secret itself.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const SKIP_DIRS = new Set(["node_modules", ".git", "graphify-out"]);
const SECRET_NAME = /(KEY|TOKEN|SECRET|PASSWORD)/i;
const KEY_FORMATS = [
  { name: "OpenRouter key", pattern: /sk-or-v1-[A-Za-z0-9]{20,}/ },
  { name: "Groq key", pattern: /gsk_[A-Za-z0-9]{20,}/ },
  { name: "Google API key", pattern: /AIza[0-9A-Za-z_-]{30,}/ },
  { name: "OpenAI-style key", pattern: /\bsk-(?:proj-)?[A-Za-z0-9]{24,}/ },
  { name: "Hugging Face token", pattern: /\bhf_[A-Za-z0-9]{30,}/ }
];

function readEnv(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
    .filter(Boolean)
    .map(([, name, raw]) => ({ name, value: raw.replace(/^["']|["']$/g, "") }));
}

function isEnvFile(path) {
  const name = path.split(sep).pop();
  return name === ".env" || (name.startsWith(".env.") && name !== ".env.example");
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) yield* walk(path);
    else if (stats.size < 4_000_000 && !isEnvFile(path)) yield path;
  }
}

const findings = [];
const env = readEnv(join(root, ".env"));
const secrets = env.filter(
  ({ name, value }) => SECRET_NAME.test(name) && value.length >= 8 && !value.startsWith("replace-with")
);

for (const { name } of env) {
  if (name.startsWith("VITE_") && SECRET_NAME.test(name)) {
    findings.push(`.env: ${name} is a VITE_ variable, so it would be bundled into the extension`);
  }
}

for (const path of walk(root)) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    continue;
  }
  if (text.includes("\u0000")) continue;
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const where = `${relative(root, path)}:${index + 1}`;
    for (const { name, value } of secrets) {
      if (line.includes(value)) findings.push(`${where}: contains the value of ${name} from .env`);
    }
    for (const { name, pattern } of KEY_FORMATS) {
      if (pattern.test(line)) findings.push(`${where}: looks like a ${name}`);
    }
  });
}

if (findings.length) {
  console.error(`check-secrets: ${findings.length} problem(s) found\n  ${findings.join("\n  ")}`);
  process.exit(1);
}
console.log(`check-secrets ok: ${secrets.length} .env secret(s) checked, none found outside .env`);
