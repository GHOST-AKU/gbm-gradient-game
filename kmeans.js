const canvas = document.querySelector("#chart");
const ctx = canvas.getContext("2d");
const runtime = window.LabRuntime;
const modelMath = window.KMeansModel;
const scoreValue = document.querySelector("#mseValue");
const roundValue = document.querySelector("#roundValue");
const progressFill = document.querySelector("#progressFill");
const toast = document.querySelector("#toast");
const latestText = document.querySelector("#latestText");
const bestLabel = document.querySelector("#bestLabel");
const targetLabel = document.querySelector("#targetLabel");
const missionText = document.querySelector("#missionText");
const levelSubtitle = document.querySelector("#levelSubtitle");
const levelPicker = document.querySelector("#levelPicker");
const viewPicker = document.querySelector("#viewPicker");
const clusterCount = document.querySelector("#clusterCount");
const clusterLabel = document.querySelector("#clusterLabel");
const moveRate = document.querySelector("#moveRate");
const rateLabel = document.querySelector("#rateLabel");
const stepBtn = document.querySelector("#stepBtn");
const autoBtn = document.querySelector("#autoBtn");
const undoBtn = document.querySelector("#undoBtn");
const resetBtn = document.querySelector("#resetBtn");
const nextLevelBtn = document.querySelector("#nextLevelBtn");
const formulaLabel = document.querySelector("#formulaLabel");
const inertiaLabel = document.querySelector("#inertiaLabel");
const movementLabel = document.querySelector("#movementLabel");
const emptyLabel = document.querySelector("#emptyLabel");
const stableLabel = document.querySelector("#stableLabel");
const kLabel = document.querySelector("#kLabel");
const bestScoreLabel = document.querySelector("#bestScoreLabel");

const colors = ["#22f0a4", "#3bd7ff", "#ffd447", "#ff7a66", "#b778ff"];

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
const trainingLog = runtime.createTrainingLog();
const autoTrainer = runtime.createAutoTrainer({
  button: autoBtn,
  idleLabel: "自动迭代",
  activeLabel: "暂停自动",
  intervalMs: 850,
  step,
});
let dragging = null;

function clamp(value, min = -0.96, max = 0.96) {
  return Math.max(min, Math.min(max, value));
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
  stopAuto();
  const level = levels[currentLevel];
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
    history: [],
    inertiaHistory: [],
  };
  state.baseline = Math.max(0.08, metrics(assignments, centroids).inertia * level.baselineScale);
  missionText.textContent = level.description;
  levelSubtitle.textContent = level.name;
  toast.textContent = "拖动质心，或让 K-Means 自动完成“分配 -> 移动”的循环。";
  latestText.textContent = "未迭代：每个样本会归到最近的质心旗下。";
  trainingLog.reset();
  updatePickers();
  draw();
  updateHud();
}

function step() {
  state.history.push({
    centroids: state.centroids.map((centroid) => ({ ...centroid })),
    assignments: [...state.assignments],
    round: state.round,
    bestScore: state.bestScore,
    inertiaHistory: [...state.inertiaHistory],
  });

  const before = metrics();
  const rate = Number(moveRate.value);
  const next = modelMath.step(state.points, state.centroids, rate);
  state.centroids = next.centroids;
  state.assignments = next.assignments;
  state.round += 1;
  const after = metrics();
  state.bestScore = Math.max(state.bestScore, after.score);
  state.inertiaHistory.push(after.inertia);
  const delta = before.inertia - after.inertia;
  toast.textContent = `第 ${state.round} 轮：样本重新站队，质心向各自簇中心移动，距离下降 ${Math.max(0, delta).toFixed(3)}。`;
  latestText.textContent = `第 ${state.round} 轮  簇内距离 ${after.inertia.toFixed(3)}  移动 ${after.movement.toFixed(2)}  得分 ${after.score.toFixed(2)}`;
  trainingLog.add(latestText.textContent);
  draw();
  updateHud();
  if (after.score >= levels[currentLevel].target && after.movement < 0.035) {
    toast.textContent = `通关！质心基本稳定，聚合得分 ${after.score.toFixed(2)}。`;
    latestText.textContent = toast.textContent;
    stopAuto();
  }
}

function undo() {
  const currentRound = state.round;
  const previous = state.history.pop();
  if (!previous) {
    toast.textContent = "还没有可以撤回的迭代。";
    return;
  }
  state.centroids = previous.centroids;
  state.assignments = previous.assignments;
  state.round = previous.round;
  state.bestScore = previous.bestScore;
  state.inertiaHistory = previous.inertiaHistory;
  toast.textContent = "撤回一步，质心回到上一轮位置。";
  latestText.textContent = state.round ? `回到第 ${state.round} 轮。` : "未迭代：每个样本会归到最近的质心旗下。";
  if (state.round < currentRound) trainingLog.removeLatest();
  draw();
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

function stopAuto() { autoTrainer.stop(); }
function toggleAuto() { autoTrainer.toggle(); }

function setView(view) {
  activeView = view;
  runtime.setActiveSegment(viewPicker, view);
  const labels = {
    territory: "地盘视图：背景颜色表示每个位置会归属哪个质心。",
    distance: "距离视图：细线越短，样本离自己的质心越近。",
    motion: "移动视图：小尾巴显示本轮质心从哪里移动过来。",
    loss: "损失视图：簇内距离下降，说明聚类正在收紧。",
  };
  toast.textContent = labels[view];
  runtime.setShapeContext(labels[view]);
  draw();
}

function updatePickers() {
  runtime.renderChoicePicker(levelPicker, levels, currentLevel, (index) => {
    currentLevel = index;
    resetGame();
  });
}

function nextLevel() {
  currentLevel = (currentLevel + 1) % levels.length;
  resetGame();
}

const fitCanvas = runtime.makeCanvasFitter(canvas, ctx, draw);

function chartBounds() {
  const rect = canvas.getBoundingClientRect();
  return { left: 4, top: 4, right: rect.width - 6, bottom: rect.height - 10, width: rect.width - 10, height: rect.height - 14 };
}

function px(point, bounds) {
  return bounds.left + ((point.x + 1) / 2) * bounds.width;
}

function py(point, bounds) {
  return bounds.bottom - ((point.y + 1) / 2) * bounds.height;
}

function pointFromCanvas(x, y, bounds) {
  return { x: ((x - bounds.left) / bounds.width) * 2 - 1, y: ((bounds.bottom - y) / bounds.height) * 2 - 1 };
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
  ctx.save();
  ctx.fillStyle = "rgba(7,16,28,0.32)";
  ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
  ctx.strokeStyle = "rgba(139,211,255,0.14)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 8; i += 1) {
    const x = Math.round(bounds.left + (bounds.width / 8) * i) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, bounds.top);
    ctx.lineTo(x, bounds.bottom);
    ctx.stroke();
  }
  for (let i = 0; i <= 4; i += 1) {
    const y = Math.round(bounds.top + (bounds.height / 4) * i) + 0.5;
    ctx.beginPath();
    ctx.moveTo(bounds.left, y);
    ctx.lineTo(bounds.right, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTerritory(bounds) {
  if (activeView !== "territory") return;
  const cols = 44;
  const rows = 28;
  const cellW = bounds.width / cols;
  const cellH = bounds.height / rows;
  ctx.save();
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const point = pointFromCanvas(bounds.left + col * cellW + cellW / 2, bounds.top + row * cellH + cellH / 2, bounds);
      const cluster = assign([point], state.centroids)[0];
      ctx.fillStyle = `${colors[cluster]}24`;
      ctx.fillRect(bounds.left + col * cellW, bounds.top + row * cellH, Math.ceil(cellW), Math.ceil(cellH));
    }
  }
  ctx.restore();
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
  ctx.save();
  ctx.strokeStyle = "rgba(255,243,214,0.56)";
  ctx.fillStyle = "rgba(255,243,214,0.72)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bounds.left, bounds.top);
  ctx.lineTo(bounds.left, bounds.bottom);
  ctx.lineTo(bounds.right, bounds.bottom);
  ctx.stroke();
  ctx.font = "12px Courier New, Microsoft YaHei, monospace";
  ctx.fillText("特征 x2", bounds.left + 10, bounds.top + 18);
  ctx.textAlign = "right";
  ctx.fillText("特征 x1", bounds.right - 8, bounds.bottom - 10);
  ctx.restore();
}

function drawLoss(bounds) {
  drawGrid(bounds);
  const values = state.inertiaHistory.length ? state.inertiaHistory : [metrics().inertia];
  const max = Math.max(...values, state.baseline / levels[currentLevel].baselineScale);
  ctx.save();
  ctx.strokeStyle = "#22f0a4";
  ctx.lineWidth = 5;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = bounds.left + (index / Math.max(1, values.length - 1)) * bounds.width;
    const y = bounds.bottom - (1 - value / max) * bounds.height;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
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

canvas.addEventListener("pointerdown", (event) => {
  const nearest = nearestCentroidAt(event.clientX, event.clientY);
  if (nearest === null) return;
  dragging = nearest;
  state.history.push({
    centroids: state.centroids.map((centroid) => ({ ...centroid })),
    assignments: [...state.assignments],
    round: state.round,
    bestScore: state.bestScore,
    inertiaHistory: [...state.inertiaHistory],
  });
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
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
  toast.textContent = `拖动质心 ${dragging + 1}：地盘实时重新分配。`;
  draw();
  updateHud();
});

canvas.addEventListener("pointerup", () => {
  dragging = null;
});

clusterCount.addEventListener("input", () => {
  const level = levels[currentLevel];
  state.centroids = makeCentroids(level, Number(clusterCount.value));
  state.assignments = assign();
  state.round = 0;
  state.inertiaHistory = [];
  latestText.textContent = "K 值已改变：等待新一轮迭代。";
  trainingLog.reset();
  updateHud();
  draw();
});
moveRate.addEventListener("input", updateHud);
stepBtn.addEventListener("click", step);
autoBtn.addEventListener("click", toggleAuto);
undoBtn.addEventListener("click", undo);
resetBtn.addEventListener("click", resetGame);
nextLevelBtn.addEventListener("click", nextLevel);
runtime.bindSegmentedPicker(viewPicker, setView);
window.addEventListener("resize", fitCanvas);

resetGame();
requestAnimationFrame(fitCanvas);
