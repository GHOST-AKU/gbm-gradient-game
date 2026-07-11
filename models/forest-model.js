(function registerForestModel(global) {
  "use strict";

  const core = global.ModelCore;
  if (!core) throw new Error("ForestModel requires model-core.js before forest-model.js");

  function rng(seed) {
    let value = seed >>> 0;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function gini(points) {
    return core.gini(points, 1, 0);
  }

  function majority(points) {
    return core.majority(points, 1, 0);
  }

  function bestSplit(points, axes) {
    return core.bestBinarySplit(points, axes, {
      positiveLabel: 1,
      negativeLabel: 0,
      includePartitions: true,
    });
  }

  function buildTree(points, depth, maxDepth, random, featureCount) {
    if (depth >= maxDepth || points.length <= 2 || gini(points) < 0.02) {
      return { leaf: true, label: majority(points), points: points.length };
    }
    const axes = featureCount === 1 ? [random() < 0.5 ? "x" : "y"] : ["x", "y"];
    const split = bestSplit(points, axes);
    if (!Number.isFinite(split.gain) || split.gain <= 0.001) {
      return { leaf: true, label: majority(points), points: points.length };
    }
    return {
      leaf: false,
      axis: split.axis,
      value: split.value,
      gain: split.gain,
      left: buildTree(split.left, depth + 1, maxDepth, random, featureCount),
      right: buildTree(split.right, depth + 1, maxDepth, random, featureCount),
    };
  }

  function predictTree(tree, point) {
    return core.predictTree(tree, point);
  }

  function treeStats(tree, stats = { splits: 0, xSplits: 0, ySplits: 0, leaves: 0, depth: 0 }) {
    if (tree.leaf) {
      stats.leaves += 1;
      return stats;
    }
    stats.splits += 1;
    stats.xSplits += tree.axis === "x" ? 1 : 0;
    stats.ySplits += tree.axis === "y" ? 1 : 0;
    stats.depth = Math.max(stats.depth, 1);
    const left = treeStats(tree.left, { splits: 0, xSplits: 0, ySplits: 0, leaves: 0, depth: 0 });
    const right = treeStats(tree.right, { splits: 0, xSplits: 0, ySplits: 0, leaves: 0, depth: 0 });
    stats.splits += left.splits + right.splits;
    stats.xSplits += left.xSplits + right.xSplits;
    stats.ySplits += left.ySplits + right.ySplits;
    stats.leaves += left.leaves + right.leaves;
    stats.depth = Math.max(stats.depth, left.depth + 1, right.depth + 1);
    return stats;
  }

  function voteSum(trees, point) {
    let sum = 0;
    for (let index = 0; index < trees.length; index += 1) {
      sum += predictTree(trees[index], point) ? 1 : -1;
    }
    return sum;
  }

  function voteDetails(trees, point, includeVotes = true) {
    const votes = includeVotes ? new Array(trees.length) : null;
    let positive = 0;
    for (let index = 0; index < trees.length; index += 1) {
      const vote = predictTree(trees[index], point);
      if (includeVotes) votes[index] = vote;
      if (vote) positive += 1;
    }
    const negative = trees.length - positive;
    return {
      votes,
      positive,
      negative,
      label: positive >= negative ? 1 : 0,
      margin: trees.length ? Math.abs(positive - negative) / trees.length : 0,
      sum: positive - negative,
    };
  }

  function metrics(points, trees) {
    if (!trees.length) return { accuracy: 0, margin: 0, score: 0 };
    let correct = 0;
    let margin = 0;
    for (let index = 0; index < points.length; index += 1) {
      const sum = voteSum(trees, points[index]);
      if ((sum >= 0 ? 1 : 0) === points[index].label) correct += 1;
      margin += Math.abs(sum) / trees.length;
    }
    const accuracy = correct / points.length;
    margin /= points.length;
    const score = Math.max(0, Math.min(
      0.99,
      accuracy * 0.78 + margin * 0.22 - Math.max(0, trees.length - 18) * 0.004,
    ));
    return { accuracy, margin, score };
  }

  function bootstrap(points, random) {
    const indices = new Array(points.length);
    const sample = new Array(points.length);
    const membership = new Set();
    const counts = new Uint16Array(points.length);
    for (let index = 0; index < points.length; index += 1) {
      const pointIndex = Math.floor(random() * points.length);
      indices[index] = pointIndex;
      sample[index] = points[pointIndex];
      membership.add(pointIndex);
      counts[pointIndex] += 1;
    }
    return { counts, indices, sample, membership };
  }

  function normalizeMembership(bag) {
    return bag instanceof Set ? bag : new Set(bag);
  }

  function oobEstimate(points, trees, bags, fallbackAccuracy = metrics(points, trees).accuracy) {
    if (!trees.length) return 0;
    const memberships = bags.map(normalizeMembership);
    let tested = 0;
    let correct = 0;
    for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
      let sum = 0;
      let count = 0;
      for (let treeIndex = 0; treeIndex < trees.length; treeIndex += 1) {
        if (memberships[treeIndex].has(pointIndex)) continue;
        sum += predictTree(trees[treeIndex], points[pointIndex]) ? 1 : -1;
        count += 1;
      }
      if (!count) continue;
      tested += 1;
      if ((sum >= 0 ? 1 : 0) === points[pointIndex].label) correct += 1;
    }
    return tested ? correct / tested : fallbackAccuracy;
  }

  function stabilityTrend(points, trees) {
    return createStabilityAccumulator(points, trees).trend;
  }

  function appendStability(accumulator, points, tree) {
    let margin = 0;
    let flips = 0;
    const count = accumulator.count + 1;
    for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
      accumulator.sums[pointIndex] += predictTree(tree, points[pointIndex]) ? 1 : -1;
      const label = accumulator.sums[pointIndex] >= 0 ? 1 : 0;
      margin += Math.abs(accumulator.sums[pointIndex]) / count;
      if (accumulator.count > 0 && label !== accumulator.labels[pointIndex]) flips += 1;
      accumulator.labels[pointIndex] = label;
    }
    accumulator.count = count;
    const point = { count, margin: margin / points.length, flips };
    accumulator.trend.push(point);
    return point;
  }

  function createStabilityAccumulator(points, trees = []) {
    const accumulator = {
      count: 0,
      labels: new Uint8Array(points.length),
      sums: new Int32Array(points.length),
      trend: [],
    };
    for (let treeIndex = 0; treeIndex < trees.length; treeIndex += 1) {
      appendStability(accumulator, points, trees[treeIndex]);
    }
    return accumulator;
  }

  function focusPoint(points, trees) {
    if (!trees.length) return points[0];
    let focus = points[0];
    let minimum = Number.POSITIVE_INFINITY;
    for (let index = 0; index < points.length; index += 1) {
      const margin = Math.abs(voteSum(trees, points[index])) / trees.length;
      if (margin < minimum) {
        minimum = margin;
        focus = points[index];
      }
    }
    return focus;
  }

  global.ForestModel = {
    bestSplit,
    appendStability,
    bootstrap,
    buildTree,
    createStabilityAccumulator,
    focusPoint,
    gini,
    majority,
    metrics,
    oobEstimate,
    predictTree,
    rng,
    stabilityTrend,
    treeStats,
    voteDetails,
    voteSum,
  };
})(typeof window === "undefined" ? globalThis : window);
