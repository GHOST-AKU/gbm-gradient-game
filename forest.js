const $ = (selector) => document.querySelector(selector);
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

const levels = [
  { shortName: "阶梯", name: "入门：矩形阶梯", target: 0.9, description: "每棵树用矩形切分，森林投票后边界更稳定。", points: [[-0.82,-0.58,0],[-0.66,-0.36,0],[-0.5,-0.12,0],[-0.32,0.18,0],[-0.72,0.56,0],[-0.14,-0.62,0],[0.08,-0.42,0],[0.2,-0.12,1],[0.38,0.18,1],[0.56,0.46,1],[0.78,0.66,1],[0.66,-0.32,1],[-0.08,0.48,1],[0.18,0.72,1]] },
  { shortName: "异或", name: "进阶：异或投票", target: 0.86, description: "单棵浅树容易偏，但多棵随机树会把角落规律投出来。", points: [[-0.82,-0.66,1],[-0.58,-0.48,1],[-0.76,-0.2,1],[-0.36,-0.72,1],[0.42,0.5,1],[0.66,0.72,1],[0.82,0.28,1],[0.28,0.78,1],[-0.72,0.46,0],[-0.48,0.72,0],[-0.22,0.28,0],[-0.66,0.12,0],[0.28,-0.66,0],[0.52,-0.34,0],[0.74,-0.62,0],[0.18,-0.18,0]] },
  { shortName: "噪声", name: "挑战：带噪森林", target: 0.82, description: "有噪声点时，随机采样和投票能避免单棵树被带偏。", points: [[-0.82,-0.52,0],[-0.62,-0.4,0],[-0.48,0.08,0],[-0.34,0.42,0],[-0.12,-0.2,0],[0.08,0.16,0],[0.02,-0.48,1],[0.28,-0.12,1],[0.46,0.26,1],[0.6,0.5,1],[0.8,0.18,1],[0.64,-0.44,1],[-0.72,0.7,1],[0.72,-0.7,0]] },
];

let levelIndex = 0;
let state;
let view = "vote";
let autoTimer = null;

function rng(seed) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function gini(points) {
  if (!points.length) return 0;
  const p = points.filter((point) => point.label === 1).length / points.length;
  return 1 - p * p - (1 - p) * (1 - p);
}

function majority(points) {
  const vote = points.reduce((sum, point) => sum + (point.label ? 1 : -1), 0);
  return vote >= 0 ? 1 : 0;
}

function bestSplit(points, axes) {
  let best = { gain: -Infinity };
  axes.forEach((axis) => {
    const values = [...new Set(points.map((point) => point[axis]))].sort((a, b) => a - b);
    for (let i = 0; i < values.length - 1; i += 1) {
      const value = (values[i] + values[i + 1]) / 2;
      const left = points.filter((point) => point[axis] <= value);
      const right = points.filter((point) => point[axis] > value);
      if (!left.length || !right.length) continue;
      const gain = gini(points) - (gini(left) * left.length + gini(right) * right.length) / points.length;
      if (gain > best.gain) best = { axis, value, gain, left, right };
    }
  });
  return best;
}

function buildTree(points, depth, maxTreeDepth, rand, featureCount) {
  if (depth >= maxTreeDepth || points.length <= 2 || gini(points) < 0.02) return { leaf: true, label: majority(points), points: points.length };
  const axes = featureCount === 1 ? [rand() < 0.5 ? "x" : "y"] : ["x", "y"];
  const split = bestSplit(points, axes);
  if (!Number.isFinite(split.gain) || split.gain <= 0.001) return { leaf: true, label: majority(points), points: points.length };
  return {
    leaf: false,
    axis: split.axis,
    value: split.value,
    gain: split.gain,
    left: buildTree(split.left, depth + 1, maxTreeDepth, rand, featureCount),
    right: buildTree(split.right, depth + 1, maxTreeDepth, rand, featureCount),
  };
}

function predictTree(tree, point) {
  if (tree.leaf) return tree.label;
  return predictTree(point[tree.axis] <= tree.value ? tree.left : tree.right, point);
}

function forestVote(point) {
  if (!state.trees.length) return 0;
  const votes = state.trees.reduce((sum, tree) => sum + (predictTree(tree, point) ? 1 : -1), 0);
  return votes >= 0 ? 1 : 0;
}

function voteMargin(point) {
  if (!state.trees.length) return 0;
  const votes = state.trees.reduce((sum, tree) => sum + (predictTree(tree, point) ? 1 : -1), 0);
  return Math.abs(votes) / state.trees.length;
}

function metrics() {
  let correct = 0, margin = 0;
  state.points.forEach((point) => {
    if (forestVote(point) === point.label) correct += 1;
    margin += voteMargin(point);
  });
  const accuracy = correct / state.points.length;
  margin /= state.points.length;
  const score = state.trees.length ? Math.max(0, Math.min(0.99, accuracy * 0.78 + margin * 0.22 - Math.max(0, state.trees.length - 18) * 0.004)) : 0;
  return { accuracy, margin, score };
}

function resetGame() {
  stopAuto();
  const level = levels[levelIndex];
  state = { points: level.points.map(([x, y, label], index) => ({ x, y, label, index })), trees: [], bags: [], round: 0, best: 0, history: [] };
  missionText.textContent = level.description;
  levelSubtitle.textContent = level.name;
  toast.textContent = "每棵树从 bootstrap 样本里学习，再加入森林投票。";
  latestText.textContent = "未训练：森林里还没有树。";
  renderPickers();
  draw();
  updateHud();
}

function trainTree() {
  state.history.push({ trees: [...state.trees], bags: state.bags.map((bag) => [...bag]), round: state.round, best: state.best });
  const rand = rng(1337 + state.round * 97 + levelIndex * 31);
  const bag = Array.from({ length: state.points.length }, () => Math.floor(rand() * state.points.length));
  const sample = bag.map((index) => state.points[index]);
  const tree = buildTree(sample, 0, Number(maxDepth.value), rand, Number(featureRate.value));
  state.trees.push(tree);
  state.bags.push(bag);
  state.round += 1;
  const result = metrics();
  state.best = Math.max(state.best, result.score);
  toast.textContent = `第 ${state.round} 棵树：用随机样本训练完成，森林正确率 ${Math.round(result.accuracy * 100)}%。`;
  latestText.textContent = `第 ${state.round} 棵树  正确率 ${Math.round(result.accuracy * 100)}%  信心 ${Math.round(result.margin * 100)}%  得分 ${result.score.toFixed(2)}`;
  draw();
  updateHud();
  if (result.score >= levels[levelIndex].target && state.trees.length >= 3) {
    toast.textContent = `通关！森林投票得分 ${result.score.toFixed(2)}，边界已经稳定。`;
    latestText.textContent = toast.textContent;
    stopAuto();
  }
}

function undo() {
  const previous = state.history.pop();
  if (!previous) {
    toast.textContent = "还没有树可以砍掉。";
    return;
  }
  state.trees = previous.trees;
  state.bags = previous.bags;
  state.round = previous.round;
  state.best = previous.best;
  draw();
  updateHud();
}

function updateHud() {
  const result = metrics();
  state.best = Math.max(state.best, result.score);
  scoreValue.textContent = result.score.toFixed(2);
  roundValue.textContent = state.trees.length;
  targetLabel.textContent = `目标 ${levels[levelIndex].target.toFixed(2)}`;
  progressFill.style.width = `${Math.round(Math.min(1, result.score / levels[levelIndex].target) * 100)}%`;
  bestLabel.textContent = state.trees.length ? `最佳 ${state.best.toFixed(2)}` : "等待开始";
  depthLabel.textContent = maxDepth.value;
  featureLabel.textContent = featureRate.value;
  accuracyLabel.textContent = `${Math.round(result.accuracy * 100)}%`;
  marginLabel.textContent = `${Math.round(result.margin * 100)}%`;
  treeLabel.textContent = state.trees.length;
  oobLabel.textContent = `${Math.round(oobEstimate() * 100)}%`;
  depthStatLabel.textContent = maxDepth.value;
  bestScoreLabel.textContent = state.best.toFixed(2);
}

function oobEstimate() {
  if (!state.trees.length) return 0;
  let tested = 0, correct = 0;
  state.points.forEach((point, index) => {
    let votes = 0, count = 0;
    state.trees.forEach((tree, treeIndex) => {
      if (state.bags[treeIndex].includes(index)) return;
      votes += predictTree(tree, point) ? 1 : -1;
      count += 1;
    });
    if (count) {
      tested += 1;
      if ((votes >= 0 ? 1 : 0) === point.label) correct += 1;
    }
  });
  return tested ? correct / tested : metrics().accuracy;
}

function stopAuto() { if (autoTimer) clearInterval(autoTimer); autoTimer = null; autoBtn.textContent = "自动造林"; }
function toggleAuto() { if (autoTimer) return stopAuto(); autoBtn.textContent = "暂停造林"; trainTree(); autoTimer = setInterval(trainTree, 650); }

function renderPickers() {
  levelPicker.innerHTML = "";
  levels.forEach((level, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = level.shortName;
    button.className = index === levelIndex ? "active" : "";
    button.addEventListener("click", () => { levelIndex = index; resetGame(); });
    levelPicker.append(button);
  });
}

function setView(next) {
  view = next;
  viewPicker.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  const text = { vote: "投票视图：背景显示森林多数票分类。", trees: "树视图：显示最新一棵树的切分线。", margin: "信心视图：颜色越亮，投票越一致。", errors: "错分视图：红框标出当前森林还没投对的样本。" }[view];
  toast.textContent = text; latestText.textContent = text; draw();
}

function fitCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * scale);
  canvas.height = Math.floor(rect.height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  draw();
}

function bounds() { const rect = canvas.getBoundingClientRect(); return { left: 4, top: 4, right: rect.width - 6, bottom: rect.height - 10, width: rect.width - 10, height: rect.height - 14 }; }
function px(x, b) { return b.left + ((x + 1) / 2) * b.width; }
function py(y, b) { return b.bottom - ((y + 1) / 2) * b.height; }
function pointAt(x, y, b) { return { x: ((x - b.left) / b.width) * 2 - 1, y: ((b.bottom - y) / b.height) * 2 - 1 }; }

function draw() {
  if (!state) return;
  const b = bounds();
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  drawField(b);
  drawGrid(b);
  if (view === "trees" && state.trees.length) drawTreeLines(state.trees[state.trees.length - 1], b);
  drawPoints(b);
  drawAxes(b);
}

function drawField(b) {
  const cols = 44, rows = 28, cellW = b.width / cols, cellH = b.height / rows;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const point = pointAt(b.left + col * cellW + cellW / 2, b.top + row * cellH + cellH / 2, b);
      const label = forestVote(point);
      const alpha = view === "margin" ? 0.08 + voteMargin(point) * 0.28 : 0.18;
      ctx.fillStyle = label ? `rgba(34,240,164,${alpha})` : `rgba(59,215,255,${alpha})`;
      ctx.fillRect(b.left + col * cellW, b.top + row * cellH, Math.ceil(cellW), Math.ceil(cellH));
    }
  }
}

function drawGrid(b) {
  ctx.strokeStyle = "rgba(139,211,255,0.14)"; ctx.lineWidth = 2;
  for (let i = 0; i <= 8; i += 1) { const x = Math.round(b.left + (b.width / 8) * i) + 0.5; ctx.beginPath(); ctx.moveTo(x, b.top); ctx.lineTo(x, b.bottom); ctx.stroke(); }
  for (let i = 0; i <= 4; i += 1) { const y = Math.round(b.top + (b.height / 4) * i) + 0.5; ctx.beginPath(); ctx.moveTo(b.left, y); ctx.lineTo(b.right, y); ctx.stroke(); }
}

function drawTreeLines(tree, b, region = { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }) {
  if (tree.leaf) return;
  ctx.strokeStyle = "#ffd447"; ctx.lineWidth = 4; ctx.setLineDash([10, 6]); ctx.beginPath();
  if (tree.axis === "x") {
    const x = px(tree.value, b);
    ctx.moveTo(x, py(region.yMin, b)); ctx.lineTo(x, py(region.yMax, b));
    ctx.stroke();
    drawTreeLines(tree.left, b, { ...region, xMax: tree.value });
    drawTreeLines(tree.right, b, { ...region, xMin: tree.value });
  } else {
    const y = py(tree.value, b);
    ctx.moveTo(px(region.xMin, b), y); ctx.lineTo(px(region.xMax, b), y);
    ctx.stroke();
    drawTreeLines(tree.left, b, { ...region, yMax: tree.value });
    drawTreeLines(tree.right, b, { ...region, yMin: tree.value });
  }
  ctx.setLineDash([]);
}

function drawPoints(b) {
  state.points.forEach((point) => {
    const wrong = state.trees.length && forestVote(point) !== point.label;
    const x = px(point.x, b), y = py(point.y, b);
    ctx.fillStyle = point.label ? "#22f0a4" : "#3bd7ff";
    ctx.strokeStyle = wrong && view === "errors" ? "#ff5f57" : "#05060c";
    ctx.lineWidth = wrong && view === "errors" ? 5 : 4;
    if (point.label) { ctx.fillRect(x - 7, y - 7, 14, 14); ctx.strokeRect(x - 7, y - 7, 14, 14); }
    else { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-7, -7, 14, 14); ctx.strokeRect(-7, -7, 14, 14); ctx.restore(); }
  });
}

function drawAxes(b) {
  ctx.strokeStyle = "rgba(255,243,214,0.58)"; ctx.fillStyle = "rgba(255,243,214,0.72)"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(b.left, b.top); ctx.lineTo(b.left, b.bottom); ctx.lineTo(b.right, b.bottom); ctx.stroke();
  ctx.font = "12px Courier New, Microsoft YaHei, monospace"; ctx.fillText("特征 x2", b.left + 10, b.top + 18); ctx.textAlign = "right"; ctx.fillText("特征 x1", b.right - 8, b.bottom - 10); ctx.textAlign = "left";
}

maxDepth.addEventListener("input", updateHud);
featureRate.addEventListener("input", updateHud);
stepBtn.addEventListener("click", trainTree);
autoBtn.addEventListener("click", toggleAuto);
undoBtn.addEventListener("click", undo);
resetBtn.addEventListener("click", resetGame);
nextLevelBtn.addEventListener("click", () => { levelIndex = (levelIndex + 1) % levels.length; resetGame(); });
viewPicker.addEventListener("click", (event) => { const button = event.target.closest("button[data-view]"); if (button) setView(button.dataset.view); });
window.addEventListener("resize", fitCanvas);
resetGame();
requestAnimationFrame(fitCanvas);
