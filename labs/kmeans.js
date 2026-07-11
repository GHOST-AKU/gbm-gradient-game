const runtime = window.LabRuntime;
const $ = runtime.query;
const canvas = $("#chart");
const ctx = canvas.getContext("2d");
const modelMath = window.KMeansModel;
const modelCore = window.ModelCore;
const scoreValue = $("#mseValue");
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
const clusterCount = $("#clusterCount");
const clusterLabel = $("#clusterLabel");
const moveRate = $("#moveRate");
const rateLabel = $("#rateLabel");
const stepBtn = $("#stepBtn");
const autoBtn = $("#autoBtn");
const undoBtn = $("#undoBtn");
const resetBtn = $("#resetBtn");
const nextLevelBtn = $("#nextLevelBtn");
const formulaLabel = $("#formulaLabel");
const inertiaLabel = $("#inertiaLabel");
const movementLabel = $("#movementLabel");
const emptyLabel = $("#emptyLabel");
const stableLabel = $("#stableLabel");
const kLabel = $("#kLabel");
const bestScoreLabel = $("#bestScoreLabel");

const colors = ["#22f0a4", "#3bd7ff", "#ffd447", "#ff7a66", "#b778ff"];
const colorRgb = [[34, 240, 164], [59, 215, 255], [255, 212, 71], [255, 122, 102], [183, 120, 255]];

const levels = [
  {
    shortName: "三团",
    name: "入门：三块地盘",
    target: 0.82,
    baselineScale: 4.8,
    k: 3,
    description: "三群样本边界清楚，拖动质心到大致中心后再迭代。",
    seeds: [[-0.72, 0.58], [0.0, -0.58], [0.7, 0.48]],
    points: [
      [-0.82, 0.52], [-0.7, 0.68], [-0.58, 0.4], [-0.76, 0.32], [-0.48, 0.58], [-0.62, 0.78],
      [-0.18, -0.54], [0.02, -0.68], [0.16, -0.48], [-0.04, -0.32], [0.22, -0.72], [-0.28, -0.74],
      [0.56, 0.38], [0.74, 0.5], [0.62, 0.72], [0.84, 0.28], [0.42, 0.62], [0.76, 0.78],
    ],
  },
  {
    shortName: "拉长",
    name: "进阶：拉长簇",
    target: 0.76,
    baselineScale: 4.4,
    k: 3,
    description: "有些簇像长条，K-Means 会用圆形地盘近似它们。",
    seeds: [[-0.72, -0.5], [-0.04, 0.38], [0.72, -0.1]],
    points: [
      [-0.88, -0.6], [-0.72, -0.48], [-0.56, -0.32], [-0.44, -0.18], [-0.62, -0.72], [-0.36, -0.52],
      [-0.18, 0.18], [-0.02, 0.34], [0.12, 0.5], [0.28, 0.66], [-0.14, 0.58], [0.08, 0.78],
      [0.54, -0.34], [0.7, -0.12], [0.84, 0.02], [0.58, 0.14], [0.76, 0.32], [0.42, -0.02],
    ],
  },
  {
    shortName: "四岛",
    name: "挑战：四座小岛",
    target: 0.8,
    baselineScale: 4.7,
    k: 4,
    description: "四个小簇靠得更近，空簇和错误归属会更明显。",
    seeds: [[-0.72, 0.56], [-0.48, -0.5], [0.42, 0.42], [0.68, -0.46]],
    points: [
      [-0.82, 0.5], [-0.66, 0.62], [-0.58, 0.44], [-0.76, 0.76],
      [-0.62, -0.54], [-0.42, -0.42], [-0.28, -0.62], [-0.52, -0.78],
      [0.28, 0.34], [0.44, 0.52], [0.62, 0.4], [0.38, 0.72],
      [0.52, -0.48], [0.72, -0.36], [0.84, -0.62], [0.62, -0.78],
      [-0.04, 0.02], [0.08, -0.12],
    ],
  },
];

let currentLevel = 0;
let state;
let activeView = "territory";
let controller;
let modelVersion = 0;
const history = runtime.createHistory();
const plane = runtime.createCartesianPlane(canvas);
const fieldRenderer = runtime.createFieldRenderer(ctx);
let dragging = null;

function clamp(value, min = -0.96, max = 0.96) {
  return modelCore.clamp(value, min, max);
}

function distance2(a, b) {
  return modelMath.distance2(a, b);
}

function makePoints(level) {
  return level.points.map(([x, y], index) => ({ x, y, index }));
}

function makeCentroids(level, k) {
  const seeds = level.seeds;
  return Array.from({ length: k }, (_, index) => {
    const seed = seeds[index % seeds.length];
    return { x: seed[0], y: seed[1], lastX: seed[0], lastY: seed[1] };
  });
}

function assign(points = state.points, centroids = state.centroids) {
  return modelMath.assign(points, centroids);
}

function metrics(assignments = state.assignments, centroids = state.centroids) {
  return modelMath.metrics(state.points, assignments, centroids, state.baseline, state.round);
}

function resetGame() {
  const level = levels[currentLevel];
  history.clear();
  modelVersion += 1;
  clusterCount.value = level.k;
  const points = makePoints(level);
  const centroids = makeCentroids(level, level.k);
  const assignments = assign(points, centroids);
  state = {
    points,
    centroids,
    assignments,
    baseline: 1,
    round: 0,
    bestScore: 0,
    inertiaHistory: [],
    revision: 0,
  };
  state.baseline = Math.max(0.08, metrics(assignments, centroids).inertia * level.baselineScale);
  missionText.textContent = level.description;
  levelSubtitle.textContent = level.name;
  toast.textContent = "拖动质心，或让 K-Means 自动完成“分配 -> 移动”的循环。";
  latestText.textContent = "未迭代：每个样本会归到最近的质心旗下。";
  controller.trainingLog.reset();
  fieldRenderer.invalidate();
  controller.render();
  updateHud();
}

function saveSnapshot(logAdded) {
  history.push({
    centroids: state.centroids.map((centroid) => ({ ...centroid })),
    assignments: [...state.assignments],
    round: state.round,
    bestScore: state.bestScore,
    inertiaHistoryLength: state.inertiaHistory.length,
    logAdded,
  });
}

function step() {
  saveSnapshot(true);

  const before = metrics();
  const rate = Number(moveRate.value);
  const next = modelMath.step(state.points, state.centroids, rate);
  state.centroids = next.centroids;
  state.assignments = next.assignments;
  state.round += 1;
  state.revision += 1;
  const after = metrics();
  state.bestScore = Math.max(state.bestScore, after.score);
  state.inertiaHistory.push(after.inertia);
  const delta = before.inertia - after.inertia;
  toast.textContent = `第 ${state.round} 轮：样本重新站队，质心向各自簇中心移动，距离下降 ${Math.max(0, delta).toFixed(3)}。`;
  latestText.textContent = `第 ${state.round} 轮  簇内距离 ${after.inertia.toFixed(3)}  移动 ${after.movement.toFixed(2)}  得分 ${after.score.toFixed(2)}`;
  controller.trainingLog.add(latestText.textContent);
  controller.render();
  updateHud();
  if (after.score >= levels[currentLevel].target && after.movement < 0.035) {
    toast.textContent = `通关！质心基本稳定，聚合得分 ${after.score.toFixed(2)}。`;
    latestText.textContent = toast.textContent;
    controller.stopAuto();
  }
}

function undo() {
  const previous = history.pop();
  if (!previous) {
    toast.textContent = "还没有可以撤回的迭代。";
    return;
  }
  state.centroids = previous.centroids;
  state.assignments = previous.assignments;
  state.round = previous.round;
  state.bestScore = previous.bestScore;
  state.inertiaHistory.length = previous.inertiaHistoryLength;
  state.revision += 1;
  toast.textContent = "撤回一步，质心回到上一轮位置。";
  latestText.textContent = state.round ? `回到第 ${state.round} 轮。` : "未迭代：每个样本会归到最近的质心旗下。";
  if (previous.logAdded) controller.trainingLog.removeLatest();
  controller.render();
  updateHud();
}

function updateHud() {
  const result = metrics();
  state.bestScore = Math.max(state.bestScore, result.score);
  runtime.setText(scoreValue, result.score.toFixed(2));
  runtime.setText(roundValue, state.round);
  runtime.setText(bestLabel, state.round ? `最佳 ${state.bestScore.toFixed(2)}` : "等待开始");
  runtime.setText(targetLabel, `目标 ${levels[currentLevel].target.toFixed(2)}`);
  runtime.setProgress(progressFill, result.score / levels[currentLevel].target);
  clusterLabel.textContent = clusterCount.value;
  rateLabel.textContent = Number(moveRate.value).toFixed(2);
  formulaLabel.textContent = state.round ? "分配 -> 移动" : "等待迭代";
  inertiaLabel.textContent = result.inertia.toFixed(3);
  movementLabel.textContent = result.movement.toFixed(2);
  emptyLabel.textContent = result.empty;
  stableLabel.textContent = `${Math.round(result.stability * 100)}%`;
  kLabel.textContent = state.centroids.length;
  bestScoreLabel.textContent = state.bestScore.toFixed(2);
}

function setView(view) {
  activeView = view;
  const labels = {
    territory: "地盘视图：背景颜色表示每个位置会归属哪个质心。",
    distance: "距离视图：细线越短，样本离自己的质心越近。",
    motion: "移动视图：小尾巴显示本轮质心从哪里移动过来。",
    loss: "损失视图：簇内距离下降，说明聚类正在收紧。",
  };
  toast.textContent = labels[view];
  runtime.setShapeContext(labels[view]);
  controller.render();
}

function chartBounds() {
  return plane.bounds();
}

function px(point, bounds) {
  return plane.toX(point.x, bounds);
}

function py(point, bounds) {
  return plane.toY(point.y, bounds);
}

function pointFromCanvas(x, y, bounds) {
  return plane.fromCanvas(x, y, bounds);
}

function draw() {
  if (!state) return;
  const rect = canvas.getBoundingClientRect();
  const bounds = chartBounds();
  ctx.clearRect(0, 0, rect.width, rect.height);
  if (activeView === "loss") drawLoss(bounds);
  else {
    drawTerritory(bounds);
    drawGrid(bounds);
    if (activeView === "distance") drawAssignments(bounds);
    drawPoints(bounds);
    drawCentroids(bounds);
  }
  drawAxes(bounds);
}

function drawGrid(bounds) {
  ctx.fillStyle = "rgba(7,16,28,0.32)";
  ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
  runtime.drawGrid(ctx, bounds);
}

function drawTerritory(bounds) {
  if (activeView !== "territory") return;
  fieldRenderer.draw({
    key: `kmeans:${modelVersion}:${state.revision}`,
    colorKey: "territory",
    bounds,
    columns: 44,
    rows: 28,
    sample: (x, y) => modelMath.nearestIndex(plane.fromUnit(x, y), state.centroids),
    color: (cluster) => [...colorRgb[cluster], 36],
  });
}

function drawAssignments(bounds) {
  ctx.save();
  ctx.lineWidth = 2;
  state.points.forEach((point, index) => {
    const cluster = state.assignments[index];
    const centroid = state.centroids[cluster];
    ctx.strokeStyle = `${colors[cluster]}88`;
    ctx.beginPath();
    ctx.moveTo(px(point, bounds), py(point, bounds));
    ctx.lineTo(px(centroid, bounds), py(centroid, bounds));
    ctx.stroke();
  });
  ctx.restore();
}

function drawPoints(bounds) {
  ctx.save();
  state.points.forEach((point, index) => {
    const cluster = state.assignments[index];
    const x = px(point, bounds);
    const y = py(point, bounds);
    ctx.fillStyle = colors[cluster];
    ctx.strokeStyle = "#05060c";
    ctx.lineWidth = 4;
    ctx.fillRect(x - 6, y - 6, 12, 12);
    ctx.strokeRect(x - 6, y - 6, 12, 12);
  });
  ctx.restore();
}

function drawCentroids(bounds) {
  ctx.save();
  state.centroids.forEach((centroid, index) => {
    const x = px(centroid, bounds);
    const y = py(centroid, bounds);
    if (activeView === "motion") {
      ctx.strokeStyle = `${colors[index]}aa`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(px({ x: centroid.lastX, y: centroid.lastY }, bounds), py({ x: centroid.lastX, y: centroid.lastY }, bounds));
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.fillStyle = "#05060c";
    ctx.fillRect(x - 13, y - 13, 26, 26);
    ctx.fillStyle = colors[index];
    ctx.fillRect(x - 9, y - 9, 18, 18);
    ctx.fillStyle = "#fff3d6";
    ctx.fillRect(x - 3, y - 3, 6, 6);
  });
  ctx.restore();
}

function drawAxes(bounds) {
  runtime.drawAxes(ctx, bounds, { strokeColor: "rgba(255,243,214,0.56)" });
}

function drawLoss(bounds) {
  drawGrid(bounds);
  const values = state.inertiaHistory.length ? state.inertiaHistory : [metrics().inertia];
  const max = Math.max(...values, state.baseline / levels[currentLevel].baselineScale);
  runtime.drawSeries(ctx, values, bounds, { min: 0, max, color: "#22f0a4", lineWidth: 5 });
}

function nearestCentroidAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const bounds = chartBounds();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  let best = null;
  let bestDistance = 24;
  state.centroids.forEach((centroid, index) => {
    const dx = px(centroid, bounds) - x;
    const dy = py(centroid, bounds) - y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

function handlePointerDown(event) {
  const nearest = nearestCentroidAt(event.clientX, event.clientY);
  if (nearest === null) return;
  dragging = nearest;
  saveSnapshot(false);
  canvas.setPointerCapture(event.pointerId);
}

function handlePointerMove(event) {
  if (dragging === null) return;
  const rect = canvas.getBoundingClientRect();
  const bounds = chartBounds();
  const point = pointFromCanvas(event.clientX - rect.left, event.clientY - rect.top, bounds);
  const centroid = state.centroids[dragging];
  centroid.lastX = centroid.x;
  centroid.lastY = centroid.y;
  centroid.x = clamp(point.x);
  centroid.y = clamp(point.y);
  state.assignments = assign();
  state.revision += 1;
  toast.textContent = `拖动质心 ${dragging + 1}：地盘实时重新分配。`;
  controller.render();
  updateHud();
}

function handlePointerUp() {
  dragging = null;
}

function handleClusterCount() {
  const level = levels[currentLevel];
  history.clear();
  state.centroids = makeCentroids(level, Number(clusterCount.value));
  state.assignments = assign();
  state.round = 0;
  state.inertiaHistory = [];
  state.bestScore = 0;
  state.revision += 1;
  latestText.textContent = "K 值已改变：等待新一轮迭代。";
  controller.trainingLog.reset();
  updateHud();
  controller.render();
}

controller = runtime.createLabController({
  levels,
  levelPicker,
  viewPicker,
  getLevelIndex: () => currentLevel,
  setLevelIndex: (index) => { currentLevel = index; },
  reset: resetGame,
  draw,
  canvas,
  context: ctx,
  setView,
  auto: { button: autoBtn, idleLabel: "自动迭代", activeLabel: "暂停自动", intervalMs: 850, step },
  actions: {
    stepButton: stepBtn,
    step,
    undoButton: undoBtn,
    undo,
    resetButton: resetBtn,
    nextButton: nextLevelBtn,
  },
  inputs: [
    { element: moveRate, handler: updateHud },
  ],
  bindings: [
    { element: clusterCount, event: "input", handler: handleClusterCount },
    { element: canvas, event: "pointerdown", handler: handlePointerDown },
    { element: canvas, event: "pointermove", handler: handlePointerMove },
    { element: canvas, event: "pointerup", handler: handlePointerUp },
    { element: canvas, event: "pointercancel", handler: handlePointerUp },
  ],
});
controller.start();
