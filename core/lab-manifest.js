(function registerLabManifest(global) {
  "use strict";

  const labs = [
    { id: "home", href: "./index.html", label: "首页" },
    {
      id: "gbm",
      href: "./gbm.html",
      label: "GBM 训练场",
      model: "./models/gbm-model.js",
      lab: "./labs/gbm.js",
      smoke: { step: "#stepBtn", next: "#nextLevelBtn", levels: 4, maxSteps: 160 },
    },
    {
      id: "svm",
      href: "./svm.html",
      label: "SVM 训练场",
      model: "./models/svm-model.js",
      lab: "./labs/svm.js",
      smoke: {
        step: "#stepBtn",
        next: "#nextLevelBtn",
        levels: 1,
        maxSteps: 120,
        values: { "#learningRate": "1", "#treeDepth": "2" },
      },
    },
    {
      id: "kmeans",
      href: "./kmeans.html",
      label: "K-Means 训练场",
      model: "./models/kmeans-model.js",
      lab: "./labs/kmeans.js",
      smoke: {
        step: "#stepBtn",
        next: "#nextLevelBtn",
        levels: 3,
        maxSteps: 80,
        values: { "#moveRate": "1" },
      },
    },
    {
      id: "tree",
      href: "./tree.html",
      label: "决策树训练场",
      model: "./models/tree-model.js",
      lab: "./labs/tree.js",
      smoke: {
        step: "#bestBtn",
        next: "#nextLevelBtn",
        levels: 3,
        maxSteps: 20,
        values: { "#threshold": "0", "#maxDepth": "4" },
      },
    },
    {
      id: "linear",
      href: "./linear.html",
      label: "线性回归",
      model: "./models/linear-model.js",
      lab: "./labs/linear.js",
      smoke: {
        step: "#stepBtn",
        next: "#nextLevelBtn",
        levels: 3,
        maxSteps: 80,
        values: { "#learningRate": "0.25", "#batchSize": "3" },
      },
    },
    {
      id: "logistic",
      href: "./logistic.html",
      label: "逻辑回归",
      model: "./models/logistic-model.js",
      lab: "./labs/logistic.js",
      smoke: {
        step: "#stepBtn",
        next: "#nextLevelBtn",
        levels: 3,
        maxSteps: 80,
        values: { "#learningRate": "0.5", "#regularization": "0.01" },
      },
    },
    {
      id: "nn",
      href: "./nn.html",
      label: "神经网络",
      model: "./models/nn-model.js",
      lab: "./labs/nn.js",
      smoke: {
        step: "#stepBtn",
        next: "#nextLevelBtn",
        levels: 3,
        maxSteps: 80,
        values: { "#learningRate": "0.35", "#epochsPerStep": "10" },
      },
    },
    {
      id: "forest",
      href: "./forest.html",
      label: "随机森林",
      model: "./models/forest-model.js",
      lab: "./labs/forest.js",
      smoke: {
        step: "#stepBtn",
        next: "#nextLevelBtn",
        levels: 3,
        maxSteps: 80,
        values: { "#maxDepth": "3", "#featureRate": "1" },
      },
    },
  ];

  global.LabManifest = Object.freeze(labs.map((lab) => Object.freeze({
    ...lab,
    smoke: lab.smoke && Object.freeze({
      ...lab.smoke,
      values: lab.smoke.values && Object.freeze({ ...lab.smoke.values }),
    }),
  })));
})(typeof window === "undefined" ? globalThis : window);
