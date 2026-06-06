const $ = (selector) => document.querySelector(selector);
const canvas = $("#chart");
const ctx = canvas.getContext("2d");
const runtime = window.LabRuntime;
const modelMath = window.LinearModel;
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
const batchSize = $("#batchSize");
const rateLabel = $("#rateLabel");
const batchLabel = $("#batchLabel");
const stepBtn = $("#stepBtn");
const autoBtn = $("#autoBtn");
const undoBtn = $("#undoBtn");
const resetBtn = $("#resetBtn");
const nextLevelBtn = $("#nextLevelBtn");
const formulaLabel = $("#formulaLabel");
const mseLabel = $("#mseLabel");
const slopeLabel = $("#slopeLabel");
const biasLabel = $("#biasLabel");
const gradLabel = $("#gradLabel");
const samplesLabel = $("#samplesLabel");
const bestScoreLabel = $("#bestScoreLabel");

const levels = [
  { shortName: "上升", name: "入门：单调上升", target: 0.94, description: "点云沿一条上升直线散开，学习斜率和截距就能通关。", points: [[-0.9,-0.62],[-0.72,-0.5],[-0.52,-0.32],[-0.32,-0.18],[-0.12,-0.02],[0.08,0.1],[0.28,0.22],[0.48,0.42],[0.68,0.52],[0.88,0.68]] },
  { shortName: "偏移", name: "进阶：截距偏移", target: 0.92, description: "这组数据整体抬高，模型需要同时学斜率和截距。", points: [[-0.9,-0.15],[-0.7,-0.1],[-0.52,0.02],[-0.34,0.14],[-0.1,0.2],[0.12,0.34],[0.34,0.46],[0.54,0.55],[0.74,0.68],[0.9,0.74]] },
  { shortName: "噪声", name: "挑战：带噪点云", target: 0.86, description: "有几处噪声偏离趋势，不要让直线追着单个点跑。", points: [[-0.9,-0.52],[-0.72,-0.7],[-0.5,-0.18],[-0.3,-0.28],[-0.08,0.08],[0.12,-0.02],[0.32,0.4],[0.5,0.28],[0.72,0.72],[0.9,0.58]] },
];

let levelIndex = 0;
let state;
let view = "fit";
const autoTrainer = runtime.createAutoTrainer({
  button: autoBtn,
  idleLabel: "自动训练",
  activeLabel: "暂停自动",
  intervalMs: 520,
  step: trainStep,
});

function predict(x, model = state) {
  return modelMath.predict(x, model);
}

function mse(model = state) {
  return modelMath.mse(state.points, model);
}

function gradient(model = state) {
  return modelMath.gradient(state.points, model);
}

function score() {
  return modelMath.score(state.points, state, state.baseline);
}

function resetGame() {
  stopAuto();
  const level = levels[levelIndex];
  state = { points: level.points.map(([x, y]) => ({ x, y })), w: 0, b: 0, round: 0, best: 0, history: [], loss: [] };
  state.baseline = Math.max(0.08, mse({ w: 0, b: 0 }) * 1.45);
  missionText.textContent = level.description;
  levelSubtitle.textContent = level.name;
  toast.textContent = "训练会沿着 MSE 的负梯度移动直线。";
  latestText.textContent = "未训练：直线从水平线开始，等待梯度下降。";
  renderPickers();
  draw();
  updateHud();
}

function trainStep() {
  state.history.push({ w: state.w, b: state.b, round: state.round, best: state.best, loss: [...state.loss] });
  const lr = Number(learningRate.value);
  const trained = modelMath.train(state.points, state, lr, Number(batchSize.value));
  state.w = trained.w;
  state.b = trained.b;
  state.round += 1;
  const currentMse = mse();
  state.loss.push(currentMse);
  state.best = Math.max(state.best, score());
  toast.textContent = `第 ${state.round} 轮：斜率和截距沿负梯度移动，MSE 降到 ${currentMse.toFixed(3)}。`;
  latestText.textContent = `第 ${state.round} 轮  MSE ${currentMse.toFixed(3)}  w ${state.w.toFixed(2)}  b ${state.b.toFixed(2)}`;
  draw();
  updateHud();
  if (score() >= levels[levelIndex].target) {
    toast.textContent = `通关！拟合得分 ${score().toFixed(2)}，直线已经贴住主要趋势。`;
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
  const currentScore = score();
  state.best = Math.max(state.best, currentScore);
  const grad = gradient();
  runtime.setText(scoreValue, currentScore.toFixed(2));
  runtime.setText(roundValue, state.round);
  runtime.setText(targetLabel, `目标 ${levels[levelIndex].target.toFixed(2)}`);
  runtime.setProgress(progressFill, currentScore / levels[levelIndex].target);
  runtime.setText(bestLabel, state.round ? `最佳 ${state.best.toFixed(2)}` : "等待开始");
  rateLabel.textContent = Number(learningRate.value).toFixed(2);
  batchLabel.textContent = batchSize.value;
  formulaLabel.textContent = `y=${state.w.toFixed(2)}x${state.b >= 0 ? "+" : ""}${state.b.toFixed(2)}`;
  mseLabel.textContent = mse().toFixed(3);
  slopeLabel.textContent = state.w.toFixed(2);
  biasLabel.textContent = state.b.toFixed(2);
  gradLabel.textContent = Math.hypot(grad.dw, grad.db).toFixed(2);
  samplesLabel.textContent = state.points.length;
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
  const text = { fit: "拟合视图：蓝线是当前模型，黄色点是真实样本。", residual: "残差视图：红线越短，预测越接近样本。", gradient: "梯度视图：箭头显示参数下一步移动方向。", loss: "损失视图：MSE 曲线下降代表训练有效。" }[view];
  toast.textContent = text;
  latestText.textContent = text;
  draw();
}

const fitCanvas = runtime.makeCanvasFitter(canvas, ctx, draw, { minWidth: 1, minHeight: 1 });

function bounds() {
  const rect = canvas.getBoundingClientRect();
  return { left: 4, top: 4, right: rect.width - 6, bottom: rect.height - 10, width: rect.width - 10, height: rect.height - 14 };
}

function px(x, b) { return b.left + ((x + 1) / 2) * b.width; }
function py(y, b) { return b.bottom - ((y + 1) / 2) * b.height; }

function draw() {
  if (!state) return;
  const b = bounds();
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  drawGrid(b);
  if (view === "loss") drawLoss(b);
  else {
    if (view === "residual") drawResiduals(b);
    if (view === "gradient") drawGradient(b);
    drawLine(b);
    drawPoints(b);
  }
  drawAxes(b);
}

function drawGrid(b) {
  ctx.fillStyle = "rgba(7,16,28,0.34)";
  ctx.fillRect(b.left, b.top, b.width, b.height);
  ctx.strokeStyle = "rgba(139,211,255,0.14)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 8; i += 1) {
    const x = Math.round(b.left + (b.width / 8) * i) + 0.5;
    ctx.beginPath(); ctx.moveTo(x, b.top); ctx.lineTo(x, b.bottom); ctx.stroke();
  }
  for (let i = 0; i <= 4; i += 1) {
    const y = Math.round(b.top + (b.height / 4) * i) + 0.5;
    ctx.beginPath(); ctx.moveTo(b.left, y); ctx.lineTo(b.right, y); ctx.stroke();
  }
}

function drawAxes(b) {
  ctx.strokeStyle = "rgba(255,243,214,0.58)";
  ctx.fillStyle = "rgba(255,243,214,0.72)";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(b.left, b.top); ctx.lineTo(b.left, b.bottom); ctx.lineTo(b.right, b.bottom); ctx.stroke();
  ctx.font = "12px Courier New, Microsoft YaHei, monospace";
  ctx.fillText("目标 y", b.left + 10, b.top + 18);
  ctx.textAlign = "right"; ctx.fillText("特征 x", b.right - 8, b.bottom - 10); ctx.textAlign = "left";
}

function drawPoints(b) {
  state.points.forEach((point) => {
    ctx.fillStyle = "#ffd447";
    ctx.strokeStyle = "#05060c";
    ctx.lineWidth = 4;
    ctx.fillRect(px(point.x, b) - 7, py(point.y, b) - 7, 14, 14);
    ctx.strokeRect(px(point.x, b) - 7, py(point.y, b) - 7, 14, 14);
  });
}

function drawLine(b) {
  ctx.strokeStyle = "#3bd7ff";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(px(-1, b), py(predict(-1), b));
  ctx.lineTo(px(1, b), py(predict(1), b));
  ctx.stroke();
}

function drawResiduals(b) {
  ctx.strokeStyle = "#ff5f57";
  ctx.lineWidth = 3;
  state.points.forEach((point) => {
    ctx.beginPath();
    ctx.moveTo(px(point.x, b), py(point.y, b));
    ctx.lineTo(px(point.x, b), py(predict(point.x), b));
    ctx.stroke();
  });
}

function drawGradient(b) {
  const grad = gradient();
  ctx.fillStyle = "#22f0a4";
  ctx.font = "18px Courier New, Microsoft YaHei, monospace";
  ctx.fillText(`dw ${(-grad.dw).toFixed(2)}   db ${(-grad.db).toFixed(2)}`, b.left + 20, b.top + 46);
}

function drawLoss(b) {
  const values = state.loss.length ? state.loss : [mse()];
  const max = Math.max(...values, state.baseline);
  ctx.strokeStyle = "#22f0a4";
  ctx.lineWidth = 5;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = b.left + (index / Math.max(1, values.length - 1)) * b.width;
    const y = b.bottom - (1 - value / max) * b.height;
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

learningRate.addEventListener("input", updateHud);
batchSize.addEventListener("input", updateHud);
stepBtn.addEventListener("click", trainStep);
autoBtn.addEventListener("click", toggleAuto);
undoBtn.addEventListener("click", undo);
resetBtn.addEventListener("click", resetGame);
nextLevelBtn.addEventListener("click", () => { levelIndex = (levelIndex + 1) % levels.length; resetGame(); });
runtime.bindSegmentedPicker(viewPicker, setView);
window.addEventListener("resize", fitCanvas);
resetGame();
requestAnimationFrame(fitCanvas);
