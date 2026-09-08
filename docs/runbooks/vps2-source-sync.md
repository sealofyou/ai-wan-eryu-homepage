# VPS2 源码同步（不部署）

本流程只同步Git源码，不能替代`DEPLOYMENT.md`中的构建发布流程。

- 仓库：`sealofyou/ai-wan-eryu-homepage`
- 本轮分支：`codex/v0.12-visual-rescue`
- SSH别名：`vps2`
- 独立源码目录：`/srv/eryu-homepage/source`
- 正式站点仍从`/srv/eryu-homepage/current`读取静态文件。源码目录不在Caddy文档根内。

首次同步前，确认源码目录不存在、服务器可读取仓库、当前发布软链接目标已记录。使用单分支浅克隆，不向服务器复制本机凭据、node_modules、忽略文件或测试会话。

```sh
git clone --depth 1 --single-branch --branch codex/v0.12-visual-rescue \
  https://github.com/sealofyou/ai-wan-eryu-homepage.git \
  /srv/eryu-homepage/source
```

后续更新先检查该目录的origin、当前分支与`git status --porcelain`。有本地改动或分支不符时停止，不强制覆盖。干净且匹配时仅`fetch`与`merge --ff-only`。同步后对比本机HEAD、GitHub分支HEAD与VPS源码HEAD，并确认`current`链接没有改变。

此流程不运行npm安装/构建、不写releases/current、不改Caddy、不重启服务、不合并主分支。正式上线必须另行确认入口切换与发布范围。
