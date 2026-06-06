# 机器学习训练场

一个无需构建的静态交互站，把常见机器学习模型做成街机式训练场。用户可以通过单步训练、自动训练、切换观察视图和调整超参数，直接看到模型如何学习、犯错、收敛和通关。

## 适合谁

- 想快速获得模型直觉的学习者。
- 需要课堂演示或技术分享素材的讲解者。
- 想比较不同模型“形态”的前端/可视化原型作者。

## 训练场

- **GBM 梯度提升机**：一棵棵弱树串联补残差，观察加法模型、学习率、弱树复杂度和过拟合。
- **SVM 最大间隔**：观察决策边界、间隔带、支持向量和核复杂度。
- **K-Means 聚类**：拖动质心，观察“分配 -> 移动”的迭代。
- **决策树**：用切分线把样本区域变成更纯的叶子。
- **线性回归**：用梯度下降移动直线，降低 MSE。
- **逻辑回归**：观察 sigmoid 概率场、分类边界、交叉熵和权重。
- **神经网络**：观察隐藏神经元、非线性边界、权重和反向传播误差信号。
- **随机森林**：用 bootstrap 样本训练多棵树，再通过投票稳定边界。

## GBM 推荐玩法

1. 打开 `gbm.html`，先看蓝色初始模型：它只猜当前关卡目标值的平均数。
2. 点一次“训练下一棵”，观察绿色弱树如何追红色残差。
3. 切到“弱树”视图，看公式 `F_m(x)=F_{m-1}(x)+ηh_m(x)` 对应到灰线、绿线和蓝线。
4. 调整“学习率 η”和“弱树分段数”，比较小步慢学、复杂弱树、过拟合抖动的差异。
5. 切到“误差”视图，看 MSE 曲线是否仍在下降。

## 本地运行

这个项目没有构建步骤，直接启动一个静态服务器即可：

```bash
python -m http.server 4173 --bind 127.0.0.1
```

然后打开：

```text
http://127.0.0.1:4173/index.html
```

也可以直接部署到 GitHub Pages；仓库已有 `.github/workflows/pages.yml`。

## 冒烟测试

项目包含一个轻量 fake DOM smoke 脚本，用来确认主要训练场可以完成通关流程：

```bash
npm run smoke
```

当前覆盖全部八个训练场，并单独验证 `models/` 下的纯模型计算模块。

## 开发命令

```bash
npm run serve  # 启动本地静态服务器
npm run check  # 检查全部 JavaScript 语法
npm run smoke  # 运行纯模型与页面通关 smoke
npm test       # 完整检查
```

## 项目结构

```text
.
├── index.html             # 训练场大厅
├── gbm.html / app.js      # GBM 梯度提升机
├── svm.html / svm.js      # SVM
├── kmeans.html / kmeans.js
├── tree.html / tree.js
├── linear.html / linear.js
├── logistic.html / logistic.js
├── nn.html / nn.js
├── forest.html / forest.js
├── models/                # 不依赖 DOM 的纯模型计算模块
├── lab-runtime.js         # 无构建共享运行时
├── styles.css             # 全站视觉系统
└── scripts/smoke-labs.cjs # 冒烟测试
```

## 新增训练场约定

建议沿用现有文件节奏：

1. HTML 使用 `nav + game-shell + stage + control-panel + canvas`。
2. JS 按 `DOM 引用 -> levels 数据 -> state -> 模型计算 -> HUD/绘制 -> 事件绑定` 排列。
3. 优先复用 `lab-runtime.js` 里的关卡选择、观察方式切换、自动训练、画布适配和 HUD 更新工具。
4. 每个观察视图都应回答一个概念问题，例如“模型在哪里”“还错在哪里”“本轮学了什么”“损失是否下降”。
5. 如果新增可通关模型，优先把它加入 `scripts/smoke-labs.cjs`。
