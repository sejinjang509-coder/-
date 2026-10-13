import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Keep editable source files while distributing a self-contained HTML demo.
// Running the demo never requires Node or this script.
const root = new URL("../", import.meta.url);
const htmlPath = fileURLToPath(new URL("index.html", root));
const original = readFileSync(htmlPath, "utf8");
const css = readFileSync(new URL("styles.css", root), "utf8").trimEnd();
const js = readFileSync(new URL("app.js", root), "utf8").trimEnd();

function replaceBlock(html, name, content) {
  const start = `<!-- REBALANCE:${name}:START -->`;
  const end = `<!-- REBALANCE:${name}:END -->`;
  if (html.split(start).length !== 2 || html.split(end).length !== 2) {
    throw new Error(`Expected exactly one ${name} block in index.html`);
  }
  const from = html.indexOf(start) + start.length;
  const to = html.indexOf(end);
  if (to < from) throw new Error(`Invalid ${name} block order`);
  return html.slice(0, from) + "\n" + content + "\n    " + html.slice(to);
}

// Escape HTML end tags inside source strings without changing runtime values.
const safeCss = css.replace(/<\/style/gi, "<\\/style");
const safeJs = js.replace(/<\/script/gi, "<\\/script");
let result = replaceBlock(original, "STYLES", `    <style>\n${safeCss}\n    </style>`);
result = replaceBlock(result, "SCRIPT", `    <script>\n${safeJs}\n    </script>`);

if (process.argv.includes("--check")) {
  if (result !== original) {
    console.error("index.html is out of date. Run: node scripts/sync-html.mjs");
    process.exitCode = 1;
  } else console.log("PASS: index.html matches styles.css and app.js.");
} else if (result !== original) {
  writeFileSync(htmlPath, result);
  console.log("Updated self-contained index.html.");
} else console.log("index.html is already up to date.");
