# 部署与切换说明

## 当前状态

- 已部署到第二台海外 VPS：`5.253.38.249`。
- IP 预览入口：`http://5.253.38.249/`。
- 临时 HTTPS 预览：`https://5-253-38-249.sslip.io/`，仅用于正式域名切换前验证。
- 当前发布版本：`/srv/eryu-homepage/releases/20260715-160518`。
- 当前生效版本软链接：`/srv/eryu-homepage/current`。
- 正式入口：`https://eryu.fun/` 和 `https://www.eryu.fun/`。
- `eryu.fun` 和 `www.eryu.fun` 已指向 VPS，Caddy 已签发并托管两个域名的 HTTPS 证书。
- HTTP 入口保留并返回 `308`，浏览器会自动跳转到对应 HTTPS 地址。
- DNS 切换定时器已完成任务并停止；后续证书续期由 Caddy 自动处理。

裸 IP 只提供 HTTP。不要使用 `https://5.253.38.249/`；正式访问始终使用自有域名。

## 域名切换

在阿里云 DNS 中把以下两条 CNAME 改为 A 记录：

| 主机记录 | 记录类型 | 记录值 |
| --- | --- | --- |
| `@` | `A` | `5.253.38.249` |
| `www` | `A` | `5.253.38.249` |

两条记录已于 2026-07-16 修改。不同本地 DNS 和路由器缓存可能需要约 10 分钟或更久才完全更新，可使用以下命令检查：

```powershell
Resolve-DnsName eryu.fun -Type A
Resolve-DnsName www.eryu.fun -Type A
curl.exe -I https://eryu.fun/
curl.exe -I https://www.eryu.fun/
```

站点和证书状态可在服务器查看：

```bash
ssh vps2
systemctl status caddy
journalctl -u caddy --no-pager -n 100
```

## 推荐结论

第一版已部署到现有第二台海外服务器，使用 Caddy 托管 `dist/`。

理由：

- 服务器已有 200 Mbps 带宽、不限流量和中美优化线路，第一版没有新增流量成本。
- `eryu.fun` 可以直接使用 A / AAAA 记录指向服务器，根域名配置简单。
- Caddy 可以自动申请和续期 HTTPS 证书。
- Astro 输出是纯静态文件，以后迁移 OSS 或 CDN 不需要改代码。

海外 VPS 仍可能受跨境网络波动影响，但该节点已做中美线路优化，当前比普通海外 VPS 更适合作为第一版主站。上线后继续观察真实访问速度，再决定是否增加 CDN 或迁移 OSS。

## 方案对比

| 方案 | 增量成本 | 中国大陆访问 | 运维 | 域名要求 | 当前建议 |
| --- | --- | --- | --- | --- | --- |
| 第二台海外服务器 + Caddy | 基本为 0 | 取决于线路，可能有波动 | 需要维护服务器 | 根域名直接 A / AAAA 解析 | 第一版推荐 |
| 中国内地 OSS 静态网站 | 存储、请求、外网流出流量按量计费 | 通常更好 | 低 | 中国内地 Bucket 的自定义域名需要 ICP 备案 | 备案完成后可考虑 |
| 中国内地阿里云服务器 | 已有服务器时成本可控 | 通常较好 | 需要维护服务器 | 对外网站需要 ICP 备案 | 暂不优先 |

## OSS 成本判断

OSS 会产生三类基础费用：存储、请求和外网流出流量。阿里云官方示例中，标准型本地冗余存储单价为 `0.0173 美元 / GB / 月`；个人主页的存储费用几乎可以忽略，实际更需要关注外网流量和请求次数。

当前构建产物约 `0.51 MB`，其中 HTML 约 `30 KB`，其余主要是按尺寸生成的 WebP 和一张社交分享图。粗略按每次都完整下载整个站点计算，1000 次访问约产生 `0.5 GB` 流量；实际浏览器缓存和单页访问通常会更低。低访问量阶段，即使按量付费，通常也不会产生明显费用，但仍应配置账单告警和防盗链，避免图片被外站引用导致流量异常。

OSS 还有两个实际限制：

1. 使用 Bucket 默认域名访问 HTML 时，浏览器会强制下载；正常浏览网站需要绑定自定义域名。
2. Bucket 位于中国内地时，绑定的域名必须完成 ICP 备案。

官方资料：

- [OSS 计费概述](https://www.alibabacloud.com/help/zh/oss/billing-overview)
- [OSS 存储费用](https://www.alibabacloud.com/help/zh/oss/storage-fees)
- [OSS 流量费用](https://www.alibabacloud.com/help/zh/oss/traffic-fees)
- [OSS 静态网站托管](https://www.alibabacloud.com/help/zh/oss/user-guide/hosting-static-websites)
- [OSS 自定义域名](https://www.alibabacloud.com/help/zh/oss/user-guide/access-buckets-via-custom-domain-names)

## 服务器部署形态

构建：

```powershell
npm ci
npm run build
```

将 `dist/` 上传到服务器的版本目录，再原子更新 `/srv/eryu-homepage/current`。正式配置位于 `deploy/Caddyfile.vps2`，IP 预览和域名站点分别放在 `sites-enabled` 与 `sites-available`。

建议上线顺序：

1. 先通过 IP 入口验证页面、路由和静态资源。
2. 确认无误后将 `eryu.fun` 与 `www.eryu.fun` 一起指向服务器。
3. 保留上一版发布目录，出现问题时直接切回。
4. 观察一段时间的中国大陆访问速度，再决定是否增加 CDN 或迁移 OSS。

回滚时把 `current` 重新指向上一版并 reload Caddy：

```bash
ln -sfn /srv/eryu-homepage/releases/<上一版本> /srv/eryu-homepage/current.next
mv -Tf /srv/eryu-homepage/current.next /srv/eryu-homepage/current
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload caddy
```
