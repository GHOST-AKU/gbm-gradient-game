const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = { console, Math };
context.globalThis = context;
vm.createContext(context);

const modelFiles = fs.readdirSync("models").filter((file) => file.endsWith(".js"));
vm.runInContext(fs.readFileSync("models/model-core.js", "utf8"), context, { filename: "model-core.js" });
modelFiles.filter((file) => file !== "model-core.js").forEach((file) => {
  vm.runInContext(fs.readFileSync(`models/${file}`, "utf8"), context, { filename: file });
});

const linearPoints = [{ x: -1, y: -1 }, { x: 1, y: 1 }];
assert.strictEqual(context.LinearModel.mse(linearPoints, { w: 1, b: 0 }), 0);
assert(context.LinearModel.gradient(linearPoints, { w: 0, b: 0 }).dw < 0);
assert(context.LinearModel.train(linearPoints, { w: 0, b: 0 }, 0.2, 4).w > 0);

const logisticPoints = [{ x: -1, y: 0, label: 0 }, { x: 1, y: 0, label: 1 }];
assert(context.LogisticModel.metrics(logisticPoints, { w1: 4, w2: 0, b: 0 }).accuracy === 1);
assert(context.LogisticModel.train(logisticPoints, { w1: 0, w2: 0, b: 0 }, 0.5, 0, 4).w1 > 0);

const centroids = [{ x: -1, y: 0, lastX: -1, lastY: 0 }, { x: 1, y: 0, lastX: 1, lastY: 0 }];
assert.deepStrictEqual([...context.KMeansModel.assign(linearPoints, centroids)], [0, 1]);
assert.deepStrictEqual([...context.KMeansModel.step(linearPoints, centroids, 1).assignments], [0, 1]);
assert.strictEqual(context.KMeansModel.nearestIndex({ x: -0.8, y: 0 }, centroids), 0);

const leaves = [
  { xMin: -1, xMax: 0, yMin: -1, yMax: 1, depth: 1 },
  { xMin: 0, xMax: 1, yMin: -1, yMax: 1, depth: 1 },
];
const treePoints = [{ x: -0.5, y: 0, label: -1 }, { x: 0.5, y: 0, label: 1 }];
assert.strictEqual(context.TreeModel.metrics(treePoints, leaves).accuracy, 1);
assert(context.TreeModel.bestSplit(treePoints, { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }, "x", 0).gain > 0);

const net = context.NeuralNetworkModel.makeNet();
assert.strictEqual(net.h.length, 4);
assert(context.NeuralNetworkModel.forward({ x: 0, y: 0 }, net).p > 0);
assert.strictEqual(
  context.NeuralNetworkModel.probability({ x: 0.2, y: -0.1 }, net),
  context.NeuralNetworkModel.forward({ x: 0.2, y: -0.1 }, net).p,
);
assert.notStrictEqual(context.NeuralNetworkModel.train(logisticPoints, net, 0.2, 1), net);

const forestPoints = [{ x: -1, y: 0, label: 0 }, { x: -0.5, y: 0, label: 0 }, { x: 0.5, y: 0, label: 1 }, { x: 1, y: 0, label: 1 }];
const tree = context.ForestModel.buildTree(forestPoints, 0, 2, context.ForestModel.rng(1), 2);
assert.strictEqual(context.ForestModel.predictTree(tree, forestPoints[0]), 0);
assert.strictEqual(context.ForestModel.predictTree(tree, forestPoints[3]), 1);
const secondTree = context.ForestModel.buildTree(forestPoints, 0, 2, context.ForestModel.rng(2), 2);
const forest = [tree, secondTree];
const forestMetrics = context.ForestModel.metrics(forestPoints, forest);
assert(Number.isFinite(forestMetrics.score) && forestMetrics.accuracy === 1);
const stability = context.ForestModel.stabilityTrend(forestPoints, forest);
assert.strictEqual(stability.length, forest.length);
assert.strictEqual(stability[1].count, 2);
const bagA = context.ForestModel.bootstrap(forestPoints, context.ForestModel.rng(3));
const bagB = context.ForestModel.bootstrap(forestPoints, context.ForestModel.rng(4));
assert(Number.isFinite(context.ForestModel.oobEstimate(forestPoints, forest, [bagA.membership, bagB.membership])));

assert.strictEqual(context.GbmModel.mse([0, 1], [0, 1]), 0);
assert(context.GbmModel.overfitRisk(0.8, 8, 12) > 0);
assert.strictEqual(context.GbmModel.buildWeakLearner(linearPoints, [0, 0], 2).values.length, 2);

const svmPoints = [{ x: -1, y: 0, label: -1 }, { x: 1, y: 0, label: 1 }];
const svmMetrics = context.SvmModel.metrics(svmPoints, [1, 1], 0, context.SvmModel.gamma(2));
assert(svmMetrics.accuracy >= 0.5);
const scorer = context.SvmModel.createScorer(svmPoints, [1, 1], 0, context.SvmModel.gamma(2));
assert.strictEqual(scorer(svmPoints[0]), context.SvmModel.scorePoint(svmPoints, svmPoints[0], [1, 1], 0, context.SvmModel.gamma(2)));
const svmKernelMatrix = context.SvmModel.createKernelMatrix(svmPoints, context.SvmModel.gamma(2));
assert.strictEqual(svmKernelMatrix.length, 4);
assert.strictEqual(svmKernelMatrix[1], svmKernelMatrix[2]);
assert.strictEqual(context.SvmModel.train(svmPoints.map((point, index) => ({ ...point, index })), [0, 0], 0, 1, 2, 0, 0, svmKernelMatrix).round, 1);

console.log("Pure model smoke passed.");
