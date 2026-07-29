# scene.ts 模块化实施计划

## 约束

- 基线提交：`3aec85b`
- 基线标签：`homepage-desktop-baseline-20260729`
- 开发分支：`codex/scene-modularization`
- 不修改视觉、坐标、材质、文案和交互。
- 不增加第三方依赖。
- 不部署到公网。

## 阶段 1：锁定行为和文件边界

修改文件：

- `tests/desktop-architecture.test.ts`（新增）
- `tests/desktop-page.test.ts`
- `tests/desk-layout.test.ts`

步骤：

1. 新增失败测试，要求 `scene.ts` 使用独立的 screens、objects、core 和 interactions 模块。
2. 保留现有布局、状态和内容测试。
3. 记录本地 `1440×900`、`1920×1080` 基线截图和 Canvas 非空检查。
4. 确认新增架构测试在拆分前按预期失败。

## 阶段 2：抽离 Canvas 与屏幕绘制

新增文件：

- `src/desktop/screens/canvas-utils.ts`
- `src/desktop/screens/main-screen.ts`
- `src/desktop/screens/side-screen.ts`
- `src/desktop/screens/badge-screen.ts`
- `src/desktop/screens/message-board.ts`

先移动纯函数：Canvas 创建、圆角矩形、换行、截断、图片裁切和文字材质。再按屏幕逐个移动绘制函数。每移动一个屏幕，运行对应测试和构建，不同时移动物件代码。

## 阶段 3：抽离核心环境

新增文件：

- `src/desktop/core/types.ts`
- `src/desktop/core/actions.ts`
- `src/desktop/core/renderer.ts`
- `src/desktop/core/assets.ts`

动作注册保留当前 `userData.action` 行为。renderer 保留当前相机、灯光、fog、tone mapping、阴影和 resize 数值。assets 第一阶段只包装现有图片加载，不改变地址和加载时机。

## 阶段 4：扩充 layout.ts

先为每组物件增加等值配置，不修改任何数字：房间、桌面、主副屏、机箱、洞洞板、台灯、键盘、鼠标和装饰物。使用测试锁定关键配置值，防止迁移时发生坐标漂移。

## 阶段 5：按区域抽离物件

顺序：

1. `room.ts` 和 `desk.ts`
2. `monitors.ts` 和 `computer.ts`
3. `pegboards.ts` 和 `decorations.ts`
4. `lamp.ts`
5. `keyboard-object.ts` 和 `mouse.ts`

每个模块返回 `SceneObjectResult`。交互物件同时返回点击代理或在创建时使用统一动作注册函数。每完成一组就执行测试、check、build 和截图对照。

## 阶段 6：抽离交互

新增文件：

- `src/desktop/interactions/pointer.ts`
- `src/desktop/interactions/dragging.ts`
- `src/desktop/interactions/mousepad.ts`
- `src/desktop/interactions/message.ts`

第一阶段只移动事件监听和计算逻辑，不修改留言 UI 和模式行为。控制器必须提供 `dispose()`，移除自己注册的事件监听。

## 阶段 7：收敛 scene.ts

`scene.ts` 最终只保留环境装配、状态连接、渲染循环和公开调试 API。目标不是机械追求行数，而是确保增加物件时不需要理解全部屏幕绘制和交互细节；预计控制在 400 行以内。

## 阶段 8：完整验证

执行：

```powershell
npm test
npm run check
npm run build
```

浏览器验证：

- `1440×900` 与基线截图对照
- `1920×1080` 与基线截图对照
- WebGL Canvas 非空且持续渲染
- 三个侧屏入口、内容预览、返回、分页正常
- 鼠标和键盘可拖动
- 鼠标垫三种模式正常
- 便利贴、徽章和留言板行为不变
- 控制台无错误

## 提交策略

- 文档单独提交。
- 测试保护单独提交。
- screens、core、objects、interactions 分批提交。
- 不把多个物理区域长期堆在同一个提交中。
- 每个提交遵循 Lore Commit Protocol。
- 重构分支推送远端，但不合并、不部署，直到用户完成本地视觉验收。

