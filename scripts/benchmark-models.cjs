const fs = require("fs");
const vm = require("vm");
const { performance } = require("perf_hooks");

const context = { console, Math };
context.globalThis = context;
vm.createContext(context);

function evaluate(file) {
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}

evaluate("models/model-core.js");
fs.readdirSync("models")
  .filter((file) => file.endsWith("-model.js"))
  .sort()
  .forEach((file) => evaluate(`models/${file}`));

function random(index) {
  return ((index * 1664525 + 1013904223) >>> 0) / 4294967296;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function benchmark(run, { samples = 7, iterations = 1 } = {}) {
  for (let warmup = 0; warmup < 3; warmup += 1) run();
  const timings = [];
  for (let sample = 0; sample < samples; sample += 1) {
    const started = performance.now();
    for (let iteration = 0; iteration < iterations; iteration += 1) run();
    timings.push((performance.now() - started) / iterations);
  }
  return Number(median(timings).toFixed(3));
}

const points = Array.from({ length: 1200 }, (_, index) => ({
  x: random(index * 2) * 2 - 1,
  y: random(index * 2 + 1) * 2 - 1,
  label: random(index * 3) > 0.5 ? 1 : -1,
}));
const forestPoints = points.map((point) => ({ ...point, label: point.label === 1 ? 1 : 0 }));
const centroids = Array.from({ length: 8 }, (_, index) => ({
  x: random(index) * 2 - 1,
  y: random(index + 10) * 2 - 1,
  lastX: 0,
  lastY: 0,
}));
const alpha = Array.from({ length: points.length }, (_, index) => (index % 3 ? 0 : 0.3));
const gamma = context.SvmModel.gamma(2);
const scorer = context.SvmModel.createScorer(points, alpha, 0, gamma);
const svmKernelMatrix = context.SvmModel.createKernelMatrix(points, gamma);
const grid = Array.from({ length: 1400 }, (_, index) => ({
  x: random(index) * 2 - 1,
  y: random(index + 1) * 2 - 1,
}));

const browserPoints = forestPoints.slice(0, 24);
const forest = Array.from({ length: 100 }, (_, index) => (
  context.ForestModel.buildTree(browserPoints, 0, 4, context.ForestModel.rng(index + 1), 2)
));
const browserGrid = grid.slice(0, 1232);

const results = {
  "tree.bestSplit.1200": benchmark(() => {
    context.TreeModel.bestSplit(points, { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }, "x", 0);
  }),
  "forest.buildTree.1200": benchmark(() => {
    context.ForestModel.buildTree(forestPoints, 0, 5, context.ForestModel.rng(42), 2);
  }),
  "forest.voteGrid.100trees": benchmark(() => {
    for (let index = 0; index < browserGrid.length; index += 1) {
      context.ForestModel.voteSum(forest, browserGrid[index]);
    }
  }, { samples: 7, iterations: 3 }),
  "kmeans.step.1200x8": benchmark(() => {
    context.KMeansModel.step(points, centroids, 0.8);
  }, { samples: 7, iterations: 10 }),
  "svm.cachedScoreGrid.1200x1400": benchmark(() => {
    for (let index = 0; index < grid.length; index += 1) scorer(grid[index]);
  }, { samples: 7, iterations: 2 }),
  "svm.train.cachedKernel.1200": benchmark(() => {
    context.SvmModel.train(points, alpha, 0, 1, 2, 0, 0, svmKernelMatrix);
  }, { samples: 5 }),
};

console.log(JSON.stringify({
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  unit: "median milliseconds per operation",
  results,
}, null, 2));
