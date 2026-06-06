(function registerSvmModel(global) {
  function gamma(kernelPower) {
    return 0.45 + Number(kernelPower) * 0.34;
  }

  function kernel(a, b, gammaValue) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.exp(-gammaValue * (dx * dx + dy * dy));
  }

  function scorePoint(points, point, alpha, bias, gammaValue) {
    return points.reduce((score, sample, index) => (
      alpha[index] > 0.0001 ? score + alpha[index] * sample.label * kernel(point, sample, gammaValue) : score
    ), bias);
  }

  function metrics(points, alpha, bias, gammaValue, overfit = 0) {
    let hinge = 0;
    let correct = 0;
    let outsideMargin = 0;
    let supportCount = 0;
    let violations = 0;
    points.forEach((point) => {
      const signed = point.label * scorePoint(points, point, alpha, bias, gammaValue);
      hinge += Math.max(0, 1 - signed);
      if (signed > 0) correct += 1;
      if (signed >= 1) outsideMargin += 1;
      if (signed > -0.15 && signed < 1.18) supportCount += 1;
      if (signed < 1) violations += 1;
    });
    hinge /= points.length;
    const regularizer = alpha.reduce((sum, value) => sum + value * value, 0) * 0.012;
    const accuracy = correct / points.length;
    const marginRate = outsideMargin / points.length;
    const score = Math.max(0, Math.min(0.99, accuracy * 0.62 + marginRate * 0.38 - overfit * 0.16));
    const activeVectors = alpha.filter((value) => value > 0.01).length;
    return { hinge, objective: hinge + regularizer, accuracy, marginRate, score, supportCount, violations, activeVectors };
  }

  function train(points, alpha, bias, penalty, complexity, round, overfit) {
    const nextAlpha = [...alpha];
    let nextBias = bias;
    const nextRound = round + 1;
    const gammaValue = gamma(complexity);
    const learningRate = 0.055;
    const order = [...points].sort((a, b) => ((a.index * 7 + nextRound * 3) % 11) - ((b.index * 7 + nextRound * 3) % 11));
    order.forEach((point) => {
      const index = point.index;
      const signed = point.label * scorePoint(points, point, nextAlpha, nextBias, gammaValue);
      nextAlpha[index] *= 1 - learningRate * 0.028;
      if (signed < 1) {
        const push = learningRate * penalty * (1 - signed);
        nextAlpha[index] = Math.min(4.5, nextAlpha[index] + push);
        nextBias += learningRate * penalty * point.label * 0.11;
      }
      if (signed > 1.6) nextAlpha[index] *= 0.985;
    });
    const shouldOverfit = penalty >= 3.2 && complexity >= 7 && nextRound >= 5;
    const nextOverfit = shouldOverfit ? Math.min(1, overfit + 0.18) : Math.max(0, overfit - 0.08);
    return { alpha: nextAlpha, bias: nextBias, round: nextRound, overfit: nextOverfit, shouldOverfit };
  }

  global.SvmModel = { gamma, kernel, metrics, scorePoint, train };
})(typeof window === "undefined" ? globalThis : window);
