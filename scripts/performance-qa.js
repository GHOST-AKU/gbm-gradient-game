async (page) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://127.0.0.1:4173/forest.html");
  await page.waitForFunction(() => window.LabRuntime && document.querySelector("#stepBtn"));
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  const result = await page.evaluate(async () => {
    const stepButton = document.querySelector("#stepBtn");
    const nodeCountBefore = document.querySelectorAll("*").length;
    const durations = [];
    const longTasks = [];
    const observer = typeof PerformanceObserver === "function"
      ? new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => longTasks.push(entry.duration));
      })
      : null;
    try {
      observer?.observe({ type: "longtask", buffered: true });
    } catch (error) {
      // Some browsers do not expose the long-task entry type.
    }

    for (let index = 0; index < 100; index += 1) {
      const started = performance.now();
      stepButton.click();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      durations.push(performance.now() - started);
    }
    observer?.disconnect();

    const ordered = [...durations].sort((left, right) => left - right);
    const percentile = (ratio) => ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * ratio))];
    const closedLogItems = document.querySelectorAll("#roundLog li, #fullRoundLog li").length;
    const nodeCountClosed = document.querySelectorAll("*").length;

    const marginButton = document.querySelector('#viewPicker button[data-view="margin"]');
    const marginStarted = performance.now();
    marginButton.click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const marginRender = performance.now() - marginStarted;

    document.querySelector("#expandLogBtn").click();
    const expandedLogItems = document.querySelectorAll("#fullRoundLog li").length;
    const nodeCountExpanded = document.querySelectorAll("*").length;
    document.querySelector("#closeLogBtn").click();

    const canvas = document.querySelector("#chart");
    const rect = canvas.getBoundingClientRect();
    return {
      rounds: Number(document.querySelector("#roundValue").textContent),
      stepMs: {
        p50: Number(percentile(0.5).toFixed(3)),
        p95: Number(percentile(0.95).toFixed(3)),
        max: Number(Math.max(...durations).toFixed(3)),
      },
      marginRenderMs: Number(marginRender.toFixed(3)),
      longTasks: longTasks.map((duration) => Number(duration.toFixed(3))),
      nodes: {
        before: nodeCountBefore,
        closed: nodeCountClosed,
        expanded: nodeCountExpanded,
      },
      logItems: {
        closed: closedLogItems,
        expanded: expandedLogItems,
      },
      canvas: {
        backingWidth: canvas.width,
        backingHeight: canvas.height,
        cssWidth: rect.width,
        cssHeight: rect.height,
        devicePixelRatio: window.devicePixelRatio,
      },
    };
  });

  const failures = [];
  if (result.rounds !== 100) failures.push(`rounds=${result.rounds}`);
  if (result.stepMs.p95 > 50 || result.stepMs.max > 100) failures.push(`step latency=${JSON.stringify(result.stepMs)}`);
  if (result.marginRenderMs > 50) failures.push(`margin render=${result.marginRenderMs}ms`);
  if (result.longTasks.length) failures.push(`long tasks=${result.longTasks.join(",")}`);
  if (result.logItems.closed !== 1 || result.logItems.expanded !== 100) failures.push(`log items=${JSON.stringify(result.logItems)}`);
  if (result.nodes.closed > result.nodes.before + 5) failures.push(`closed DOM growth=${JSON.stringify(result.nodes)}`);
  if (result.canvas.backingWidth < 1 || result.canvas.backingHeight < 1) failures.push("empty canvas");
  if (failures.length) throw new Error(`Performance QA failed: ${failures.join(" | ")}`);
  return result;
}
