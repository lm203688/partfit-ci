# PartFit · app source

Expo 54 / RN 0.81.5 · offline-first · no account, no cloud.

## 结构

```
App.js                     8 个界面：Home / Scan / Result / AddAppliance / Detail / Lookup / Settings / Sources
src/fitment.logic.js       匹配内核（纯函数）：归一 → 精确 → 前缀 → 候选；反查；品牌系列族
src/fitment.js             把 assets/data/fitment.json 接到内核
src/db.js                  expo-sqlite：appliances / logs / settings
src/due.js                 到期内核（纯函数，月末收敛，四档状态）
src/notify.js              本地通知 14/3/0 天，sound: 'default'
src/export.js              CSV / JSON 导出，带证据列
src/demo.js                EXPO_PUBLIC_DEMO=1 时的种子数据（截图用）
modules/partfit-ocr/       iOS 端侧文字识别（Vision，Swift）
assets/data/fitment.json   适配库（由 ../../data/fitment.json 同步而来）
test/                      17 条 node --test 回归
```

## 本地校验（Windows 可跑）

```powershell
npm install
npm test                      # 17 条：匹配/归一/反查/系列族/日期内核
npx expo export --platform ios   # JSX 与资源引用的真实打包校验
```

`expo prebuild` 在 Windows 上不会生成 iOS 工程（Expo 明确要求 macOS/Linux），所以原生构建走 CI 的 macOS runner。

## 数据流

1. `../../data/fitment.json` 是唯一数据源（含 evidence / grade / conflict）。
2. 同步到 `assets/data/fitment.json` 后随包下发，完全离线。
3. 每条结论在 UI 里都能展开看到：发布方、抓取日期、证据等级、原文片段、来源链接。
4. 厂商页面互相矛盾时，`conflict` 字段原样展示，不合并。

## 构建（CI）

变量：`PARTFIT_BUNDLE_ID`、`PARTFIT_TEAM_ID`。`app.config.js` 会读取，本地不设时回落到 app.json 的占位值。

## 版本

- 1.0.0 build 1：核心闭环（扫描/手输 → 适配 → 档案 → 提醒 → 记录 → 导出 → 来源）。
- Widget 与 App Intents 计划在 1.1：需要额外原生 target 与 CI 验证周期，1.0 不因缺它而被审核阻塞，但核心差异化（离线 + 可核验来源）已经成立。
