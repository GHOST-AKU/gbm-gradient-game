const canvas = document.querySelector("#chart");
const ctx = canvas.getContext("2d");
const runtime = window.LabRuntime;
const modelMath = window.TreeModel;
const scoreValue = document.querySelector("#mseValue");
const leafValue = document.querySelector("#roundValue");
const progressFill = document.querySelector("#progressFill");
const toast = document.querySelector("#toast");
const latestText = document.querySelector("#latestText");
const bestLabel = document.querySelector("#bestLabel");
const targetLabel = document.querySelector("#targetLabel");
const missionText = document.querySelector("#missionText");
const levelSubtitle = document.querySelector("#levelSubtitle");
const levelPicker = document.querySelector("#levelPicker");
const viewPicker = document.querySelector("#viewPicker");
const axisPicker = document.querySelector("#axisPicker");
const threshold = document.querySelector("#threshold");
const thresholdLabel = document.querySelector("#thresholdLabel");
const maxDepth = document.querySelector("#maxDepth");
const depthLabel = document.querySelector("#depthLabel");
const stepBtn = document.querySelector("#stepBtn");
const bestBtn = document.querySelector("#bestBtn");
const undoBtn = document.querySelector("#undoBtn");
const resetBtn = document.querySelector("#resetBtn");
const nextLevelBtn = document.querySelector("#nextLevelBtn");
const formulaLabel = document.querySelector("#formulaLabel");
const accuracyLabel = document.querySelector("#accuracyLabel");
const gainLabel = document.querySelector("#gainLabel");
const leafLabel = document.querySelector("#leafLabel");
const depthStatLabel = document.querySelector("#depthStatLabel");
const impurityLabel = document.querySelector("#impurityLabel");
const bestScoreLabel = document.querySelector("#bestScoreLabel");

const levels = [
  {
    shortName: "直切",
    name: "入门：一刀见效",
    target: 0.9,
    description: "两类样本大致按 x 分开，先找到能让两边更纯的一刀。",
    points: [
      [-0.82, -0.54, -1], [-0.68, -0.22, -1], [-0.54, 0.18, -1], [-0.44, 0.56, -1],
      [-0.24, -0.42, -1], [-0.12, 0.04, -1], [0.08, -0.58, 1], [0.22, -0.18, 1],
      [0.36, 0.22, 1], [0.52, 0.58, 1], [0.68, -0.42, 1], [0.82, 0.14, 1],
    ],
  },
  {
    shortName: "阶梯",
    name: "进阶：阶梯边界",
    target: 0.86,
    description: "真实边界像阶梯，需要多片矩形叶子拼出来。",
    points: [
      [-0.82, -0.58, -1], [-0.64, -0.36, -1], [-0.48, -0.1, -1], [-0.32, 0.22, -1],
      [-0.74, 0.58, -1], [-0.18, -0.62, -1], [0.02, -0.42, -1], [0.2, -0.12, 1],
      [0.36, 0.18, 1], [0.54, 0.44, 1], [0.76, 0.66, 1], [0.66, -0.34, 1],
      [-0.08, 0.48, 1], [0.18, 0.72, 1],
    ],
  },
  {
    shortName: "异或",
    name: "挑战：异或角落",
    target: 0.84,
    description: "斜线模型会犯难，但树可以用几刀矩形区域拼出角落规律。",
    points: [
      [-0.82, -0.66, 1], [-0.58, -0.48, 1], [-0.76, -0.2, 1], [-0.36, -0.72, 1],
      [0.42, 0.5, 1], [0.66, 0.72, 1], [0.82, 0.28, 1], [0.28, 0.78, 1],
      [-0.72, 0.46, -1], [-0.48, 0.72, -1], [-0.22, 0.28, -1], [-0.66, 0.12, -1],
      [0.28, -0.66, -1], [0.52, -0.34, -1], [0.74, -0.62, -1], [0.18, -0.18, -1],
    ],
  },
];

let currentLevel = 0;
let state;
let activeView = "regions";
let splitAxis = "x";
let nextLeafId = 1;
const trainingLog = runtime.createTrainingLog();

function makePoints(level) {
  return level.points.map(([x, y, label], index) => ({ x, y, label, index }));
}

function rootLeaf() {
  return { id: 0, xMin: -1, xMax: 1, yMin: -1, yMax: 1, depth: 0, parent: null, rule: "root" };
}

function pointsInLeaf(leaf) {
  return modelMath.pointsInLeaf(state.points, leaf);
}

function gini(points) {
  return modelMath.gini(points);
}

function majority(points) {
  return modelMath.majority(points);
}

function leafFor(point) {
  return modelMath.leafFor(state.leaves, point);
}

function prediction(point) {
  return modelMath.prediction(state.points, state.leaves, point);
}

function treeMetrics() {
  return modelMath.metrics(state.points, state.leaves);
}

function activeLeaf() {
  const maxAllowedDepth = Number(maxDepth.value);
  return [...state.leaves]
    .filter((leaf) => pointsInLeaf(leaf).length >= 2 && leaf.depth < maxAllowedDepth)
    .sort((a, b) => {
      const pa = pointsInLeaf(a);
      const pb = pointsInLeaf(b);
      return gini(pb) * pb.length - gini(pa) * pa.length;
    })[0] || state.leaves[0];
}

function splitGain(leaf, axis, value) {
  return modelMath.splitGain(state.points, leaf, axis, value);
}

function bestSplit(leaf = activeLeaf()) {
  return modelMath.bestSplit(state.points, leaf, splitAxis, Number(threshold.value));
}

function resetGame() {
  const level = levels[currentLevel];
  nextLeafId = 1;
  state = {
    points: makePoints(level),
    leaves: [rootLeaf()],
    history: [],
    bestScore: 0,
    lastGain: 0,
  };
  splitAxis = "x";
  threshold.value = 0;
  missionText.textContent = level.description;
  levelSubtitle.textContent = level.name;
  toast.textContent = "点击画布或拖动阈值，给当前最混乱的叶子找一刀。";
  latestText.textContent = "未切分：整张地图只有一个叶子，预测全靠多数票。";
  trainingLog.reset();
  updatePickers();
  updateAxisButtons();
  draw();
  updateHud();
}

function applySplit(useBest = false) {
  const leaf = activeLeaf();
  const split = useBest ? bestSplit(leaf) : { axis: splitAxis, value: Number(threshold.value), gain: splitGain(leaf, splitAxis, Number(threshold.value)) };
  if (leaf.depth >= Number(maxDepth.value)) {
    toast.textContent = "当前叶子已经达到最大深度。";
    return;
  }
  if (!Number.isFinite(split.gain) || split.gain <= 0.001) {
    toast.textContent = "这一刀没有让叶子变纯，换个轴或阈值试试。";
    latestText.textContent = toast.textContent;
    return;
  }

  state.history.push({
    leaves: state.leaves.map((item) => ({ ...item })),
    bestScore: state.bestScore,
    lastGain: state.lastGain,
    nextLeafId,
  });

  const left = { ...leaf, id: nextLeafId++, depth: leaf.depth + 1, parent: leaf.id, rule: `${split.axis}<=${split.value.toFixed(2)}` };
  const right = { ...leaf, id: nextLeafId++, depth: leaf.depth + 1, parent: leaf.id, rule: `${split.axis}>${split.value.toFixed(2)}` };
  if (split.axis === "x") {
    left.xMax = split.value;
    right.xMin = split.value;
  } else {
    left.yMax = split.value;
    right.yMin = split.value;
  }
  state.leaves = state.leaves.filter((item) => item.id !== leaf.id).concat(left, right);
  splitAxis = split.axis;
  threshold.value = split.value;
  state.lastGain = split.gain;
  const result = treeMetrics();
  state.bestScore = Math.max(state.bestScore, result.score);
  toast.textContent = `切分叶子 #${leaf.id}：按 ${split.axis}=${split.value.toFixed(2)} 分裂，Gini 下降 ${split.gain.toFixed(3)}。`;
  latestText.textContent = `第 ${state.leaves.length - 1} 刀  叶子 ${state.leaves.length}  正确率 ${Math.round(result.accuracy * 100)}%  增益 ${split.gain.toFixed(3)}`;
  trainingLog.add(latestText.textContent);
  updateAxisButtons();
  draw();
  updateHud();
  if (result.score >= levels[currentLevel].target) {
    toast.textContent = `通关！分类得分 ${result.score.toFixed(2)}，用了 ${state.leaves.length} 个叶子。`;
    latestText.textContent = toast.textContent;
  }
}

function undo() {
  const previous = state.history.pop();
  if (!previous) {
    toast.textContent = "还没有可以撤回的切分。";
    return;
  }
  state.leaves = previous.leaves;
  state.bestScore = previous.bestScore;
  state.lastGain = previous.lastGain;
  nextLeafId = previous.nextLeafId;
  latestText.textContent = "撤回一刀，树回到上一版。";
  trainingLog.removeLatest();
  draw();
  updateHud();
}

function updateHud() {
  const result = treeMetrics();
  state.bestScore = Math.max(state.bestScore, result.score);
  const split = bestSplit(activeLeaf());
  runtime.setText(scoreValue, result.score.toFixed(2));
  runtime.setText(leafValue, state.leaves.length);
  runtime.setText(targetLabel, `目标 ${levels[currentLevel].target.toFixed(2)}`);
  runtime.setProgress(progressFill, result.score / levels[currentLevel].target);
  runtime.setText(bestLabel, state.leaves.length > 1 ? `最佳 ${state.bestScore.toFixed(2)}` : "等待开始");
  thresholdLabel.textContent = Number(threshold.value).toFixed(2);
  depthLabel.textContent = maxDepth.value;
  formulaLabel.textContent = state.leaves.length > 1 ? `${state.leaves.length} 个叶子` : "等待切分";
  accuracyLabel.textContent = `${Math.round(result.accuracy * 100)}%`;
  gainLabel.textContent = Number.isFinite(split.gain) ? split.gain.toFixed(3) : "--";
  leafLabel.textContent = state.leaves.length;
  depthStatLabel.textContent = result.depth;
  impurityLabel.textContent = result.impurity.toFixed(2);
  bestScoreLabel.textContent = state.bestScore.toFixed(2);
}

function setView(view) {
  activeView = view;
  runtime.setActiveSegment(viewPicker, view);
  const labels = {
    regions: "区域视图：每个矩形叶子用多数票决定预测颜色。",
    gain: "增益视图：候选切分线越能降低 Gini，不纯度下降越明显。",
    tree: "树形视图：看每一刀如何把父叶子分成两个子叶子。",
    errors: "错分视图：被圈出的样本说明当前树还没解释好。",
  };
  toast.textContent = labels[view];
  runtime.setShapeContext(labels[view]);
  draw();
}

function updateAxisButtons() {
  axisPicker.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.axis === splitAxis));
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
  if (activeView === "tree") drawTree(bounds);
  else {
    drawRegions(bounds);
    drawGrid(bounds);
    drawCandidate(bounds);
    drawPoints(bounds);
  }
  drawAxes(bounds);
}

function drawGrid(bounds) {
  ctx.save();
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

function drawRegions(bounds) {
  ctx.save();
  ctx.fillStyle = "rgba(7,16,28,0.34)";
  ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
  state.leaves.forEach((leaf) => {
    const points = pointsInLeaf(leaf);
    const label = majority(points);
    const x = bounds.left + ((leaf.xMin + 1) / 2) * bounds.width;
    const y = bounds.bottom - ((leaf.yMax + 1) / 2) * bounds.height;
    const width = ((leaf.xMax - leaf.xMin) / 2) * bounds.width;
    const height = ((leaf.yMax - leaf.yMin) / 2) * bounds.height;
    ctx.fillStyle = label === 1 ? "rgba(34,240,164,0.14)" : "rgba(59,215,255,0.14)";
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = leaf.id === activeLeaf().id ? "#ffd447" : "rgba(255,243,214,0.35)";
    ctx.lineWidth = leaf.id === activeLeaf().id ? 4 : 2;
    ctx.strokeRect(x, y, width, height);
  });
  ctx.restore();
}

function drawCandidate(bounds) {
  const leaf = activeLeaf();
  const value = Number(threshold.value);
  ctx.save();
  ctx.strokeStyle = activeView === "gain" ? "#ffd447" : "#22f0a4";
  ctx.lineWidth = activeView === "gain" ? 5 : 3;
  ctx.setLineDash([10, 6]);
  ctx.beginPath();
  if (splitAxis === "x") {
    const x = bounds.left + ((value + 1) / 2) * bounds.width;
    ctx.moveTo(x, bounds.bottom - ((leaf.yMax + 1) / 2) * bounds.height);
    ctx.lineTo(x, bounds.bottom - ((leaf.yMin + 1) / 2) * bounds.height);
  } else {
    const y = bounds.bottom - ((value + 1) / 2) * bounds.height;
    ctx.moveTo(bounds.left + ((leaf.xMin + 1) / 2) * bounds.width, y);
    ctx.lineTo(bounds.left + ((leaf.xMax + 1) / 2) * bounds.width, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawPoints(bounds) {
  ctx.save();
  state.points.forEach((point) => {
    const x = px(point, bounds);
    const y = py(point, bounds);
    const wrong = prediction(point) !== point.label;
    ctx.fillStyle = point.label === 1 ? "#22f0a4" : "#3bd7ff";
    ctx.strokeStyle = wrong && activeView === "errors" ? "#ff5f57" : "#05060c";
    ctx.lineWidth = wrong && activeView === "errors" ? 5 : 4;
    if (point.label === 1) {
      ctx.fillRect(x - 7, y - 7, 14, 14);
      ctx.strokeRect(x - 7, y - 7, 14, 14);
    } else {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-7, -7, 14, 14);
      ctx.strokeRect(-7, -7, 14, 14);
      ctx.restore();
    }
  });
  ctx.restore();
}

function drawTree(bounds) {
  ctx.save();
  ctx.fillStyle = "rgba(7,16,28,0.34)";
  ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
  const depth = Math.max(1, treeMetrics().depth);
  state.leaves.forEach((leaf, index) => {
    const x = bounds.left + ((index + 1) / (state.leaves.length + 1)) * bounds.width;
    const y = bounds.top + ((leaf.depth + 1) / (depth + 2)) * bounds.height;
    const points = pointsInLeaf(leaf);
    ctx.fillStyle = majority(points) === 1 ? "#123126" : "#0d3342";
    ctx.strokeStyle = leaf.id === activeLeaf().id ? "#ffd447" : "#33476f";
    ctx.lineWidth = 4;
    ctx.fillRect(x - 42, y - 22, 84, 44);
    ctx.strokeRect(x - 42, y - 22, 84, 44);
    ctx.fillStyle = "#fff3d6";
    ctx.font = "12px Courier New, Microsoft YaHei, monospace";
    ctx.textAlign = "center";
    ctx.fillText(`#${leaf.id}  ${points.length}点`, x, y - 3);
    ctx.fillText(`纯度 ${Math.round((1 - gini(points)) * 100)}%`, x, y + 13);
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

threshold.addEventListener("input", () => {
  updateHud();
  draw();
});
maxDepth.addEventListener("input", updateHud);
axisPicker.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-axis]");
  if (!button) return;
  splitAxis = button.dataset.axis;
  updateAxisButtons();
  updateHud();
  draw();
});
stepBtn.addEventListener("click", () => applySplit(false));
bestBtn.addEventListener("click", () => {
  const split = bestSplit(activeLeaf());
  if (!Number.isFinite(split.gain)) return;
  splitAxis = split.axis;
  threshold.value = split.value;
  updateAxisButtons();
  applySplit(true);
});
undoBtn.addEventListener("click", undo);
resetBtn.addEventListener("click", resetGame);
nextLevelBtn.addEventListener("click", nextLevel);
runtime.bindSegmentedPicker(viewPicker, setView);
canvas.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();
  const bounds = chartBounds();
  const point = pointFromCanvas(event.clientX - rect.left, event.clientY - rect.top, bounds);
  threshold.value = splitAxis === "x" ? point.x : point.y;
  thresholdLabel.textContent = Number(threshold.value).toFixed(2);
  draw();
});
window.addEventListener("resize", fitCanvas);

resetGame();
requestAnimationFrame(fitCanvas);
