<p align="center">适用于 OpenWrt / ImmortalWrt / iStoreOS 的代理管理面板，基于 <a href="https://github.com/slobys/NaiLink">slobys/NaiLink</a> 0.6.92 二次精简。</p>

管理节点、订阅和群组，测试节点延迟，查看实时流量，配置 DNS 与路由；沿用路由器 LuCI 登录授权，无需另设账户。本分支在保持后端能力不变的前提下，精简了面板上不常用的入口与首启预设。

## 本分支相对上游的改动

- **移除顶部多内核切换入口**：工具栏不再显示内核切换按钮，相关前端组件与内核更新状态工具一并清理。后端可选内核的打包与接口保留，仅面板不提供切换入口。
- **移除群组“常用分流”按钮**：群组卡片右上角不再提供一键注入 AI / Netflix 预设的按钮，对应状态提示与预设 hook 一并清理；这类分流规则需在高级设置中手动配置。
- **首启不再自动注入分流预设**：全新安装只初始化默认模式与基础配置，不再自动生成“分流”路由和 AI / Netflix 群组；升级安装保留已有配置。
- **连接检测国内项改为百度**：国内对照目标由阿里云改为 `https://www.baidu.com/robots.txt`；TCP 健康探测默认端点升级为 Cloudflare 加密 204（`https://cp.cloudflare.com/generate_204`），IPv4 / IPv6 竞速目标不变。
- **初始化默认资源幂等**：向导重试时先按默认名回查已存在的配置 / 分流 / DNS / 分组并复用，不再重复创建；避免首启中断后留下孤儿记录，或分组重名撞唯一索引导致面板初始化失败。

> 各改动在源码中的具体位置、后端补丁与打包层结构，见文末[改造地图](#改造地图重新对接上游时从哪下手)。

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

本 fork 的安装包由仓库 GitHub Actions（`openwrt.yml`）构建，产物在对应运行的 Artifact 或 [Release](https://github.com/18110512616/NaiLink/releases/tag/openwrt-v0.6.95) 中；后台更新检测也指向本仓库。更新前会备份并保留节点、订阅、群组与配置；卸载备份保留在 `/root/daed-backups`。

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

## 改造地图：重新对接上游时从哪下手

这一节给"全新拉取上游后不知道从哪改"的接手者：先分清哪些是上游原生、哪些是本 fork 的定制，再按层定位改动点。

### 1. 仓库组成（三层）

| 层                   | 路径                                                       | 来源 / 性质                                                                                |
| -------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 前端 + 共享包 + 脚本 | `apps/web/`、`packages/`、`scripts/`、`.github/workflows/` | 基于上游 daed 前端裁剪调优，改动直接在本仓                                                 |
| 后端子模块           | `wing/`（`.gitmodules` → daeuniverse/dae-wing）            | 上游子模块，**锁定提交、不在子模块里改代码**；fork 的后端修改全部由打包期补丁套上          |
| 路由器适配 / 打包层  | `openwrt/`                                                 | **本 fork 整目录新增，上游没有**：安装器、CGI 网关、procd 维护、SDK 打包、后端增量覆盖源码 |

后端基线由 `openwrt/prepare-wing.py` 顶部的 `ORIGINAL`（上游 wing 提交 SHA-256）锁定；换上游版本时先更新子模块到对应提交，再核对补丁锚点（见第 3 节）。

### 2. 前端定制点（`apps/web/src/`）

| 主题                             | 主要位置                                                                                                                                                                        | 说明                                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 移除多内核切换入口               | `components/Header.tsx`、`components/RouterHeader.tsx`、`components/RouterMaintenance.tsx`、`pages/RouterLogs.tsx`、`utils/router-navigation.ts`、`utils/router-maintenance.ts` | 面板不再暴露顶部 / 侧边的内核切换面板入口；相关内核更新入口按窄屏保留可见                                     |
| 移除群组"常用分流"按钮           | `pages/Orchestrate/Group.tsx`、`components/DroppableGroupCard.tsx`、`components/SortableGroupContent.tsx`                                                                       | 不再提供一键补齐预设分流的按钮                                                                                |
| 首启不自动注入分流预设           | `initialize.ts`、`constants/default.ts`、后端 `openwrt/wing/service_presets*.go`                                                                                                | 新建默认不再自动挂 AI / Netflix / 分流预设                                                                    |
| 国内探测改百度                   | `utils/connectivity.ts`、`constants/default.ts`                                                                                                                                 | 国内对照目标为百度；TCP 健康探测默认 Cloudflare 加密 204                                                      |
| **初始化默认资源幂等**（0.6.95） | `initialize.ts`（`findDefaultResource`）、`constants/default.ts`、`apis/query.ts`、`apis/mutation.ts`                                                                           | 向导在创建 config / routing / dns / group 之前先按默认名回查，命中即复用；同名多条优先取 `selected=true` 那条 |
| 仓库链接 / 更新指向 fork         | `components/Header.tsx` 等、`openwrt/install.sh`、后端更新检测                                                                                                                  | 面板外链与后台更新检测都指向本仓 `18110512616/NaiLink`                                                        |
| 协议导入 / 节点模型兼容          | `components/ConfigureNodeFormModal/`、`utils/native-node.ts`、`utils/node-library.ts` 等                                                                                        | XHTTP / 加密 VLESS 导入不丢节点、SS / Hysteria2 / V2ray 表单与 IPv6 引导 DNS 调整                             |

前端校验：`pnpm test`（vitest）、`pnpm check-types`（`tsc --noEmit`）。

### 3. 后端补丁机制（`openwrt/prepare-wing.py`）

后端**不直接改 `wing/` 子模块**。构建期先把锁定版本的上游源码读进来，再按脚本里的 `patches` 字典逐条套用；每条目记录上游文件的 SHA-256，校验不符（上游已改）或遇到未知修改会拒绝执行，防止误覆盖。补丁有两种形态：

- **字符串变换**：字典值是 `router_*` 函数或内联 lambda，对指定上游文件做锚点替换。
- **本地整文件覆盖**：字典值引用 `openwrt/wing/` 下的同名 `.go`，整文件替换上游对应路径。

`openwrt/wing/` 覆盖源码按功能分组：

| 分组                   | 代表文件                                                                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 事务 / 并发加固        | `transaction.go`、`config_apply.go`、`core_mutations.go`、`test_job_mutations.go`                                                                          |
| 多内核运行时与管理     | `core_manager.go`、`runtime.go`、`singbox_runtime.go`、`mihomo_runtime.go`、`restart_core.go`、`restart_state.go`、`readiness_http.go`、`network_ready.go` |
| DNS 数据面 / 稳定性    | `dns_transport.go`、`dns_stability.go`、`core_tproxy_dns.go`、`core_dns_conntrack.go`、`mihomo_dns*.go`、`node_dns*`、`subscription_node_dns.go`           |
| 延迟 / 服务探测        | `node_latency*.go`、`node_test_jobs.go`、`node_service_cache.go`、`core_probe.go`、`service_probe.go`、`worker_probe.go`、`website_diagnosis.go`           |
| 订阅传输 / 解析 / 命名 | `subscription_transport.go`、`subscription_parse.go`、`subscription_name.go`、`subscription_update.go`                                                     |
| 协议兼容 / SIP008      | `protocol_compat.go`、`sip008.go`、`node_native_import.go`、`core_tproxy.go`、`core_udp_probe_test.go`                                                     |
| 服务预设 / 分组引用    | `service_presets.go`、`service_presets_ipv6.go`、`service_group_refs.go`、`group_add_nodes.txt`                                                            |
| 规则库 / 资源          | `geodata_mutation.go`、`geodata_update.go`、`web_assets.go`、`dae_serve.go`、`luci_prepare.go`                                                             |

`prepare-wing.py` 内字符串补丁覆盖的上游文件类别：

- **事务加固**：`graphql/service/{config,dns,routing,group,node}/mutation_utils.go`（`router_transactions`）。
- **LuCI 鉴权**：`cmd/run.go`（`router_auth`）。
- **生命周期 / 就绪 / 恢复**：`dae/run.go`、`dae-core/control/control_plane.go`、`control/dial.go`、`control/dns_control.go`、`dae/runtime.go`。
- **DNS 数据面**：`dae-core/control/kern/tproxy.c`、`control/dns.go`、DNS 相关测试与 UDP 池。
- **节点 DNS / 模型字段**：`db/subscription.go`、`db/group.go`、`db/routing.go`、`dae-core/config/config.go`、`graphql/service/node/schema.go`、`dae/flat_desc.go`。
- **健康探测 / 拨号**：`dae-core/component/outbound/dialer/{connectivity_check.go,dialer.go}`。
- **延迟 / 探测 schema**：`graphql/service/node/latency_*.go`、`db/node_utils.go`、`graphql/{mutation.go,root_schema.go}`。

后端回归（本地已初始化子模块、具备 Go / Clang 环境）见 `openwrt/README.md` 的"开发"一节：`prepare-wing.py wing` 后在 `wing/` 跑 `go test`。

### 4. 打包与网关层（`openwrt/`）

| 脚本 / 目录                                                                 | 职责                                                                                                                                 |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `install.sh` / `universal-install.sh`                                       | 路由器一键安装 / 更新 / 卸载菜单与直装命令；更新前备份、保留节点订阅群组配置                                                         |
| `luci-proxy.go`                                                             | CGI 网关：rpcd 校验当前 LuCI 会话权限，自签短时本地授权反代 `127.0.0.1:2023`；凭据留在本机 `/etc/daed/luci-session.json`，不下发 JWT |
| `maintenance.go` / `maintenance-core*.go` / `corelib/`                      | procd 维护服务、内核健康 / 切换 / 独立可选内核更新、应用配置 RPC                                                                     |
| `prepare-wing.py`                                                           | 后端补丁套用（见第 3 节）                                                                                                            |
| `runtime.py` / `build.py` / `build-universal.py` / `manifest.py`            | 运行时与探针组装、固定哈希 SDK 静态打包、多架构发行清单校验                                                                          |
| `wing/`                                                                     | 后端增量覆盖源码（见第 3 节）                                                                                                        |
| `files/`                                                                    | procd init、rpcd、uhttpd CGI、ACL、菜单、检查脚本等安装落点                                                                          |
| `htdocs/`                                                                   | 路由器专用前端静态资源落点                                                                                                           |
| `core-updates.json` / `core-updates-sources.json` / `core-updates-build.py` | 可选兼容内核（sing-box / mihomo）来源、摘要与构建审核                                                                                |
| `sdk-matrix.json`                                                           | 各架构 OpenWrt SDK URL、SHA-256 与 feed 提交固定                                                                                     |

### 5. 版本锚点（升补丁版本必须同步，共 6 处）

| 文件                            | 位置                                                     |
| ------------------------------- | -------------------------------------------------------- |
| `openwrt/Makefile`              | `PKG_VERSION` fallback 默认值                            |
| `openwrt/install.sh`            | `release=openwrt-vX.Y.Z`                                 |
| `docs/site/site.json`           | `"version"` 与 `"release"`（同一文件两个字段，各算一处） |
| `.github/workflows/openwrt.yml` | `workflow_dispatch` 的 `version` 默认值                  |
| `README.md`                     | 顶部 / 安装节 Release 链接 tag                           |

`scripts/publish-openwrt.py check-version` 会校验 Makefile 与 install.sh 版本一致；发布前还要核对在线文档版本。

### 6. CI 与发布流程

- 主工作流 `.github/workflows/openwrt.yml`：仅 `workflow_dispatch` 手动触发；push / PR 不自动出包。输入项：`version`（须与源码一致）、`publish`（仅 `main` 可正式发布）、`verified_run`（复用已验证历史产物）。
- 流程：单测 / shellcheck / UI 测试 → 内核探针 → 各架构 SDK 打包 → 清单校验；`publish` 勾选且在 `main`、上游 assemble 成功后，发布**正式 Release**（published，非草稿、非预发布），不覆盖同名已发布版本。
- 其余工作流：`publish-openwrt-artifact.yml`（复用已验证产物发布）、`repository.yml`（仓库 / Docker 相关）。

### 7. 本次故障与兜底记录（0.6.95）

- **现象**：面板初始化失败，报 `constraint failed: UNIQUE constraint failed: groups.name (2067)`，DNS 列表出现两条同名 `default`。
- **根因**：首启向导创建默认资源后、回写默认资源 ID 到 JsonStorage 之前中断，导致库内已有记录而存储缺 ID；重试时前端重复创建同名资源——分组表有唯一约束直接撞 2067，DNS 表无唯一约束则并存两条同名孤儿。
- **代码兜底**：前端 `initialize.ts` 在创建前先回查同名默认记录并复用（见第 2 节）。后端 `db.InitDatabase` 仅 AutoMigrate、不播种默认资源；分组 `Create` 不查重名，因此幂等兜底放在前端。
- **现场救援**：补回缺失的 `defaultGroupID`、删除孤儿 DNS 记录；改前备份在路由器 `/etc/daed/wing.db.bak-*`。

### 8. 全新对接上游的推荐顺序

1. 更新 `wing/` 子模块到目标上游提交，跑 `python3 openwrt/prepare-wing.py wing`。
2. 哈希校验失败的补丁：对照新上游源码更新 `prepare-wing.py` 的变换锚点或 `openwrt/wing/` 覆盖文件。
3. 前端按第 2 节表格定位 fork 裁剪点，与上游新代码合并。
4. 同步第 5 节版本锚点，跑 `pnpm test`、`pnpm check-types`、`python3 -m unittest discover -s tests/repository` 与 `tests/docs`。
5. 手动触发 `openwrt.yml`，先不勾 `publish` 出 artifact 验收，通过后再勾 `publish` 发正式版。

## 许可与致谢

基于 [daed](https://github.com/daeuniverse/daed)、[dae-wing](https://github.com/daeuniverse/dae-wing) 与 [dae](https://github.com/daeuniverse/dae)，并参考上游 [NaiLink](https://github.com/slobys/NaiLink)。本分支并非上游官方发行版。前端及安装集成遵循 [MIT](LICENSE)，后端及其修改遵循 AGPL-3.0，保留相关版权声明。

Mihomo 为独立可选组件，感谢 [MetaCubeX/mihomo](https://github.com/MetaCubeX/mihomo)。
