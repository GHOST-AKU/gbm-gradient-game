(function registerTreeModel(global) {
  const core = global.ModelCore;
  if (!core) throw new Error("TreeModel requires model-core.js before tree-model.js");

  function pointsInLeaf(points, leaf) {
    return points.filter((point) => (
      point.x >= leaf.xMin && point.x <= leaf.xMax && point.y >= leaf.yMin && point.y <= leaf.yMax
    ));
  }

  function gini(points) {
    return core.gini(points, 1, -1);
  }

  function majority(points) {
    return core.majority(points, 1, -1);
  }

  function leafFor(leaves, point) {
    return leaves.find((leaf) => (
      point.x >= leaf.xMin && point.x <= leaf.xMax && point.y >= leaf.yMin && point.y <= leaf.yMax
    )) || leaves[0];
  }

  function prediction(points, leaves, point) {
    return majority(pointsInLeaf(points, leafFor(leaves, point)));
  }

  function metrics(points, leaves) {
    let correct = 0;
    let weightedImpurity = 0;
    leaves.forEach((leaf) => {
      const leafPoints = pointsInLeaf(points, leaf);
      weightedImpurity += gini(leafPoints) * leafPoints.length;
    });
    points.forEach((point) => {
      if (prediction(points, leaves, point) === point.label) correct += 1;
    });
    const accuracy = correct / points.length;
    const impurity = weightedImpurity / points.length;
    const depth = Math.max(...leaves.map((leaf) => leaf.depth));
    const score = Math.max(0, Math.min(0.99, accuracy - Math.max(0, leaves.length - 4) * 0.015));
    return { accuracy, impurity, depth, score };
  }

  function splitGain(points, leaf, axis, value) {
    const leafPoints = pointsInLeaf(points, leaf);
    return core.binarySplitGain(leafPoints, axis, value, 1, -1);
  }

  function bestSplit(points, leaf, defaultAxis, defaultValue) {
    const leafPoints = pointsInLeaf(points, leaf);
    return core.bestBinarySplit(leafPoints, ["x", "y"], {
      positiveLabel: 1,
      negativeLabel: -1,
      bounds: {
        x: { min: leaf.xMin, max: leaf.xMax },
        y: { min: leaf.yMin, max: leaf.yMax },
      },
      initialBest: { axis: defaultAxis, value: defaultValue, gain: -Infinity },
    });
  }

  global.TreeModel = { bestSplit, gini, leafFor, majority, metrics, pointsInLeaf, prediction, splitGain };
})(typeof window === "undefined" ? globalThis : window);
