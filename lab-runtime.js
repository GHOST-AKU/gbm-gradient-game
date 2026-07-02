(function registerLabRuntime(global) {
  const THEME_KEY = "ml-arcade-theme";
  const LIGHT_THEME = "light";
  const DARK_THEME = "dark";

  function setText(element, value) {
    if (element) element.textContent = value;
  }

  function readStoredTheme() {
    try {
      return global.localStorage && global.localStorage.getItem(THEME_KEY);
    } catch (error) {
      return null;
    }
  }

  function writeStoredTheme(theme) {
    try {
      if (global.localStorage) global.localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      // Theme persistence is a convenience; keep the UI usable if storage is blocked.
    }
  }

  function getThemeRoot() {
    const root = global.document && (global.document.documentElement || global.document.body);
    if (root && !root.dataset) root.dataset = {};
    return root;
  }

  function normalizeTheme(theme) {
    return theme === LIGHT_THEME ? LIGHT_THEME : DARK_THEME;
  }

  function applyTheme(theme, button) {
    const normalized = normalizeTheme(theme);
    const root = getThemeRoot();
    if (root) root.dataset.theme = normalized;
    if (button) {
      const isLight = normalized === LIGHT_THEME;
      button.textContent = isLight ? "暗色" : "浅色";
      button.title = isLight ? "切换到暗色模式" : "切换到浅色模式";
      button.setAttribute && button.setAttribute("aria-label", button.title);
      button.setAttribute && button.setAttribute("aria-pressed", String(isLight));
    }
    return normalized;
  }

  function setupThemeToggle() {
    if (!global.document) return null;
    const root = getThemeRoot();
    if (!root) return null;
    const stored = readStoredTheme();
    let theme = applyTheme(stored || DARK_THEME);
    const button = global.document.createElement("button");
    button.type = "button";
    button.className = "theme-toggle";
    button.addEventListener("click", () => {
      theme = applyTheme(theme === LIGHT_THEME ? DARK_THEME : LIGHT_THEME, button);
      writeStoredTheme(theme);
    });
    applyTheme(theme, button);
    const nav = global.document.querySelector(".lab-switch");
    if (nav && nav.append) nav.append(button);
    else if (global.document.body && global.document.body.append) global.document.body.append(button);
    return button;
  }

  function resetLabScroll() {
    if (!global.document || !global.document.body) return;
    if (global.document.body.classList && global.document.body.classList.contains("home-page")) return;
    if (global.scrollTo) global.scrollTo(0, 0);
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

  function createTrainingLog() {
    if (!global.document) {
      return { add() {}, removeLatest() {}, reset() {}, render() {} };
    }
    const roundLog = global.document.querySelector("#roundLog");
    const fullRoundLog = global.document.querySelector("#fullRoundLog");
    const emptyLog = global.document.querySelector("#emptyLog");
    const modalEmptyLog = global.document.querySelector("#modalEmptyLog");
    const overlay = global.document.querySelector("#logOverlay");
    const expandButton = global.document.querySelector("#expandLogBtn");
    const closeButton = global.document.querySelector("#closeLogBtn");
    const modalRound = global.document.querySelector("#modalRoundLabel");
    const modalBest = global.document.querySelector("#modalBestLabel");
    const modalLevel = global.document.querySelector("#modalLevelLabel");
    const entries = [];

    function updateModalStats() {
      const round = global.document.querySelector("#roundValue, #leafValue")?.textContent?.trim() || "0";
      const best = global.document.querySelector("#bestLabel")?.textContent?.trim() || "最佳 --";
      const level = global.document.querySelector("#levelPicker button.active")?.textContent?.trim() || "--";
      const target = global.document.querySelector("#targetLabel")?.textContent?.trim() || "";
      setText(modalRound, `轮次 ${round}`);
      setText(modalBest, best.startsWith("最佳") ? best : `最佳 ${best}`);
      setText(modalLevel, `关卡 ${level}${target ? ` / ${target}` : ""}`);
    }

    function render() {
      const hasEntries = entries.length > 0;
      if (roundLog) {
        roundLog.innerHTML = "";
        // The sidebar is a current-round receipt. Full history belongs in the
        // expanded log so every lab follows the same compact-log contract.
        entries.slice(0, 1).forEach((message) => {
          const item = global.document.createElement("li");
          item.textContent = message;
          roundLog.append(item);
        });
        roundLog.hidden = !hasEntries;
      }
      if (fullRoundLog) {
        fullRoundLog.innerHTML = "";
        entries.forEach((message) => {
          const item = global.document.createElement("li");
          item.textContent = message;
          fullRoundLog.append(item);
        });
        fullRoundLog.hidden = !hasEntries;
      }
      if (emptyLog) emptyLog.hidden = hasEntries;
      if (modalEmptyLog) modalEmptyLog.hidden = hasEntries;
      updateModalStats();
    }

    function open() {
      if (!overlay) return;
      render();
      overlay.hidden = false;
      global.document.body?.classList.add("modal-open");
      closeButton?.focus();
    }

    function close() {
      if (!overlay) return;
      overlay.hidden = true;
      global.document.body?.classList.remove("modal-open");
      expandButton?.focus();
    }

    expandButton?.addEventListener("click", open);
    closeButton?.addEventListener("click", close);
    overlay?.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });
    global.document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && overlay && !overlay.hidden) close();
    });
    render();

    return {
      add(message) {
        if (message) entries.unshift(message);
        render();
      },
      removeLatest() {
        entries.shift();
        render();
      },
      reset() {
        entries.length = 0;
        render();
      },
      render,
    };
  }

  function setShapeContext(message) {
    setText(global.document?.querySelector("[data-shape-context]"), message);
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

  setupThemeToggle();
  resetLabScroll();

  global.LabRuntime = {
    bindSegmentedPicker,
    createAutoTrainer,
    createTrainingLog,
    makeCanvasFitter,
    renderChoicePicker,
    setActiveSegment,
    setProgress,
    setShapeContext,
    setText,
    resetLabScroll,
    setupThemeToggle,
  };
})(window);
