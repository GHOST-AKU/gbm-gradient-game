const canvas = document.querySelector("#chart");
const ctx = canvas.getContext("2d");
const mseValue = document.querySelector("#mseValue");
const roundValue = document.querySelector("#roundValue");
const progressFill = document.querySelector("#progressFill");
const toast = document.querySelector("#toast");
const latestText = document.querySelector("#latestText");
const roundLog = document.querySelector("#roundLog");
const logCard = document.querySelector(".log-card");
const expandLogBtn = document.querySelector("#expandLogBtn");
const logOverlay = document.querySelector("#logOverlay");
const closeLogBtn = document.querySelector("#closeLogBtn");
const fullRoundLog = document.querySelector("#fullRoundLog");
const modalEmptyLog = document.querySelector("#modalEmptyLog");
const modalRoundLabel = document.querySelector("#modalRoundLabel");
const modalBestLabel = document.querySelector("#modalBestLabel");
const modalLevelLabel = document.querySelector("#modalLevelLabel");
const bestLabel = document.querySelector("#bestLabel");
const targetLabel = document.querySelector("#targetLabel");
const missionText = document.querySelector("#missionText");
const levelSubtitle = document.querySelector("#levelSubtitle");
const levelPicker = document.querySelector("#levelPicker");
const viewPicker = document.querySelector("#viewPicker");
const penaltyC = document.querySelector("#learningRate");
const kernelPower = document.querySelector("#treeDepth");
const rateLabel = document.querySelector("#rateLabel");
const depthLabel = document.querySelector("#depthLabel");
const stepBtn = document.querySelector("#stepBtn");
const autoBtn = document.querySelector("#autoBtn");
const undoBtn = document.querySelector("#undoBtn");
const resetBtn = document.querySelector("#resetBtn");
const nextLevelBtn = document.querySelector("#nextLevelBtn");
const boundaryFormula = document.querySelector("#boundaryFormula");
const supportCountLabel = document.querySelector("#supportCountLabel");
const accuracyLabel = document.querySelector("#accuracyLabel");
const violationLabel = document.querySelector("#violationLabel");
const hingeLabel = document.querySelector("#hingeLabel");
const biasLabel = document.querySelector("#biasLabel");
const gammaLabel = document.querySelector("#gammaLabel");

const levels = [
  {
    name: "入门：清晰直线",
    shortName: "直线",
    target: 0.88,
    defaultC: 1,
    defaultKernel: 2,
    description: "两类样本几乎线性可分。先把边界推到中间，再观察哪些点成了支持向量。",
    points: [
      [-0.86, -0.62, -1], [-0.72, -0.46, -1], [-0.52, -0.58, -1], [-0.36, -0.31, -1],
      [-0.12, -0.44, -1], [0.16, -0.18, -1], [-0.62, -0.12, -1], [-0.2, 0.02, -1],
      [0.2, 0.22, 1], [0.34, 0.48, 1], [0.52, 0.32, 1], [0.7, 0.55, 1],
      [0.82, 0.72, 1], [0.08, 0.56, 1], [0.46, 0.78, 1], [0.72, 0.18, 1],
    ],
  },
  {
    name: "进阶：软间隔",
    shortName: "软间隔",
    target: 0.82,
    defaultC: 1.2,
    defaultKernel: 3,
    description: "有几个样本挤进了对方地盘。调低 C 可以容忍少量错误，换来更宽的间隔。",
    points: [
      [-0.86, -0.55, -1], [-0.66, -0.38, -1], [-0.48, -0.28, -1], [-0.26, -0.52, -1],
      [-0.08, -0.18, -1], [0.18, -0.06, -1], [0.34, -0.32, -1], [-0.1, 0.24, -1],
      [0.2, 0.38, 1], [0.42, 0.2, 1], [0.56, 0.54, 1], [0.76, 0.36, 1],
      [0.86, 0.7, 1], [-0.22, 0.42, 1], [0.08, -0.34, 1], [0.62, -0.08, 1],
    ],
  },
  {
    name: "挑战：圆形核边界",
    shortName: "圆核",
    target: 0.84,
    defaultC: 1.6,
    defaultKernel: 5,
    description: "正类藏在中心，负类围在外圈。线性边界不够用，需要让核函数弯起来。",
    points: [
      [-0.18, -0.2, 1], [0.12, -0.24, 1], [-0.28, 0.08, 1], [0.18, 0.16, 1],
      [0.0, 0.26, 1], [0.3, -0.02, 1], [-0.08, 0.02, 1],
      [-0.86, -0.2, -1], [-0.72, 0.48, -1], [-0.42, -0.78, -1], [0.02, -0.86, -1],
      [0.48, -0.68, -1], [0.82, -0.18, -1], [0.76, 0.46, -1], [0.28, 0.82, -1],
      [-0.36, 0.78, -1], [-0.82, 0.08, -1],
    ],
  },
  {
    name: "专家：噪声陷阱",
    shortName: "噪声",
    target: 0.8,
    defaultC: 1.1,
    defaultKernel: 4,
    description: "这关故意放了冲突点。C 和核复杂度太高时，边界会追着噪声乱抖。",
    points: [
      [-0.82, -0.62, -1], [-0.64, -0.22, -1], [-0.48, -0.5, -1], [-0.22, -0.18, -1],
      [0.02, -0.48, -1], [0.22, -0.06, -1], [0.42, -0.36, -1], [-0.7, 0.28, -1],
      [0.16, 0.34, 1], [0.34, 0.12, 1], [0.52, 0.44, 1], [0.74, 0.24, 1],
      [0.86, 0.68, 1], [-0.18, 0.58, 1], [0.12, 0.76, 1], [0.56, -0.12, 1],
      [-0.38, 0.38, 1], [0.08, -0.08, 1], [0.66, 0.02, -1],
    ],
  },
];

let currentLevel = 0;
let targetPoints = [];
let state;
let autoTimer = null;
let activeView = "boundary";
let latestStatus = "";
let activeViewNote = "边界视图：蓝色区域判为负类，绿色区域判为正类；亮线是当前决策边界。";
let latestTicker = null;
let latestTickerIndex = 0;

const idleLatestMessage = "未训练：样本已经摆好，第一轮会开始寻找最大间隔。";
const viewNotes = {
  boundary: "边界视图：蓝色区域判为负类，绿色区域判为正类；亮线是当前决策边界。",
  margin: "间隔视图：两条虚线之间是 SVM 努力撑开的安全通道，落在里面的点会被继续惩罚。",
  support: "支持向量视图：被方框套住的点决定边界位置，远离边界的点影响会变小。",
  loss: "损失视图：观察 hinge loss 和正则项的总目标是否还在下降。",
};

function makePoints(level) {
  return level.points.map(([x, y, label], index) => ({ x, y, label, index }));
}

function latestMessages() {
  if (state?.completedRound !== null) {
    const level = levels[currentLevel];
    return [`通关！目标间隔得分 ${level.target.toFixed(2)}，你在第 ${state.completedRound} 轮达成。`];
  }
  const messages = [];
  if (state?.logEntries?.length) messages.push(state.logEntries[0]);
  if (latestStatus) messages.push(latestStatus);
  messages.push(activeViewNote || idleLatestMessage);
  if (!state?.logEntries?.length && !latestStatus) messages.unshift(idleLatestMessage);
  return [...new Set(messages)];
}

function showLatestMessage(message, animate = false) {
  latestText.textContent = message;
  latestText.classList.remove("is-rolling");
  if (animate) {
    void latestText.offsetWidth;
    latestText.classList.add("is-rolling");
  }
}

function updateLatestTicker(reset = false) {
  const messages = latestMessages();
  if (reset) latestTickerIndex = 0;
  latestTickerIndex %= messages.length;
  showLatestMessage(messages[latestTickerIndex], false);

  if (latestTicker) {
    clearInterval(latestTicker);
    latestTicker = null;
  }
  if (messages.length > 1) {
    latestTicker = setInterval(() => {
      const nextMessages = latestMessages();
      latestTickerIndex = (latestTickerIndex + 1) % nextMessages.length;
      showLatestMessage(nextMessages[latestTickerIndex], true);
    }, 3000);
  }
}

function setLatestStatus(message, reset = false) {
  latestStatus = message;
  updateLatestTicker(reset);
}

function setActiveViewNote(message, reset = false) {
  if (!reset && activeViewNote === message) return;
  activeViewNote = message;
  updateLatestTicker(reset);
}

function resetGame() {
  stopAuto();
  const level = levels[currentLevel];
  targetPoints = makePoints(level);
  penaltyC.value = level.defaultC;
  kernelPower.value = level.defaultKernel;
  state = {
    alpha: targetPoints.map(() => 0),
    bias: 0,
    round: 0,
    bestScore: 0,
    lossHistory: [],
    history: [],
    logEntries: [],
    completedRound: null,
    overfit: 0,
  };
  if (roundLog) roundLog.innerHTML = "";
  fullRoundLog.innerHTML = "";
  if (logCard) logCard.classList.remove("has-logs");
  missionText.textContent = level.description;
  levelSubtitle.textContent = level.name;
  toast.textContent = "先观察样本，再训练第一轮。SVM 会寻找能最大化分类间隔的边界。";
  latestStatus = "";
  activeViewNote = viewNotes[activeView];
  updateLatestTicker(true);
  updatePickers();
  draw();
  updateHud();
}

function gamma() {
  return 0.45 + Number(kernelPower.value) * 0.34;
}

function kernel(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.exp(-gamma() * (dx * dx + dy * dy));
}

function noiseField(point, round = state.round) {
  const k = Number(kernelPower.value);
  const wave = Math.sin(point.x * 17.2 + point.y * 11.7 + round * 0.9);
  const checker = Math.sin(point.x * 31 - point.y * 27 + round * 1.4);
  return (wave * 0.55 + checker * 0.45) * state.overfit * (0.35 + k * 0.04);
}

function scorePoint(point, alpha = state.alpha, bias = state.bias) {
  let score = bias;
  targetPoints.forEach((sample, index) => {
    if (alpha[index] > 0.0001) score += alpha[index] * sample.label * kernel(point, sample);
  });
  if (state.overfit > 0.05) score += noiseField(point);
  return score;
}

function classify(point) {
  return scorePoint(point) >= 0 ? 1 : -1;
}

function metrics(alpha = state.alpha, bias = state.bias) {
  let hinge = 0;
  let correct = 0;
  let outsideMargin = 0;
  let supportCount = 0;
  let violations = 0;
  targetPoints.forEach((point) => {
    const signed = point.label * scorePointWith(point, alpha, bias);
    hinge += Math.max(0, 1 - signed);
    if (signed > 0) correct += 1;
    if (signed >= 1) outsideMargin += 1;
    if (signed > -0.15 && signed < 1.18) supportCount += 1;
    if (signed < 1) violations += 1;
  });
  hinge /= targetPoints.length;
  const regularizer = alpha.reduce((sum, value) => sum + value * value, 0) * 0.012;
  const accuracy = correct / targetPoints.length;
  const marginRate = outsideMargin / targetPoints.length;
  const score = Math.max(0, Math.min(0.99, accuracy * 0.62 + marginRate * 0.38 - state.overfit * 0.16));
  const activeVectors = alpha.filter((value) => value > 0.01).length;
  return { hinge, objective: hinge + regularizer, accuracy, marginRate, score, supportCount, violations, activeVectors };
}

function scorePointWith(point, alpha, bias) {
  let score = bias;
  targetPoints.forEach((sample, index) => {
    if (alpha[index] > 0.0001) score += alpha[index] * sample.label * kernel(point, sample);
  });
  return score;
}

function trainStep() {
  const before = metrics();
  const c = Number(penaltyC.value);
  const complexity = Number(kernelPower.value);
  const nextRound = state.round + 1;

  state.history.push({
    alpha: [...state.alpha],
    bias: state.bias,
    round: state.round,
    bestScore: state.bestScore,
    lossHistory: [...state.lossHistory],
    logEntries: [...state.logEntries],
    completedRound: state.completedRound,
    overfit: state.overfit,
  });

  const lr = 0.055;
  const order = [...targetPoints].sort((a, b) => ((a.index * 7 + nextRound * 3) % 11) - ((b.index * 7 + nextRound * 3) % 11));
  order.forEach((point) => {
    const index = point.index;
    const signed = point.label * scorePointWith(point, state.alpha, state.bias);
    state.alpha[index] *= 1 - lr * 0.028;
    if (signed < 1) {
      const push = lr * c * (1 - signed);
      state.alpha[index] = Math.min(4.5, state.alpha[index] + push);
      state.bias += lr * c * point.label * 0.11;
    }
    if (signed > 1.6) state.alpha[index] *= 0.985;
  });

  const shouldOverfit = c >= 3.2 && complexity >= 7 && nextRound >= 5;
  state.overfit = shouldOverfit ? Math.min(1, state.overfit + 0.18) : Math.max(0, state.overfit - 0.08);
  state.round = nextRound;
  const after = metrics();
  state.bestScore = Math.max(state.bestScore, after.score);
  state.lossHistory.push(after.objective);

  const supportText = `${after.supportCount} 个支持向量`;
  prependLog(`第 ${state.round} 轮  SV ${after.supportCount}  hinge ${after.hinge.toFixed(2)}  得分 ${after.score.toFixed(2)}`);

  toast.textContent = `第 ${state.round} 轮：违反间隔的样本被加权，边界向最大间隔移动；当前 ${supportText}。`;
  setLatestStatus(toast.textContent, true);
  if (shouldOverfit) {
    toast.textContent = `OVERFIT MODE：你把噪声也学进去了。C=${c.toFixed(1)} + 核复杂度 ${complexity} 让边界开始乱抖。`;
    state.logEntries[0] = `过拟合警报  第 ${state.round} 轮  噪声抖动  得分 ${after.score.toFixed(2)}`;
    renderLogLists();
    setLatestStatus(toast.textContent, true);
    if (roundLog?.firstElementChild) {
      roundLog.firstElementChild.textContent = `过拟合警报  第 ${state.round} 轮  噪声抖动  得分 ${after.score.toFixed(2)}`;
    }
  }

  if (after.score >= levels[currentLevel].target && state.completedRound === null && !shouldOverfit) {
    state.completedRound = state.round;
  }

  draw();
  updateHud();

  if (after.score >= levels[currentLevel].target && !shouldOverfit) {
    toast.textContent = `通关！目标间隔得分 ${levels[currentLevel].target.toFixed(2)}，你在第 ${state.completedRound} 轮达成。`;
    setLatestStatus(toast.textContent, true);
    stopAuto();
  } else if (autoTimer && state.round > 10 && Math.abs(before.objective - after.objective) < 0.002) {
    toast.textContent = "训练进入平台期：切到“间隔”或“向量”视图，看看是不是 C 太低或核复杂度不够。";
    setLatestStatus(toast.textContent, true);
    stopAuto();
  }
}

function undoStep() {
  const previous = state.history.pop();
  if (!previous) {
    toast.textContent = "还没有可以撤回的训练轮次。";
    setLatestStatus(toast.textContent, true);
    return;
  }
  state.alpha = previous.alpha;
  state.bias = previous.bias;
  state.round = previous.round;
  state.bestScore = previous.bestScore;
  state.lossHistory = previous.lossHistory;
  state.logEntries = previous.logEntries;
  state.completedRound = previous.completedRound;
  state.overfit = previous.overfit;
  renderLogLists();
  toast.textContent = "撤回上一轮训练，边界回到上一轮状态。";
  setLatestStatus(toast.textContent, true);
  draw();
  updateHud();
}

function prependLog(message) {
  state.logEntries.unshift(message);
  renderLogLists();
}

function renderLogLists() {
  const hasLogs = state.logEntries.length > 0;
  if (logCard) logCard.classList.toggle("has-logs", hasLogs);
  if (roundLog) roundLog.innerHTML = "";
  fullRoundLog.innerHTML = "";
  updateLatestTicker(true);

  if (roundLog) {
    state.logEntries.slice(0, 1).forEach((message) => {
      const item = document.createElement("li");
      item.textContent = message;
      roundLog.append(item);
    });
  }

  state.logEntries.forEach((message) => {
    const item = document.createElement("li");
    item.textContent = message;
    fullRoundLog.append(item);
  });

  modalEmptyLog.hidden = hasLogs;
  fullRoundLog.hidden = !hasLogs;
}

function updateLogModalStats() {
  const level = levels[currentLevel];
  modalRoundLabel.textContent = `轮次 ${state.round}`;
  modalBestLabel.textContent = state.round ? `最佳得分 ${state.bestScore.toFixed(2)}` : "最佳 --";
  modalLevelLabel.textContent = `关卡 ${level.shortName} / 目标 ${level.target.toFixed(2)}`;
}

function openLogModal() {
  renderLogLists();
  updateLogModalStats();
  logOverlay.hidden = false;
  document.body.classList.add("modal-open");
  closeLogBtn.focus();
}

function closeLogModal() {
  logOverlay.hidden = true;
  document.body.classList.remove("modal-open");
  expandLogBtn.focus();
}

function updateHud() {
  const level = levels[currentLevel];
  const result = metrics();
  state.bestScore = Math.max(state.bestScore, result.score);
  mseValue.textContent = result.score.toFixed(2);
  roundValue.textContent = state.round;
  bestLabel.textContent = state.round ? `最佳 ${state.bestScore.toFixed(2)}` : "等待开始";
  targetLabel.textContent = `目标 ${level.target.toFixed(2)}`;
  progressFill.style.width = `${Math.round(Math.min(1, result.score / level.target) * 100)}%`;
  rateLabel.textContent = Number(penaltyC.value).toFixed(1);
  depthLabel.textContent = `${kernelPower.value} 级`;
  updateBoundaryData(result);
  document.body.classList.toggle("overfit-mode", state.overfit > 0.15);
  if (!logOverlay.hidden) updateLogModalStats();
}

function updateBoundaryData(result = metrics()) {
  const vectors = result.activeVectors;
  boundaryFormula.textContent = vectors ? `f(x)=Σ${vectors}K+b` : "等待训练";
  supportCountLabel.textContent = vectors;
  accuracyLabel.textContent = `${Math.round(result.accuracy * 100)}%`;
  violationLabel.textContent = result.violations;
  hingeLabel.textContent = result.hinge.toFixed(2);
  biasLabel.textContent = state.bias.toFixed(2);
  gammaLabel.textContent = gamma().toFixed(2);
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
  autoTimer = setInterval(trainStep, 760);
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
  toast.textContent = viewNotes[view];
  setActiveViewNote(viewNotes[view], true);
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
  const left = isSmall ? 28 : 34;
  const right = isSmall ? rect.width - 4 : rect.width - 6;
  const top = isSmall ? 2 : 4;
  const bottom = isSmall ? rect.height - 8 : rect.height - 10;
  return { left, right, top, bottom, width: right - left, height: bottom - top };
}

function px(point, bounds) {
  return bounds.left + ((point.x + 1) / 2) * bounds.width;
}

function py(point, bounds) {
  return bounds.bottom - ((point.y + 1) / 2) * bounds.height;
}

function pointFromCanvas(x, y, bounds) {
  return {
    x: ((x - bounds.left) / bounds.width) * 2 - 1,
    y: ((bounds.bottom - y) / bounds.height) * 2 - 1,
  };
}

function draw() {
  if (!state) return;
  const rect = canvas.getBoundingClientRect();
  const bounds = chartBounds();
  ctx.clearRect(0, 0, rect.width, rect.height);
  drawBackdrop(rect, bounds);
  drawGrid(bounds);
  if (activeView === "loss") drawLoss(bounds);
  else {
    drawDecisionField(bounds, activeView);
    if (activeView === "margin") drawMarginBand(bounds);
    if (activeView === "support") drawSupportInfluence(bounds);
    drawPoints(bounds, activeView);
  }
  drawAxes(bounds, activeView);
}

function drawBackdrop(rect, bounds) {
  ctx.fillStyle = "rgba(7, 16, 28, 0.34)";
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
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText(view === "loss" ? "训练轮次" : "特征 x1", bounds.right - 8, bounds.bottom - 7);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.translate(bounds.left + 12, bounds.top + bounds.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(view === "loss" ? "目标函数" : "特征 x2", 0, 0);
  ctx.restore();
  ctx.restore();
}

function drawDecisionField(bounds, view) {
  if (state.round === 0 && state.alpha.every((value) => value < 0.0001)) {
    return;
  }
  const cols = 46;
  const rows = 30;
  const cellW = bounds.width / cols;
  const cellH = bounds.height / rows;
  ctx.save();
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = bounds.left + col * cellW + cellW / 2;
      const y = bounds.top + row * cellH + cellH / 2;
      const score = scorePoint(pointFromCanvas(x, y, bounds));
      const alpha = view === "boundary" ? 0.24 : 0.15;
      ctx.fillStyle = score >= 0 ? `rgba(34,240,164,${alpha})` : `rgba(59,215,255,${alpha})`;
      ctx.fillRect(bounds.left + col * cellW, bounds.top + row * cellH, Math.ceil(cellW), Math.ceil(cellH));
      if (Math.abs(score) < 0.07) {
        ctx.fillStyle = "#fff3d6";
        ctx.fillRect(bounds.left + col * cellW, bounds.top + row * cellH, Math.ceil(cellW), Math.ceil(cellH));
      }
    }
  }
  if (state.overfit > 0.15) drawOverfitGlitch(bounds);
  ctx.restore();
}

function drawMarginBand(bounds) {
  const cols = 50;
  const rows = 32;
  const cellW = bounds.width / cols;
  const cellH = bounds.height / rows;
  ctx.save();
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = bounds.left + col * cellW + cellW / 2;
      const y = bounds.top + row * cellH + cellH / 2;
      const score = scorePoint(pointFromCanvas(x, y, bounds));
      if (Math.abs(Math.abs(score) - 1) < 0.08) {
        ctx.fillStyle = "#22f0a4";
        ctx.fillRect(bounds.left + col * cellW, bounds.top + row * cellH, Math.ceil(cellW), Math.ceil(cellH));
      } else if (Math.abs(score) < 1) {
        ctx.fillStyle = "rgba(255,212,71,0.11)";
        ctx.fillRect(bounds.left + col * cellW, bounds.top + row * cellH, Math.ceil(cellW), Math.ceil(cellH));
      }
    }
  }
  ctx.restore();
  setActiveViewNote("间隔带越宽越稳；落在带内的样本会继续影响边界。");
}

function drawSupportInfluence(bounds) {
  ctx.save();
  targetPoints.forEach((point) => {
    const signed = point.label * scorePoint(point);
    if (signed < 1.18) {
      const radius = 22 + Math.max(0, 1.2 - signed) * 14;
      ctx.strokeStyle = point.label > 0 ? "rgba(34,240,164,0.32)" : "rgba(59,215,255,0.32)";
      ctx.lineWidth = 3;
      ctx.strokeRect(px(point, bounds) - radius / 2, py(point, bounds) - radius / 2, radius, radius);
    }
  });
  ctx.restore();
  setActiveViewNote("这些方框点就是支持向量：边界主要听它们的。");
}

function drawOverfitGlitch(bounds) {
  ctx.save();
  ctx.fillStyle = "rgba(255,95,87,0.16)";
  for (let i = 0; i < 9; i += 1) {
    const y = bounds.top + ((i * 31 + state.round * 13) % Math.max(1, bounds.height));
    ctx.fillRect(bounds.left, y, bounds.width, 4);
  }
  ctx.restore();
}

function drawPoints(bounds, view) {
  ctx.save();
  targetPoints.forEach((point) => {
    const x = px(point, bounds);
    const y = py(point, bounds);
    const signed = point.label * scorePoint(point);
    const isSupport = signed < 1.12;
    const isWrong = signed < 0;
    if (isSupport) {
      ctx.fillStyle = isWrong ? "rgba(255,95,87,0.36)" : "rgba(255,212,71,0.26)";
      ctx.fillRect(x - 13, y - 13, 26, 26);
    }
    ctx.fillStyle = "#05060c";
    ctx.fillRect(x - 8, y - 8, 16, 16);
    ctx.fillStyle = point.label > 0 ? "#22f0a4" : "#3bd7ff";
    if (point.label > 0) {
      ctx.fillRect(x - 5, y - 5, 10, 10);
    } else {
      ctx.beginPath();
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x + 7, y);
      ctx.lineTo(x, y + 7);
      ctx.lineTo(x - 7, y);
      ctx.closePath();
      ctx.fill();
    }
    if (view === "boundary" && isWrong) {
      ctx.strokeStyle = "#ff5f57";
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 12, y - 12, 24, 24);
    }
  });
  ctx.restore();
}

function drawLoss(bounds) {
  const values = state.lossHistory.length ? state.lossHistory : [metrics().objective];
  const max = Math.max(...values, 1.2);
  const min = Math.min(...values, 0);
  const toX = (index) => bounds.left + (values.length <= 1 ? 0 : (index / (values.length - 1)) * bounds.width);
  const toY = (value) => bounds.bottom - ((value - min) / Math.max(max - min, 0.0001)) * bounds.height;
  ctx.save();
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
    ctx.fillStyle = "#ffd447";
    ctx.fillRect(toX(index) - 4, toY(value) - 4, 8, 8);
  });
  setActiveViewNote("hinge loss + 正则项：下降说明边界还在变好。");
  ctx.restore();
}

penaltyC.addEventListener("input", updateHud);
kernelPower.addEventListener("input", updateHud);
stepBtn.addEventListener("click", trainStep);
autoBtn.addEventListener("click", toggleAuto);
undoBtn.addEventListener("click", undoStep);
resetBtn.addEventListener("click", resetGame);
nextLevelBtn.addEventListener("click", nextLevel);
expandLogBtn.addEventListener("click", openLogModal);
closeLogBtn.addEventListener("click", closeLogModal);
logOverlay.addEventListener("click", (event) => {
  if (event.target === logOverlay) closeLogModal();
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !logOverlay.hidden) closeLogModal();
});
viewPicker.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-view]");
  if (button) setView(button.dataset.view);
});
window.addEventListener("resize", fitCanvas);

resetGame();
requestAnimationFrame(fitCanvas);
