const $ = (selector) => document.querySelector(selector);
const canvas = $("#chart");
const ctx = canvas.getContext("2d");
const runtime = window.LabRuntime;
const modelMath = window.LogisticModel;
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
const learningRate = $("#learningRate");
const regularization = $("#regularization");
const rateLabel = $("#rateLabel");
const regLabel = $("#regLabel");
const stepBtn = $("#stepBtn");
const autoBtn = $("#autoBtn");
const undoBtn = $("#undoBtn");
const resetBtn = $("#resetBtn");
const nextLevelBtn = $("#nextLevelBtn");
const accuracyLabel = $("#accuracyLabel");
const lossLabel = $("#lossLabel");
const marginLabel = $("#marginLabel");
const wLabel = $("#wLabel");
const biasLabel = $("#biasLabel");
const bestScoreLabel = $("#bestScoreLabel");

const levels = [
  { shortName: "直线", name: "入门：清晰边界", target: 0.9, description: "两类样本大致线性可分，学习一条概率边界。", points: [[-0.82,-0.52,0],[-0.64,-0.28,0],[-0.48,0.02,0],[-0.3,0.36,0],[-0.72,0.42,0],[-0.12,-0.46,0],[0.12,-0.22,1],[0.3,0.1,1],[0.46,0.36,1],[0.66,0.58,1],[0.76,-0.2,1],[0.88,0.22,1]] },
  { shortName: "软边界", name: "进阶：少量重叠", target: 0.84, description: "少数样本混在边界附近，目标是概率稳定而不是硬追每个点。", points: [[-0.86,-0.5,0],[-0.62,-0.42,0],[-0.52,0.12,0],[-0.34,0.42,0],[-0.1,-0.2,0],[0.08,0.16,0],[0.02,-0.46,1],[0.26,-0.1,1],[0.44,0.26,1],[0.58,0.5,1],[0.78,0.18,1],[0.64,-0.42,1]] },
  { shortName: "斜率", name: "挑战：斜向边界", target: 0.86, description: "边界不是竖线，两个权重必须一起调整。", points: [[-0.82,0.22,0],[-0.68,0.58,0],[-0.46,0.12,0],[-0.28,0.48,0],[-0.12,-0.06,0],[0.12,-0.52,0],[0.08,0.2,1],[0.28,-0.2,1],[0.46,0.08,1],[0.62,-0.38,1],[0.78,0.26,1],[0.88,-0.08,1]] },
];

let levelIndex = 0;
let state;
let view = "prob";
const autoTrainer = runtime.createAutoTrainer({
  button: autoBtn,
  idleLabel: "自动训练",
  activeLabel: "暂停自动",
  intervalMs: 520,
  step: trainStep,
});

function sigmoid(z) { return modelMath.sigmoid(z); }
function logit(point, model = state) { return modelMath.logit(point, model); }
function prob(point, model = state) { return modelMath.probability(point, model); }

function metrics(model = state) {
  return modelMath.metrics(state.points, model);
}

function resetGame() {
  stopAuto();
  const level = levels[levelIndex];
  state = { points: level.points.map(([x, y, label]) => ({ x, y, label })), w1: 0.1, w2: -0.1, b: 0, round: 0, best: 0, history: [], lossHistory: [] };
  missionText.textContent = level.description;
  levelSubtitle.textContent = level.name;
  toast.textContent = "梯度下降会降低交叉熵，让正类概率升高、负类概率降低。";
  latestText.textContent = "未训练：所有点先按初始概率判断。";
  renderPickers();
  draw();
  updateHud();
}

function trainStep() {
  state.history.push({ w1: state.w1, w2: state.w2, b: state.b, round: state.round, best: state.best, lossHistory: [...state.lossHistory] });
  const lr = Number(learningRate.value);
  const reg = Number(regularization.value);
  Object.assign(state, modelMath.train(state.points, state, lr, reg, 12));
  state.round += 1;
  const result = metrics();
  state.best = Math.max(state.best, result.score);
  state.lossHistory.push(result.loss);
  toast.textContent = `第 ${state.round} 轮：边界向错分和低信心样本移动，交叉熵 ${result.loss.toFixed(3)}。`;
  latestText.textContent = `第 ${state.round} 轮  正确率 ${Math.round(result.accuracy * 100)}%  损失 ${result.loss.toFixed(3)}  得分 ${result.score.toFixed(2)}`;
  draw();
  updateHud();
  if (result.score >= levels[levelIndex].target) {
    toast.textContent = `通关！概率边界已经稳定分开两类，得分 ${result.score.toFixed(2)}。`;
    latestText.textContent = toast.textContent;
    stopAuto();
  }
}

function undo() {
  const previous = state.history.pop();
  if (!previous) {
    toast.textContent = "还没有可以撤回的训练。";
    return;
  }
  Object.assign(state, previous);
  draw();
  updateHud();
}

function updateHud() {
  const result = metrics();
  state.best = Math.max(state.best, result.score);
  runtime.setText(scoreValue, result.score.toFixed(2));
  runtime.setText(roundValue, state.round);
  runtime.setText(targetLabel, `目标 ${levels[levelIndex].target.toFixed(2)}`);
  runtime.setProgress(progressFill, result.score / levels[levelIndex].target);
  runtime.setText(bestLabel, state.round ? `最佳 ${state.best.toFixed(2)}` : "等待开始");
  rateLabel.textContent = Number(learningRate.value).toFixed(2);
  regLabel.textContent = Number(regularization.value).toFixed(2);
  accuracyLabel.textContent = `${Math.round(result.accuracy * 100)}%`;
  lossLabel.textContent = result.loss.toFixed(3);
  marginLabel.textContent = `${Math.round(result.confidence * 100)}%`;
  wLabel.textContent = `${state.w1.toFixed(1)},${state.w2.toFixed(1)}`;
  biasLabel.textContent = state.b.toFixed(2);
  bestScoreLabel.textContent = state.best.toFixed(2);
}

function stopAuto() { autoTrainer.stop(); }
function toggleAuto() { autoTrainer.toggle(); }

function renderPickers() {
  runtime.renderChoicePicker(levelPicker, levels, levelIndex, (index) => {
    levelIndex = index;
    resetGame();
  });
}

function setView(next) {
  view = next;
  runtime.setActiveSegment(viewPicker, view);
  const text = { prob: "概率视图：背景越绿，模型越相信这里是正类。", boundary: "边界视图：亮线是 p=0.5 的分类边界。", loss: "损失视图：交叉熵下降代表概率更可信。", weights: "权重视图：两个权重决定边界方向，偏置决定平移。" }[view];
  toast.textContent = text; latestText.textContent = text; draw();
}

const fitCanvas = runtime.makeCanvasFitter(canvas, ctx, draw, { minWidth: 1, minHeight: 1 });

function bounds() { const rect = canvas.getBoundingClientRect(); return { left: 4, top: 4, right: rect.width - 6, bottom: rect.height - 10, width: rect.width - 10, height: rect.height - 14 }; }
function px(x, b) { return b.left + ((x + 1) / 2) * b.width; }
function py(y, b) { return b.bottom - ((y + 1) / 2) * b.height; }
function pointAt(x, y, b) { return { x: ((x - b.left) / b.width) * 2 - 1, y: ((b.bottom - y) / b.height) * 2 - 1 }; }

function draw() {
  if (!state) return;
  const b = bounds();
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  if (view === "loss") drawLoss(b);
  else {
    drawField(b);
    drawGrid(b);
    drawBoundary(b);
    drawPoints(b);
    if (view === "weights") drawWeights(b);
  }
  drawAxes(b);
}

function drawField(b) {
  const cols = 42, rows = 26, cellW = b.width / cols, cellH = b.height / rows;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const p = prob(pointAt(b.left + col * cellW + cellW / 2, b.top + row * cellH + cellH / 2, b));
      const color = p >= 0.5 ? `rgba(34,240,164,${0.08 + p * 0.2})` : `rgba(59,215,255,${0.08 + (1 - p) * 0.2})`;
      ctx.fillStyle = color;
      ctx.fillRect(b.left + col * cellW, b.top + row * cellH, Math.ceil(cellW), Math.ceil(cellH));
    }
  }
}

function drawGrid(b) {
  ctx.strokeStyle = "rgba(139,211,255,0.14)"; ctx.lineWidth = 2;
  for (let i = 0; i <= 8; i += 1) { const x = Math.round(b.left + (b.width / 8) * i) + 0.5; ctx.beginPath(); ctx.moveTo(x, b.top); ctx.lineTo(x, b.bottom); ctx.stroke(); }
  for (let i = 0; i <= 4; i += 1) { const y = Math.round(b.top + (b.height / 4) * i) + 0.5; ctx.beginPath(); ctx.moveTo(b.left, y); ctx.lineTo(b.right, y); ctx.stroke(); }
}

function drawBoundary(b) {
  if (Math.abs(state.w2) < 0.001) return;
  ctx.strokeStyle = "#fff3d6"; ctx.lineWidth = view === "boundary" ? 6 : 4; ctx.beginPath();
  const y1 = -(state.w1 * -1 + state.b) / state.w2;
  const y2 = -(state.w1 * 1 + state.b) / state.w2;
  ctx.moveTo(px(-1, b), py(y1, b)); ctx.lineTo(px(1, b), py(y2, b)); ctx.stroke();
}

function drawPoints(b) {
  state.points.forEach((point) => {
    const p = prob(point);
    const wrong = (p >= 0.5 ? 1 : 0) !== point.label;
    ctx.fillStyle = point.label ? "#22f0a4" : "#3bd7ff";
    ctx.strokeStyle = wrong ? "#ff5f57" : "#05060c";
    ctx.lineWidth = wrong && view === "loss" ? 5 : 4;
    const x = px(point.x, b), y = py(point.y, b);
    if (point.label) { ctx.fillRect(x - 7, y - 7, 14, 14); ctx.strokeRect(x - 7, y - 7, 14, 14); }
    else { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-7, -7, 14, 14); ctx.strokeRect(-7, -7, 14, 14); ctx.restore(); }
  });
}

function drawWeights(b) {
  ctx.fillStyle = "#ffd447";
  ctx.font = "18px Courier New, Microsoft YaHei, monospace";
  ctx.fillText(`w1 ${state.w1.toFixed(2)}   w2 ${state.w2.toFixed(2)}   b ${state.b.toFixed(2)}`, b.left + 22, b.top + 44);
}

function drawAxes(b) {
  ctx.strokeStyle = "rgba(255,243,214,0.58)"; ctx.fillStyle = "rgba(255,243,214,0.72)"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(b.left, b.top); ctx.lineTo(b.left, b.bottom); ctx.lineTo(b.right, b.bottom); ctx.stroke();
  ctx.font = "12px Courier New, Microsoft YaHei, monospace"; ctx.fillText("特征 x2", b.left + 10, b.top + 18); ctx.textAlign = "right"; ctx.fillText("特征 x1", b.right - 8, b.bottom - 10); ctx.textAlign = "left";
}

function drawLoss(b) {
  drawField(b); drawGrid(b);
  const values = state.lossHistory.length ? state.lossHistory : [metrics().loss];
  const max = Math.max(...values, 0.8);
  ctx.strokeStyle = "#22f0a4"; ctx.lineWidth = 5; ctx.beginPath();
  values.forEach((value, index) => { const x = b.left + (index / Math.max(1, values.length - 1)) * b.width; const y = b.bottom - (1 - value / max) * b.height; if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  ctx.stroke();
  drawBoundary(b);
  drawPoints(b);
}

learningRate.addEventListener("input", updateHud);
regularization.addEventListener("input", updateHud);
stepBtn.addEventListener("click", trainStep);
autoBtn.addEventListener("click", toggleAuto);
undoBtn.addEventListener("click", undo);
resetBtn.addEventListener("click", resetGame);
nextLevelBtn.addEventListener("click", () => { levelIndex = (levelIndex + 1) % levels.length; resetGame(); });
runtime.bindSegmentedPicker(viewPicker, setView);
window.addEventListener("resize", fitCanvas);
resetGame();
requestAnimationFrame(fitCanvas);
