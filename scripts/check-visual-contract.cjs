const assert = require("assert");
const fs = require("fs");

const pages = ["gbm", "forest", "svm", "kmeans", "tree", "linear", "logistic", "nn"];
const index = fs.readFileSync("index.html", "utf8");
assert(/\.\/lab-runtime\.js\?v=\d+/.test(index), "index: global runtime must load with a cache version");

pages.forEach((name) => {
  const html = fs.readFileSync(`${name}.html`, "utf8");
  assert(html.includes('class="panel-block shape-card"'), `${name}: missing shape readout`);
  assert(html.includes('class="shape-readout"'), `${name}: missing shape readout body`);
  assert(html.includes("data-shape-context"), `${name}: shape readout must explain the active view`);
  assert(html.includes('class="panel-block log-card"'), `${name}: missing visible training log`);
  assert(html.includes('id="roundLog"') && html.includes('id="logOverlay"'), `${name}: training log needs compact and full views`);
  assert(!html.includes('id="chartNote"'), `${name}: canvas note must be split into shape readout and training log`);
  assert(html.includes('id="levelPicker"') && /id="levelPicker"[^>]+aria-label=/.test(html), `${name}: level picker needs aria-label`);
  assert(html.includes('id="viewPicker"') && /id="viewPicker"[^>]+aria-label=/.test(html), `${name}: view picker needs aria-label`);
  const canvas = html.match(/<canvas[^>]*id="chart"[^>]*>([\s\S]*?)<\/canvas>/);
  assert(canvas && canvas[1].trim().length > 20, `${name}: canvas needs useful fallback text`);
  const modelIndex = html.indexOf(`./models/${name === "gbm" ? "gbm" : name}-model.js`);
  const runtimeIndex = html.indexOf("./lab-runtime.js");
  assert(modelIndex >= 0 && runtimeIndex > modelIndex, `${name}: model script must load before runtime`);
  assert(/\.\/lab-runtime\.js\?v=\d+/.test(html), `${name}: lab runtime must load with a cache version`);
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
assert(css.includes("@media (max-width: 1200px) and (orientation: landscape)"), "styles: embedded landscape windows must enter the compact layout before columns overflow");
assert(!css.includes("minmax(760px, 1fr)"), "styles: SVM must share the common desktop stage minimum");
assert(css.includes("overflow-x: hidden"), "styles: sidebar must never expose a horizontal scrollbar");
assert(css.includes("grid-auto-rows: max-content"), "styles: scrollable sidebar cards must keep their full content height");
assert(css.includes("grid-template-rows: auto auto minmax(0, 1fr) auto"), "styles: compact landscape stage must reserve a row for the legend");
assert(!css.includes(".legend {\n    display: none;"), "styles: compact landscape must not hide the chart legend");
assert(/\.log-current\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?clip-path:\s*inset\(50%\);/.test(css), "training log: live status must not duplicate the visible latest-round entry");

const runtime = fs.readFileSync("lab-runtime.js", "utf8");
assert(runtime.includes("setupThemeToggle"), "runtime: missing global theme toggle setup");
assert(runtime.includes("ml-arcade-theme"), "runtime: theme choice must persist globally");
assert(runtime.includes("resetLabScroll"), "runtime: lab pages must reset inherited scroll position");
assert(runtime.includes("entries.slice(0, 1)"), "shared training log: sidebar must only show the latest round");

const gbm = fs.readFileSync("app.js", "utf8");
assert(gbm.includes("state.logEntries.slice(0, 1)"), "gbm: sidebar must only show the latest round");

const neuralNetwork = fs.readFileSync("nn.js", "utf8");
assert(neuralNetwork.includes("drawNetworkPanel(b.panel)"), "nn: network panel must use a dedicated canvas region");
assert(!neuralNetwork.includes("rect.width < 700"), "nn: network panel should not fall back to portrait stacking");
assert(neuralNetwork.includes("const compact = rect.width < 760"), "nn: narrow landscape needs compact side-by-side bounds");
assert(neuralNetwork.includes("const compactPanel = panel.h < 230"), "nn: compact landscape panel must avoid title collisions");
assert(neuralNetwork.includes("drawWeightLabels"), "nn: dense weight labels need collision-aware layout");
assert(neuralNetwork.includes("labelBlockers"), "nn: weight labels must avoid nodes and panel copy");

const svm = fs.readFileSync("svm.js", "utf8");
assert(!svm.includes("latestTicker"), "svm: training log must stay stable instead of rotating view notes");
assert(!svm.includes("shapeTicker"), "svm: shape readout must not rotate training metrics or status");
assert(!svm.includes("latestStatus"), "svm: training status must not feed the shape readout");
const svmHtml = fs.readFileSync("svm.html", "utf8");
assert(!svmHtml.includes('id="latestText"'), "svm: compact training log must only show the latest round entry");

console.log(`Visual contract passed for ${pages.length} labs.`);
