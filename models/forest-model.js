(function registerForestModel(global) {
  function rng(seed) {
    let value = seed >>> 0;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function gini(points) {
    if (!points.length) return 0;
    const positive = points.filter((point) => point.label === 1).length / points.length;
    return 1 - positive * positive - (1 - positive) * (1 - positive);
  }

  function majority(points) {
    return points.reduce((sum, point) => sum + (point.label ? 1 : -1), 0) >= 0 ? 1 : 0;
  }

  function bestSplit(points, axes) {
    let best = { gain: -Infinity };
    axes.forEach((axis) => {
      const values = [...new Set(points.map((point) => point[axis]))].sort((a, b) => a - b);
      for (let index = 0; index < values.length - 1; index += 1) {
        const value = (values[index] + values[index + 1]) / 2;
        const left = points.filter((point) => point[axis] <= value);
        const right = points.filter((point) => point[axis] > value);
        if (!left.length || !right.length) continue;
        const gain = gini(points) - (gini(left) * left.length + gini(right) * right.length) / points.length;
        if (gain > best.gain) best = { axis, value, gain, left, right };
      }
    });
    return best;
  }

  function buildTree(points, depth, maxDepth, random, featureCount) {
    if (depth >= maxDepth || points.length <= 2 || gini(points) < 0.02) return { leaf: true, label: majority(points), points: points.length };
    const axes = featureCount === 1 ? [random() < 0.5 ? "x" : "y"] : ["x", "y"];
    const split = bestSplit(points, axes);
    if (!Number.isFinite(split.gain) || split.gain <= 0.001) return { leaf: true, label: majority(points), points: points.length };
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
    if (tree.leaf) return tree.label;
    return predictTree(point[tree.axis] <= tree.value ? tree.left : tree.right, point);
  }

  global.ForestModel = { bestSplit, buildTree, gini, majority, predictTree, rng };
})(typeof window === "undefined" ? globalThis : window);
