const assert = require("assert");
const fs = require("fs");

const pages = ["gbm", "forest", "svm", "kmeans", "tree", "linear", "logistic", "nn"];
const index = fs.readFileSync("index.html", "utf8");
assert(index.includes("./lab-runtime.js?v=2"), "index: global runtime must load for theme controls");

pages.forEach((name) => {
  const html = fs.readFileSync(`${name}.html`, "utf8");
  assert(html.includes('class="panel-block shape-card"'), `${name}: missing shape readout`);
  assert(html.includes('class="shape-readout"'), `${name}: missing shape readout body`);
  assert(html.includes('id="levelPicker"') && /id="levelPicker"[^>]+aria-label=/.test(html), `${name}: level picker needs aria-label`);
  assert(html.includes('id="viewPicker"') && /id="viewPicker"[^>]+aria-label=/.test(html), `${name}: view picker needs aria-label`);
  const canvas = html.match(/<canvas[^>]*id="chart"[^>]*>([\s\S]*?)<\/canvas>/);
  assert(canvas && canvas[1].trim().length > 20, `${name}: canvas needs useful fallback text`);
  const modelIndex = html.indexOf(`./models/${name === "gbm" ? "gbm" : name}-model.js`);
  const runtimeIndex = html.indexOf("./lab-runtime.js");
  assert(modelIndex >= 0 && runtimeIndex > modelIndex, `${name}: model script must load before runtime`);
  assert(html.includes("./lab-runtime.js?v=2"), `${name}: lab runtime cache version must include theme controls`);
});

const css = fs.readFileSync("styles.css", "utf8");
["--viz-positive", "--viz-negative", "--viz-focus", "--viz-error", "--viz-previous"].forEach((token) => {
  assert(css.includes(token), `styles: missing ${token}`);
});
assert(css.includes('html[data-theme="light"]'), "styles: missing global light theme");
assert(css.includes(".theme-toggle"), "styles: missing global theme toggle styling");
assert(css.includes("--ui-accent"), "styles: UI accent must be separate from model-positive green");
assert(css.includes("--decor-glow-a"), "styles: decorative background glows must be tokenized");
[
  "rgba(34, 240, 164, 0.16)",
  "rgba(34, 240, 164, 0.18)",
  "rgba(34, 240, 164, 0.1)",
  "rgba(0, 138, 102",
  "background: #134e4a",
  "background: #123126",
  "background: #d8f4e9",
].forEach((pattern) => {
  assert(!css.includes(pattern), `styles: decorative UI should not use green token ${pattern}`);
});
assert(css.includes("prefers-reduced-motion"), "styles: missing reduced-motion support");
assert(css.includes("@media (max-width: 900px) and (orientation: portrait)"), "styles: mobile portrait must be a rotate-device gate");
assert(css.includes("@media (max-width: 1100px) and (orientation: landscape)"), "styles: mobile landscape must keep the game layout");

const runtime = fs.readFileSync("lab-runtime.js", "utf8");
assert(runtime.includes("setupThemeToggle"), "runtime: missing global theme toggle setup");
assert(runtime.includes("ml-arcade-theme"), "runtime: theme choice must persist globally");
assert(runtime.includes("resetLabScroll"), "runtime: lab pages must reset inherited scroll position");

const neuralNetwork = fs.readFileSync("nn.js", "utf8");
assert(neuralNetwork.includes("drawNetworkPanel(b.panel)"), "nn: network panel must use a dedicated canvas region");
assert(!neuralNetwork.includes("rect.width < 700"), "nn: network panel should not fall back to portrait stacking");
assert(neuralNetwork.includes("const compact = rect.width < 760"), "nn: narrow landscape needs compact side-by-side bounds");
assert(neuralNetwork.includes("const compactPanel = panel.h < 230"), "nn: compact landscape panel must avoid title collisions");
assert(neuralNetwork.includes("drawWeightLabels"), "nn: dense weight labels need collision-aware layout");
assert(neuralNetwork.includes("labelBlockers"), "nn: weight labels must avoid nodes and panel copy");

console.log(`Visual contract passed for ${pages.length} labs.`);
