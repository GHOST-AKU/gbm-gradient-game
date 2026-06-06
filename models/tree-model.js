(function registerTreeModel(global) {
  function pointsInLeaf(points, leaf) {
    return points.filter((point) => (
      point.x >= leaf.xMin && point.x <= leaf.xMax && point.y >= leaf.yMin && point.y <= leaf.yMax
    ));
  }

  function gini(points) {
    if (!points.length) return 0;
    const positive = points.filter((point) => point.label === 1).length / points.length;
    return 1 - positive * positive - (1 - positive) * (1 - positive);
  }

  function majority(points) {
    return points.reduce((sum, point) => sum + point.label, 0) >= 0 ? 1 : -1;
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
    const left = leafPoints.filter((point) => point[axis] <= value);
    const right = leafPoints.filter((point) => point[axis] > value);
    if (!left.length || !right.length) return -Infinity;
    const after = (gini(left) * left.length + gini(right) * right.length) / leafPoints.length;
    return gini(leafPoints) - after;
  }

  function bestSplit(points, leaf, defaultAxis, defaultValue) {
    let best = { axis: defaultAxis, value: defaultValue, gain: -Infinity };
    ["x", "y"].forEach((axis) => {
      const values = pointsInLeaf(points, leaf).map((point) => point[axis]).sort((a, b) => a - b);
      for (let index = 0; index < values.length - 1; index += 1) {
        const value = (values[index] + values[index + 1]) / 2;
        if (value <= leaf[`${axis}Min`] || value >= leaf[`${axis}Max`]) continue;
        const gain = splitGain(points, leaf, axis, value);
        if (gain > best.gain) best = { axis, value, gain };
      }
    });
    return best;
  }

  global.TreeModel = { bestSplit, gini, leafFor, majority, metrics, pointsInLeaf, prediction, splitGain };
})(typeof window === "undefined" ? globalThis : window);
