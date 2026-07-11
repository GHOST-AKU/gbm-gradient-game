const fs = require("fs");
const vm = require("vm");

function makeCtx() {
  return new Proxy({
    createImageData(width, height) {
      return { data: new Uint8ClampedArray(width * height * 4) };
    },
    drawImage() {},
    putImageData() {},
  }, { get: (target, property) => (property in target ? target[property] : () => {}) });
}

function makeElement(selector) {
  return {
    selector,
    style: {},
    dataset: {},
    className: "",
    hidden: false,
    classList: { contains() { return false; }, toggle() {}, add() {}, remove() {} },
    textContent: "",
    innerHTML: "",
    value: "",
    checked: false,
    firstElementChild: null,
    listeners: {},
    append() {},
    prepend() {},
    focus() {},
    setAttribute() {},
    setPointerCapture() {},
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    removeEventListener() {},
    getBoundingClientRect() {
      return { width: 900, height: 430, left: 0, top: 0 };
    },
    getContext() {
      return makeCtx();
    },
    querySelector() {
      return makeElement(`${selector} child`);
    },
    querySelectorAll() {
      return [];
    },
  };
}

function evaluate(file, context) {
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}

function loadManifest() {
  const context = { globalThis: null };
  context.globalThis = context;
  vm.createContext(context);
  evaluate("core/lab-manifest.js", context);
  return context.LabManifest;
}

function run(definition) {
  const elements = new Map();
  function element(selector) {
    if (!elements.has(selector)) elements.set(selector, makeElement(selector));
    return elements.get(selector);
  }

  Object.entries(definition.smoke.values || {}).forEach(([selector, value]) => {
    element(selector).value = value;
  });

  const context = {
    console,
    setInterval() { return 1; },
    clearInterval() {},
    window: { addEventListener() {}, removeEventListener() {}, devicePixelRatio: 1 },
    document: {
      body: { classList: { add() {}, remove() {}, toggle() {} } },
      querySelector: element,
      querySelectorAll() { return []; },
      createElement(tagName) { return makeElement(tagName); },
    },
    Math,
    Date,
    requestAnimationFrame(callback) {
      if (typeof callback === "function") callback();
      return 1;
    },
    cancelAnimationFrame() {},
  };
  vm.createContext(context);
  evaluate("core/lab-manifest.js", context);
  evaluate("models/model-core.js", context);
  evaluate(definition.model.replace(/^\.\//, ""), context);
  evaluate("core/lab-runtime.js", context);
  evaluate(definition.lab.replace(/^\.\//, ""), context);

  const results = [];
  for (let level = 0; level < definition.smoke.levels; level += 1) {
    let cleared = false;
    for (let step = 0; step < definition.smoke.maxSteps; step += 1) {
      const handler = element(definition.smoke.step).listeners.click;
      if (typeof handler !== "function") throw new Error(`${definition.id}: primary action is not bound`);
      handler();
      const message = element("#toast").textContent || "";
      if (message.includes("通关")) {
        results.push({
          level,
          steps: element("#roundValue").textContent,
          score: element("#scoreValue").textContent || element("#mseValue").textContent,
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
        steps: element("#roundValue").textContent,
        score: element("#scoreValue").textContent || element("#mseValue").textContent,
        message: element("#toast").textContent,
      });
      break;
    }
    if (level < definition.smoke.levels - 1) {
      const next = element(definition.smoke.next).listeners.click;
      if (typeof next !== "function") throw new Error(`${definition.id}: next-level action is not bound`);
      next();
    }
  }
  return results;
}

const definitions = loadManifest().filter((definition) => definition.smoke);
for (const definition of definitions) {
  const result = run(definition);
  console.log(definition.id, JSON.stringify(result));
  if (result.some((item) => item.fail)) process.exitCode = 1;
}
