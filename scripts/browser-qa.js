async (page) => {
  const ids = ["gbm", "svm", "kmeans", "tree", "linear", "logistic", "nn", "forest"];
  const results = [];
  const errors = [];

  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      errors.push(`console:${message.type()}:${message.text()}`);
    }
  });
  page.on("pageerror", (error) => errors.push(`pageerror:${error.message}`));
  page.on("requestfailed", (request) => errors.push(`requestfailed:${request.url()}`));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => localStorage.clear());

  await page.goto("http://127.0.0.1:4173/index.html");
  await page.waitForFunction(() => window.LabRuntime && document.querySelector(".theme-toggle"));
  const home = await page.evaluate(() => ({
    labCards: document.querySelectorAll(".lab-grid a").length,
    themeToggle: Boolean(document.querySelector(".theme-toggle")),
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  }));
  await page.screenshot({ path: "output/playwright/refactor-after-home.png" });

  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index];
    await page.goto(`http://127.0.0.1:4173/${id}.html`);
    await page.waitForFunction(() => window.LabRuntime && document.querySelector("#chart")?.width > 0);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    if (index === 0) await page.locator(".theme-toggle").click();

    const before = await page.evaluate(() => {
      const canvas = document.querySelector("#chart");
      const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = new Set();
      let nonTransparent = 0;
      const stride = Math.max(4, Math.floor(data.length / 20000 / 4) * 4);
      for (let offset = 0; offset < data.length; offset += stride) {
        if (data[offset + 3]) nonTransparent += 1;
        colors.add(`${data[offset]},${data[offset + 1]},${data[offset + 2]},${data[offset + 3]}`);
      }
      const rect = canvas.getBoundingClientRect();
      return {
        round: document.querySelector("#roundValue").textContent,
        score: (document.querySelector("#scoreValue") || document.querySelector("#mseValue")).textContent,
        navLinks: document.querySelectorAll(".lab-switch a").length,
        activeNav: document.querySelectorAll('.lab-switch a.active[aria-current="page"]').length,
        theme: document.documentElement.dataset.theme,
        canvas: {
          width: canvas.width,
          height: canvas.height,
          cssWidth: rect.width,
          cssHeight: rect.height,
          colors: colors.size,
          nonTransparent,
        },
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });

    const primary = id === "tree" ? "#bestBtn" : "#stepBtn";
    await page.locator(primary).click();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const trained = await page.evaluate(() => ({
      round: document.querySelector("#roundValue").textContent,
      score: (document.querySelector("#scoreValue") || document.querySelector("#mseValue")).textContent,
      logCount: document.querySelector("#roundLog").children.length,
      modalInitiallyHidden: document.querySelector("#logOverlay").hidden,
    }));

    await page.locator("#expandLogBtn").click();
    const modalOpened = await page.locator("#logOverlay").evaluate((element) => !element.hidden);
    await page.keyboard.press("Escape");
    const modalClosed = await page.locator("#logOverlay").evaluate((element) => element.hidden);

    await page.locator("#undoBtn").click();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    const undoneRound = await page.locator("#roundValue").textContent();

    const views = page.locator("#viewPicker button[data-view]");
    if (await views.count() > 1) await views.nth(1).click();
    const activeViews = await page.locator("#viewPicker button.active").count();

    await page.screenshot({ path: `output/playwright/refactor-after-${id}.png` });

    const lossButton = page.locator('#viewPicker button[data-view="loss"]');
    let lossView = null;
    if (await lossButton.count()) {
      await lossButton.click();
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      lossView = await page.evaluate(() => {
        const canvas = document.querySelector("#chart");
        return {
          active: document.querySelector('#viewPicker button[data-view="loss"]')?.classList.contains("active"),
          width: canvas.width,
          height: canvas.height,
        };
      });
      await page.screenshot({ path: `output/playwright/refactor-loss-${id}.png` });
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(50);
    const portraitGate = await page.evaluate(() => ({
      shellHidden: getComputedStyle(document.querySelector(".game-shell")).visibility === "hidden",
      message: getComputedStyle(document.body, "::after").content,
    }));

    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(50);
    const landscape = await page.evaluate(() => ({
      shellVisible: getComputedStyle(document.querySelector(".game-shell")).visibility !== "hidden",
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      panelScrollable: document.querySelector(".control-panel").scrollHeight >= document.querySelector(".control-panel").clientHeight,
    }));
    await page.setViewportSize({ width: 1440, height: 900 });

    results.push({
      id,
      before,
      trained,
      modalOpened,
      modalClosed,
      undoneRound,
      activeViews,
      lossView,
      portraitGate,
      landscape,
    });
  }

  const failures = [];
  if (home.labCards !== ids.length || !home.themeToggle || home.horizontalOverflow) failures.push("home: navigation/layout");
  results.forEach((result) => {
    if (result.before.navLinks !== ids.length + 1 || result.before.activeNav !== 1) failures.push(`${result.id}: navigation`);
    if (result.before.canvas.colors < 10 || result.before.canvas.nonTransparent < 100) failures.push(`${result.id}: empty canvas`);
    if (result.before.horizontalOverflow) failures.push(`${result.id}: desktop overflow`);
    if (result.trained.round === result.before.round || result.trained.logCount !== 1) failures.push(`${result.id}: training step`);
    if (!result.modalOpened || !result.modalClosed) failures.push(`${result.id}: log modal`);
    if (result.undoneRound !== result.before.round) failures.push(`${result.id}: undo`);
    if (result.activeViews !== 1) failures.push(`${result.id}: view selection`);
    if (result.lossView && (!result.lossView.active || result.lossView.width < 1 || result.lossView.height < 1)) failures.push(`${result.id}: loss view`);
    if (!result.portraitGate.shellHidden || !result.portraitGate.message.includes("请横屏游玩")) failures.push(`${result.id}: portrait gate`);
    if (!result.landscape.shellVisible || result.landscape.horizontalOverflow) failures.push(`${result.id}: landscape layout`);
  });
  failures.push(...errors);
  if (failures.length) throw new Error(`Browser QA failed: ${failures.join(" | ")}`);
  return { home, results, errors };
}
