<p align="center">适用于 OpenWrt / ImmortalWrt / iStoreOS 的代理管理面板，基于 <a href="https://github.com/slobys/NaiLink">slobys/NaiLink</a> 0.6.92 二次精简。</p>

管理节点、订阅和群组，测试节点延迟，查看实时流量，配置 DNS 与路由；沿用路由器 LuCI 登录授权，无需另设账户。本分支在保持后端能力不变的前提下，精简了面板上不常用的入口与首启预设。

## 本分支相对上游的改动

- **移除顶部多内核切换入口**：工具栏不再显示内核切换按钮，相关前端组件与内核更新状态工具一并清理。后端可选内核的打包与接口保留，仅面板不提供切换入口。
- **移除群组“常用分流”按钮**：群组卡片右上角不再提供一键注入 AI / Netflix 预设的按钮，对应状态提示与预设 hook 一并清理；这类分流规则需在高级设置中手动配置。
- **首启不再自动注入分流预设**：全新安装只初始化默认模式与基础配置，不再自动生成“分流”路由和 AI / Netflix 群组；升级安装保留已有配置。
- **连接检测国内项改为百度**：国内对照目标由阿里云改为 `https://www.baidu.com/robots.txt`；TCP 健康探测默认端点升级为 Cloudflare 加密 204（`https://cp.cloudflare.com/generate_204`），IPv4 / IPv6 竞速目标不变。

## 功能现状

- **节点和订阅**：导入单个节点或订阅（普通 / Base64 / Clash），标签可自动识别。
- **群组编排**：把节点或订阅加入群组，配置选择策略，手动或自动测试延迟。
- **运行概况**：实时查看上传 / 下载速度、活跃连接、本次流量与历史趋势。
- **DNS 与路由**：在高级设置中核对接口、DNS 上游与分流规则，应用后实际验证联网。
- **规则库**：顶部“更新规则”检查并更新 GeoIP / GeoSite 数据。

## 默认分流与 DNS

全新安装的默认路由（其余流量回退到默认代理群组 `proxy`）：

```
pname(NetworkManager, systemd-resolved, dnsmasq) -> must_direct
dip(geoip:private) -> direct
dip(geoip:cn) -> direct
domain(geosite:cn) -> direct
fallback: proxy
```

默认 DNS：国内域名走阿里 `223.5.5.5:53`，其余走 Google `8.8.8.8:53`（TCP+UDP）。升级安装会保留已有的路由与 DNS 配置。

## 连接检测

管理面板的连接检测包含四个固定目标：

| 目标   | 地址                                  | 类别         |
| ------ | ------------------------------------- | ------------ |
| 百度   | `https://www.baidu.com/robots.txt`    | 国内直连对照 |
| Google | `https://www.google.com/generate_204` | 境外         |
| OpenAI | `https://chatgpt.com/robots.txt`      | 境外         |
| GitHub | `https://github.com/robots.txt`       | 境外         |

探测使用 `HEAD` 请求、不跟随跳转；200–399 记为正常，400 及以上记为受限，网络 / 证书 / 超时错误分别归类提示。

## 安装与更新

优先选择 x86_64 / ARM64；ARMv7、MIPS 仅实验构建，暂不推荐用于透明代理。脚本会自动识别 CPU、固件 ABI 与包格式并检查内核能力，不兼容时停止安装。

在路由器 SSH 中以 root 执行一键命令，从本仓库拉取安装器并打开中文安装 / 更新菜单：

```sh
nl=$(uclient-fetch -O- https://raw.githubusercontent.com/18110512616/NaiLink/main/openwrt/install.sh) && sh -c "${nl:?下载为空}" -- --menu
```

有 `curl` 时也可直接安装 / 更新（不进菜单）：

```sh
curl -fsSL https://raw.githubusercontent.com/18110512616/NaiLink/main/openwrt/install.sh | sh -s -- --install
```

本 fork 的安装包由仓库 GitHub Actions（`openwrt.yml`）构建，产物在对应运行的 Artifact 或 [Release](https://github.com/18110512616/NaiLink/releases/tag/openwrt-v0.6.94) 中；后台更新检测也指向本仓库。更新前会备份并保留节点、订阅、群组与配置；卸载备份保留在 `/root/daed-backups`。

兼容性、内存占用与故障排查可参考仓内文档：[OpenWrt 说明](openwrt/README.md) · [验证记录](openwrt/VALIDATION.md) · [普通 Linux / Docker](docs/getting-started.md)。

## 源码构建

环境与步骤见 [构建说明](docs/build.md)：Node.js 22、pnpm 10.24.0、Go 1.26.0、Python 3、Make、Clang / LLVM 15+。

```sh
git clone --recurse-submodules https://github.com/18110512616/NaiLink.git
pnpm install --frozen-lockfile
pnpm test
pnpm check-types
```

GitHub 的 Download ZIP 不包含后端子模块；已有工作区运行 `git submodule update --init --recursive`。

## 许可与致谢

基于 [daed](https://github.com/daeuniverse/daed)、[dae-wing](https://github.com/daeuniverse/dae-wing) 与 [dae](https://github.com/daeuniverse/dae)，并参考上游 [NaiLink](https://github.com/slobys/NaiLink)。本分支并非上游官方发行版。前端及安装集成遵循 [MIT](LICENSE)，后端及其修改遵循 AGPL-3.0，保留相关版权声明。

Mihomo 为独立可选组件，感谢 [MetaCubeX/mihomo](https://github.com/MetaCubeX/mihomo)。
