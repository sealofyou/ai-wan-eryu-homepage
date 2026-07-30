# V0.7 Build in Public 实施计划

## Task 1：锁定内容合同

先增加失败测试，要求：

1. `projects` 和 `projectUpdates` 两个 collection 存在。
2. “个人主页实现”项目是公开、推荐、站内目标。
3. 首批更新不含本地绝对路径、凭据占位符或维护者文案。
4. 项目更新按日期倒序且不修改输入数组。
5. 首页把公开项目放进 `recent`，不影响文章和活动。

## Task 2：建立内容模型

修改 `src/content.config.ts`，增加项目与项目更新 schema。

在 `src/lib/content.ts` 增加项目更新时间线排序函数，继续复用现有 `createDesktopContentItem` 和 URL 安全检查，不引入新的路由工具。

## Task 3：写入首批真实资料

新增：

- `src/content/projects/personal-homepage-build-in-public.md`
- `src/content/project-updates/` 下的阶段更新

首批内容只使用现有 Git 提交、标签、验证结果和 `docs/miaoda-contest/` 中已经存在的事实。

## Task 4：接入桌面“最近在做”

在 `src/pages/index.astro` 读取公开项目并映射到 `recent`。

主屏最近项目预览按钮显示“查看项目”。默认首页和其他栏目不改。

## Task 5：实现站内项目页

新增 `src/pages/projects/[id].astro`。

页面读取项目正文与对应更新，按日期倒序渲染。样式只扩展 `global.css` 的项目页部分，沿用现有变量、字体、分隔线和响应式规则。

## Task 6：验证与记录

依次运行：

1. `npm test`
2. `npm run check`
3. `npm run build`
4. `npm run check:assets`
5. `git diff --check`

浏览器验证：

- 默认桌面无控制台错误。
- “最近在做”能看到“个人主页实现”。
- 项目预览按钮能打开 `/projects/personal-homepage-build-in-public/`。
- 项目页显示状态、当前阶段和全部公开更新。
- 默认页面不请求鼠标 GLB。
- `pagehide` 后场景资源正常释放。

完成后更新 `IMPLEMENTATION_RESULT.md`，执行独立代码评审，提交并推送功能分支。测试和本地视觉验收通过前不部署公网。

