(function registerNeuralNetworkModel(global) {
  function sigmoid(value) {
    return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, value))));
  }

  function makeNet() {
    return {
      h: [
        { wx: 1.7, wy: 1.4, b: -0.15, v: 0.7 },
        { wx: -1.5, wy: -1.2, b: -0.1, v: 0.7 },
        { wx: 1.2, wy: -1.6, b: 0.05, v: -0.6 },
        { wx: -1.4, wy: 1.3, b: 0.08, v: -0.6 },
      ],
      outB: 0,
    };
  }

  function cloneNet(net) {
    return { h: net.h.map((unit) => ({ ...unit })), outB: net.outB };
  }

  function forward(point, net) {
    const hidden = net.h.map((unit) => Math.tanh(unit.wx * point.x + unit.wy * point.y + unit.b));
    const z = hidden.reduce((sum, value, index) => sum + value * net.h[index].v, net.outB);
    return { hidden, p: sigmoid(z), z };
  }

  function metrics(points, net) {
    let loss = 0;
    let correct = 0;
    let confidence = 0;
    points.forEach((point) => {
      const p = Math.min(0.999, Math.max(0.001, forward(point, net).p));
      loss += -(point.label * Math.log(p) + (1 - point.label) * Math.log(1 - p));
      if ((p >= 0.5 ? 1 : 0) === point.label) correct += 1;
      confidence += Math.abs(p - 0.5) * 2;
    });
    loss /= points.length;
    const accuracy = correct / points.length;
    confidence /= points.length;
    const score = Math.max(0, Math.min(0.99, accuracy * 0.74 + confidence * 0.26 - Math.max(0, loss - 0.25) * 0.05));
    return { loss, accuracy, confidence, score };
  }

  function hardestPointIndex(points, net) {
    let bestIndex = 0;
    let bestError = -1;
    points.forEach((point, index) => {
      const error = Math.abs(forward(point, net).p - point.label);
      if (error > bestError) {
        bestError = error;
        bestIndex = index;
      }
    });
    return bestIndex;
  }

  function train(points, net, learningRate, epochs) {
    const next = cloneNet(net);
    for (let epoch = 0; epoch < epochs; epoch += 1) {
      const grads = { h: next.h.map(() => ({ wx: 0, wy: 0, b: 0, v: 0 })), outB: 0 };
      points.forEach((point) => {
        const out = forward(point, next);
        const dz = out.p - point.label;
        grads.outB += dz;
        next.h.forEach((unit, index) => {
          grads.h[index].v += dz * out.hidden[index];
          const dh = dz * unit.v * (1 - out.hidden[index] * out.hidden[index]);
          grads.h[index].wx += dh * point.x;
          grads.h[index].wy += dh * point.y;
          grads.h[index].b += dh;
        });
      });
      next.outB -= learningRate * grads.outB / points.length;
      next.h.forEach((unit, index) => {
        unit.v -= learningRate * grads.h[index].v / points.length;
        unit.wx -= learningRate * grads.h[index].wx / points.length;
        unit.wy -= learningRate * grads.h[index].wy / points.length;
        unit.b -= learningRate * grads.h[index].b / points.length;
      });
    }
    return next;
  }

  global.NeuralNetworkModel = { cloneNet, forward, hardestPointIndex, makeNet, metrics, sigmoid, train };
})(typeof window === "undefined" ? globalThis : window);
