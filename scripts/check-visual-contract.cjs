const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const manifestContext = {};
manifestContext.globalThis = manifestContext;
vm.createContext(manifestContext);
vm.runInContext(fs.readFileSync("core/lab-manifest.js", "utf8"), manifestContext, {
  filename: "core/lab-manifest.js",
});

const manifest = manifestContext.LabManifest;
assert(Array.isArray(manifest), "manifest: LabManifest must be an array");
assert.strictEqual(manifest.length, 9, "manifest: expected home plus eight labs");
assert.strictEqual(new Set(manifest.map((lab) => lab.id)).size, manifest.length, "manifest: ids must be unique");
assert.strictEqual(new Set(manifest.map((lab) => lab.href)).size, manifest.length, "manifest: hrefs must be unique");

const labs = manifest.filter((lab) => lab.id !== "home");
const sharedScripts = ["./core/lab-manifest.js", "./core/bootstrap.js"];

function scriptsIn(html) {
  return [...html.matchAll(/<script\s+src="([^"]+)"[^>]*><\/script>/g)].map((match) => match[1]);
}

const index = fs.readFileSync("index.html", "utf8");
assert(index.includes('data-lab="home"'), "index: body must identify the home route");
assert.deepStrictEqual(scriptsIn(index), sharedScripts, "index: script assembly must use only manifest + bootstrap");
assert(!/[?&]v=\d+/.test(index), "index: manual cache versions are forbidden");

labs.forEach((definition) => {
  assert(definition.model === `./models/${definition.id}-model.js`, `${definition.id}: model path must follow convention`);
  assert(definition.lab === `./labs/${definition.id}.js`, `${definition.id}: lab path must follow convention`);
  assert(definition.smoke && definition.smoke.step && definition.smoke.next, `${definition.id}: smoke contract missing`);
  assert(fs.existsSync(definition.model), `${definition.id}: model file missing`);
  assert(fs.existsSync(definition.lab), `${definition.id}: lab file missing`);

  const html = fs.readFileSync(`${definition.id}.html`, "utf8");
  assert(html.includes(`data-lab="${definition.id}"`), `${definition.id}: body route id missing`);
  assert(/<nav class="lab-switch" aria-label="切换训练场"><\/nav>/.test(html), `${definition.id}: nav must be an empty shared mount`);
  assert(html.includes('class="panel-block shape-card"'), `${definition.id}: missing shape readout`);
  assert(html.includes('class="shape-readout"'), `${definition.id}: missing shape readout body`);
  assert(html.includes("data-shape-context"), `${definition.id}: shape readout must explain the active view`);
  assert(html.includes("data-training-log"), `${definition.id}: missing shared training-log mount`);
  assert(html.includes("data-empty-message"), `${definition.id}: shared log needs its lab-specific empty message`);
  assert(!html.includes('id="roundLog"') && !html.includes('id="logOverlay"'), `${definition.id}: duplicated log DOM must not live in page HTML`);
  assert(html.includes('id="levelPicker"') && /id="levelPicker"[^>]+aria-label=/.test(html), `${definition.id}: level picker needs aria-label`);
  assert(html.includes('id="viewPicker"') && /id="viewPicker"[^>]+aria-label=/.test(html), `${definition.id}: view picker needs aria-label`);
  const canvas = html.match(/<canvas[^>]*id="chart"[^>]*>([\s\S]*?)<\/canvas>/);
  assert(canvas && canvas[1].trim().length > 20, `${definition.id}: canvas needs useful fallback text`);
  assert.deepStrictEqual(scriptsIn(html), sharedScripts, `${definition.id}: script assembly must use only manifest + bootstrap`);
  assert(!/[?&]v=\d+/.test(html), `${definition.id}: manual cache versions are forbidden`);

  const source = fs.readFileSync(definition.lab, "utf8");
  assert(source.includes("createLabController"), `${definition.id}: must mount through the shared controller`);
  assert(source.includes("const $ = runtime.query"), `${definition.id}: DOM access must use the shared query entrypoint`);
  assert(!source.includes("document.querySelector"), `${definition.id}: direct DOM queries would fork the shared access pattern`);
  assert(source.includes("runtime.drawAxes"), `${definition.id}: axes must use the shared renderer`);
  if (["gbm", "svm", "kmeans", "linear", "logistic", "nn", "forest"].includes(definition.id)) {
    assert(source.includes("runtime.drawSeries"), `${definition.id}: chart series must use the shared renderer`);
  }
  ["createTrainingLog", "createAutoTrainer", "makeCanvasFitter", 'addEventListener("resize"'].forEach((pattern) => {
    assert(!source.includes(pattern), `${definition.id}: duplicated runtime behavior found: ${pattern}`);
  });
});

const css = fs.readFileSync("styles.css", "utf8");
["--viz-positive", "--viz-negative", "--viz-focus", "--viz-error", "--viz-previous"].forEach((token) => {
  assert(css.includes(token), `styles: missing ${token}`);
});
assert(css.includes('html[data-theme="light"]'), "styles: missing global light theme");
assert(css.includes(".theme-toggle"), "styles: missing global theme toggle styling");
assert(css.includes("--ui-accent"), "styles: UI accent must be separate from model-positive green");
assert(css.includes("--decor-glow-a"), "styles: decorative background glows must be tokenized");
assert(css.includes("prefers-reduced-motion"), "styles: missing reduced-motion support");
assert(css.includes("@media (max-width: 900px) and (orientation: portrait)"), "styles: mobile portrait must be a rotate-device gate");
assert(css.includes("@media (max-width: 1200px) and (orientation: landscape)"), "styles: compact landscape gate missing");
assert(css.includes("overflow-x: hidden"), "styles: sidebar must never expose a horizontal scrollbar");
assert(css.includes("grid-auto-rows: max-content"), "styles: scrollable sidebar cards must keep their content height");
assert(css.includes("grid-template-rows: auto auto minmax(0, 1fr) auto"), "styles: compact stage must reserve a legend row");
assert(/\.log-current\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?clip-path:\s*inset\(50%\);/.test(css), "training log: live status must not duplicate the visible latest entry");
[".kmeans-page", ".tree-page", ".compact-lab-page", ".linear-page", ".logistic-page", ".forest-page"].forEach((selector) => {
  assert(!css.includes(selector), `styles: shared layout must not fork through ${selector}`);
});

const runtime = fs.readFileSync("core/lab-runtime.js", "utf8");
[
  "global.LabManifest",
  "createLabController",
  "createTrainingLog",
  "createCanvasSurface",
  "createFieldRenderer",
  "createHistory",
  "drawAxes",
  "drawSeries",
  "query",
  "ResizeObserver",
  "DEFAULT_MAX_DPR",
].forEach((contract) => assert(runtime.includes(contract), `runtime: missing ${contract}`));
assert(runtime.includes("entries.unshift"), "runtime: shared training log must be the single append-only store");
assert(runtime.includes("fullLogDirty"), "runtime: full log must render lazily");
assert(!runtime.includes("setInterval(step"), "runtime: auto training must not use an overlapping fixed interval");

const bootstrap = fs.readFileSync("core/bootstrap.js", "utf8");
assert(bootstrap.includes("definition.model") && bootstrap.includes("definition.lab"), "bootstrap: model/lab loading must come from manifest");
assert(bootstrap.includes("./models/model-core.js"), "bootstrap: shared model core must load before model adapters");

const treeModel = fs.readFileSync("models/tree-model.js", "utf8");
const forestModel = fs.readFileSync("models/forest-model.js", "utf8");
assert(treeModel.includes("bestBinarySplit") && forestModel.includes("bestBinarySplit"), "tree models must share the split kernel");
assert(forestModel.includes("createStabilityAccumulator") && forestModel.includes("oobEstimate"), "forest ensemble logic must live in the pure model");
assert(fs.readFileSync("models/logistic-model.js", "utf8").includes("binaryClassificationStats"), "logistic model must share binary metrics");
assert(fs.readFileSync("models/nn-model.js", "utf8").includes("binaryClassificationStats"), "neural model must share binary metrics");
assert(fs.readFileSync("models/svm-model.js", "utf8").includes("createKernelMatrix"), "svm model must expose reusable kernel computation");

const neuralNetwork = fs.readFileSync("labs/nn.js", "utf8");
assert(neuralNetwork.includes("drawNetworkPanel(b.panel)"), "nn: network panel must keep its dedicated canvas region");
assert(neuralNetwork.includes("drawWeightLabels"), "nn: dense weight labels need collision-aware layout");
assert(neuralNetwork.includes("labelBlockers"), "nn: weight labels must avoid nodes and panel copy");

console.log(`Architecture and visual contract passed for ${labs.length} labs.`);
