const runtime = window.LabRuntime;
const $ = runtime.query;
const canvas = $("#chart");
const ctx = canvas.getContext("2d");
const mseValue = $("#mseValue");
const roundValue = $("#roundValue");
const progressFill = $("#progressFill");
const toast = $("#toast");
const bestLabel = $("#bestLabel");
const targetLabel = $("#targetLabel");
const missionText = $("#missionText");
const levelSubtitle = $("#levelSubtitle");
const levelPicker = $("#levelPicker");
const viewPicker = $("#viewPicker");
const learningRate = $("#learningRate");
const treeDepth = $("#treeDepth");
const rateLabel = $("#rateLabel");
const depthLabel = $("#depthLabel");
const stepBtn = $("#stepBtn");
const autoBtn = $("#autoBtn");
const undoBtn = $("#undoBtn");
const resetBtn = $("#resetBtn");
const nextLevelBtn = $("#nextLevelBtn");
const modelMath = window.GbmModel;
const plane = runtime.createCartesianPlane(canvas, { xDomain: [0, 1], yDomain: [0, 1] });
const history = runtime.createHistory();

const levels = [
  {
    name: "入门：单调趋势",
    shortName: "趋势",
    target: 0.010,
    defaultRate: 0.3,
    defaultDepth: 3,
    description: "先学习一个平滑上升的函数，观察残差如何被逐段吃掉。",
    points: [
      [0.04, 0.18],
      [0.1, 0.2],
      [0.16, 0.28],
      [0.22, 0.31],
      [0.29, 0.42],
      [0.36, 0.49],
      [0.44, 0.5],
      [0.52, 0.57],
      [0.61, 0.62],
      [0.7, 0.64],
      [0.78, 0.72],
      [0.87, 0.78],
      [0.95, 0.8],
    ],
  },
  {
    name: "进阶：波峰与低谷",
    shortName: "波形",
    target: 0.007,
    defaultRate: 0.28,
    defaultDepth: 5,
    description: "目标曲线有转折。复杂度太低会欠拟合，太高又容易追着噪声跑。",
    points: [
      [0.04, 0.22],
      [0.1, 0.28],
      [0.16, 0.43],
      [0.23, 0.37],
      [0.31, 0.63],
      [0.38, 0.72],
      [0.45, 0.67],
      [0.53, 0.47],
      [0.6, 0.35],
      [0.68, 0.3],
      [0.75, 0.48],
      [0.82, 0.69],
      [0.9, 0.78],
      [0.96, 0.7],
    ],
  },
  {
    name: "挑战：异常点干扰",
    shortName: "异常",
    target: 0.012,
    defaultRate: 0.2,
    defaultDepth: 4,
    description: "有几个点故意偏离主趋势。小学习率更稳，别让模型被单点牵着走。",
    points: [
      [0.03, 0.2],
      [0.09, 0.27],
      [0.15, 0.34],
      [0.21, 0.7],
      [0.28, 0.46],
      [0.35, 0.52],
      [0.43, 0.58],
      [0.51, 0.18],
      [0.58, 0.62],
      [0.66, 0.66],
      [0.73, 0.71],
      [0.8, 0.34],
      [0.88, 0.77],
      [0.95, 0.82],
    ],
  },
  {
    name: "专家：局部突变",
    shortName: "突变",
    target: 0.006,
    defaultRate: 0.18,
    defaultDepth: 7,
    description: "目标里有窄峰和阶跃。需要更多弱树慢慢叠加，观察每一轮贡献。",
    points: [
      [0.03, 0.26],
      [0.08, 0.24],
      [0.14, 0.25],
      [0.2, 0.3],
      [0.26, 0.76],
      [0.31, 0.33],
      [0.38, 0.36],
      [0.45, 0.55],
      [0.52, 0.58],
      [0.59, 0.56],
      [0.66, 0.4],
      [0.73, 0.42],
      [0.8, 0.73],
      [0.86, 0.78],
      [0.92, 0.48],
      [0.97, 0.46],
    ],
  },
];

let currentLevel = 0;
let targetPoints = [];
let state;
let activeView = "model";
let controller;

function makePoints(level) {
  return level.points.map(([x, y]) => ({ x, y }));
}

function initialPrediction() {
  const avg = modelMath.mean(targetPoints.map((point) => point.y));
  return targetPoints.map(() => avg);
}

function resetGame() {
  const level = levels[currentLevel];
  targetPoints = makePoints(level);
  learningRate.value = level.defaultRate;
  treeDepth.value = level.defaultDepth;
  history.clear();
  state = {
    predictions: initialPrediction(),
    lastLearner: null,
    lastLearnerMeta: null,
    lastBefore: null,
    lastRate: null,
    round: 0,
    bestMse: Number.POSITIVE_INFINITY,
    mseHistory: [],
    completedRound: null,
    overfit: 0,
    lastOverfitNoise: null,
  };
  state.initialMse = calcMse(state.predictions);
  missionText.textContent = level.description;
  levelSubtitle.textContent = level.name;
  toast.textContent = "先看蓝线的平均猜测，再训练第一棵弱树追残差。平方误差下，残差就是负梯度方向。";
  controller.trainingLog.reset();
  controller.render();
  updateHud();
}

function calcMse(predictions = state.predictions) {
  return modelMath.mse(targetPoints.map((point) => point.y), predictions);
}

function buildWeakLearner(segments) {
  return modelMath.buildWeakLearner(targetPoints, state.predictions, segments);
}

function calcOverfitRisk(rate, segments, nextRound) {
  return modelMath.overfitRisk(rate, segments, nextRound);
}

function buildOverfitNoise(risk, nextRound) {
  return modelMath.overfitNoise(targetPoints, risk, nextRound);
}

function clampPrediction(value) {
  return modelMath.clampPrediction(value);
}

function trainStep() {
  const rate = Number(learningRate.value);
  const segments = Number(treeDepth.value);
  const before = calcMse();
  const learnerModel = buildWeakLearner(segments);
  const learner = learnerModel.values;
  const nextRound = state.round + 1;
  const overfitRisk = calcOverfitRisk(rate, segments, nextRound);
  const shouldOverfit = rate >= 0.52 && segments >= 6 && nextRound >= 3;
  const overfitNoise = shouldOverfit ? buildOverfitNoise(overfitRisk, nextRound) : null;
  const nextPredictions = state.predictions.map((prediction, index) =>
    clampPrediction(prediction + rate * learner[index] + (overfitNoise ? overfitNoise[index] : 0)),
  );
  const after = calcMse(nextPredictions);

  history.push({
    predictions: [...state.predictions],
    lastLearner: state.lastLearner ? [...state.lastLearner] : null,
    lastLearnerMeta: state.lastLearnerMeta ? { leaves: state.lastLearnerMeta.leaves.map((leaf) => ({ ...leaf })) } : null,
    lastBefore: state.lastBefore ? [...state.lastBefore] : null,
    lastRate: state.lastRate,
    round: state.round,
    bestMse: state.bestMse,
    mseHistoryLength: state.mseHistory.length,
    completedRound: state.completedRound,
    overfit: state.overfit,
    lastOverfitNoise: state.lastOverfitNoise ? [...state.lastOverfitNoise] : null,
  });
  state.lastBefore = [...state.predictions];
  state.predictions = nextPredictions;
  state.lastLearner = learner;
  state.lastLearnerMeta = learnerModel;
  state.lastRate = rate;
  state.round = nextRound;
  state.bestMse = Math.min(state.bestMse, after);
  state.mseHistory.push(after);
  if (after <= levels[currentLevel].target && state.completedRound === null && !shouldOverfit) {
    state.completedRound = state.round;
  }
  state.lastOverfitNoise = overfitNoise;
  state.overfit = shouldOverfit ? Math.min(1, state.overfit + 0.2 + overfitRisk * 0.25) : Math.max(0, state.overfit - 0.08);

  const improvement = Math.max(0, before - after);
  toast.textContent = `第 ${state.round} 轮：弱树按 ${segments} 段拟合残差，模型按学习率 ${rate.toFixed(
    2,
  )} 只走 ηh_m 这一步，误差下降 ${improvement.toFixed(4)}。`;
  controller.trainingLog.add(`第 ${state.round} 棵树 | ${segments} 段叶子 | MSE ${before.toFixed(4)} 至 ${after.toFixed(4)}`);
  if (shouldOverfit) {
    toast.textContent = `OVERFIT MODE：你把噪声也学进去了。学习率 ${rate.toFixed(2)} + ${segments} 段弱树让曲线开始乱抖。`;
    controller.trainingLog.replaceLatest(`过拟合警报 | 第 ${state.round} 棵树 | 噪声抖动 | MSE ${before.toFixed(4)} 至 ${after.toFixed(4)}`);
  }
  controller.render();
  updateHud();

  if (after <= levels[currentLevel].target && !shouldOverfit) {
    toast.textContent = `通关！这一关目标 MSE ${levels[currentLevel].target.toFixed(3)}，你用 ${state.completedRound} 棵弱树达成了。`;
    controller.stopAuto();
  } else if (controller.isAutoRunning() && state.round > 5 && improvement < 0.00001) {
    toast.textContent = "模型进入平台期：换观察方式看看卡在残差、弱树贡献，还是误差下降曲线。";
    controller.stopAuto();
  }
}

function undoStep() {
  const previous = history.pop();
  if (!previous) {
    toast.textContent = "还没有可以撤回的训练轮次。";
    return;
  }
  state.predictions = previous.predictions;
  state.lastLearner = previous.lastLearner;
  state.lastLearnerMeta = previous.lastLearnerMeta;
  state.lastBefore = previous.lastBefore;
  state.lastRate = previous.lastRate;
  state.round = previous.round;
  state.bestMse = previous.bestMse;
  state.mseHistory.length = previous.mseHistoryLength;
  state.completedRound = previous.completedRound;
  state.overfit = previous.overfit;
  state.lastOverfitNoise = previous.lastOverfitNoise;
  controller.trainingLog.removeLatest();
  toast.textContent = "撤回上一棵弱学习器，回到上一轮模型。";
  controller.render();
  updateHud();
}

function updateHud() {
  const level = levels[currentLevel];
  const mse = calcMse();
  state.bestMse = Math.min(state.bestMse, mse);
  runtime.setText(mseValue, mse.toFixed(4));
  runtime.setText(roundValue, state.round);
  runtime.setText(bestLabel, state.round ? `最佳 ${state.bestMse.toFixed(4)}` : "等待开始");
  runtime.setText(targetLabel, `目标 ${level.target.toFixed(3)}`);
  const initial = state.initialMse;
  const score = Math.max(0, Math.min(1, (initial - mse) / Math.max(initial - level.target, 0.0001)));
  runtime.setProgress(progressFill, score);
  runtime.setText(rateLabel, Number(learningRate.value).toFixed(2));
  runtime.setText(depthLabel, `${treeDepth.value} 段`);
  document.body.classList.toggle("overfit-mode", state.overfit > 0.15);
}

function setView(view) {
  activeView = view;
  const labels = {
    model: "模型视图：灰线是旧模型，绿色是全量弱树，黄色是学习率缩放后的实际步长，蓝线是新模型。",
    residual: "残差视图：看每个样本还剩多少没有解释；平方误差下，残差就是这轮要追的负梯度。",
    learner: "弱树视图：虚线是叶子边界，标签是每段残差均值；黄色柱是 ηh_m 的实际修正。",
    loss: "误差视图：看每轮 MSE 是否还在有效下降。",
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

function py(value, bounds) {
  return plane.toY(value, bounds);
}

function draw() {
  if (!state) return;
  const rect = canvas.getBoundingClientRect();
  const bounds = chartBounds();
  ctx.clearRect(0, 0, rect.width, rect.height);
  drawBackdrop(rect, bounds);
  drawGrid(bounds);
  if (activeView === "loss") drawLoss(bounds);
  else if (activeView === "residual") drawResidualPanel(bounds);
  else if (activeView === "learner") drawLearnerPanel(bounds);
  else drawModelPanel(bounds);
  drawAxes(bounds, activeView);
}

function drawBackdrop(rect, bounds) {
  ctx.fillStyle = "rgba(7, 16, 28, 0.34)";
  ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
}

function drawGrid(bounds) {
  runtime.drawGrid(ctx, bounds);
}

function drawAxes(bounds, view) {
  runtime.drawAxes(ctx, bounds, {
    xLabel: view === "loss" ? "训练轮次" : "特征 x",
    yLabel: view === "loss" ? "均方误差" : view === "residual" ? "残差" : "预测 / 真实值",
  });
}

function drawModelPanel(bounds) {
  drawResiduals(bounds);
  if (state.lastLearnerMeta) drawLeafGuides(bounds, state.lastLearnerMeta, true);
  if (state.lastBefore) drawPrediction(bounds, state.lastBefore, "rgba(168,176,189,0.55)", 2, false);
  if (state.lastLearner) {
    drawLearner(bounds, false);
    drawLearner(bounds, true);
  }
  if (state.overfit > 0) drawOverfitGlitch(bounds);
  drawPrediction(bounds, state.predictions, "#55c7f7", 4.5, true);
  drawTargets(bounds);
}

function drawOverfitGlitch(bounds) {
  const strength = Math.max(0.25, state.overfit);
  const jittered = state.predictions.map((value, index) => {
    const shake = (state.lastOverfitNoise?.[index] || 0) * 1.8;
    const scan = Math.sin(index * 5.2 + state.round) * 0.018 * strength;
    return clampPrediction(value + shake + scan);
  });
  drawPrediction(bounds, jittered, "rgba(255,95,87,0.9)", 3, false);
  ctx.save();
  ctx.fillStyle = "rgba(255,95,87,0.18)";
  for (let i = 0; i < 7; i += 1) {
    const y = bounds.top + ((i * 37 + state.round * 11) % Math.max(1, bounds.height));
    ctx.fillRect(bounds.left, y, bounds.width, 3);
  }
  ctx.restore();
}

function drawResidualPanel(bounds) {
  const zero = bounds.top + bounds.height / 2;
  const maxResidual = Math.max(
    0.12,
    ...targetPoints.map((point, index) => Math.abs(point.y - state.predictions[index])),
  );
  ctx.save();
  ctx.strokeStyle = "rgba(255,243,214,0.42)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bounds.left, zero);
  ctx.lineTo(bounds.right, zero);
  ctx.stroke();
  targetPoints.forEach((point, index) => {
    const residual = point.y - state.predictions[index];
    const x = px(point, bounds);
    const y = zero - (residual / maxResidual) * (bounds.height * 0.42);
    ctx.strokeStyle = residual >= 0 ? "#ff7868" : "#35d7a3";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(x, zero);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = "#ffd447";
    ctx.fillRect(x - 5, y - 5, 10, 10);
  });
  drawPanelTitle(bounds, "残差越接近中线，模型越接近目标");
  ctx.restore();
}

function drawLearnerPanel(bounds) {
  if (!state.lastLearner) {
    drawPanelTitle(bounds, "先训练一棵弱树，再观察它本轮学到了什么");
    drawModelPanel(bounds);
    return;
  }
  const zero = bounds.top + bounds.height / 2;
  const maxValue = Math.max(0.12, ...state.lastLearner.map((value) => Math.abs(value)));
  ctx.save();
  if (state.lastLearnerMeta) drawLeafGuides(bounds, state.lastLearnerMeta, false);
  ctx.strokeStyle = "rgba(255,243,214,0.42)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bounds.left, zero);
  ctx.lineTo(bounds.right, zero);
  ctx.stroke();
  state.lastLearner.forEach((value, index) => {
    const x = px(targetPoints[index], bounds);
    const y = zero - (value / maxValue) * (bounds.height * 0.38);
    ctx.strokeStyle = value >= 0 ? "#35d7a3" : "#ff7868";
    ctx.globalAlpha = 0.38;
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(x, zero);
    ctx.lineTo(x, y);
    ctx.stroke();

    const scaled = value * (state.lastRate ?? Number(learningRate.value));
    const scaledY = zero - (scaled / maxValue) * (bounds.height * 0.38);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#ffd447";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, zero);
    ctx.lineTo(x, scaledY);
    ctx.stroke();
  });
  if (state.lastBefore) drawPrediction(bounds, state.lastBefore, "rgba(168,176,189,0.55)", 2, false);
  drawLearner(bounds, false);
  drawLearner(bounds, true);
  drawPrediction(bounds, state.predictions, "#55c7f7", 4.5, true);
  drawPanelTitle(bounds, "虚线分出叶子；淡绿/红是 h_m，黄色是 ηh_m");
  ctx.restore();
}

function drawLoss(bounds) {
  const values = state.mseHistory.length ? state.mseHistory : [calcMse()];
  const max = Math.max(...values, calcMse(initialPrediction()), levels[currentLevel].target * 1.8);
  const min = Math.min(levels[currentLevel].target * 0.65, ...values);
  ctx.save();
  runtime.drawSeries(ctx, values, bounds, {
    min,
    max,
    color: "#3bd7ff",
    lineWidth: 5,
    lineJoin: "miter",
    pointColor: "#3bd7ff",
    pointSize: 8,
    guides: [{ value: levels[currentLevel].target, dash: [8, 6] }],
  });
  drawPanelTitle(bounds, `虚线是本关通关线：MSE ${levels[currentLevel].target.toFixed(3)}`);
  ctx.restore();
}

function drawPanelTitle(bounds, text) {
  ctx.save();
  ctx.fillStyle = "#08111d";
  ctx.fillRect(bounds.left + 12, bounds.top + 12, Math.min(bounds.width - 24, 430), 34);
  ctx.strokeStyle = "#22f0a4";
  ctx.lineWidth = 3;
  ctx.strokeRect(bounds.left + 12, bounds.top + 12, Math.min(bounds.width - 24, 430), 34);
  ctx.fillStyle = "#fff3d6";
  ctx.font = "14px Courier New, Microsoft YaHei, monospace";
  ctx.fillText(text, bounds.left + 24, bounds.top + 34);
  ctx.restore();
}

function drawTargets(bounds) {
  ctx.save();
  targetPoints.forEach((point) => {
    const x = px(point, bounds);
    const y = py(point.y, bounds);
    ctx.fillStyle = "rgba(255,212,71,0.2)";
    ctx.fillRect(x - 10, y - 10, 20, 20);
    ctx.fillStyle = "#05060c";
    ctx.fillRect(x - 7, y - 7, 14, 14);
    ctx.fillStyle = "#ffd447";
    ctx.fillRect(x - 5, y - 5, 10, 10);
  });
  ctx.restore();
}

function drawResiduals(bounds) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,95,87,0.86)";
  ctx.lineWidth = 3;
  targetPoints.forEach((point, index) => {
    const x = px(point, bounds);
    const y1 = py(state.predictions[index], bounds);
    const y2 = py(point.y, bounds);
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();
  });
  ctx.restore();
}

function drawPrediction(bounds, values, color, width, glow) {
  ctx.save();
  if (glow) {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "miter";
  ctx.lineCap = "square";
  ctx.beginPath();
  targetPoints.forEach((point, index) => {
    const x = px(point, bounds);
    const y = py(values[index], bounds);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawLeafGuides(bounds, meta, subtle) {
  if (!meta?.leaves?.length) return;
  ctx.save();
  meta.leaves.forEach((leaf, index) => {
    const x = bounds.left + leaf.xMin * bounds.width;
    const width = Math.max(3, (leaf.xMax - leaf.xMin) * bounds.width);
    ctx.fillStyle = index % 2 === 0 ? "rgba(34,240,164,0.045)" : "rgba(59,215,255,0.04)";
    ctx.fillRect(x, bounds.top, width, bounds.height);

    if (index > 0) {
      ctx.strokeStyle = subtle ? "rgba(255,212,71,0.22)" : "rgba(255,212,71,0.55)";
      ctx.lineWidth = subtle ? 2 : 3;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(x, bounds.top);
      ctx.lineTo(x, bounds.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });

  if (!subtle) {
    ctx.font = "12px Courier New, Microsoft YaHei, monospace";
    ctx.textAlign = "center";
    meta.leaves.forEach((leaf) => {
      const center = bounds.left + ((leaf.xMin + leaf.xMax) / 2) * bounds.width;
      const labelY = leaf.value >= 0 ? bounds.top + 62 : bounds.bottom - 28;
      ctx.fillStyle = "#08111d";
      ctx.fillRect(center - 36, labelY - 14, 72, 20);
      ctx.strokeStyle = leaf.value >= 0 ? "#35d7a3" : "#ff7868";
      ctx.lineWidth = 2;
      ctx.strokeRect(center - 36, labelY - 14, 72, 20);
      ctx.fillStyle = "#fff3d6";
      ctx.fillText(`均值 ${leaf.value.toFixed(2)}`, center, labelY + 1);
    });
    ctx.textAlign = "left";
  }
  ctx.restore();
}

function drawLearner(bounds, scaled) {
  const rate = state.lastRate ?? Number(learningRate.value);
  const base = state.lastBefore || state.predictions.map((prediction, index) => prediction - rate * state.lastLearner[index]);
  const factor = scaled ? rate : 1;
  const shifted = base.map((prediction, index) => prediction + factor * state.lastLearner[index]);
  drawPrediction(bounds, shifted, scaled ? "rgba(255,212,71,0.92)" : "rgba(34,240,164,0.58)", scaled ? 3 : 2, false);
}

controller = runtime.createLabController({
  levels,
  getLevelIndex: () => currentLevel,
  setLevelIndex: (index) => { currentLevel = index; },
  reset: resetGame,
  draw,
  canvas,
  context: ctx,
  levelPicker,
  viewPicker,
  setView,
  auto: { button: autoBtn, idleLabel: "自动训练", activeLabel: "暂停自动", intervalMs: 900, step: trainStep },
  actions: {
    step: trainStep,
    stepButton: stepBtn,
    undo: undoStep,
    undoButton: undoBtn,
    resetButton: resetBtn,
    nextButton: nextLevelBtn,
  },
  inputs: [
    { element: learningRate, handler: updateHud },
    { element: treeDepth, handler: updateHud },
  ],
});
controller.start();
