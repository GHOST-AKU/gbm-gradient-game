(function registerSvmModel(global) {
  function gamma(kernelPower) {
    return 0.45 + Number(kernelPower) * 0.34;
  }

  function kernel(a, b, gammaValue) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.exp(-gammaValue * (dx * dx + dy * dy));
  }

  function createKernelMatrix(points, gammaValue) {
    const size = points.length;
    const matrix = new Float64Array(size * size);
    for (let row = 0; row < size; row += 1) {
      matrix[row * size + row] = 1;
      for (let column = 0; column < row; column += 1) {
        const value = kernel(points[row], points[column], gammaValue);
        matrix[row * size + column] = value;
        matrix[column * size + row] = value;
      }
    }
    return matrix;
  }

  function scorePoint(points, point, alpha, bias, gammaValue) {
    let score = bias;
    for (let index = 0; index < points.length; index += 1) {
      if (alpha[index] > 0.0001) score += alpha[index] * points[index].label * kernel(point, points[index], gammaValue);
    }
    return score;
  }

  function createScorer(points, alpha, bias, gammaValue, extraScore) {
    const xValues = new Float64Array(points.length);
    const yValues = new Float64Array(points.length);
    const coefficients = new Float64Array(points.length);
    let activeCount = 0;
    for (let index = 0; index < points.length; index += 1) {
      if (alpha[index] <= 0.0001) continue;
      xValues[activeCount] = points[index].x;
      yValues[activeCount] = points[index].y;
      coefficients[activeCount] = alpha[index] * points[index].label;
      activeCount += 1;
    }
    return (point) => {
      let score = bias;
      const pointX = point.x;
      const pointY = point.y;
      for (let index = 0; index < activeCount; index += 1) {
        const dx = pointX - xValues[index];
        const dy = pointY - yValues[index];
        score += coefficients[index] * Math.exp(-gammaValue * (dx * dx + dy * dy));
      }
      return score + (extraScore ? extraScore(point) : 0);
    };
  }

  function metrics(points, alpha, bias, gammaValue, overfit = 0, scorer = createScorer(points, alpha, bias, gammaValue)) {
    let hinge = 0;
    let correct = 0;
    let outsideMargin = 0;
    let supportCount = 0;
    let violations = 0;
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      const signed = point.label * scorer(point);
      hinge += Math.max(0, 1 - signed);
      if (signed > 0) correct += 1;
      if (signed >= 1) outsideMargin += 1;
      if (signed > -0.15 && signed < 1.18) supportCount += 1;
      if (signed < 1) violations += 1;
    }
    hinge /= points.length;
    let regularizer = 0;
    let activeVectors = 0;
    for (let index = 0; index < alpha.length; index += 1) {
      regularizer += alpha[index] * alpha[index];
      if (alpha[index] > 0.01) activeVectors += 1;
    }
    regularizer *= 0.012;
    const accuracy = correct / points.length;
    const marginRate = outsideMargin / points.length;
    const score = Math.max(0, Math.min(0.99, accuracy * 0.62 + marginRate * 0.38 - overfit * 0.16));
    return { hinge, objective: hinge + regularizer, accuracy, marginRate, score, supportCount, violations, activeVectors };
  }

  function train(points, alpha, bias, penalty, complexity, round, overfit, kernelMatrix) {
    const nextAlpha = [...alpha];
    let nextBias = bias;
    const nextRound = round + 1;
    const gammaValue = gamma(complexity);
    const learningRate = 0.055;
    const size = points.length;
    const kernels = kernelMatrix?.length === size * size ? kernelMatrix : createKernelMatrix(points, gammaValue);
    const order = Array.from({ length: size }, (_, index) => index);
    order.sort((left, right) => {
      const leftIndex = points[left].index ?? left;
      const rightIndex = points[right].index ?? right;
      return ((leftIndex * 7 + nextRound * 3) % 11) - ((rightIndex * 7 + nextRound * 3) % 11);
    });
    for (let orderIndex = 0; orderIndex < order.length; orderIndex += 1) {
      const position = order[orderIndex];
      const point = points[position];
      const index = point.index ?? position;
      let rawScore = nextBias;
      const rowOffset = position * size;
      for (let samplePosition = 0; samplePosition < size; samplePosition += 1) {
        const sampleIndex = points[samplePosition].index ?? samplePosition;
        if (nextAlpha[sampleIndex] > 0.0001) {
          rawScore += nextAlpha[sampleIndex] * points[samplePosition].label * kernels[rowOffset + samplePosition];
        }
      }
      const signed = point.label * rawScore;
      nextAlpha[index] *= 1 - learningRate * 0.028;
      if (signed < 1) {
        const push = learningRate * penalty * (1 - signed);
        nextAlpha[index] = Math.min(4.5, nextAlpha[index] + push);
        nextBias += learningRate * penalty * point.label * 0.11;
      }
      if (signed > 1.6) nextAlpha[index] *= 0.985;
    }
    const shouldOverfit = penalty >= 3.2 && complexity >= 7 && nextRound >= 5;
    const nextOverfit = shouldOverfit ? Math.min(1, overfit + 0.18) : Math.max(0, overfit - 0.08);
    return { alpha: nextAlpha, bias: nextBias, round: nextRound, overfit: nextOverfit, shouldOverfit };
  }

  global.SvmModel = { createKernelMatrix, createScorer, gamma, kernel, metrics, scorePoint, train };
})(typeof window === "undefined" ? globalThis : window);
