const canvas = document.querySelector("#chart");
const ctx = canvas.getContext("2d");
const mseValue = document.querySelector("#mseValue");
const roundValue = document.querySelector("#roundValue");
const progressFill = document.querySelector("#progressFill");
const toast = document.querySelector("#toast");
const roundLog = document.querySelector("#roundLog");
const logCard = document.querySelector(".log-card");
const bestLabel = document.querySelector("#bestLabel");
const targetLabel = document.querySelector("#targetLabel");
const missionText = document.querySelector("#missionText");
const levelSubtitle = document.querySelector("#levelSubtitle");
const levelPicker = document.querySelector("#levelPicker");
const viewPicker = document.querySelector("#viewPicker");
const learningRate = document.querySelector("#learningRate");
const treeDepth = document.querySelector("#treeDepth");
const rateLabel = document.querySelector("#rateLabel");
const depthLabel = document.querySelector("#depthLabel");
const stepBtn = document.querySelector("#stepBtn");
const autoBtn = document.querySelector("#autoBtn");
const undoBtn = document.querySelector("#undoBtn");
const resetBtn = document.querySelector("#resetBtn");
const nextLevelBtn = document.querySelector("#nextLevelBtn");

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
let autoTimer = null;
let activeView = "model";

function makePoints(level) {
  return level.points.map(([x, y]) => ({ x, y }));
}

function initialPrediction() {
  const avg = targetPoints.reduce((sum, point) => sum + point.y, 0) / targetPoints.length;
  return targetPoints.map(() => avg);
}

function resetGame() {
  stopAuto();
  const level = levels[currentLevel];
  targetPoints = makePoints(level);
  learningRate.value = level.defaultRate;
  treeDepth.value = level.defaultDepth;
  state = {
    predictions: initialPrediction(),
    history: [],
    lastLearner: null,
    lastBefore: null,
    round: 0,
    bestMse: Number.POSITIVE_INFINITY,
    mseHistory: [],
    overfit: 0,
    lastOverfitNoise: null,
  };
  roundLog.innerHTML = "";
  logCard.classList.remove("has-logs");
  missionText.textContent = level.description;
  levelSubtitle.textContent = level.name;
  toast.textContent = "选择观察方式，然后训练第一棵弱树。初始模型只猜这一关目标的平均值。";
  updatePickers();
  draw();
  updateHud();
}

function calcMse(predictions = state.predictions) {
  return (
    predictions.reduce((sum, pred, index) => {
      const err = targetPoints[index].y - pred;
      return sum + err * err;
    }, 0) / targetPoints.length
  );
}

function buildWeakLearner(segments) {
  const residuals = targetPoints.map((point, index) => point.y - state.predictions[index]);
  const learner = [];

  for (let segment = 0; segment < segments; segment += 1) {
    const minX = segment / segments;
    const maxX = (segment + 1) / segments;
    const indexes = targetPoints
      .map((point, index) => ({ point, index }))
      .filter(({ point }) => point.x >= minX && (segment === segments - 1 ? point.x <= maxX : point.x < maxX))
      .map(({ index }) => index);

    const avgResidual =
      indexes.reduce((sum, index) => sum + residuals[index], 0) / Math.max(indexes.length, 1);

    indexes.forEach((index) => {
      learner[index] = avgResidual;
    });
  }

  return learner.map((value) => (Number.isFinite(value) ? value : 0));
}

function calcOverfitRisk(rate, segments, nextRound) {
  const rateRisk = Math.max(0, (rate - 0.42) / 0.38);
  const depthRisk = Math.max(0, (segments - 5) / 3);
  const roundRisk = Math.max(0, (nextRound - 4) / 8);
  return Math.min(1, rateRisk * 0.45 + depthRisk * 0.35 + roundRisk * 0.2);
}

function buildOverfitNoise(risk, nextRound) {
  const amplitude = risk * (0.025 + Math.min(nextRound, 14) * 0.003);
  return targetPoints.map((point, index) => {
    const wave = Math.sin((index + 1) * 3.9 + nextRound * 1.7);
    const zigzag = index % 2 === 0 ? 1 : -1;
    return (wave * 0.55 + zigzag * 0.45) * amplitude;
  });
}

function clampPrediction(value) {
  return Math.max(0.02, Math.min(0.98, value));
}

function trainStep() {
  const rate = Number(learningRate.value);
  const segments = Number(treeDepth.value);
  const before = calcMse();
  const learner = buildWeakLearner(segments);
  const nextRound = state.round + 1;
  const overfitRisk = calcOverfitRisk(rate, segments, nextRound);
  const shouldOverfit = rate >= 0.52 && segments >= 6 && nextRound >= 3;
  const overfitNoise = shouldOverfit ? buildOverfitNoise(overfitRisk, nextRound) : null;
  const nextPredictions = state.predictions.map((prediction, index) =>
    clampPrediction(prediction + rate * learner[index] + (overfitNoise ? overfitNoise[index] : 0)),
  );
  const after = calcMse(nextPredictions);

  state.history.push({
    predictions: [...state.predictions],
    lastLearner: state.lastLearner ? [...state.lastLearner] : null,
    lastBefore: state.lastBefore ? [...state.lastBefore] : null,
    round: state.round,
    bestMse: state.bestMse,
    mseHistory: [...state.mseHistory],
    overfit: state.overfit,
    lastOverfitNoise: state.lastOverfitNoise ? [...state.lastOverfitNoise] : null,
  });
  state.lastBefore = [...state.predictions];
  state.predictions = nextPredictions;
  state.lastLearner = learner;
  state.round = nextRound;
  state.bestMse = Math.min(state.bestMse, after);
  state.mseHistory.push(after);
  state.lastOverfitNoise = overfitNoise;
  state.overfit = shouldOverfit ? Math.min(1, state.overfit + 0.2 + overfitRisk * 0.25) : Math.max(0, state.overfit - 0.08);

  const improvement = Math.max(0, before - after);
  toast.textContent = `第 ${state.round} 轮：小树拟合残差，模型按学习率 ${rate.toFixed(
    2,
  )} 前进，误差下降 ${improvement.toFixed(4)}。`;
  prependLog(`第 ${state.round} 棵树 | ${segments} 段 | MSE ${before.toFixed(4)} 至 ${after.toFixed(4)}`);
  if (shouldOverfit) {
    toast.textContent = `OVERFIT MODE：你把噪声也学进去了。学习率 ${rate.toFixed(2)} + ${segments} 段弱树让曲线开始乱抖。`;
    if (roundLog.firstElementChild) {
      roundLog.firstElementChild.textContent = `过拟合警报 | 第 ${state.round} 棵树 | 噪声抖动 | MSE ${before.toFixed(4)} 至 ${after.toFixed(4)}`;
    }
  }
  draw();
  updateHud();

  if (after <= levels[currentLevel].target && !shouldOverfit) {
    toast.textContent = `通关！这一关目标 MSE ${levels[currentLevel].target.toFixed(3)}，你用 ${state.round} 棵弱树达成了。`;
    stopAuto();
  } else if (autoTimer && state.round > 5 && improvement < 0.00001) {
    toast.textContent = "模型进入平台期：换观察方式看看卡在残差、弱树贡献，还是误差下降曲线。";
    stopAuto();
  }
}

function undoStep() {
  const previous = state.history.pop();
  if (!previous) {
    toast.textContent = "还没有可以撤回的训练轮次。";
    return;
  }
  state.predictions = previous.predictions;
  state.lastLearner = previous.lastLearner;
  state.lastBefore = previous.lastBefore;
  state.round = previous.round;
  state.bestMse = previous.bestMse;
  state.mseHistory = previous.mseHistory;
  state.overfit = previous.overfit;
  state.lastOverfitNoise = previous.lastOverfitNoise;
  roundLog.firstElementChild?.remove();
  if (!roundLog.children.length) logCard.classList.remove("has-logs");
  toast.textContent = "撤回上一棵弱学习器，回到上一轮模型。";
  draw();
  updateHud();
}

function prependLog(message) {
  const item = document.createElement("li");
  item.textContent = message;
  roundLog.prepend(item);
  logCard.classList.add("has-logs");
  while (roundLog.children.length > 7) {
    roundLog.lastElementChild.remove();
  }
}

function updateHud() {
  const level = levels[currentLevel];
  const mse = calcMse();
  state.bestMse = Math.min(state.bestMse, mse);
  mseValue.textContent = mse.toFixed(4);
  roundValue.textContent = state.round;
  bestLabel.textContent = state.round ? `最佳 ${state.bestMse.toFixed(4)}` : "等待开始";
  targetLabel.textContent = `目标 ${level.target.toFixed(3)}`;
  const initial = state.history[0] ? calcMse(state.history[0].predictions) : calcMse(initialPrediction());
  const score = Math.max(0, Math.min(1, (initial - mse) / Math.max(initial - level.target, 0.0001)));
  progressFill.style.width = `${Math.round(score * 100)}%`;
  rateLabel.textContent = Number(learningRate.value).toFixed(2);
  depthLabel.textContent = `${treeDepth.value} 段`;
  document.body.classList.toggle("overfit-mode", state.overfit > 0.15);
}

function stopAuto() {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
  }
  autoBtn.textContent = "自动训练";
}

function toggleAuto() {
  if (autoTimer) {
    stopAuto();
    return;
  }
  autoBtn.textContent = "暂停自动";
  trainStep();
  autoTimer = setInterval(trainStep, 900);
}

function nextLevel() {
  currentLevel = (currentLevel + 1) % levels.length;
  resetGame();
}

function setView(view) {
  activeView = view;
  viewPicker.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  const labels = {
    model: "模型视图：看蓝色预测曲线如何追近黄色目标点。",
    residual: "残差视图：看每个样本还剩多少没有解释，红色为欠预测，绿色为过预测。",
    learner: "弱树视图：看上一棵弱学习器给每个区域的修正量。",
    loss: "误差视图：看每轮 MSE 是否还在有效下降。",
  };
  toast.textContent = labels[view];
  draw();
}

function updatePickers() {
  levelPicker.innerHTML = "";
  levels.forEach((level, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = index === currentLevel ? "active" : "";
    button.textContent = level.shortName;
    button.addEventListener("click", () => {
      currentLevel = index;
      resetGame();
    });
    levelPicker.append(button);
  });
}

function fitCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(320, Math.floor(rect.width * scale));
  canvas.height = Math.max(260, Math.floor(rect.height * scale));
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  draw();
}

function chartBounds() {
  const rect = canvas.getBoundingClientRect();
  const isSmall = rect.width < 560;
  const left = isSmall ? 46 : 68;
  const right = isSmall ? rect.width - 18 : rect.width - 36;
  const top = isSmall ? 30 : 38;
  const bottom = isSmall ? rect.height - 42 : rect.height - 58;

  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

function px(point, bounds) {
  return bounds.left + point.x * bounds.width;
}

function py(value, bounds) {
  return bounds.bottom - value * bounds.height;
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
  ctx.fillStyle = "#07101c";
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = "rgba(34, 240, 164, 0.04)";
  ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
}

function drawGrid(bounds) {
  ctx.save();
  ctx.strokeStyle = "rgba(139,211,255,0.14)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i += 1) {
    const y = Math.round(bounds.top + (bounds.height / 4) * i) + 0.5;
    ctx.beginPath();
    ctx.moveTo(bounds.left, y);
    ctx.lineTo(bounds.right, y);
    ctx.stroke();
  }
  for (let i = 0; i <= 8; i += 1) {
    const x = Math.round(bounds.left + (bounds.width / 8) * i) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, bounds.top);
    ctx.lineTo(x, bounds.bottom);
    ctx.stroke();
  }
  ctx.restore();
}

function drawAxes(bounds, view) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,243,214,0.58)";
  ctx.fillStyle = "rgba(255,243,214,0.72)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bounds.left, bounds.top);
  ctx.lineTo(bounds.left, bounds.bottom);
  ctx.lineTo(bounds.right, bounds.bottom);
  ctx.stroke();
  ctx.font = "12px Courier New, Microsoft YaHei, monospace";
  ctx.fillText(view === "loss" ? "训练轮次" : "特征 x", bounds.right - 58, bounds.bottom + 30);
  ctx.save();
  ctx.translate(bounds.left - 38, bounds.top + 92);
  ctx.rotate(-Math.PI / 2);
  const label = view === "loss" ? "均方误差" : view === "residual" ? "残差" : "预测 / 真实值";
  ctx.fillText(label, 0, 0);
  ctx.restore();
  ctx.restore();
}

function drawModelPanel(bounds) {
  drawResiduals(bounds);
  if (state.lastLearner) drawLearner(bounds);
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
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(x, zero);
    ctx.lineTo(x, y);
    ctx.stroke();
  });
  if (state.lastBefore) drawPrediction(bounds, state.lastBefore, "rgba(168,176,189,0.55)", 2, false);
  drawPrediction(bounds, state.predictions, "#55c7f7", 4.5, true);
  drawPanelTitle(bounds, "绿色向上修正，红色向下修正；蓝线是叠加后的模型");
  ctx.restore();
}

function drawLoss(bounds) {
  const values = state.mseHistory.length ? state.mseHistory : [calcMse()];
  const max = Math.max(...values, calcMse(initialPrediction()), levels[currentLevel].target * 1.8);
  const min = Math.min(levels[currentLevel].target * 0.65, ...values);
  const toX = (index) => bounds.left + (values.length <= 1 ? 0 : (index / (values.length - 1)) * bounds.width);
  const toY = (value) => bounds.bottom - ((value - min) / Math.max(max - min, 0.0001)) * bounds.height;
  ctx.save();
  const targetY = toY(levels[currentLevel].target);
  ctx.strokeStyle = "rgba(255,212,71,0.85)";
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bounds.left, targetY);
  ctx.lineTo(bounds.right, targetY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "#3bd7ff";
  ctx.lineWidth = 5;
  ctx.lineJoin = "miter";
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = toX(index);
    const y = toY(value);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  values.forEach((value, index) => {
    ctx.fillStyle = "#3bd7ff";
    ctx.fillRect(toX(index) - 4, toY(value) - 4, 8, 8);
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

function drawLearner(bounds) {
  const rate = Number(learningRate.value);
  const learnerProjection = state.predictions.map((prediction, index) => prediction - rate * state.lastLearner[index]);
  const shifted = learnerProjection.map((prediction, index) => prediction + state.lastLearner[index]);
  drawPrediction(bounds, shifted, "rgba(34,240,164,0.9)", 3, false);
}

learningRate.addEventListener("input", updateHud);
treeDepth.addEventListener("input", updateHud);
stepBtn.addEventListener("click", trainStep);
autoBtn.addEventListener("click", toggleAuto);
undoBtn.addEventListener("click", undoStep);
resetBtn.addEventListener("click", resetGame);
nextLevelBtn.addEventListener("click", nextLevel);
viewPicker.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-view]");
  if (button) setView(button.dataset.view);
});
window.addEventListener("resize", fitCanvas);

resetGame();
requestAnimationFrame(fitCanvas);
