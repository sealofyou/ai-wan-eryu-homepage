# 桌面物件建模工具对照

核对时间：2026-07-31。价格、套餐和授权会变化，正式使用外部工具前需要重新检查当日条款。

| 方案 | 今晚可直接使用 | 优点 | 主要限制 | 当前决定 |
| --- | --- | --- | --- | --- |
| Three.js + GLTFExporter | 是 | 仓库已有依赖、可重复生成、无第三方资产授权风险 | 更适合验证管线，不代替精细人工建模 | 用于 V0.5 鼠标候选模型 |
| Blender | 否，本机未安装 | 适合修比例、轴心、法线、拓扑、材质和导出 GLB | 需要安装和人工清理 | 后续正式模型清理首选 |
| Tripo | 需要账号、API key 和 credits | 图片或文本生成速度快，可导出 GLB | 下载地址有时效；免费与付费授权边界不同 | 收到实拍图并确认套餐后再试 |
| Meshy | 需要账号或 API 套餐 | 图片转 3D、重拓扑和纹理流程完整 | 免费输出通常有署名要求；API 与保存期限受套餐影响 | 作为 Tripo 的对照候选 |
| Hunyuan3D-2 | 本机未安装模型与依赖 | 可本地运行，当前显卡具备后续试验基础 | 初次安装、模型权重和清理成本高；许可证有地域与用途条款 | 单独实验，不塞进本轮 |
| Rodin / Hyper3D | 需要账号和对应 API 套餐 | 图像转 3D 质量和格式选项完整 | API 权限、价格和输入素材权利需确认 | 有明确素材与预算后再试 |

## 官方入口

- Three.js GLTFExporter：<https://threejs.org/docs/#examples/en/exporters/GLTFExporter>
- Blender glTF 2.0：<https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html>
- Tripo API：<https://developers.tripo3d.com/en/docs/quick-start>
- Meshy API：<https://docs.meshy.ai/en/api/quick-start>
- Hunyuan3D-2：<https://github.com/Tencent-Hunyuan/Hunyuan3D-2>
- Rodin API：<https://developer.hyper3d.ai/>

## 后续正式模型流程

1. 用户提供正面、左右侧、俯视和局部细节照片。
2. 同一组素材分别生成 2 至 3 个候选，不直接覆盖当前物件。
3. 在 Blender 中统一比例、原点、法线、材质、拓扑和朝向。
4. 导出独立 GLB，记录来源与授权，执行资源预算检查。
5. 通过查询参数加载候选，生成前后截图并由用户验收。
6. 用户确认后才改变默认模型；程序化版本永久保留为回退。
