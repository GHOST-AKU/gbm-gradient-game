(function registerGbmModel(global) {
  function mean(values) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function mse(targets, predictions) {
    return predictions.reduce((sum, prediction, index) => {
      const error = targets[index] - prediction;
      return sum + error * error;
    }, 0) / predictions.length;
  }

  function clampPrediction(value) {
    return Math.max(0.02, Math.min(0.98, value));
  }

  function overfitRisk(rate, segments, nextRound) {
    const rateRisk = Math.max(0, (rate - 0.42) / 0.38);
    const depthRisk = Math.max(0, (segments - 5) / 3);
    const roundRisk = Math.max(0, (nextRound - 4) / 8);
    return Math.min(1, rateRisk * 0.45 + depthRisk * 0.35 + roundRisk * 0.2);
  }

  function buildWeakLearner(points, predictions, segments) {
    const ordered = points.map((point, index) => ({ point, index, residual: point.y - predictions[index] })).sort((a, b) => a.point.x - b.point.x);
    const leafCount = Math.max(1, Math.min(segments, ordered.length));
    const prefix = [0];
    const prefixSquare = [0];
    ordered.forEach((item, index) => {
      prefix[index + 1] = prefix[index] + item.residual;
      prefixSquare[index + 1] = prefixSquare[index] + item.residual * item.residual;
    });
    const groupCost = (start, end) => {
      const count = end - start;
      const sum = prefix[end] - prefix[start];
      const square = prefixSquare[end] - prefixSquare[start];
      return square - (sum * sum) / Math.max(1, count);
    };
    const dp = Array.from({ length: leafCount + 1 }, () => Array(ordered.length + 1).fill(Infinity));
    const splitAt = Array.from({ length: leafCount + 1 }, () => Array(ordered.length + 1).fill(0));
    dp[0][0] = 0;
    for (let leaf = 1; leaf <= leafCount; leaf += 1) {
      for (let end = leaf; end <= ordered.length; end += 1) {
        for (let start = leaf - 1; start < end; start += 1) {
          const cost = dp[leaf - 1][start] + groupCost(start, end);
          if (cost < dp[leaf][end]) {
            dp[leaf][end] = cost;
            splitAt[leaf][end] = start;
          }
        }
      }
    }
    const values = Array(points.length).fill(0);
    const leaves = [];
    let end = ordered.length;
    for (let leaf = leafCount; leaf >= 1; leaf -= 1) {
      const start = splitAt[leaf][end];
      const value = (prefix[end] - prefix[start]) / Math.max(1, end - start);
      for (let index = start; index < end; index += 1) values[ordered[index].index] = value;
      leaves.unshift({
        start,
        end,
        value,
        count: end - start,
        xMin: start === 0 ? 0 : (ordered[start - 1].point.x + ordered[start].point.x) / 2,
        xMax: end === ordered.length ? 1 : (ordered[end - 1].point.x + ordered[end].point.x) / 2,
      });
      end = start;
    }
    return { values, leaves };
  }

  function overfitNoise(points, risk, nextRound) {
    const amplitude = risk * (0.025 + Math.min(nextRound, 14) * 0.003);
    return points.map((point, index) => {
      const wave = Math.sin((index + 1) * 3.9 + nextRound * 1.7);
      return (wave * 0.55 + (index % 2 === 0 ? 1 : -1) * 0.45) * amplitude;
    });
  }

  global.GbmModel = { buildWeakLearner, clampPrediction, mean, mse, overfitNoise, overfitRisk };
})(typeof window === "undefined" ? globalThis : window);
