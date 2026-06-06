(function registerLinearModel(global) {
  function predict(x, model) {
    return model.w * x + model.b;
  }

  function mse(points, model) {
    return points.reduce((sum, point) => {
      const error = predict(point.x, model) - point.y;
      return sum + error * error;
    }, 0) / points.length;
  }

  function gradient(points, model) {
    const total = points.reduce((result, point) => {
      const error = predict(point.x, model) - point.y;
      result.dw += 2 * error * point.x;
      result.db += 2 * error;
      return result;
    }, { dw: 0, db: 0 });
    return { dw: total.dw / points.length, db: total.db / points.length };
  }

  function score(points, model, baseline) {
    return Math.max(0, Math.min(0.99, 1 - mse(points, model) / baseline));
  }

  function train(points, model, learningRate, steps) {
    const next = { w: model.w, b: model.b };
    let lastGradient = gradient(points, next);
    for (let index = 0; index < steps; index += 1) {
      lastGradient = gradient(points, next);
      next.w -= learningRate * lastGradient.dw;
      next.b -= learningRate * lastGradient.db;
    }
    return { ...next, gradient: lastGradient };
  }

  global.LinearModel = { gradient, mse, predict, score, train };
})(typeof window === "undefined" ? globalThis : window);
