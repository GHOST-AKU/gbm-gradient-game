(function registerLabRuntime(global) {
  "use strict";

  const document = global.document || globalThis.document;
  const THEME_KEY = "ml-arcade-theme";
  const LIGHT_THEME = "light";
  const DARK_THEME = "dark";
  const DEFAULT_MAX_DPR = 2;
  const LABS = global.LabManifest;
  if (!LABS) throw new Error("lab-runtime.js requires lab-manifest.js");

  function query(selector, root = document) {
    return root && root.querySelector ? root.querySelector(selector) : null;
  }

  function setText(element, value) {
    if (element && element.textContent !== String(value)) element.textContent = value;
  }

  function setTexts(entries) {
    Object.entries(entries || {}).forEach(([selector, value]) => setText(query(selector), value));
  }

  function replaceChildren(element, children = []) {
    if (!element) return;
    if (element.replaceChildren) element.replaceChildren(...children);
    else {
      element.innerHTML = "";
      children.forEach((child) => element.append && element.append(child));
    }
  }

  function makeElement(tagName, properties = {}) {
    if (!document || !document.createElement) return null;
    const element = document.createElement(tagName);
    Object.entries(properties).forEach(([key, value]) => {
      if (key === "dataset") Object.assign(element.dataset || {}, value);
      else if (key === "attributes") {
        Object.entries(value).forEach(([name, content]) => element.setAttribute && element.setAttribute(name, content));
      } else element[key] = value;
    });
    return element;
  }

  function inferLabId() {
    const explicit = document && document.body && document.body.dataset && document.body.dataset.lab;
    if (explicit) return explicit;
    const pathname = global.location && global.location.pathname ? global.location.pathname : "index.html";
    const filename = pathname.split("/").pop() || "index.html";
    return filename === "index.html" || filename === "" ? "home" : filename.replace(/\.html$/i, "");
  }

  function renderNavigation(container = query(".lab-switch"), activeId = inferLabId()) {
    if (!container) return;
    const links = LABS.map((lab) => {
      const link = makeElement("a", { href: lab.href, textContent: lab.label });
      if (!link) return null;
      if (lab.id === activeId) {
        link.className = "active";
        link.setAttribute && link.setAttribute("aria-current", "page");
      }
      return link;
    }).filter(Boolean);
    replaceChildren(container, links);
    if (container.dataset) container.dataset.labNav = activeId;
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
      // Storage is optional. The current page remains usable when it is blocked.
    }
  }

  function getThemeRoot() {
    const root = document && (document.documentElement || document.body);
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
    if (!document) return null;
    const root = getThemeRoot();
    if (!root) return null;
    const existing = query(".theme-toggle");
    if (existing) return existing;
    let theme = applyTheme(readStoredTheme() || DARK_THEME);
    const button = makeElement("button", { type: "button", className: "theme-toggle" });
    if (!button) return null;
    button.addEventListener("click", () => {
      theme = applyTheme(theme === LIGHT_THEME ? DARK_THEME : LIGHT_THEME, button);
      writeStoredTheme(theme);
    });
    applyTheme(theme, button);
    const nav = query(".lab-switch");
    if (nav && nav.append) nav.append(button);
    else if (document.body && document.body.append) document.body.append(button);
    return button;
  }

  function resetLabScroll() {
    if (!document || !document.body) return;
    if (document.body.classList?.contains?.("home-page")) return;
    if (global.scrollTo) global.scrollTo(0, 0);
  }

  function setProgress(element, ratio) {
    if (!element) return;
    const clamped = Math.max(0, Math.min(1, Number(ratio) || 0));
    const width = `${Math.round(clamped * 100)}%`;
    if (element.style.width !== width) element.style.width = width;
  }

  function renderChoicePicker(container, items, activeIndex, onSelect, getLabel = (item) => item.shortName) {
    if (!container) return;
    const buttons = items.map((item, index) => {
      const button = makeElement("button", {
        type: "button",
        textContent: getLabel(item, index),
        className: index === activeIndex ? "active" : "",
      });
      if (!button) return null;
      if (index === activeIndex) button.setAttribute && button.setAttribute("aria-pressed", "true");
      button.addEventListener("click", () => onSelect(index, item));
      return button;
    }).filter(Boolean);
    replaceChildren(container, buttons);
  }

  function setActiveSegment(container, activeValue) {
    if (!container || !container.querySelectorAll) return;
    container.querySelectorAll("button[data-view]").forEach((button) => {
      const active = button.dataset.view === activeValue;
      button.classList.toggle("active", active);
      button.setAttribute && button.setAttribute("aria-pressed", String(active));
    });
  }

  function bindSegmentedPicker(container, onSelect) {
    if (!container) return () => {};
    const handler = (event) => {
      const target = event.target && event.target.closest ? event.target.closest("button[data-view]") : null;
      if (target && (!container.contains || container.contains(target))) onSelect(target.dataset.view, target);
    };
    container.addEventListener("click", handler);
    return () => container.removeEventListener && container.removeEventListener("click", handler);
  }

  function createAutoTrainer({ button, idleLabel, activeLabel, intervalMs, step }) {
    const scheduleTimeout = global.setTimeout
      ? global.setTimeout.bind(global)
      : (typeof setTimeout === "function" ? setTimeout : setInterval);
    const cancelTimeout = global.clearTimeout
      ? global.clearTimeout.bind(global)
      : (typeof clearTimeout === "function" ? clearTimeout : clearInterval);
    let running = false;
    let timer = null;
    let generation = 0;

    const stop = () => {
      running = false;
      generation += 1;
      if (timer !== null) cancelTimeout(timer);
      timer = null;
      setText(button, idleLabel);
    };

    const tick = async (token) => {
      if (!running || token !== generation) return;
      const startedAt = global.performance && global.performance.now ? global.performance.now() : Date.now();
      try {
        await step();
      } catch (error) {
        stop();
        throw error;
      }
      if (!running || token !== generation) return;
      const elapsed = (global.performance && global.performance.now ? global.performance.now() : Date.now()) - startedAt;
      timer = scheduleTimeout(() => tick(token), Math.max(0, intervalMs - elapsed));
    };

    const start = () => {
      if (running) return;
      running = true;
      generation += 1;
      setText(button, activeLabel);
      tick(generation);
    };

    return {
      isRunning: () => running,
      start,
      stop,
      toggle: () => (running ? stop() : start()),
    };
  }

  function ensureTrainingLogShell() {
    if (!document) return;
    const host = query("[data-training-log]");
    if (!host) return;
    if (host.dataset && host.dataset.logReady === "true") return;
    const emptyMessage = host.dataset.emptyMessage || "还没有训练记录。";
    const initialStatus = host.dataset.initialStatus || "";
    host.className = "panel-block log-card";
    if (host.dataset) host.dataset.logReady = "true";
    host.setAttribute && host.setAttribute("aria-label", "训练记录");
    host.innerHTML = [
      '<div class="panel-heading">',
      "<h2>训练记录</h2>",
      '<button id="expandLogBtn" class="mini-button" type="button" aria-haspopup="dialog">全屏</button>',
      '<span id="bestLabel">等待开始</span>',
      "</div>",
      initialStatus ? `<p id="latestText" class="log-current" role="status">${initialStatus}</p>` : "",
      `<p id="emptyLog" class="empty-log">${emptyMessage}</p>`,
      '<ol id="roundLog" class="round-log"></ol>',
    ].join("");

    if (!query("#logOverlay") && document.body && document.body.append) {
      const overlay = makeElement("section", {
        id: "logOverlay",
        className: "log-overlay",
        hidden: true,
        attributes: { role: "dialog", "aria-modal": "true", "aria-labelledby": "logOverlayTitle" },
      });
      if (overlay) {
        overlay.innerHTML = [
          '<div class="log-modal">',
          '<div class="modal-heading"><div><p class="eyebrow">Training Log</p><h2 id="logOverlayTitle">训练记录</h2></div>',
          '<button id="closeLogBtn" class="mini-button danger" type="button">关闭</button></div>',
          '<div class="modal-stats"><span id="modalRoundLabel">轮次 0</span><span id="modalBestLabel">最佳 --</span><span id="modalLevelLabel">关卡 --</span></div>',
          '<p id="modalEmptyLog" class="empty-log">还没有训练记录。</p>',
          '<ol id="fullRoundLog" class="full-round-log"></ol>',
          "</div>",
        ].join("");
        document.body.append(overlay);
      }
    }
  }

  function createTrainingLog() {
    ensureTrainingLogShell();
    if (!document) return { add() {}, removeLatest() {}, replaceLatest() {}, reset() {}, render() {}, open() {}, close() {}, entries: [] };
    const roundLog = query("#roundLog");
    const fullRoundLog = query("#fullRoundLog");
    const emptyLog = query("#emptyLog");
    const modalEmptyLog = query("#modalEmptyLog");
    const overlay = query("#logOverlay");
    const expandButton = query("#expandLogBtn");
    const closeButton = query("#closeLogBtn");
    const modalRound = query("#modalRoundLabel");
    const modalBest = query("#modalBestLabel");
    const modalLevel = query("#modalLevelLabel");
    const logCard = query(".log-card");
    const entries = [];
    let fullLogDirty = true;

    function updateModalStats() {
      const round = query("#roundValue, #leafValue")?.textContent?.trim() || "0";
      const best = query("#bestLabel")?.textContent?.trim() || "最佳 --";
      const level = query("#levelPicker button.active")?.textContent?.trim() || "--";
      const target = query("#targetLabel")?.textContent?.trim() || "";
      setText(modalRound, `轮次 ${round}`);
      setText(modalBest, best.startsWith("最佳") ? best : `最佳 ${best}`);
      setText(modalLevel, `关卡 ${level}${target ? ` / ${target}` : ""}`);
    }

    function makeLogItem(message) {
      return makeElement("li", { textContent: message });
    }

    function updateVisibility() {
      const hasEntries = entries.length > 0;
      if (roundLog) roundLog.hidden = !hasEntries;
      if (fullRoundLog) fullRoundLog.hidden = !hasEntries;
      if (emptyLog) emptyLog.hidden = hasEntries;
      if (modalEmptyLog) modalEmptyLog.hidden = hasEntries;
      if (logCard && logCard.classList) logCard.classList.toggle("has-logs", hasEntries);
    }

    function renderLatest() {
      replaceChildren(roundLog, entries.length ? [makeLogItem(entries[0])].filter(Boolean) : []);
      updateVisibility();
    }

    function renderFull() {
      if (!fullLogDirty) return;
      replaceChildren(fullRoundLog, entries.map(makeLogItem).filter(Boolean));
      fullLogDirty = false;
      updateVisibility();
    }

    function render() {
      renderLatest();
      if (overlay && !overlay.hidden) renderFull();
      updateModalStats();
    }

    function open() {
      if (!overlay) return;
      renderFull();
      updateModalStats();
      overlay.hidden = false;
      document.body?.classList.add("modal-open");
      closeButton?.focus();
    }

    function close({ restoreFocus = true } = {}) {
      if (!overlay) return;
      overlay.hidden = true;
      document.body?.classList.remove("modal-open");
      if (restoreFocus) expandButton?.focus();
    }

    const handleClose = () => close();
    const handleOverlayClick = (event) => {
      if (event.target === overlay) close();
    };
    const handleKeydown = (event) => {
      if (event.key === "Escape" && overlay && !overlay.hidden) close();
    };
    expandButton?.addEventListener("click", open);
    closeButton?.addEventListener("click", handleClose);
    overlay?.addEventListener("click", handleOverlayClick);
    document?.addEventListener?.("keydown", handleKeydown);
    render();

    return {
      entries,
      add(message) {
        if (!message) return;
        entries.unshift(message);
        fullLogDirty = true;
        renderLatest();
        if (overlay && !overlay.hidden) renderFull();
      },
      removeLatest() {
        entries.shift();
        fullLogDirty = true;
        renderLatest();
        if (overlay && !overlay.hidden) renderFull();
      },
      replaceLatest(message) {
        if (!entries.length) entries.unshift(message);
        else entries[0] = message;
        fullLogDirty = true;
        renderLatest();
        if (overlay && !overlay.hidden) renderFull();
      },
      reset() {
        entries.length = 0;
        fullLogDirty = true;
        replaceChildren(roundLog);
        replaceChildren(fullRoundLog);
        render();
      },
      render,
      open,
      close,
      dispose() {
        expandButton?.removeEventListener?.("click", open);
        closeButton?.removeEventListener?.("click", handleClose);
        overlay?.removeEventListener?.("click", handleOverlayClick);
        document?.removeEventListener?.("keydown", handleKeydown);
        close({ restoreFocus: false });
      },
    };
  }

  function setShapeContext(message) {
    setText(query("[data-shape-context]"), message);
  }

  function createRenderScheduler(render) {
    const scheduleFrame = global.requestAnimationFrame
      ? global.requestAnimationFrame.bind(global)
      : (typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : (callback) => (global.setTimeout ? global.setTimeout(callback, 16) : callback()));
    const cancelFrame = global.cancelAnimationFrame
      ? global.cancelAnimationFrame.bind(global)
      : (typeof cancelAnimationFrame === "function"
        ? cancelAnimationFrame
        : (handle) => global.clearTimeout && global.clearTimeout(handle));
    let frame = null;
    let pending = false;
    let disposed = false;

    function request() {
      if (disposed || pending) return;
      pending = true;
      frame = scheduleFrame(() => {
        frame = null;
        pending = false;
        if (!disposed) render();
      });
    }

    function flush() {
      if (disposed) return;
      if (pending && frame !== null) cancelFrame(frame);
      frame = null;
      pending = false;
      render();
    }

    function dispose() {
      disposed = true;
      if (pending && frame !== null) cancelFrame(frame);
      frame = null;
      pending = false;
    }

    return { request, flush, dispose, isPending: () => pending };
  }

  function createCanvasSurface(canvas, context, draw, options = {}) {
    const minWidth = options.minWidth ?? 1;
    const minHeight = options.minHeight ?? 1;
    const maxDpr = options.maxDpr ?? DEFAULT_MAX_DPR;
    let metrics = { width: 0, height: 0, pixelRatio: 1, rect: null };
    let observer = null;
    let started = false;
    const scheduler = createRenderScheduler(() => draw(metrics));

    function measure() {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(minWidth, Math.floor(rect.width || canvas.clientWidth || minWidth));
      const height = Math.max(minHeight, Math.floor(rect.height || canvas.clientHeight || minHeight));
      const pixelRatio = Math.max(1, Math.min(maxDpr, global.devicePixelRatio || 1));
      return { width, height, pixelRatio, rect };
    }

    function resize() {
      const next = measure();
      const pixelWidth = Math.max(1, Math.round(next.width * next.pixelRatio));
      const pixelHeight = Math.max(1, Math.round(next.height * next.pixelRatio));
      const changed = canvas.width !== pixelWidth || canvas.height !== pixelHeight || metrics.pixelRatio !== next.pixelRatio;
      metrics = next;
      if (changed) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        context.setTransform(next.pixelRatio, 0, 0, next.pixelRatio, 0, 0);
        context.imageSmoothingEnabled = false;
      }
      scheduler.request();
      return changed;
    }

    function start() {
      if (started) return;
      started = true;
      resize();
      if (global.ResizeObserver) {
        observer = new global.ResizeObserver(resize);
        observer.observe(canvas.parentElement || canvas);
      } else if (global.addEventListener) global.addEventListener("resize", resize, { passive: true });
    }

    function dispose() {
      observer?.disconnect();
      observer = null;
      if (!global.ResizeObserver && global.removeEventListener) global.removeEventListener("resize", resize);
      scheduler.dispose();
      started = false;
    }

    return {
      start,
      resize,
      requestDraw: scheduler.request,
      flush: scheduler.flush,
      dispose,
      getMetrics: () => metrics,
    };
  }

  function makeCanvasFitter(canvas, context, draw, options = {}) {
    const surface = createCanvasSurface(canvas, context, draw, options);
    const fitCanvas = () => surface.resize();
    fitCanvas.requestDraw = surface.requestDraw;
    fitCanvas.destroy = surface.dispose;
    fitCanvas.surface = surface;
    return fitCanvas;
  }

  function createHistory({ limit = Number.POSITIVE_INFINITY } = {}) {
    const entries = [];
    return {
      push(snapshot) {
        entries.push(snapshot);
        if (entries.length > limit) entries.splice(0, entries.length - limit);
      },
      pop: () => entries.pop(),
      peek: () => entries[entries.length - 1],
      clear() { entries.length = 0; },
      get size() { return entries.length; },
    };
  }

  function createMemo(compute) {
    let hasValue = false;
    let cachedKey;
    let cachedValue;
    return {
      get(key) {
        if (!hasValue || key !== cachedKey) {
          cachedKey = key;
          cachedValue = compute(key);
          hasValue = true;
        }
        return cachedValue;
      },
      invalidate() {
        hasValue = false;
        cachedKey = undefined;
        cachedValue = undefined;
      },
    };
  }

  function createFieldRenderer(context) {
    const offscreen = document && document.createElement ? document.createElement("canvas") : null;
    const offscreenContext = offscreen && offscreen.getContext ? offscreen.getContext("2d", { alpha: true }) : null;
    let gridKey;
    let grid = null;
    let columns = 0;
    let rows = 0;
    let imageKey;

    function getGrid({ key, columns: nextColumns, rows: nextRows, sample }) {
      const nextKey = `${key}|${nextColumns}x${nextRows}`;
      if (grid && gridKey === nextKey) return grid;
      columns = nextColumns;
      rows = nextRows;
      grid = new Float64Array(columns * rows);
      let offset = 0;
      for (let row = 0; row < rows; row += 1) {
        const y = (row + 0.5) / rows;
        for (let column = 0; column < columns; column += 1) {
          grid[offset] = sample((column + 0.5) / columns, y, column, row);
          offset += 1;
        }
      }
      gridKey = nextKey;
      imageKey = undefined;
      return grid;
    }

    function draw({ key, colorKey = "default", bounds, columns: nextColumns, rows: nextRows, sample, color }) {
      const values = getGrid({ key, columns: nextColumns, rows: nextRows, sample });
      const nextImageKey = `${gridKey}|${colorKey}`;
      const canRasterize = Boolean(
        offscreenContext
        && offscreenContext.createImageData
        && offscreenContext.putImageData
        && context.drawImage,
      );
      if (!canRasterize) {
        const cellWidth = bounds.width / columns;
        const cellHeight = bounds.height / rows;
        values.forEach((value, index) => {
          const rgba = color(value, index % columns, Math.floor(index / columns));
          context.fillStyle = `rgba(${rgba[0]},${rgba[1]},${rgba[2]},${rgba[3] / 255})`;
          context.fillRect(
            bounds.left + (index % columns) * cellWidth,
            bounds.top + Math.floor(index / columns) * cellHeight,
            Math.ceil(cellWidth),
            Math.ceil(cellHeight),
          );
        });
        return values;
      }

      if (imageKey !== nextImageKey) {
        offscreen.width = columns;
        offscreen.height = rows;
        const imageData = offscreenContext.createImageData(columns, rows);
        values.forEach((value, index) => {
          const rgba = color(value, index % columns, Math.floor(index / columns));
          const offset = index * 4;
          imageData.data[offset] = rgba[0];
          imageData.data[offset + 1] = rgba[1];
          imageData.data[offset + 2] = rgba[2];
          imageData.data[offset + 3] = rgba[3];
        });
        offscreenContext.putImageData(imageData, 0, 0);
        imageKey = nextImageKey;
      }
      context.save();
      context.imageSmoothingEnabled = false;
      context.drawImage(offscreen, bounds.left, bounds.top, bounds.width, bounds.height);
      context.restore();
      return values;
    }

    function invalidate() {
      gridKey = undefined;
      grid = null;
      imageKey = undefined;
    }

    return { draw, getGrid, invalidate };
  }

  function createCartesianPlane(canvas, options = {}) {
    const xDomain = options.xDomain || [-1, 1];
    const yDomain = options.yDomain || [-1, 1];
    const padding = { left: 4, top: 4, right: 6, bottom: 10, ...(options.padding || {}) };

    function bounds(rect = canvas.getBoundingClientRect()) {
      const left = padding.left;
      const top = padding.top;
      const right = Math.max(left + 1, rect.width - padding.right);
      const bottom = Math.max(top + 1, rect.height - padding.bottom);
      return { left, top, right, bottom, width: right - left, height: bottom - top };
    }

    function toX(value, area) {
      return area.left + ((value - xDomain[0]) / (xDomain[1] - xDomain[0])) * area.width;
    }

    function toY(value, area) {
      return area.bottom - ((value - yDomain[0]) / (yDomain[1] - yDomain[0])) * area.height;
    }

    function fromCanvas(x, y, area) {
      return {
        x: xDomain[0] + ((x - area.left) / area.width) * (xDomain[1] - xDomain[0]),
        y: yDomain[0] + ((area.bottom - y) / area.height) * (yDomain[1] - yDomain[0]),
      };
    }

    function fromUnit(x, y) {
      return {
        x: xDomain[0] + x * (xDomain[1] - xDomain[0]),
        y: yDomain[1] - y * (yDomain[1] - yDomain[0]),
      };
    }

    return { bounds, toX, toY, fromCanvas, fromUnit, xDomain, yDomain };
  }

  function drawGrid(context, bounds, options = {}) {
    const columns = options.columns ?? 8;
    const rows = options.rows ?? 4;
    context.save();
    context.strokeStyle = options.color || "rgba(139,211,255,0.14)";
    context.lineWidth = options.lineWidth || 2;
    context.beginPath();
    for (let index = 0; index <= columns; index += 1) {
      const x = Math.round(bounds.left + (bounds.width / columns) * index) + 0.5;
      context.moveTo(x, bounds.top);
      context.lineTo(x, bounds.bottom);
    }
    for (let index = 0; index <= rows; index += 1) {
      const y = Math.round(bounds.top + (bounds.height / rows) * index) + 0.5;
      context.moveTo(bounds.left, y);
      context.lineTo(bounds.right, y);
    }
    context.stroke();
    context.restore();
  }

  function drawAxes(context, bounds, options = {}) {
    context.save();
    context.strokeStyle = options.strokeColor || "rgba(255,243,214,0.58)";
    context.fillStyle = options.textColor || "rgba(255,243,214,0.72)";
    context.lineWidth = options.lineWidth || 3;
    context.beginPath();
    context.moveTo(bounds.left, bounds.top);
    context.lineTo(bounds.left, bounds.bottom);
    context.lineTo(bounds.right, bounds.bottom);
    context.stroke();
    context.font = options.font || "12px Courier New, Microsoft YaHei, monospace";
    context.textAlign = "right";
    context.textBaseline = options.xBaseline || "alphabetic";
    context.fillText(options.xLabel || "特征 x1", bounds.right - 8, bounds.bottom - (options.xOffset ?? 10));
    context.textAlign = "left";
    context.textBaseline = options.yBaseline || "alphabetic";
    context.fillText(options.yLabel || "特征 x2", bounds.left + 10, bounds.top + (options.yOffset ?? 18));
    context.restore();
  }

  function drawSeries(context, values, bounds, options = {}) {
    if (!values || !values.length) return;
    const valueAt = options.value || ((value) => value);
    let minimum = options.min;
    let maximum = options.max;
    if (minimum === undefined || maximum === undefined) {
      let observedMinimum = 0;
      let observedMaximum = 1;
      for (let index = 0; index < values.length; index += 1) {
        const value = valueAt(values[index], index);
        if (value < observedMinimum) observedMinimum = value;
        if (value > observedMaximum) observedMaximum = value;
      }
      minimum ??= observedMinimum;
      maximum ??= observedMaximum;
    }
    const range = Math.max(maximum - minimum, Number.EPSILON);
    const xAt = (index) => bounds.left + (index / Math.max(1, values.length - 1)) * bounds.width;
    const yAt = (value) => bounds.bottom - ((value - minimum) / range) * bounds.height;
    context.save();
    (options.guides || []).forEach((guide) => {
      const y = yAt(guide.value);
      context.strokeStyle = guide.color || "rgba(255,212,71,0.85)";
      context.lineWidth = guide.lineWidth || 3;
      context.setLineDash(guide.dash || []);
      context.beginPath();
      context.moveTo(bounds.left, y);
      context.lineTo(bounds.right, y);
      context.stroke();
    });
    context.setLineDash(options.dash || []);
    context.strokeStyle = options.color || "#22f0a4";
    context.lineWidth = options.lineWidth || 5;
    context.lineJoin = options.lineJoin || "round";
    context.lineCap = options.lineCap || "round";
    context.beginPath();
    for (let index = 0; index < values.length; index += 1) {
      const value = valueAt(values[index], index);
      const x = xAt(index);
      const y = yAt(value);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
    const pointSize = options.pointSize || 0;
    if (pointSize > 0) {
      context.fillStyle = options.pointColor || options.color || "#22f0a4";
      const half = pointSize / 2;
      for (let index = 0; index < values.length; index += 1) {
        context.fillRect(xAt(index) - half, yAt(valueAt(values[index], index)) - half, pointSize, pointSize);
      }
    }
    context.restore();
  }

  function createLabController(options) {
    const levelPicker = options.levelPicker || query("#levelPicker");
    const viewPicker = options.viewPicker || query("#viewPicker");
    const canvas = options.canvas || query("#chart");
    const context = options.context || (canvas && canvas.getContext && canvas.getContext("2d"));
    const trainingLog = options.trainingLog === false ? null : createTrainingLog();
    const bindings = [];
    let started = false;

    function bind(element, event, handler, eventOptions) {
      if (!element || !handler) return;
      element.addEventListener(event, handler, eventOptions);
      bindings.push(() => element.removeEventListener && element.removeEventListener(event, handler, eventOptions));
    }

    const surface = canvas && context && options.draw
      ? createCanvasSurface(canvas, context, options.draw, options.canvasOptions)
      : null;
    const autoTrainer = options.auto
      ? createAutoTrainer({
        button: options.auto.button || query("#autoBtn"),
        idleLabel: options.auto.idleLabel || "自动训练",
        activeLabel: options.auto.activeLabel || "暂停自动",
        intervalMs: options.auto.intervalMs || 600,
        step: options.auto.step || options.actions?.step,
      })
      : null;

    function currentLevelIndex() {
      return Number(options.getLevelIndex ? options.getLevelIndex() : 0);
    }

    function renderLevels() {
      if (!options.levels || !levelPicker) return;
      renderChoicePicker(levelPicker, options.levels, currentLevelIndex(), (index, level) => {
        autoTrainer?.stop();
        options.setLevelIndex?.(index, level);
        reset();
      });
    }

    function selectView(value) {
      setActiveSegment(viewPicker, value);
      options.setView?.(value);
      surface?.requestDraw();
    }

    function reset() {
      autoTrainer?.stop();
      options.reset?.();
      renderLevels();
      surface?.requestDraw();
    }

    function nextLevel() {
      if (!options.levels || !options.levels.length) return;
      autoTrainer?.stop();
      const next = (currentLevelIndex() + 1) % options.levels.length;
      options.setLevelIndex?.(next, options.levels[next]);
      reset();
    }

    function start() {
      if (started) return controller;
      started = true;
      surface?.start();
      const actions = options.actions || {};
      bind(actions.stepButton || query("#stepBtn"), "click", actions.step);
      bind(actions.undoButton || query("#undoBtn"), "click", actions.undo);
      bind(actions.resetButton || query("#resetBtn"), "click", reset);
      bind(actions.nextButton || query("#nextLevelBtn"), "click", actions.next || nextLevel);
      if (autoTrainer) bind(options.auto.button || query("#autoBtn"), "click", autoTrainer.toggle);
      if (viewPicker && options.setView) bindings.push(bindSegmentedPicker(viewPicker, selectView));
      (options.inputs || []).forEach((input) => {
        const descriptor = input.element ? input : { element: input[0], handler: input[1] };
        bind(descriptor.element, descriptor.event || "input", descriptor.handler, descriptor.options);
      });
      (options.bindings || []).forEach((descriptor) => {
        bind(descriptor.element, descriptor.event, descriptor.handler, descriptor.options);
      });
      reset();
      return controller;
    }

    function dispose() {
      autoTrainer?.stop();
      surface?.dispose();
      bindings.splice(0).forEach((unbind) => unbind());
      trainingLog?.dispose();
      started = false;
    }

    const controller = {
      start,
      dispose,
      reset,
      nextLevel,
      renderLevels,
      selectView,
      render: () => surface?.requestDraw(),
      flushRender: () => surface?.flush(),
      stopAuto: () => autoTrainer?.stop(),
      toggleAuto: () => autoTrainer?.toggle(),
      isAutoRunning: () => Boolean(autoTrainer?.isRunning()),
      trainingLog,
      autoTrainer,
      surface,
    };
    return controller;
  }

  renderNavigation();
  ensureTrainingLogShell();
  setupThemeToggle();
  resetLabScroll();

  global.LabRuntime = Object.freeze({
    LABS,
    applyTheme,
    bindSegmentedPicker,
    createAutoTrainer,
    createCanvasSurface,
    createCartesianPlane,
    createFieldRenderer,
    createHistory,
    createLabController,
    createMemo,
    createRenderScheduler,
    createTrainingLog,
    drawAxes,
    drawGrid,
    drawSeries,
    ensureTrainingLogShell,
    makeCanvasFitter,
    query,
    renderChoicePicker,
    renderNavigation,
    resetLabScroll,
    setActiveSegment,
    setProgress,
    setShapeContext,
    setText,
    setTexts,
    setupThemeToggle,
  });
})(window);
