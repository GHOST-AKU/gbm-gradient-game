const runtime = window.LabRuntime;
const $ = runtime.query;
const canvas = $("#chart");
const ctx = canvas.getContext("2d");
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
let controller;
const history = runtime.createHistory();
const plane = runtime.createCartesianPlane(canvas);
const fieldRenderer = runtime.createFieldRenderer(ctx);

function sigmoid(z) { return modelMath.sigmoid(z); }
function logit(point, model = state) { return modelMath.logit(point, model); }
function prob(point, model = state) { return modelMath.probability(point, model); }

function metrics(model = state) {
  return modelMath.metrics(state.points, model);
}

function resetGame() {
  const level = levels[levelIndex];
  state = { points: level.points.map(([x, y, label]) => ({ x, y, label })), w1: 0.1, w2: -0.1, b: 0, round: 0, best: 0, lossHistory: [] };
  missionText.textContent = level.description;
  levelSubtitle.textContent = level.name;
  toast.textContent = "梯度下降会降低交叉熵，让正类概率升高、负类概率降低。";
  latestText.textContent = "未训练：所有点先按初始概率判断。";
  history.clear();
  controller.trainingLog.reset();
  controller.render();
  updateHud();
}

function trainStep() {
  history.push({ w1: state.w1, w2: state.w2, b: state.b, round: state.round, best: state.best });
  const lr = Number(learningRate.value);
  const reg = Number(regularization.value);
  Object.assign(state, modelMath.train(state.points, state, lr, reg, 12));
  state.round += 1;
  const result = metrics();
  state.best = Math.max(state.best, result.score);
  state.lossHistory.push(result.loss);
  toast.textContent = `第 ${state.round} 轮：边界向错分和低信心样本移动，交叉熵 ${result.loss.toFixed(3)}。`;
  latestText.textContent = `第 ${state.round} 轮  正确率 ${Math.round(result.accuracy * 100)}%  损失 ${result.loss.toFixed(3)}  得分 ${result.score.toFixed(2)}`;
  controller.trainingLog.add(latestText.textContent);
  controller.render();
  updateHud();
  if (result.score >= levels[levelIndex].target) {
    toast.textContent = `通关！概率边界已经稳定分开两类，得分 ${result.score.toFixed(2)}。`;
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
  state.lossHistory.pop();
  latestText.textContent = state.round ? `已撤回到第 ${state.round} 轮。` : "未训练：所有点先按初始概率判断。";
  controller.trainingLog.removeLatest();
  controller.render();
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

function setView(next) {
  view = next;
  const text = { prob: "概率视图：背景越绿，模型越相信这里是正类。", boundary: "边界视图：亮线是 p=0.5 的分类边界。", loss: "损失视图：交叉熵下降代表概率更可信。", weights: "权重视图：两个权重决定边界方向，偏置决定平移。" }[view];
  toast.textContent = text; runtime.setShapeContext(text);
}

function draw() {
  if (!state) return;
  const b = plane.bounds();
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  if (view === "loss") drawLoss(b);
  else {
    drawField(b);
    runtime.drawGrid(ctx, b);
    drawBoundary(b);
    drawPoints(b);
    if (view === "weights") drawWeights(b);
  }
  drawAxes(b);
}

function drawField(b) {
  fieldRenderer.draw({
    key: `${levelIndex}:${state.round}:${state.w1}:${state.w2}:${state.b}`,
    colorKey: "probability",
    bounds: b,
    columns: 42,
    rows: 26,
    sample: (unitX, unitY) => prob(plane.fromUnit(unitX, unitY)),
    color: (value) => value >= 0.5
      ? [34, 240, 164, Math.round((0.08 + value * 0.2) * 255)]
      : [59, 215, 255, Math.round((0.08 + (1 - value) * 0.2) * 255)],
  });
}

function drawBoundary(b) {
  if (Math.abs(state.w2) < 0.001) return;
  ctx.strokeStyle = "#fff3d6"; ctx.lineWidth = view === "boundary" ? 6 : 4; ctx.beginPath();
  const y1 = -(state.w1 * -1 + state.b) / state.w2;
  const y2 = -(state.w1 * 1 + state.b) / state.w2;
  ctx.moveTo(plane.toX(-1, b), plane.toY(y1, b)); ctx.lineTo(plane.toX(1, b), plane.toY(y2, b)); ctx.stroke();
}

function drawPoints(b) {
  state.points.forEach((point) => {
    const p = prob(point);
    const wrong = (p >= 0.5 ? 1 : 0) !== point.label;
    ctx.fillStyle = point.label ? "#22f0a4" : "#3bd7ff";
    ctx.strokeStyle = wrong ? "#ff5f57" : "#05060c";
    ctx.lineWidth = wrong && view === "loss" ? 5 : 4;
    const x = plane.toX(point.x, b), y = plane.toY(point.y, b);
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
  runtime.drawAxes(ctx, b);
}

function drawLoss(b) {
  drawField(b); runtime.drawGrid(ctx, b);
  const values = state.lossHistory.length ? state.lossHistory : [metrics().loss];
  const max = Math.max(...values, 0.8);
  runtime.drawSeries(ctx, values, b, { min: 0, max, color: "#22f0a4", lineWidth: 5 });
  drawBoundary(b);
  drawPoints(b);
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
    { element: regularization, handler: updateHud },
  ],
  canvasOptions: { minWidth: 1, minHeight: 1 },
});
controller.start();
