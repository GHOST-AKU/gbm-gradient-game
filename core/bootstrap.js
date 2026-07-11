(function bootstrapLab(global) {
  "use strict";

  const document = global.document;
  const manifest = global.LabManifest;
  if (!document || !manifest) throw new Error("bootstrap.js requires lab-manifest.js");

  function loadScripts(sources) {
    return Promise.all(sources.map((source) => new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = source;
      script.async = false;
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", () => reject(new Error(`Unable to load ${source}`)), { once: true });
      document.head.append(script);
    })));
  }

  async function start() {
    const id = document.body?.dataset.lab || "home";
    const definition = manifest.find((lab) => lab.id === id);
    if (!definition) throw new Error(`Unknown lab id: ${id}`);

    const sources = definition.model
      ? ["./models/model-core.js", definition.model, "./core/lab-runtime.js", definition.lab]
      : ["./core/lab-runtime.js"];
    await loadScripts(sources);
  }

  start().catch((error) => {
    console.error(error);
    const status = document.querySelector("#toast") || document.querySelector("main");
    if (status) status.textContent = `训练场加载失败：${error.message}`;
  });
})(window);
