(function registerLabRuntime(global) {
  function setText(element, value) {
    if (element) element.textContent = value;
  }

  function setProgress(element, ratio) {
    if (!element) return;
    const clamped = Math.max(0, Math.min(1, ratio || 0));
    element.style.width = `${Math.round(clamped * 100)}%`;
  }

  function renderChoicePicker(container, items, activeIndex, onSelect, getLabel = (item) => item.shortName) {
    if (!container) return;
    container.innerHTML = "";
    items.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = getLabel(item, index);
      button.className = index === activeIndex ? "active" : "";
      button.addEventListener("click", () => onSelect(index, item));
      container.append(button);
    });
  }

  function setActiveSegment(container, activeValue) {
    if (!container) return;
    container.querySelectorAll("button[data-view]").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === activeValue);
    });
  }

  function bindSegmentedPicker(container, onSelect) {
    if (!container) return;
    container.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-view]");
      if (button) onSelect(button.dataset.view, button);
    });
  }

  function createAutoTrainer({ button, idleLabel, activeLabel, intervalMs, step }) {
    let timer = null;
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      setText(button, idleLabel);
    };
    const start = () => {
      if (timer) return;
      setText(button, activeLabel);
      step();
      timer = setInterval(step, intervalMs);
    };
    return {
      isRunning: () => Boolean(timer),
      start,
      stop,
      toggle: () => (timer ? stop() : start()),
    };
  }

  function makeCanvasFitter(canvas, ctx, draw, options = {}) {
    const minWidth = options.minWidth || 320;
    const minHeight = options.minHeight || 260;
    return function fitCanvas() {
      const rect = canvas.getBoundingClientRect();
      const scale = global.devicePixelRatio || 1;
      canvas.width = Math.max(minWidth, Math.floor(rect.width * scale));
      canvas.height = Math.max(minHeight, Math.floor(rect.height * scale));
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.imageSmoothingEnabled = false;
      draw();
    };
  }

  global.LabRuntime = {
    bindSegmentedPicker,
    createAutoTrainer,
    makeCanvasFitter,
    renderChoicePicker,
    setActiveSegment,
    setProgress,
    setText,
  };
})(window);
