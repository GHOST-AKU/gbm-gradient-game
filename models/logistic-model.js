(function registerLogisticModel(global) {
  function sigmoid(value) {
    return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, value))));
  }

  function logit(point, model) {
    return model.w1 * point.x + model.w2 * point.y + model.b;
  }

  function probability(point, model) {
    return sigmoid(logit(point, model));
  }

  function metrics(points, model) {
    let loss = 0;
    let correct = 0;
    let confidence = 0;
    points.forEach((point) => {
      const p = Math.min(0.999, Math.max(0.001, probability(point, model)));
      loss += -(point.label * Math.log(p) + (1 - point.label) * Math.log(1 - p));
      if ((p >= 0.5 ? 1 : 0) === point.label) correct += 1;
      confidence += Math.abs(p - 0.5) * 2;
    });
    loss /= points.length;
    const accuracy = correct / points.length;
    confidence /= points.length;
    const score = Math.max(0, Math.min(0.99, accuracy * 0.76 + confidence * 0.24 - Math.max(0, loss - 0.22) * 0.08));
    return { loss, accuracy, confidence, score };
  }

  function train(points, model, learningRate, regularization, epochs) {
    const next = { w1: model.w1, w2: model.w2, b: model.b };
    for (let epoch = 0; epoch < epochs; epoch += 1) {
      let dw1 = regularization * next.w1;
      let dw2 = regularization * next.w2;
      let db = 0;
      points.forEach((point) => {
        const error = probability(point, next) - point.label;
        dw1 += error * point.x;
        dw2 += error * point.y;
        db += error;
      });
      next.w1 -= learningRate * dw1 / points.length;
      next.w2 -= learningRate * dw2 / points.length;
      next.b -= learningRate * db / points.length;
    }
    return next;
  }

  global.LogisticModel = { logit, metrics, probability, sigmoid, train };
})(typeof window === "undefined" ? globalThis : window);
