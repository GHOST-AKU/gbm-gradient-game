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
- At 390px the two canvas regions stack vertically with no horizontal overflow.

**Focused region comparison evidence**

- The canvas region was inspected separately because it carries the requested change. Network nodes, signed weight lines, hidden activations, output probability, and backprop error remain readable inside the dedicated panel.
- A one-batch training interaction updates score, batch, activations, weights, and status text without console warnings or errors.

**Findings**

- No actionable P0/P1/P2 findings remain.
- [P3] Dense weight labels can overlap when several connections have similar slopes.
  Location: network panel in `nn.js`.
  Evidence: the dedicated panel preserves all labels from the reference, but the center connection cluster remains visually dense.
  Impact: minor reading friction when inspecting every numeric weight simultaneously.
  Follow-up: reveal secondary weight labels on hover/focus or only label the strongest connections.

**Required fidelity surfaces**

- Fonts and typography: existing pixel/monospace hierarchy preserved; no new font drift.
- Spacing and layout rhythm: desktop split matches the forest composition; mobile uses a stable stacked layout.
- Colors and visual tokens: positive, negative, focus, error, and previous-state colors remain aligned with `VISUAL_LANGUAGE.md`.
- Image quality and asset fidelity: no image assets are required; Canvas output remains sharp at device-pixel scaling.
- Copy and content: neural-network terminology and all existing controls remain unchanged.

**Patches made**

- Added responsive split bounds to the neural-network Canvas.
- Moved the network diagram from an overlay to a dedicated panel.
- Kept the network panel visible across all observation modes.
- Increased the mobile Canvas height so field and network panel can stack without compression.
- Added visual-contract assertions for the dedicated panel and narrow-screen layout.

**Implementation Checklist**

- [x] Desktop field/network split
- [x] Mobile stacked layout
- [x] Existing training controls remain functional
- [x] Full smoke suite passes
- [x] Console has no errors or warnings

**Follow-up Polish**

- Consider progressive disclosure for low-strength connection labels.

final result: passed
