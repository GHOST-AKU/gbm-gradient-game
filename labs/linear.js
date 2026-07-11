const runtime = window.LabRuntime;
const $ = runtime.query;
const canvas = $("#chart");
const ctx = canvas.getContext("2d");
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
let controller;
const history = runtime.createHistory();
const plane = runtime.createCartesianPlane(canvas);

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
  const level = levels[levelIndex];
  state = { points: level.points.map(([x, y]) => ({ x, y })), w: 0, b: 0, round: 0, best: 0, loss: [] };
  state.baseline = Math.max(0.08, mse({ w: 0, b: 0 }) * 1.45);
  missionText.textContent = level.description;
  levelSubtitle.textContent = level.name;
  toast.textContent = "训练会沿着 MSE 的负梯度移动直线。";
  latestText.textContent = "未训练：直线从水平线开始，等待梯度下降。";
  history.clear();
  controller.trainingLog.reset();
  controller.render();
  updateHud();
}

function trainStep() {
  history.push({ w: state.w, b: state.b, round: state.round, best: state.best });
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
  controller.trainingLog.add(latestText.textContent);
  controller.render();
  updateHud();
  if (score() >= levels[levelIndex].target) {
    toast.textContent = `通关！拟合得分 ${score().toFixed(2)}，直线已经贴住主要趋势。`;
    latestText.textContent = toast.textContent;
    controller.stopAuto();
  }
}

function undo() {
  const previous = history.pop();
  if (!previous) {
    toast.textContent = "还没有可以撤回的训练。";
    return;
  }
  Object.assign(state, previous);
  state.loss.pop();
  latestText.textContent = state.round ? `已撤回到第 ${state.round} 轮。` : "未训练：直线从水平线开始，等待梯度下降。";
  controller.trainingLog.removeLatest();
  controller.render();
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

function setView(next) {
  view = next;
  const text = { fit: "拟合视图：蓝线是当前模型，黄色点是真实样本。", residual: "残差视图：红线越短，预测越接近样本。", gradient: "梯度视图：箭头显示参数下一步移动方向。", loss: "损失视图：MSE 曲线下降代表训练有效。" }[view];
  toast.textContent = text;
  runtime.setShapeContext(text);
}

function draw() {
  if (!state) return;
  const b = plane.bounds();
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  ctx.fillStyle = "rgba(7,16,28,0.34)";
  ctx.fillRect(b.left, b.top, b.width, b.height);
  runtime.drawGrid(ctx, b);
  if (view === "loss") drawLoss(b);
  else {
    if (view === "residual") drawResiduals(b);
    if (view === "gradient") drawGradient(b);
    drawLine(b);
    drawPoints(b);
  }
  drawAxes(b);
}

function drawAxes(b) {
  runtime.drawAxes(ctx, b, { xLabel: "特征 x", yLabel: "目标 y" });
}

function drawPoints(b) {
  state.points.forEach((point) => {
    ctx.fillStyle = "#ffd447";
    ctx.strokeStyle = "#05060c";
    ctx.lineWidth = 4;
    ctx.fillRect(plane.toX(point.x, b) - 7, plane.toY(point.y, b) - 7, 14, 14);
    ctx.strokeRect(plane.toX(point.x, b) - 7, plane.toY(point.y, b) - 7, 14, 14);
  });
}

function drawLine(b) {
  ctx.strokeStyle = "#3bd7ff";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(plane.toX(-1, b), plane.toY(predict(-1), b));
  ctx.lineTo(plane.toX(1, b), plane.toY(predict(1), b));
  ctx.stroke();
}

function drawResiduals(b) {
  ctx.strokeStyle = "#ff5f57";
  ctx.lineWidth = 3;
  state.points.forEach((point) => {
    ctx.beginPath();
    ctx.moveTo(plane.toX(point.x, b), plane.toY(point.y, b));
    ctx.lineTo(plane.toX(point.x, b), plane.toY(predict(point.x), b));
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
  runtime.drawSeries(ctx, values, b, { min: 0, max, color: "#22f0a4", lineWidth: 5 });
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
  auto: { button: autoBtn, idleLabel: "自动训练", activeLabel: "暂停自动", intervalMs: 520, step: trainStep },
  actions: {
    stepButton: stepBtn,
    step: trainStep,
    undoButton: undoBtn,
    undo,
    resetButton: resetBtn,
    nextButton: nextLevelBtn,
  },
  inputs: [
    { element: learningRate, handler: updateHud },
    { element: batchSize, handler: updateHud },
  ],
  canvasOptions: { minWidth: 1, minHeight: 1 },
});
controller.start();
