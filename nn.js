const $ = (selector) => document.querySelector(selector);
const canvas = $("#chart");
const ctx = canvas.getContext("2d");
const runtime = window.LabRuntime;
const modelMath = window.NeuralNetworkModel;
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
const epochsPerStep = $("#epochsPerStep");
const rateLabel = $("#rateLabel");
const epochLabel = $("#epochLabel");
const stepBtn = $("#stepBtn");
const autoBtn = $("#autoBtn");
const undoBtn = $("#undoBtn");
const resetBtn = $("#resetBtn");
const nextLevelBtn = $("#nextLevelBtn");
const accuracyLabel = $("#accuracyLabel");
const lossLabel = $("#lossLabel");
const confidenceLabel = $("#confidenceLabel");
const hiddenLabel = $("#hiddenLabel");
const normLabel = $("#normLabel");
const bestScoreLabel = $("#bestScoreLabel");

const levels = [
  { shortName: "异或", name: "入门：XOR 角落", target: 0.88, description: "正类在左下和右上，线性边界切不开，需要隐藏层组合两条斜边。", points: [[-0.78,-0.72,1],[-0.52,-0.52,1],[-0.82,-0.28,1],[-0.28,-0.78,1],[0.42,0.48,1],[0.72,0.66,1],[0.82,0.28,1],[0.3,0.78,1],[-0.72,0.46,0],[-0.48,0.72,0],[-0.22,0.28,0],[-0.66,0.08,0],[0.24,-0.66,0],[0.56,-0.36,0],[0.78,-0.62,0],[0.16,-0.18,0]] },
  { shortName: "圆环", name: "进阶：中心与外圈", target: 0.86, description: "中心点和外圈点要分开，隐藏神经元会围出一块区域。", points: [[-0.12,-0.08,1],[0.08,0.04,1],[-0.02,0.18,1],[0.16,-0.16,1],[-0.22,0.08,1],[0.22,0.2,1],[-0.84,0.02,0],[-0.58,0.58,0],[0.02,0.84,0],[0.62,0.56,0],[0.86,-0.04,0],[0.52,-0.64,0],[-0.08,-0.86,0],[-0.62,-0.54,0]] },
  { shortName: "弯月", name: "挑战：弯月边界", target: 0.82, description: "边界呈弯月形，训练足够批次后网络会慢慢弯起来。", points: [[-0.82,0.12,1],[-0.66,0.34,1],[-0.42,0.46,1],[-0.12,0.48,1],[0.16,0.38,1],[0.42,0.18,1],[0.66,-0.04,1],[-0.62,-0.42,0],[-0.34,-0.58,0],[-0.04,-0.62,0],[0.26,-0.52,0],[0.52,-0.34,0],[0.76,-0.12,0],[0.1,-0.08,0]] },
];

let levelIndex = 0;
let state;
let view = "weights";
const autoTrainer = runtime.createAutoTrainer({
  button: autoBtn,
  idleLabel: "自动训练",
  activeLabel: "暂停自动",
  intervalMs: 650,
  step: trainStep,
});

function sigmoid(x) { return modelMath.sigmoid(x); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function makeNet() {
  return modelMath.makeNet();
}

function forward(point, net = state.net) {
  return modelMath.forward(point, net);
}

function metrics() {
  return modelMath.metrics(state.points, state.net);
}

function hardestPointIndex() {
  return modelMath.hardestPointIndex(state.points, state.net);
}

function resetGame() {
  stopAuto();
  const level = levels[levelIndex];
  state = { points: level.points.map(([x, y, label]) => ({ x, y, label })), net: makeNet(), round: 0, best: 0, history: [], lossHistory: [], signalPointIndex: 0 };
  missionText.textContent = level.description;
  levelSubtitle.textContent = level.name;
  toast.textContent = "每批训练会先前向计算概率，再把误差反向传回隐藏层。";
  latestText.textContent = "未训练：隐藏层还没有形成有效特征。";
  renderPickers();
  draw();
  updateHud();
}

function cloneNet(net) {
  return modelMath.cloneNet(net);
}

function trainStep() {
  state.history.push({ net: cloneNet(state.net), round: state.round, best: state.best, lossHistory: [...state.lossHistory], signalPointIndex: state.signalPointIndex });
  const lr = Number(learningRate.value);
  state.net = modelMath.train(state.points, state.net, lr, Number(epochsPerStep.value));
  state.round += 1;
  const result = metrics();
  state.signalPointIndex = hardestPointIndex();
  state.best = Math.max(state.best, result.score);
  state.lossHistory.push(result.loss);
  toast.textContent = `第 ${state.round} 批：误差反向修正权重，损失 ${result.loss.toFixed(3)}。`;
  latestText.textContent = `第 ${state.round} 批  正确率 ${Math.round(result.accuracy * 100)}%  损失 ${result.loss.toFixed(3)}  得分 ${result.score.toFixed(2)}`;
  draw();
  updateHud();
  if (result.score >= levels[levelIndex].target) {
    toast.textContent = `通关！网络已经学出非线性边界，得分 ${result.score.toFixed(2)}。`;
    latestText.textContent = toast.textContent;
    stopAuto();
  }
}

function undo() {
  const previous = state.history.pop();
  if (!previous) {
    toast.textContent = "还没有可以撤回的训练批次。";
    return;
  }
  state.net = previous.net;
  state.round = previous.round;
  state.best = previous.best;
  state.lossHistory = previous.lossHistory;
  state.signalPointIndex = previous.signalPointIndex || 0;
  draw();
  updateHud();
}

function updateHud() {
  const result = metrics();
  state.best = Math.max(state.best, result.score);
  const norm = Math.sqrt(state.net.h.reduce((sum, unit) => sum + unit.wx ** 2 + unit.wy ** 2 + unit.v ** 2, 0));
  runtime.setText(scoreValue, result.score.toFixed(2));
  runtime.setText(roundValue, state.round);
  runtime.setText(targetLabel, `目标 ${levels[levelIndex].target.toFixed(2)}`);
  runtime.setProgress(progressFill, result.score / levels[levelIndex].target);
  runtime.setText(bestLabel, state.round ? `最佳 ${state.best.toFixed(2)}` : "等待开始");
  rateLabel.textContent = Number(learningRate.value).toFixed(2);
  epochLabel.textContent = epochsPerStep.value;
  accuracyLabel.textContent = `${Math.round(result.accuracy * 100)}%`;
  lossLabel.textContent = result.loss.toFixed(3);
  confidenceLabel.textContent = `${Math.round(result.confidence * 100)}%`;
  hiddenLabel.textContent = state.net.h.length;
  normLabel.textContent = norm.toFixed(1);
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
  const text = { field: "边界视图：背景显示网络输出概率。", neurons: "神经元视图：亮线展示隐藏单元各自学到的切分方向。", loss: "损失视图：曲线下降说明反向传播有效。", weights: "网络视图：2 个输入、4 个隐藏神经元、1 个输出，线宽表示权重，红色脉冲表示反向误差。" }[view];
  toast.textContent = text; latestText.textContent = text; draw();
}

const fitCanvas = runtime.makeCanvasFitter(canvas, ctx, draw, { minWidth: 1, minHeight: 1 });

function bounds() {
  const rect = canvas.getBoundingClientRect();
  const compact = rect.width < 760;
  const panelWidth = compact
    ? Math.min(260, Math.max(190, rect.width * 0.42))
    : Math.min(350, Math.max(280, rect.width * 0.34));
  const gap = compact ? 10 : 14;
  const minPlotWidth = compact ? Math.max(190, rect.width * 0.48) : 340;
  const plotRight = Math.max(minPlotWidth, rect.width - panelWidth - gap);
  return {
    left: 4,
    top: 4,
    right: plotRight - 6,
    bottom: rect.height - 10,
    width: plotRight - 10,
    height: rect.height - 14,
    panel: { x: plotRight + gap, y: 4, w: rect.width - plotRight - gap - 6, h: rect.height - 14 },
  };
}
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
    if (view === "neurons") drawNeuronLines(b);
    drawPoints(b);
  }
  drawAxes(b);
  drawNetworkPanel(b.panel);
}

function drawField(b) {
  const cols = 44, rows = 28, cellW = b.width / cols, cellH = b.height / rows;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const p = forward(pointAt(b.left + col * cellW + cellW / 2, b.top + row * cellH + cellH / 2, b)).p;
      ctx.fillStyle = p >= 0.5 ? `rgba(34,240,164,${0.08 + p * 0.2})` : `rgba(59,215,255,${0.08 + (1 - p) * 0.2})`;
      ctx.fillRect(b.left + col * cellW, b.top + row * cellH, Math.ceil(cellW), Math.ceil(cellH));
      if (Math.abs(p - 0.5) < 0.035) { ctx.fillStyle = "#fff3d6"; ctx.fillRect(b.left + col * cellW, b.top + row * cellH, Math.ceil(cellW), Math.ceil(cellH)); }
    }
  }
}

function drawGrid(b) {
  ctx.strokeStyle = "rgba(139,211,255,0.14)"; ctx.lineWidth = 2;
  for (let i = 0; i <= 8; i += 1) { const x = Math.round(b.left + (b.width / 8) * i) + 0.5; ctx.beginPath(); ctx.moveTo(x, b.top); ctx.lineTo(x, b.bottom); ctx.stroke(); }
  for (let i = 0; i <= 4; i += 1) { const y = Math.round(b.top + (b.height / 4) * i) + 0.5; ctx.beginPath(); ctx.moveTo(b.left, y); ctx.lineTo(b.right, y); ctx.stroke(); }
}

function drawNeuronLines(b) {
  state.net.h.forEach((unit, index) => {
    if (Math.abs(unit.wy) < 0.01) return;
    const y1 = -(unit.wx * -1 + unit.b) / unit.wy;
    const y2 = -(unit.wx * 1 + unit.b) / unit.wy;
    ctx.strokeStyle = unit.v >= 0 ? "#22f0a4" : "#ffd447";
    ctx.globalAlpha = view === "weights" ? Math.min(1, Math.abs(unit.v)) : 0.7;
    ctx.lineWidth = 3 + Math.min(5, Math.abs(unit.v) * 3);
    ctx.beginPath(); ctx.moveTo(px(-1, b), py(y1, b)); ctx.lineTo(px(1, b), py(y2, b)); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff3d6"; ctx.fillText(`H${index + 1}`, px(-0.96, b), py(y1, b));
  });
}

function drawPoints(b) {
  state.points.forEach((point) => {
    const p = forward(point).p;
    const wrong = (p >= 0.5 ? 1 : 0) !== point.label;
    ctx.fillStyle = point.label ? "#22f0a4" : "#3bd7ff";
    ctx.strokeStyle = wrong ? "#ff5f57" : "#05060c";
    ctx.lineWidth = wrong ? 5 : 4;
    const x = px(point.x, b), y = py(point.y, b);
    if (point.label) { ctx.fillRect(x - 7, y - 7, 14, 14); ctx.strokeRect(x - 7, y - 7, 14, 14); }
    else { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-7, -7, 14, 14); ctx.strokeRect(-7, -7, 14, 14); ctx.restore(); }
  });
}

function drawAxes(b) {
  ctx.strokeStyle = "rgba(255,243,214,0.58)"; ctx.fillStyle = "rgba(255,243,214,0.72)"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(b.left, b.top); ctx.lineTo(b.left, b.bottom); ctx.lineTo(b.right, b.bottom); ctx.stroke();
  ctx.font = "12px Courier New, Microsoft YaHei, monospace"; ctx.fillText("特征 x2", b.left + 10, b.top + 18); ctx.textAlign = "right"; ctx.fillText("特征 x1", b.right - 8, b.bottom - 10); ctx.textAlign = "left";
}

function drawNetworkPanel(panel) {
  const sample = state.points[state.signalPointIndex] || state.points[0];
  const out = forward(sample);
  const dz = out.p - sample.label;
  const inputValues = [sample.x, sample.y];
  const xIn = panel.x + 52;
  const xHidden = panel.x + panel.w * 0.5;
  const xOut = panel.x + panel.w - 54;
  const inputY = [panel.y + panel.h * 0.34, panel.y + panel.h * 0.66];
  const hiddenY = state.net.h.map((_, index) => panel.y + panel.h * (0.2 + index * 0.2));
  const outputY = panel.y + panel.h * 0.5;
  const compactPanel = panel.h < 230 || panel.w < 220;
  const weightLabels = [];
  const labelBlockers = [
    ...(compactPanel ? [] : [{ x: panel.x + 8, y: panel.y + 4, w: panel.w - 16, h: 24 }]),
    { x: panel.x + 8, y: panel.y + panel.h - 28, w: panel.w - 16, h: 24 },
    ...inputY.map((y) => nodeLabelBlocker(xIn, y, 16)),
    ...hiddenY.map((y) => nodeLabelBlocker(xHidden, y, 18)),
    nodeLabelBlocker(xOut, outputY, 30),
    { x: xHidden + 34, y: outputY + 54, w: panel.x + panel.w - xHidden - 46, h: 22 },
  ];

  ctx.save();
  ctx.fillStyle = "rgba(5,6,12,0.86)";
  ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  ctx.strokeStyle = "#fff3d6";
  ctx.lineWidth = 3;
  ctx.strokeRect(panel.x + 0.5, panel.y + 0.5, panel.w - 1, panel.h - 1);
  ctx.font = "12px Courier New, Microsoft YaHei, monospace";
  ctx.fillStyle = "#fff3d6";
  if (!compactPanel) ctx.fillText("2-4-1 NETWORK", panel.x + 12, panel.y + 18);
  ctx.fillStyle = "rgba(255,243,214,0.72)";
  ctx.fillText(`sample ${state.signalPointIndex + 1}  y=${sample.label}  p=${out.p.toFixed(2)}`, panel.x + 12, panel.y + panel.h - 12);

  state.net.h.forEach((unit, index) => {
    const laneOffset = index % 2 === 0 ? 10 : -10;
    drawWeightLine(xIn, inputY[0], xHidden, hiddenY[index], unit.wx, `x1 ${signed(unit.wx)}`, { labels: weightLabels, t: 0.31, normalOffset: -12 + laneOffset });
    drawWeightLine(xIn, inputY[1], xHidden, hiddenY[index], unit.wy, `x2 ${signed(unit.wy)}`, { labels: weightLabels, t: 0.5, normalOffset: 12 + laneOffset });
    drawWeightLine(xHidden, hiddenY[index], xOut, outputY, unit.v, `v ${signed(unit.v)}`, { labels: weightLabels, t: 0.56, normalOffset: index < 2 ? -12 : 12 });
  });
  drawWeightLabels(weightLabels, panel, labelBlockers);

  inputValues.forEach((value, index) => {
    drawNode(xIn, inputY[index], 16, value, `x${index + 1}`, value.toFixed(2), "#3bd7ff");
  });

  state.net.h.forEach((unit, index) => {
    const activation = out.hidden[index];
    const hiddenError = dz * unit.v * (1 - activation * activation);
    drawNode(xHidden, hiddenY[index], 18, activation, `H${index + 1}`, activation.toFixed(2), unit.v >= 0 ? "#22f0a4" : "#ffd447");
    drawErrorBar(xHidden + 25, hiddenY[index], hiddenError);
  });

  drawNode(xOut, outputY, 20, out.p * 2 - 1, "OUT", out.p.toFixed(2), out.p >= 0.5 ? "#22f0a4" : "#3bd7ff");
  drawErrorRing(xOut, outputY, dz);
  drawBackpropArrow(xOut - 26, outputY + 36, xHidden + 30, outputY + 36, dz);
  ctx.restore();
}

function drawWeightLine(x1, y1, x2, y2, weight, label, labelOptions = {}) {
  const strength = clamp(Math.abs(weight) / 2.4, 0.12, 1);
  ctx.strokeStyle = weight >= 0 ? "#22f0a4" : "#3bd7ff";
  ctx.globalAlpha = 0.28 + strength * 0.64;
  ctx.lineWidth = 2 + strength * 6;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (strength > 0.42) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy) || 1;
    const normalOffset = labelOptions.normalOffset || 0;
    const t = labelOptions.t == null ? 0.46 : labelOptions.t;
    const nx = -dy / length;
    const ny = dx / length;
    const item = {
      label,
      color: weight >= 0 ? "#baffdf" : "#bdf2ff",
      strength,
      x: x1 + dx * t + nx * normalOffset,
      y: y1 + dy * t + ny * normalOffset,
      nx,
      ny,
    };
    if (labelOptions.labels) labelOptions.labels.push(item);
    else drawWeightLabel(item, { x: item.x, y: item.y, w: 0, h: 0 });
  }
}

function drawWeightLabels(labels, panel, blockers) {
  const placed = [...blockers];
  ctx.save();
  ctx.font = "10px Courier New, Microsoft YaHei, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  labels
    .sort((a, b) => b.strength - a.strength)
    .forEach((item) => {
      const metrics = ctx.measureText(item.label);
      const width = Math.ceil((metrics && metrics.width) || item.label.length * 6) + 8;
      const height = 14;
      const shifts = [0, 8, -8, 16, -16, 24, -24, 32, -32];
      let bestRect = null;
      let bestScore = Infinity;
      shifts.forEach((shift, order) => {
        const rect = fitLabelRect(item.x + item.nx * shift, item.y + item.ny * shift, width, height, panel);
        const overlap = placed.reduce((sum, other) => sum + overlapArea(rect, other), 0);
        const score = overlap * 100 + Math.abs(shift) + order * 0.01;
        if (score < bestScore) {
          bestScore = score;
          bestRect = rect;
        }
      });
      placed.push(bestRect);
      drawWeightLabel(item, bestRect);
    });
  ctx.restore();
}

function drawWeightLabel(item, rect) {
  if (!rect.w || !rect.h) {
    ctx.fillStyle = item.color;
    ctx.font = "10px Courier New, Microsoft YaHei, monospace";
    ctx.fillText(item.label, item.x, item.y);
    return;
  }
  ctx.fillStyle = "rgba(5,6,12,0.78)";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalAlpha = 0.58;
  ctx.strokeStyle = item.color;
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
  ctx.globalAlpha = 1;
  ctx.fillStyle = item.color;
  ctx.fillText(item.label, rect.x + 4, rect.y + rect.h / 2);
}

function fitLabelRect(cx, cy, width, height, panel) {
  return {
    x: clamp(cx - width / 2, panel.x + 6, panel.x + panel.w - width - 6),
    y: clamp(cy - height / 2, panel.y + 30, panel.y + panel.h - height - 30),
    w: width,
    h: height,
  };
}

function overlapArea(a, b) {
  const width = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return width * height;
}

function nodeLabelBlocker(x, y, r) {
  const pad = 8;
  return { x: x - r - pad, y: y - r - 22, w: (r + pad) * 2, h: r * 2 + 32 };
}

function drawNode(x, y, r, activation, name, value, color) {
  const pulse = clamp(Math.abs(activation), 0, 1);
  ctx.fillStyle = "#05060c";
  ctx.fillRect(x - r - 3, y - r - 3, (r + 3) * 2, (r + 3) * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.28 + pulse * 0.62;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#fff3d6";
  ctx.lineWidth = 3;
  ctx.strokeRect(x - r, y - r, r * 2, r * 2);
  ctx.fillStyle = "#fff3d6";
  ctx.font = "11px Courier New, Microsoft YaHei, monospace";
  ctx.textAlign = "center";
  ctx.fillText(name, x, y - r - 7);
  ctx.fillText(value, x, y + 4);
  ctx.textAlign = "left";
}

function drawErrorBar(x, y, error) {
  const size = clamp(Math.abs(error) * 80, 3, 24);
  ctx.fillStyle = error >= 0 ? "#ff5f57" : "#ffd447";
  ctx.globalAlpha = 0.45 + clamp(Math.abs(error) * 5, 0, 0.5);
  ctx.fillRect(x, y - size / 2, 6, size);
  ctx.globalAlpha = 1;
}

function drawErrorRing(x, y, error) {
  const strength = clamp(Math.abs(error), 0, 1);
  ctx.strokeStyle = error >= 0 ? "#ff5f57" : "#ffd447";
  ctx.lineWidth = 2 + strength * 8;
  ctx.strokeRect(x - 28, y - 28, 56, 56);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.font = "11px Courier New, Microsoft YaHei, monospace";
  ctx.textAlign = "center";
  ctx.fillText(`err ${signed(error)}`, x, y + 42);
  ctx.textAlign = "left";
}

function drawBackpropArrow(x1, y1, x2, y2, error) {
  ctx.strokeStyle = error >= 0 ? "#ff5f57" : "#ffd447";
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 + 10, y2 - 6);
  ctx.lineTo(x2 + 10, y2 + 6);
  ctx.closePath();
  ctx.fill();
  ctx.font = "11px Courier New, Microsoft YaHei, monospace";
  const label = "backprop error";
  const metrics = ctx.measureText(label);
  const width = Math.ceil((metrics && metrics.width) || label.length * 7) + 8;
  const labelX = x2 + 14;
  const labelY = y2 + 32;
  ctx.fillStyle = "rgba(5,6,12,0.78)";
  ctx.fillRect(labelX - 4, labelY - 11, width, 14);
  ctx.fillStyle = error >= 0 ? "#ff5f57" : "#ffd447";
  ctx.fillText(label, labelX, labelY);
}

function signed(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function drawLoss(b) {
  drawField(b); drawGrid(b);
  const values = state.lossHistory.length ? state.lossHistory : [metrics().loss];
  const max = Math.max(...values, 0.8);
  ctx.strokeStyle = "#22f0a4"; ctx.lineWidth = 5; ctx.beginPath();
  values.forEach((value, index) => { const x = b.left + (index / Math.max(1, values.length - 1)) * b.width; const y = b.bottom - (1 - value / max) * b.height; if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  ctx.stroke();
}

learningRate.addEventListener("input", updateHud);
epochsPerStep.addEventListener("input", updateHud);
stepBtn.addEventListener("click", trainStep);
autoBtn.addEventListener("click", toggleAuto);
undoBtn.addEventListener("click", undo);
resetBtn.addEventListener("click", resetGame);
nextLevelBtn.addEventListener("click", () => { levelIndex = (levelIndex + 1) % levels.length; resetGame(); });
runtime.bindSegmentedPicker(viewPicker, setView);
window.addEventListener("resize", fitCanvas);
resetGame();
requestAnimationFrame(fitCanvas);
