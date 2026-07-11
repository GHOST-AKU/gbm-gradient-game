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

## 测试与性能基准

测试清单与页面加载清单共用 `core/lab-manifest.js`，不会再分别维护“页面 -> 模型 -> 主按钮 -> 关卡数”的映射。轻量 smoke 会确认全部关卡可以通关、纯模型计算保持确定；真实浏览器脚本会验证 Canvas、训练/撤销、日志弹层、主题、响应式和错误输出。

```bash
npm run smoke
npm run benchmark
```

浏览器 QA 需要先运行 `npm run serve`，再执行：

```bash
npx --yes --package @playwright/cli playwright-cli -s=ml-arcade-qa open http://127.0.0.1:4173/gbm.html
npx --yes --package @playwright/cli playwright-cli -s=ml-arcade-qa run-code --filename scripts/browser-qa.js
npx --yes --package @playwright/cli playwright-cli -s=ml-arcade-qa run-code --filename scripts/performance-qa.js
```

## 开发命令

```bash
npm run serve  # 启动本地静态服务器
npm run check  # 检查全部 JavaScript 语法
npm run visual:check # 检查八个训练场的可视化结构约定
npm run smoke  # 运行纯模型与页面通关 smoke
npm run benchmark # 运行树切分、森林、聚类和 SVM 热点基准
npm test       # 完整检查
```

颜色、线型、形态速读和 Canvas 可访问性约定见 `VISUAL_LANGUAGE.md`。

## 项目结构

```text
.
├── index.html                 # 训练场大厅
├── gbm.html ... forest.html   # 保留稳定 URL；只放本场语义内容
├── core/
│   ├── lab-manifest.js        # 页面、模型、脚本、导航和 smoke 的唯一清单
│   ├── bootstrap.js           # 按清单并行获取、按序启动训练场
│   └── lab-runtime.js         # 控制器、日志、历史、Canvas、字段缓存
├── labs/                      # 每个训练场独有的状态、文案与绘制层
│   ├── gbm.js
│   └── ...
├── models/
│   ├── model-core.js          # 二分类统计与树切分共享数学核
│   ├── gbm-model.js
│   └── ...                    # 不依赖 DOM 的纯模型模块
├── styles.css                 # 全站视觉系统
└── scripts/                   # 契约、smoke、浏览器 QA 与 benchmark
```

## 新增训练场约定

1. 在 `core/lab-manifest.js` 增加一条定义；导航、bootstrap 和 smoke 会同时获得它。
2. 保留一个根目录 HTML 作为稳定 URL，公共导航写成空的 `.lab-switch` mount，日志写成 `data-training-log` mount。
3. 纯算法放进 `models/<id>-model.js`；训练场交互与专属绘制放进 `labs/<id>.js`。
4. 所有训练场必须通过 `LabRuntime.createLabController()` 装配关卡、视图、自动训练、撤销、重置、日志和 Canvas 生命周期，不能在页面脚本里再复制一套。
5. 密集分类/聚类背景使用共享 `createFieldRenderer()`；坐标映射、网格和损失曲线使用共享 Canvas 工具。
6. 每个观察视图都应回答一个概念问题，例如“模型在哪里”“还错在哪里”“本轮学了什么”“损失是否下降”。
