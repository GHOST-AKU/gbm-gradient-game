# 神经网络训练场设计 QA

- source visual truth path: `C:/Users/GHOST_~1/AppData/Local/Temp/codex-clipboard-c9d23f56-20d1-471f-9fb8-b9418cbb3ee3.png`
- supporting reference path: `C:/Users/GHOST_~1/AppData/Local/Temp/codex-clipboard-affc74aa-774c-4baf-b871-3d9824d392d2.png`
- implementation screenshot path: `output/design-qa/nn-1920x852.png`
- mobile screenshot path: `output/design-qa/nn-mobile-390x844.png`
- combined comparison path: `output/design-qa/nn-reference-vs-implementation.png`
- viewport: desktop `1920x852`; mobile `390x844`
- state: XOR first level, network view, untrained state

**Full-view comparison evidence**

- The implementation preserves the reference's page hierarchy, typography, color tokens, control density, and fixed right control rail.
- The requested forest-style canvas organization is present: the decision field occupies the left region and the 2-4-1 network occupies a dedicated right region.
- The network panel no longer covers samples or the decision boundary. Both regions remain visible at the same time.
- At 390px portrait, the lab now shows a rotate-device gate instead of a stacked responsive layout; phone landscape keeps the game-style split.

**Focused region comparison evidence**

- The canvas region was inspected separately because it carries the requested change. Network nodes, signed weight lines, hidden activations, output probability, and backprop error remain readable inside the dedicated panel.
- A one-batch training interaction updates score, batch, activations, weights, and status text without console warnings or errors.

**Findings**

- No actionable findings remain.
- Resolved: dense weight labels now use collision-aware placement in `nn.js`, so labels avoid the central connection cluster, nodes, panel title, and footer copy while preserving the existing color and monospace treatment.

**Required fidelity surfaces**

- Fonts and typography: existing pixel/monospace hierarchy preserved; no new font drift.
- Spacing and layout rhythm: desktop split matches the forest composition; mobile portrait is gated, while mobile landscape preserves a compact split layout.
- Colors and visual tokens: positive, negative, focus, error, and previous-state colors remain aligned with `VISUAL_LANGUAGE.md`.
- Image quality and asset fidelity: no image assets are required; Canvas output remains sharp at device-pixel scaling.
- Copy and content: neural-network terminology and all existing controls remain unchanged.

**Patches made**

- Added responsive split bounds to the neural-network Canvas.
- Moved the network diagram from an overlay to a dedicated panel.
- Kept the network panel visible across all observation modes.
- Replaced portrait mobile stacking with a rotate-device gate and compact landscape game layout.
- Added visual-contract assertions for the dedicated panel and narrow-screen layout.
- Added collision-aware neural-network weight label placement and label readability backing.

**Implementation Checklist**

- [x] Desktop field/network split
- [x] Mobile portrait rotate gate
- [x] Mobile landscape split layout
- [x] Existing training controls remain functional
- [x] Full smoke suite passes
- [x] Console has no errors or warnings

**Follow-up Polish**

- None currently open.

final result: passed
