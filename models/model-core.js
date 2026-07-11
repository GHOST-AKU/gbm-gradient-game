(function registerModelCore(global) {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function sigmoid(value) {
    return 1 / (1 + Math.exp(-clamp(value, -30, 30)));
  }

  function binaryClassificationStats(
    points,
    probabilityFor,
    { positiveLabel = 1, negativeLabel = 0, minProbability = 0.001, maxProbability = 0.999 } = {},
  ) {
    let loss = 0;
    let correct = 0;
    let confidence = 0;
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      const probability = clamp(probabilityFor(point, index), minProbability, maxProbability);
      const target = point.label === positiveLabel ? 1 : 0;
      loss += -(target * Math.log(probability) + (1 - target) * Math.log(1 - probability));
      const prediction = probability >= 0.5 ? positiveLabel : negativeLabel;
      if (prediction === point.label) correct += 1;
      confidence += Math.abs(probability - 0.5) * 2;
    }
    const count = points.length;
    return {
      loss: loss / count,
      accuracy: correct / count,
      confidence: confidence / count,
      correct,
      count,
    };
  }

  function labelCounts(points, positiveLabel, negativeLabel) {
    let positive = 0;
    let negative = 0;
    for (let index = 0; index < points.length; index += 1) {
      if (points[index].label === positiveLabel) positive += 1;
      else if (points[index].label === negativeLabel) negative += 1;
    }
    return { positive, negative };
  }

  function giniFromCounts(positive, negative) {
    const count = positive + negative;
    if (!count) return 0;
    const positiveRate = positive / count;
    const negativeRate = negative / count;
    return 1 - positiveRate * positiveRate - negativeRate * negativeRate;
  }

  function gini(points, positiveLabel, negativeLabel) {
    const counts = labelCounts(points, positiveLabel, negativeLabel);
    return giniFromCounts(counts.positive, counts.negative);
  }

  function majority(points, positiveLabel, negativeLabel) {
    const counts = labelCounts(points, positiveLabel, negativeLabel);
    return counts.positive >= counts.negative ? positiveLabel : negativeLabel;
  }

  function upperBound(sorted, value) {
    let low = 0;
    let high = sorted.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (sorted[middle].value <= value) low = middle + 1;
      else high = middle;
    }
    return low;
  }

  function binarySplitGain(points, axis, value, positiveLabel, negativeLabel) {
    let leftPositive = 0;
    let leftNegative = 0;
    let rightPositive = 0;
    let rightNegative = 0;
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      const isLeft = point[axis] <= value;
      if (point.label === positiveLabel) {
        if (isLeft) leftPositive += 1;
        else rightPositive += 1;
      } else if (point.label === negativeLabel) {
        if (isLeft) leftNegative += 1;
        else rightNegative += 1;
      }
    }
    const leftCount = leftPositive + leftNegative;
    const rightCount = rightPositive + rightNegative;
    const count = leftCount + rightCount;
    if (!leftCount || !rightCount) return -Infinity;
    const parent = giniFromCounts(leftPositive + rightPositive, leftNegative + rightNegative);
    const after = (
      giniFromCounts(leftPositive, leftNegative) * leftCount
      + giniFromCounts(rightPositive, rightNegative) * rightCount
    ) / count;
    return parent - after;
  }

  function bestBinarySplit(
    points,
    axes,
    {
      positiveLabel,
      negativeLabel,
      candidateMode = "unique",
      bounds = null,
      initialBest = { gain: -Infinity },
      includePartitions = false,
    },
  ) {
    let best = { ...initialBest };
    const parentCounts = labelCounts(points, positiveLabel, negativeLabel);
    const parentGini = giniFromCounts(parentCounts.positive, parentCounts.negative);

    for (let axisIndex = 0; axisIndex < axes.length; axisIndex += 1) {
      const axis = axes[axisIndex];
      const ordered = points.map((point, index) => ({ value: point[axis], label: point.label, index }));
      ordered.sort((left, right) => left.value - right.value);
      if (ordered.length < 2) continue;

      const prefixPositive = new Uint32Array(ordered.length + 1);
      const prefixNegative = new Uint32Array(ordered.length + 1);
      for (let index = 0; index < ordered.length; index += 1) {
        prefixPositive[index + 1] = prefixPositive[index] + (ordered[index].label === positiveLabel ? 1 : 0);
        prefixNegative[index + 1] = prefixNegative[index] + (ordered[index].label === negativeLabel ? 1 : 0);
      }

      for (let index = 0; index < ordered.length - 1; index += 1) {
        if (candidateMode === "unique" && index > 0 && ordered[index].value === ordered[index - 1].value) continue;
        const nextIndex = candidateMode === "unique"
          ? (() => {
            let cursor = index + 1;
            while (cursor < ordered.length && ordered[cursor].value === ordered[index].value) cursor += 1;
            return cursor;
          })()
          : index + 1;
        if (nextIndex >= ordered.length) break;
        const value = (ordered[index].value + ordered[nextIndex].value) / 2;
        if (bounds && (value <= bounds[axis].min || value >= bounds[axis].max)) continue;

        const splitIndex = upperBound(ordered, value);
        const leftPositive = prefixPositive[splitIndex];
        const leftNegative = prefixNegative[splitIndex];
        const rightPositive = parentCounts.positive - leftPositive;
        const rightNegative = parentCounts.negative - leftNegative;
        const leftCount = leftPositive + leftNegative;
        const rightCount = rightPositive + rightNegative;
        if (!leftCount || !rightCount) continue;
        const after = (
          giniFromCounts(leftPositive, leftNegative) * leftCount
          + giniFromCounts(rightPositive, rightNegative) * rightCount
        ) / points.length;
        const gain = parentGini - after;
        if (gain > best.gain) best = { axis, value, gain };
      }
    }

    if (includePartitions && Number.isFinite(best.gain)) {
      const left = points.filter((point) => point[best.axis] <= best.value);
      const right = points.filter((point) => point[best.axis] > best.value);
      return { axis: best.axis, value: best.value, gain: best.gain, left, right };
    }
    return best;
  }

  function predictTree(tree, point) {
    let node = tree;
    while (!node.leaf) node = point[node.axis] <= node.value ? node.left : node.right;
    return node.label;
  }

  global.ModelCore = {
    bestBinarySplit,
    binaryClassificationStats,
    binarySplitGain,
    clamp,
    gini,
    giniFromCounts,
    majority,
    predictTree,
    sigmoid,
  };
})(typeof window === "undefined" ? globalThis : window);
