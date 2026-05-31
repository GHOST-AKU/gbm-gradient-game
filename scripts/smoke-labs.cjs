const fs = require("fs");
const vm = require("vm");

function makeCtx() {
  return new Proxy({}, { get: (target, prop) => (prop in target ? target[prop] : () => {}) });
}

function makeEl(selector) {
  return {
    selector,
    style: {},
    dataset: {},
    className: "",
    hidden: false,
    classList: { toggle() {}, add() {}, remove() {} },
    textContent: "",
    innerHTML: "",
    value: "",
    checked: false,
    firstElementChild: null,
    listeners: {},
    append() {},
    prepend() {},
    focus() {},
    setPointerCapture() {},
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    getBoundingClientRect() {
      return { width: 900, height: 430, left: 0, top: 0 };
    },
    getContext() {
      return makeCtx();
    },
    querySelector() {
      return makeEl(`${selector} child`);
    },
    querySelectorAll() {
      return [];
    },
  };
}

function run(file, options) {
  const els = new Map();
  function el(selector) {
    if (!els.has(selector)) els.set(selector, makeEl(selector));
    return els.get(selector);
  }

  Object.entries(options.values || {}).forEach(([selector, value]) => {
    el(selector).value = value;
  });

  const context = {
    console,
    setInterval() { return 1; },
    clearInterval() {},
    window: { addEventListener() {}, devicePixelRatio: 1 },
    document: {
      body: { classList: { add() {}, remove() {}, toggle() {} } },
      querySelector: el,
      querySelectorAll() { return []; },
      createElement(tagName) { return makeEl(tagName); },
    },
    Math,
    Date,
    requestAnimationFrame(fn) { if (typeof fn === "function") fn(); },
    cancelAnimationFrame() {},
  };

  vm.createContext(context);
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });

  const results = [];
  for (let level = 0; level < options.levels; level += 1) {
    let cleared = false;
    for (let step = 0; step < options.maxSteps; step += 1) {
      el(options.step).listeners.click();
      const message = el("#toast").textContent || "";
      if (message.includes("通关")) {
        results.push({
          level,
          steps: el("#roundValue").textContent,
          score: el("#scoreValue").textContent || el("#mseValue").textContent,
          message,
        });
        cleared = true;
        break;
      }
    }
    if (!cleared) {
      results.push({
        level,
        fail: true,
        steps: el("#roundValue").textContent,
        score: el("#scoreValue").textContent || el("#mseValue").textContent,
        message: el("#toast").textContent,
      });
      break;
    }
    if (level < options.levels - 1) el(options.next).listeners.click();
  }
  return results;
}

const specs = [
  ["app.js", { step: "#stepBtn", next: "#nextLevelBtn", levels: 4, maxSteps: 160 }],
  ["kmeans.js", { step: "#stepBtn", next: "#nextLevelBtn", levels: 3, maxSteps: 80, values: { "#moveRate": "1" } }],
  ["linear.js", { step: "#stepBtn", next: "#nextLevelBtn", levels: 3, maxSteps: 80, values: { "#learningRate": "0.25", "#batchSize": "3" } }],
  ["logistic.js", { step: "#stepBtn", next: "#nextLevelBtn", levels: 3, maxSteps: 80, values: { "#learningRate": "0.5", "#regularization": "0.01" } }],
  ["nn.js", { step: "#stepBtn", next: "#nextLevelBtn", levels: 3, maxSteps: 80, values: { "#learningRate": "0.35", "#epochsPerStep": "10" } }],
  ["forest.js", { step: "#stepBtn", next: "#nextLevelBtn", levels: 3, maxSteps: 80, values: { "#maxDepth": "3", "#featureRate": "1" } }],
];

for (const [file, options] of specs) {
  const result = run(file, options);
  console.log(file, JSON.stringify(result));
  if (result.some((item) => item.fail)) process.exitCode = 1;
}
