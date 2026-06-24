const assert = require("assert");
const fs = require("fs");

const pages = ["gbm", "forest", "svm", "kmeans", "tree", "linear", "logistic", "nn"];

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
});

const css = fs.readFileSync("styles.css", "utf8");
["--viz-positive", "--viz-negative", "--viz-focus", "--viz-error", "--viz-previous"].forEach((token) => {
  assert(css.includes(token), `styles: missing ${token}`);
});
assert(css.includes("prefers-reduced-motion"), "styles: missing reduced-motion support");
assert(css.includes("@media (max-width: 900px) and (orientation: portrait)"), "styles: mobile portrait must be a rotate-device gate");
assert(css.includes("@media (max-width: 1100px) and (orientation: landscape)"), "styles: mobile landscape must keep the game layout");

const neuralNetwork = fs.readFileSync("nn.js", "utf8");
assert(neuralNetwork.includes("drawNetworkPanel(b.panel)"), "nn: network panel must use a dedicated canvas region");
assert(!neuralNetwork.includes("rect.width < 700"), "nn: network panel should not fall back to portrait stacking");
assert(neuralNetwork.includes("const compact = rect.width < 760"), "nn: narrow landscape needs compact side-by-side bounds");
assert(neuralNetwork.includes("const compactPanel = panel.h < 230"), "nn: compact landscape panel must avoid title collisions");
assert(neuralNetwork.includes("drawWeightLabels"), "nn: dense weight labels need collision-aware layout");
assert(neuralNetwork.includes("labelBlockers"), "nn: weight labels must avoid nodes and panel copy");

console.log(`Visual contract passed for ${pages.length} labs.`);
