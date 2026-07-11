const runtime = window.LabRuntime;
const $ = runtime.query;
const canvas = $("#chart");
const ctx = canvas.getContext("2d");
const scoreValue = $("#scoreValue");
const roundValue = $("#roundValue");
const progressFill = $("#progressFill");
const toast = $("#toast");
const latestText = $("#latestText");
const bestLabel = $("#bestLabel");
const targetLabel = $("#targetLabel");
const missionText = $("#missionText");
const levelSubtitle = $("#levelSubtitle");
const levelPicker = $("#levelPicker");
const viewPicker = $("#viewPicker");
const maxDepth = $("#maxDepth");
const featureRate = $("#featureRate");
const depthLabel = $("#depthLabel");
const featureLabel = $("#featureLabel");
const stepBtn = $("#stepBtn");
const autoBtn = $("#autoBtn");
const undoBtn = $("#undoBtn");
const resetBtn = $("#resetBtn");
const nextLevelBtn = $("#nextLevelBtn");
const accuracyLabel = $("#accuracyLabel");
const marginLabel = $("#marginLabel");
const treeLabel = $("#treeLabel");
const oobLabel = $("#oobLabel");
const depthStatLabel = $("#depthStatLabel");
const bestScoreLabel = $("#bestScoreLabel");
const modelMath = window.ForestModel;
const history = runtime.createHistory();
const plane = runtime.createCartesianPlane(canvas);
const fieldRenderer = runtime.createFieldRenderer(ctx);
const metricsMemo = runtime.createMemo(() => modelMath.metrics(state.points, state.trees));

const levels = [
  { shortName: "阶梯", name: "入门：矩形阶梯", target: 0.9, description: "每棵树用矩形切分，森林投票后边界更稳定。", points: [[-0.82,-0.58,0],[-0.66,-0.36,0],[-0.5,-0.12,0],[-0.32,0.18,0],[-0.72,0.56,0],[-0.14,-0.62,0],[0.08,-0.42,0],[0.2,-0.12,1],[0.38,0.18,1],[0.56,0.46,1],[0.78,0.66,1],[0.66,-0.32,1],[-0.08,0.48,1],[0.18,0.72,1]] },
  { shortName: "异或", name: "进阶：异或投票", target: 0.86, description: "单棵浅树容易偏，但多棵随机树会把角落规律投出来。", points: [[-0.82,-0.66,1],[-0.58,-0.48,1],[-0.76,-0.2,1],[-0.36,-0.72,1],[0.42,0.5,1],[0.66,0.72,1],[0.82,0.28,1],[0.28,0.78,1],[-0.72,0.46,0],[-0.48,0.72,0],[-0.22,0.28,0],[-0.66,0.12,0],[0.28,-0.66,0],[0.52,-0.34,0],[0.74,-0.62,0],[0.18,-0.18,0]] },
  { shortName: "噪声", name: "挑战：带噪森林", target: 0.82, description: "有噪声点时，随机采样和投票能避免单棵树被带偏。", points: [[-0.82,-0.52,0],[-0.62,-0.4,0],[-0.48,0.08,0],[-0.34,0.42,0],[-0.12,-0.2,0],[0.08,0.16,0],[0.02,-0.48,1],[0.28,-0.12,1],[0.46,0.26,1],[0.6,0.5,1],[0.8,0.18,1],[0.64,-0.44,1],[-0.72,0.7,1],[0.72,-0.7,0]] },
];

let levelIndex = 0;
let state;
let view = "vote";
let controller;
let modelVersion = 0;

function forestVote(point) {
  if (!state.trees.length) return 0;
  return modelMath.voteSum(state.trees, point) >= 0 ? 1 : 0;
}

function voteMargin(point) {
  if (!state.trees.length) return 0;
  return Math.abs(modelMath.voteSum(state.trees, point)) / state.trees.length;
}

function voteDetails(point, trees = state.trees) {
  return modelMath.voteDetails(trees, point);
}

function focusPoint() {
  return modelMath.focusPoint(state.points, state.trees);
}

function stabilityTrend() {
  return state.stability.trend;
}

function metrics() {
  return metricsMemo.get(`${modelVersion}:${state.revision}`);
}

function resetGame() {
  const level = levels[levelIndex];
  history.clear();
  modelVersion += 1;
  const points = level.points.map(([x, y, label], index) => ({ x, y, label, index }));
  state = {
    points,
    trees: [],
    bags: [],
    bagMemberships: [],
    bagCounts: [],
    stability: modelMath.createStabilityAccumulator(points),
    round: 0,
    best: 0,
    revision: 0,
  };
  missionText.textContent = level.description;
  levelSubtitle.textContent = level.name;
  toast.textContent = "每棵树从 bootstrap 样本里学习，再加入森林投票。";
  latestText.textContent = "未训练：森林里还没有树。";
  metricsMemo.invalidate();
  fieldRenderer.invalidate();
  controller.trainingLog.reset();
  controller.render();
  updateHud();
}

function trainTree() {
  history.push({ treeCount: state.trees.length, round: state.round, best: state.best });
  const rand = modelMath.rng(1337 + state.round * 97 + levelIndex * 31);
  const bag = modelMath.bootstrap(state.points, rand);
  const tree = modelMath.buildTree(bag.sample, 0, Number(maxDepth.value), rand, Number(featureRate.value));
  tree.id = state.round + 1;
  tree.uniqueSamples = bag.membership.size;
  tree.featureMode = Number(featureRate.value) === 1 ? "random-1" : "x+y";
  tree.stats = modelMath.treeStats(tree);
  state.trees.push(tree);
  state.bags.push(bag.indices);
  state.bagMemberships.push(bag.membership);
  state.bagCounts.push(bag.counts);
  modelMath.appendStability(state.stability, state.points, tree);
  state.round += 1;
  state.revision += 1;
  const result = metrics();
  state.best = Math.max(state.best, result.score);
  toast.textContent = `第 ${state.round} 棵树：用随机样本训练完成，森林正确率 ${Math.round(result.accuracy * 100)}%。`;
  latestText.textContent = `第 ${state.round} 棵树  正确率 ${Math.round(result.accuracy * 100)}%  信心 ${Math.round(result.margin * 100)}%  得分 ${result.score.toFixed(2)}`;
  controller.trainingLog.add(latestText.textContent);
  controller.render();
  updateHud();
  if (result.score >= levels[levelIndex].target && state.trees.length >= 3) {
    toast.textContent = `通关！森林投票得分 ${result.score.toFixed(2)}，边界已经稳定。`;
    latestText.textContent = toast.textContent;
    controller.stopAuto();
  }
}

function undo() {
  const previous = history.pop();
  if (!previous) {
    toast.textContent = "还没有树可以砍掉。";
    return;
  }
  state.trees.length = previous.treeCount;
  state.bags.length = previous.treeCount;
  state.bagMemberships.length = previous.treeCount;
  state.bagCounts.length = previous.treeCount;
  state.stability = modelMath.createStabilityAccumulator(state.points, state.trees);
  state.round = previous.round;
  state.best = previous.best;
  state.revision += 1;
  latestText.textContent = state.round ? `已砍回第 ${state.round} 棵树。` : "未训练：森林里还没有树。";
  controller.trainingLog.removeLatest();
  controller.render();
  updateHud();
}

function updateHud() {
  const result = metrics();
  state.best = Math.max(state.best, result.score);
  runtime.setText(scoreValue, result.score.toFixed(2));
  runtime.setText(roundValue, state.trees.length);
  runtime.setText(targetLabel, `目标 ${levels[levelIndex].target.toFixed(2)}`);
  runtime.setProgress(progressFill, result.score / levels[levelIndex].target);
  runtime.setText(bestLabel, state.trees.length ? `最佳 ${state.best.toFixed(2)}` : "等待开始");
  runtime.setText(depthLabel, maxDepth.value);
  runtime.setText(featureLabel, featureRate.value);
  runtime.setText(accuracyLabel, `${Math.round(result.accuracy * 100)}%`);
  runtime.setText(marginLabel, `${Math.round(result.margin * 100)}%`);
  runtime.setText(treeLabel, state.trees.length);
  runtime.setText(oobLabel, `${Math.round(oobEstimate() * 100)}%`);
  runtime.setText(depthStatLabel, maxDepth.value);
  runtime.setText(bestScoreLabel, state.best.toFixed(2));
}

function oobEstimate() {
  return modelMath.oobEstimate(state.points, state.trees, state.bagMemberships, metrics().accuracy);
}

function setView(next) {
  view = next;
  const text = {
    vote: "投票视图：左侧是多数投票边界，右侧逐棵树亮出票箱。",
    trees: "森林视图：每棵树都有自己的 bootstrap 样本和切分纹路。",
    margin: "信心视图：颜色越亮，越多树投成同一边，森林越稳定。",
    errors: "错分视图：红框标出当前森林还没投对的样本。"
  }[view];
  toast.textContent = text; runtime.setShapeContext(text); controller.render();
}

function bounds() {
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 700) {
    const panelHeight = Math.min(280, Math.max(230, rect.height * 0.52));
    const gap = 12;
    const plotBottom = rect.height - panelHeight - gap;
    return {
      left: 4,
      top: 4,
      right: rect.width - 6,
      bottom: plotBottom - 4,
      width: rect.width - 10,
      height: plotBottom - 8,
      panel: { left: 4, top: plotBottom + gap, right: rect.width - 6, bottom: rect.height - 10, width: rect.width - 10, height: panelHeight - 10 }
    };
  }
  const panelWidth = Math.min(330, Math.max(250, rect.width * 0.34));
  const gap = 14;
  const plotRight = Math.max(320, rect.width - panelWidth - gap);
  return {
    left: 4,
    top: 4,
    right: plotRight - 6,
    bottom: rect.height - 10,
    width: plotRight - 10,
    height: rect.height - 14,
    panel: { left: plotRight + gap, top: 4, right: rect.width - 6, bottom: rect.height - 10, width: rect.width - plotRight - gap - 6, height: rect.height - 14 }
  };
}
function px(x, b) { return plane.toX(x, b); }
function py(y, b) { return plane.toY(y, b); }
function pointAt(x, y, b) { return plane.fromCanvas(x, y, b); }

function draw() {
  if (!state) return;
  const b = bounds();
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  drawField(b);
  drawGrid(b);
  if (view === "trees" && state.trees.length) drawForestCuts(b);
  drawPoints(b);
  drawAxes(b);
  drawForestPanel(b.panel);
}

function drawField(b) {
  fieldRenderer.draw({
    key: `forest:${modelVersion}:${state.revision}`,
    colorKey: view === "margin" ? "margin" : "vote",
    bounds: b,
    columns: 44,
    rows: 28,
    sample: (x, y) => state.trees.length
      ? modelMath.voteSum(state.trees, plane.fromUnit(x, y)) / state.trees.length
      : -Number.EPSILON,
    color: (signedVote) => {
      const alpha = view === "margin" ? 0.08 + Math.abs(signedVote) * 0.28 : 0.18;
      return signedVote >= 0
        ? [34, 240, 164, Math.round(alpha * 255)]
        : [59, 215, 255, Math.round(alpha * 255)];
    },
  });
}

function drawGrid(b) {
  runtime.drawGrid(ctx, b);
}

function drawTreeLines(tree, b, region = { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }, color = "#ffd447", lineWidth = 4) {
  if (tree.leaf) return;
  ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.setLineDash([10, 6]); ctx.beginPath();
  if (tree.axis === "x") {
    const x = px(tree.value, b);
    ctx.moveTo(x, py(region.yMin, b)); ctx.lineTo(x, py(region.yMax, b));
    ctx.stroke();
    drawTreeLines(tree.left, b, { ...region, xMax: tree.value }, color, lineWidth);
    drawTreeLines(tree.right, b, { ...region, xMin: tree.value }, color, lineWidth);
  } else {
    const y = py(tree.value, b);
    ctx.moveTo(px(region.xMin, b), y); ctx.lineTo(px(region.xMax, b), y);
    ctx.stroke();
    drawTreeLines(tree.left, b, { ...region, yMax: tree.value }, color, lineWidth);
    drawTreeLines(tree.right, b, { ...region, yMin: tree.value }, color, lineWidth);
  }
  ctx.setLineDash([]);
}

function drawForestCuts(b) {
  const colors = ["rgba(255,212,71,0.9)", "rgba(34,240,164,0.55)", "rgba(59,215,255,0.55)", "rgba(255,95,87,0.48)", "rgba(255,243,214,0.45)"];
  state.trees.slice(-5).forEach((tree, index, trees) => {
    const newest = index === trees.length - 1;
    drawTreeLines(tree, b, { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }, colors[index % colors.length], newest ? 4 : 2);
  });
}

function drawPanelFrame(panel, title, subtitle) {
  ctx.fillStyle = "rgba(5,6,12,0.74)";
  ctx.fillRect(panel.left, panel.top, panel.width, panel.height);
  ctx.strokeStyle = "rgba(255,243,214,0.35)";
  ctx.lineWidth = 3;
  ctx.strokeRect(panel.left + 1.5, panel.top + 1.5, panel.width - 3, panel.height - 3);
  ctx.fillStyle = "#fff3d6";
  ctx.font = "bold 15px Courier New, Microsoft YaHei, monospace";
  ctx.fillText(title, panel.left + 12, panel.top + 22);
  ctx.fillStyle = "rgba(255,243,214,0.68)";
  ctx.font = "11px Courier New, Microsoft YaHei, monospace";
  ctx.fillText(subtitle, panel.left + 12, panel.top + 40);
}

function drawPixelTree(x, y, size, tree, bag, focus) {
  const stats = tree.stats || modelMath.treeStats(tree);
  const vote = focus ? modelMath.predictTree(tree, focus) : tree.id % 2;
  const bagUnique = tree.uniqueSamples ?? new Set(bag || []).size;
  const canopy = vote ? "#22f0a4" : "#3bd7ff";
  const trunk = "#8d6a3f";
  const shade = stats.xSplits >= stats.ySplits ? "rgba(255,212,71,0.75)" : "rgba(255,95,87,0.72)";
  ctx.fillStyle = trunk;
  ctx.fillRect(x + size * 0.42, y + size * 0.55, size * 0.18, size * 0.36);
  ctx.fillStyle = canopy;
  ctx.fillRect(x + size * 0.22, y + size * 0.24, size * 0.56, size * 0.42);
  ctx.fillRect(x + size * 0.32, y + size * 0.08, size * 0.36, size * 0.22);
  ctx.fillStyle = shade;
  ctx.fillRect(x + size * 0.18, y + size * 0.68, Math.max(4, size * (bagUnique / state.points.length)), 4);
  ctx.fillStyle = "#05060c";
  ctx.font = "bold 10px Courier New, Microsoft YaHei, monospace";
  ctx.fillText(String(tree.id), x + 3, y + size - 2);
}

function drawForestPanel(panel) {
  drawPanelFrame(panel, "FOREST", state.trees.length ? `${state.trees.length} trees / bootstrap + vote` : "plant trees to wake the forest");
  if (!state.trees.length) {
    ctx.fillStyle = "rgba(255,243,214,0.72)";
    ctx.font = "13px Courier New, Microsoft YaHei, monospace";
    ctx.fillText("No trees yet.", panel.left + 16, panel.top + 78);
    ctx.fillText("Use Seed Tree to train.", panel.left + 16, panel.top + 100);
    drawEmptyGrove(panel);
    return;
  }
  drawTreeGrove(panel);
  drawVoteBoard(panel);
  drawStabilityChart(panel);
}

function drawEmptyGrove(panel) {
  const cols = 4;
  const size = Math.min(34, Math.floor((panel.width - 52) / cols));
  const startX = panel.left + 18;
  const startY = panel.top + 136;
  ctx.save();
  ctx.globalAlpha = 0.38;
  for (let index = 0; index < 8; index += 1) {
    const x = startX + (index % cols) * (size + 14);
    const y = startY + Math.floor(index / cols) * (size + 18);
    ctx.fillStyle = "#8d6a3f";
    ctx.fillRect(x + size * 0.42, y + size * 0.58, size * 0.18, size * 0.32);
    ctx.fillStyle = index % 2 ? "#3bd7ff" : "#22f0a4";
    ctx.fillRect(x + size * 0.24, y + size * 0.28, size * 0.52, size * 0.34);
    ctx.fillRect(x + size * 0.34, y + size * 0.12, size * 0.32, size * 0.2);
    ctx.strokeStyle = "rgba(255,243,214,0.7)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 2, y - 2, size + 4, size + 4);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(255,243,214,0.58)";
  ctx.font = "11px Courier New, Microsoft YaHei, monospace";
  ctx.fillText("ghost slots: new trees fill tiles", panel.left + 16, startY + size * 2 + 42);
  ctx.restore();
}

function drawTreeGrove(panel) {
  const focus = focusPoint();
  const cols = Math.max(4, Math.floor((panel.width - 22) / 42));
  const size = Math.min(34, Math.floor((panel.width - 28) / cols) - 4);
  const rows = panel.height < 300 ? 1 : 3;
  const startX = panel.left + 12;
  const startY = panel.top + 56;
  const visible = state.trees.slice(-Math.min(state.trees.length, cols * rows));
  visible.forEach((tree, index) => {
    const x = startX + (index % cols) * (size + 7);
    const y = startY + Math.floor(index / cols) * (size + 12);
    drawPixelTree(x, y, size, tree, state.bags[state.trees.indexOf(tree)], focus);
    if (tree === state.trees[state.trees.length - 1]) {
      ctx.strokeStyle = "#ffd447";
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 2, y - 2, size + 4, size + 5);
    }
  });
  const latest = state.trees[state.trees.length - 1];
  const bag = state.bags[state.bags.length - 1] || [];
  ctx.fillStyle = "rgba(255,243,214,0.72)";
  ctx.font = "11px Courier New, Microsoft YaHei, monospace";
  ctx.fillText(`latest bag: ${new Set(bag).size}/${state.points.length} unique`, panel.left + 12, startY + rows * (size + 12) + 12);
  ctx.fillText(`split flavor: ${latest.stats.xSplits}x / ${latest.stats.ySplits}y`, panel.left + 12, startY + rows * (size + 12) + 28);
}

function drawVoteBoard(panel) {
  const focus = focusPoint();
  const details = voteDetails(focus);
  const top = panel.top + (panel.height < 300 ? 145 : Math.min(232, panel.height * 0.48));
  ctx.fillStyle = "#fff3d6";
  ctx.font = "bold 12px Courier New, Microsoft YaHei, monospace";
  ctx.fillText(`vote probe #${focus.index + 1}`, panel.left + 12, top);
  const maxDots = Math.min(details.votes.length, Math.floor((panel.width - 26) / 12));
  details.votes.slice(-maxDots).forEach((vote, index) => {
    ctx.fillStyle = vote ? "#22f0a4" : "#3bd7ff";
    ctx.fillRect(panel.left + 12 + index * 12, top + 12, 9, 13);
  });
  const barX = panel.left + 12, barY = top + 34, barW = panel.width - 26, barH = 16;
  ctx.fillStyle = "#3bd7ff";
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = "#22f0a4";
  ctx.fillRect(barX, barY, barW * (details.positive / Math.max(1, details.votes.length)), barH);
  ctx.strokeStyle = "rgba(255,243,214,0.54)";
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barW, barH);
  ctx.fillStyle = "rgba(255,243,214,0.72)";
  ctx.font = "11px Courier New, Microsoft YaHei, monospace";
  ctx.fillText(`yes ${details.positive} / no ${details.negative} / margin ${Math.round(details.margin * 100)}%`, barX, barY + 31);
}

function drawStabilityChart(panel) {
  const trend = stabilityTrend();
  if (!trend.length) return;
  const compact = panel.height < 300;
  const chart = { x: panel.left + 12, y: panel.bottom - (compact ? 72 : 104), w: panel.width - 26, h: compact ? 42 : 70 };
  ctx.fillStyle = "#fff3d6";
  ctx.font = "bold 12px Courier New, Microsoft YaHei, monospace";
  ctx.fillText("stability as trees grow", chart.x, chart.y - 10);
  ctx.strokeStyle = "rgba(255,243,214,0.25)";
  ctx.lineWidth = 2;
  ctx.strokeRect(chart.x, chart.y, chart.w, chart.h);
  runtime.drawSeries(ctx, trend, {
    left: chart.x,
    right: chart.x + chart.w,
    top: chart.y,
    bottom: chart.y + chart.h,
    width: chart.w,
    height: chart.h,
  }, { min: 0, max: 1, value: (point) => point.margin, color: "#ffd447", lineWidth: 3 });
  trend.forEach((point, index) => {
    if (!point.flips) return;
    const x = chart.x + (trend.length === 1 ? 0 : (index / (trend.length - 1)) * chart.w);
    ctx.fillStyle = "rgba(255,95,87,0.75)";
    ctx.fillRect(x - 2, chart.y + chart.h - Math.min(chart.h, point.flips * 6), 4, Math.min(chart.h, point.flips * 6));
  });
  const last = trend[trend.length - 1];
  ctx.fillStyle = "rgba(255,243,214,0.72)";
  ctx.font = "11px Courier New, Microsoft YaHei, monospace";
  ctx.fillText(`avg margin ${Math.round(last.margin * 100)}%; red ticks = vote flips`, chart.x, chart.y + chart.h + 18);
}

function drawPoints(b) {
  const latestBagCounts = state.bagCounts[state.bagCounts.length - 1];
  state.points.forEach((point) => {
    const wrong = state.trees.length && forestVote(point) !== point.label;
    const x = px(point.x, b), y = py(point.y, b);
    const bagCount = latestBagCounts ? latestBagCounts[point.index] : 0;
    if (bagCount) {
      ctx.strokeStyle = "rgba(255,212,71,0.86)";
      ctx.lineWidth = Math.min(8, 2 + bagCount * 2);
      ctx.strokeRect(x - 12, y - 12, 24, 24);
      if (bagCount > 1) {
        ctx.fillStyle = "#ffd447";
        ctx.font = "bold 11px Courier New, Microsoft YaHei, monospace";
        ctx.fillText(`x${bagCount}`, x + 10, y - 10);
      }
    }
    ctx.fillStyle = point.label ? "#22f0a4" : "#3bd7ff";
    ctx.strokeStyle = wrong && view === "errors" ? "#ff5f57" : "#05060c";
    ctx.lineWidth = wrong && view === "errors" ? 5 : 4;
    if (point.label) { ctx.fillRect(x - 7, y - 7, 14, 14); ctx.strokeRect(x - 7, y - 7, 14, 14); }
    else { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-7, -7, 14, 14); ctx.strokeRect(-7, -7, 14, 14); ctx.restore(); }
  });
}

function drawAxes(b) {
  runtime.drawAxes(ctx, b);
}

controller = runtime.createLabController({
  levels,
  levelPicker,
  viewPicker,
  getLevelIndex: () => levelIndex,
  setLevelIndex: (index) => { levelIndex = index; },
  reset: resetGame,
  draw,
  canvas,
  context: ctx,
  setView,
  auto: { button: autoBtn, idleLabel: "自动造林", activeLabel: "暂停造林", intervalMs: 650, step: trainTree },
  actions: {
    stepButton: stepBtn,
    step: trainTree,
    undoButton: undoBtn,
    undo,
    resetButton: resetBtn,
    nextButton: nextLevelBtn,
  },
  inputs: [
    { element: maxDepth, handler: updateHud },
    { element: featureRate, handler: updateHud },
  ],
});
controller.start();
