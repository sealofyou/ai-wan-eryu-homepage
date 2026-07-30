# AI玩尔玉三维桌面主页实现结果

## 运行地址

- 本地开发服务器：`http://127.0.0.1:4328/`
- Build in Public 项目页：`http://127.0.0.1:4328/projects/personal-homepage-build-in-public/`
- 当前状态：正在监听，HTTP 返回 `200`
- 启动方式：`npm run dev -- --host 127.0.0.1 --port 4328`

## 2026-07-30 阶段一架构重构

本轮只调整代码组织，不修改桌面构图、尺寸、坐标、材质、文案和交互。公网版本未更新。

- 受保护基线：`3aec85b`
- 基线标签：`homepage-desktop-baseline-20260729`
- 开发分支：`codex/scene-modularization`
- `scene.ts`：从最初 `1412` 行收敛到 `366` 行
- 屏幕绘制：迁移到 `src/desktop/screens/`
- WebGL、相机、灯光、资源与动作合同：迁移到 `src/desktop/core/`
- 房间、桌体、显示器、机箱、装饰、洞洞板、台灯、键盘、鼠标和实体控制键：迁移到 `src/desktop/objects/`
- pointer、拖拽、鼠标垫画线和留言 DOM 监听：迁移到 `src/desktop/interactions/`
- 所有物件工厂使用统一的 `SceneObjectResult` 合同，为后续 GLB 模型替换保留入口
- 所有 interaction 控制器提供 `dispose()`，不再向 `scene.ts` 继续堆叠原始事件监听
- 页面卸载或热更新时统一停止动画帧、移除监听器、释放 Three.js 几何体/材质/纹理/renderer，并移除 Canvas 与调试 API

### 阶段一验证

- `npm test`：`10` 个测试文件、`45` 个测试全部通过
- `npm run check`：`0 errors / 0 warnings / 0 hints`
- `npm run build`：通过，生成 `6` 个静态页面
- `1440×900`：与受保护基线截图 `0` 像素差
- `1920×1080`：与受保护基线截图 `0` 像素差
- 真实浏览器交互：左侧入口切换、鼠标拖拽、键盘拖拽、鼠标垫画线、留言输入聚焦、台灯亮度切换均通过
- 页面生命周期：触发 `pagehide` 后 Canvas 数量由 `1` 变为 `0`，`window.__ERYU_DESKTOP__` 已移除
- 浏览器控制台：`0 errors`

确定性视觉回归使用 `prefers-reduced-motion: reduce` 关闭入场动画，避免截图时间差产生假阳性。验证记录保存在 `.omx/state/scene-modularization/ralph-progress.json`，截图保存在忽略提交的 `output/scene-refactor-deterministic/`。

### 主线合并状态

- 用户已完成本地视觉与交互验收。
- 已通过合并提交 `0d970d4` 接入 GitHub `main`。
- 合并前旧主线由标签 `public-main-before-modularization-20260730` 保护。
- 已验收桌面版本继续由标签 `homepage-desktop-baseline-20260729` 保护。
- 下一阶段分支为 `codex/desktop-model-pipeline`。
- 本次只更新 GitHub 代码主线，没有触发公网部署。

### 发布 Gate

当前已完成本地验收和 GitHub 主线合并，但尚未重新部署公网。下一步先在独立分支完成资源基线和鼠标 GLB 管线试验，再单独接入 Build in Public 内容；所有阶段仍需本地验收后才能进入公网发布。

## 2026-07-30 V0.4 首屏资源优化

本轮在独立 V0.4 工作树和分支 `codex/v0.4-resource-baseline` 中执行，未修改 `main/master`，未部署公网。

- 正常 WebGL 首屏不再请求 `2,141,964` 字节的降级构图图。
- 主屏人物图由 `2,191,104` 字节 PNG 改为 `230,910` 字节 WebP。
- Q 版摆件图由 `1,902,688` 字节 PNG 改为 `134,602` 字节 WebP。
- 首屏图片负载由 `6,235,756` 字节降至 `365,512` 字节，下降 `94.14%`。
- 原 PNG 继续作为 WebP 加载失败时的回退资源。
- 新增 `npm run check:assets`，为图片、首页 JS 和未来 GLB 设置资源预算。
- WebP 与原 PNG 在 `1440x900`、`1920x1080` 的同环境截图对比中，最大单通道差为 `5`，没有像素差异超过 `5`。
- 当前为 `11` 个测试文件、`47` 个测试全部通过；Astro check、生产构建和资源预算检查均通过。
- 两个桌面视口控制台均为 `0 errors`，交互状态和页面卸载资源清理正常。

完整数据和验证说明见 `docs/superpowers/plans/2026-07-30-v0.4-resource-baseline.md`。

## 2026-07-31 V0.5 鼠标 GLB 管线

本轮以 `68d0132` 为基线，在独立 V0.5 工作树和分支 `codex/v0.5-mouse-glb` 中执行。默认首页继续使用已验收的程序化鼠标；只有地址包含 `?mouse=glb` 时才加载候选模型。

- 新增 GLB 下载、解析、并发缓存、失败重试和幂等释放管线。
- `GLTFLoader` 按需动态导入，不进入默认首页请求。
- 鼠标视觉与拖拽容器分离，GLB 加载成功只替换视觉层。
- 鼠标使用独立低复杂度命中代理；全场景点击由明确的 `interactiveTargets` 驱动。
- 场景卸载前调用物件 `dispose()`，再统一释放其余 Three.js 资源。
- 新增可重复生成的通用游戏鼠标模型，最终 GLB 为 `435,088` 字节。
- 新增建模工具对照、资产来源说明、运行预算和正式模型替换流程。

### V0.5 验证

- TDD 红灯已记录；实现后当前全量测试为 `58` 个。
- Astro check：`0 errors / 0 warnings / 0 hints`。
- 生产构建通过；默认桌面 JS 为 `609,532` 字节，低于 `650,000` 字节预算。
- `gaming-mouse.glb` 为 `435,088` 字节，低于本轮 `500,000` 字节目标和 `3 MB` 硬上限。
- 默认页面在 `1440x900`、`1920x1080` 下均与 V0.4 为 `0` 像素差，且不请求 GLB。
- GLB 试验版完成副屏点击、鼠标拖拽、主屏光标同步、键盘拖拽和画笔模式回归。
- 损坏模型自动回退到程序化鼠标，无未处理异常。
- `pagehide` 后 Canvas、调试 API 和模型状态标记均被清理。
- GLB 候选经过三轮视觉检查，最终内部判定 `91/100`；是否改为默认仍交给用户决定。

### V0.5 发布边界

本阶段只建立管线和候选模型，不默认替换鼠标，不修改其他桌面物件，不处理手机版，也不部署公网。

## 2026-07-31 V0.7 Build in Public 内容接入

本轮从 `2aaf7fc` 建立独立工作树和 `codex/v0.7-build-in-public` 分支。默认 3D 桌面构图、相机、物件和首页文案不变，只把一个真实项目接入“最近在做”。

- 新增 `projects` 与 `projectUpdates` 两个 Astro Content Collections。
- 项目概览和逐次更新分开保存；以后新增进展只需要增加一个 Markdown 文件。
- 首批整理 7 条真实记录，覆盖视觉基线、架构重构、主线统一、资源优化、秒哒参赛版、GLB 管线和本轮内容接入。
- 每条记录只使用现有提交、标签、测试或项目文档能够支持的事实。
- 公开证据链接强制使用 HTTPS，站内项目地址强制使用根相对路径。
- 3D 主屏“最近在做”可以进入项目列表、项目预览，并通过“查看项目”打开站内详情。
- 项目页采用现有纸张、炭黑和冷绿视觉语言，展示状态、当前阶段、可验证结果、时间线与证据链接。

### V0.7 TDD 与验证

- 实现前目标测试出现 6 项预期失败；完成后全量为 `14` 个测试文件、`64` 个测试全部通过。
- Astro check：`0 errors / 0 warnings / 0 hints`。
- 生产构建生成 `7` 个静态页面。
- 首页资源预算继续通过，默认模型预加载为 `0`。
- `1440×900` 与 `1920×1080` 默认桌面均和 V0.5 基线保持 `0` 像素差。
- 浏览器验证“最近在做 → 项目预览 → 查看项目”完整链路通过。
- 项目页无横向溢出，首批显示 7 条更新；桌面与项目页控制台均为 `0 errors`。
- 触发 `pagehide` 后 Canvas 由 `1` 变为 `0`，调试 API 被移除。

### V0.7 发布边界

本阶段只在本地与 Git 功能分支中验证，不部署公网。项目内容合入主线后仍需用户本地验收，公网发布继续作为独立操作执行。

## 实现概览

首页已替换为仅面向桌面端的 Three.js 三维电脑桌面。场景使用真实相机、灯光、阴影、圆角网格、屏幕纹理和射线交互，不使用批准构图图作为页面背景。批准构图图仅在 WebGL 初始化失败时作为降级预览。

场景包含：

- 左侧黑色机箱、每日格言便利贴和 Q 版尔玉小摆件
- 三入口竖向活动屏
- 中央主屏、显示器支架与 `Eryu` 音箱
- 一整张浅色鼠标垫、带独立功能区和数字区的 104 键 Eryu 键盘，以及实体鼠标
- 右侧暖色台灯、黑色洞洞板和少量徽章占位
- 暖木桌面、墙面、屏幕光、台灯光与轻微镜头进入/视差

## 已完成交互

- 左屏 `07.04 分享`、`07.18 活动`、`最近在做` 可切换中央主屏内容。
- 详情页返回控件位于中央主屏内部，可返回首页。
- 实体鼠标可在桌垫内拖动，主屏光标同步移动并保持合理方向和比例。
- 键盘采用浅色双层底壳、深色定位板、分区键帽、宽键、字符图例、状态灯和 `Eryu` 字标；可在限定桌垫区域内拖动，拖动时有抬起反馈，松手后保留位置。
- 鼠标垫支持移动、画笔、留言三种明确模式，并提供清空笔迹按钮。
- 画笔模式可留下连续笔迹；留言会同时显示在桌垫和主屏状态区。
- 便利贴点击后轮换每日格言。
- 洞洞板徽章与 Q 版摆件可打开明确标注为未填充状态的故事占位。
- 台灯可点击调节亮度。
- 所有关键操作均提供键盘可达的语义按钮入口。
- 支持 `prefers-reduced-motion`；WebGL 初始化失败时显示预览与说明。

## 浏览器验证

使用 Playwright CLI 在真实 Chromium 中完成验证：

- 页面标题、Three.js Canvas 和测试接口成功加载。
- 浏览器控制台：`0 errors`、`0 warnings`。
- WebGL Canvas 像素抽样：5 个采样点得到 5 组不同颜色，画布非空。
- 键盘操作：`Tab` 聚焦 `07.04 分享` 后按 `Enter`，主屏状态变为 `share`；继续切换到返回按钮后恢复 `home`。
- 实体鼠标真实拖拽后，位置从 `(0.82, 0.56)` 变为约 `(0.896, 0.72)`，主屏光标同步变为约 `(0.838, 0.92)`。
- 键盘真实拖拽后仍被限制在允许范围内。
- 边界验证：鼠标越界输入被限制为 `(0.93, 0.35)`，对应主屏光标 `(0.95, 0.08)`；键盘越界输入被限制为 `(0.2, 0.82)`。
- 画笔真实拖动产生连续折线；留言表单成功写入 `今天也把想法做出来`。
- 分享详情、返回首页、格言轮换、徽章故事、画笔模式和留言状态均通过自动验证。

## 截图

- `output/screenshots/desktop-1440x900.png`
- `output/screenshots/desktop-1920x1080.png`
- `output/screenshots/interaction-share-detail.png`
- `output/screenshots/interaction-drawing.png`
- `output/screenshots/interaction-message.png`

最终视觉验收记录位于 `.omx/state/desktop/ralph-progress.json`，得分 `93/100`，结果为 `pass`。

## 自动化验证结果

- `npm ci`：通过
- `npm run check`：通过，`0 errors / 0 warnings / 0 hints`
- `npm test`：通过，当前为 `10` 个测试文件、`45` 个测试全部通过
- `npm run build`：通过，当前生成 `6` 个静态页面

构建仍会提示 Three.js 入口 chunk 超过 500 kB。这是当前单场景原型直接加载 Three.js 的体积提示，不影响功能、截图或运行；后续正式上线时可将场景改为动态导入以进一步优化首屏包体。

## 主要改动文件

- `src/pages/index.astro`：沉浸式桌面首页和语义交互入口
- `src/desktop/scene.ts`：场景装配、状态连接、动作分发与渲染循环
- `src/desktop/core/`：WebGL 环境、相机灯光、资源和动作合同
- `src/desktop/screens/`：主屏、副屏、便利贴、留言纸与 Canvas 绘制
- `src/desktop/objects/`：各物理物件工厂、共享材质与布局消费
- `src/desktop/interactions/`：pointer、拖拽、画线、留言和 DOM 控制器
- `src/desktop/keyboard.ts`：全尺寸键盘布局、双层键帽、图例、状态灯和三维模型
- `src/desktop/model.ts`：可测试的桌面状态与边界映射
- `src/styles/desktop.css`：全屏场景、留言输入、降级与桌面端样式
- `src/layouts/SiteLayout.astro`：新增沉浸模式，首页不显示旧导航
- `astro.config.mjs`：关闭开发工具条，保证截图纯净
- `tests/desktop-model.test.ts`：状态、边界、模式和内容切换测试
- `tests/keyboard-layout.test.ts`：键盘分区、宽键比例、边界和强调键测试
- `tests/desktop-page.test.ts`：Three.js、屏幕纹理、降级和无障碍结构测试
- `public/desktop/`：场景使用的人物资源与 WebGL 降级预览
- `package.json`、`package-lock.json`：新增 `three` 与 `@types/three`

## 已知限制

- 当前按任务要求只设计和验收桌面视口；900px 以下显示简短静态提示。
- Q 版人物采用圆角亚克力立牌表现，不是完整角色模型。
- 键盘已完成结构化细节升级，但外壳轮廓和精确键帽配色仍需以后根据近距离实拍继续校准。
- 活动、徽章故事仍是明确标注的内容占位，没有编造规模、成绩或合作信息。
- 当前未部署，也未覆盖原主页。
