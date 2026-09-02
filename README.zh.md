# RepoMemo

> **语言：** [English](./README.md) · **简体中文**

**初始化一次，继续开发，切换 Agent Harness 不需要转换。**

RepoMemo 可以让新项目或已经做到一半的项目成为 **Agent Native**、
**Harness Native** 的项目。规则、当前进度和可复用 Skills 都留在项目目录中，
Codex、Claude Code、Gemini CLI、OpenCode、Cursor、Copilot CLI、ZCode 和
DeepSeek Harness 可以读取同一套信息。

## 30 秒开始

在任何新项目或已有项目中运行一次：

```bash
cd 你的项目
npx repomemo@latest init
```

然后直接用任意受支持的 Harness 打开同一个目录：

```bash
codex
# 也可以：claude、gemini、opencode、cursor、copilot、zcode、dsh
```

切换流程到这里就结束了。RepoMemo 没有 `switch`、`sync`、`convert`、
`export` 或 `handoff` 命令。

## 项目已经做到一半了？

仍然在现有项目目录运行同一个 `init`。RepoMemo 会保留源码、配置、用户规则、
当前状态和已有 Skills，只补充共享契约与必要的兼容桥。

切换前，让当前 Agent 把真实进度写进项目：

```text
请读取 AGENTS.md，并把当前目标、已完成工作、验证结果、
修改路径和下一步写入 AGENT_STATE.md。
```

下一个 Harness 打开同一个目录，读取 `AGENTS.md` 和 `AGENT_STATE.md` 后即可
继续。如果 Harness 在执行 `init` 前就已经运行，可能需要让它重新读取项目文件
或新开一次会话。私有聊天历史不能自动搬运；重要上下文必须写回项目。

## 核心理念

- **Agent Harness**：承载 Coding Agent 的运行环境或交互入口，例如 Codex、
  Claude Code、Gemini CLI、OpenCode。
- **Agent Native**：项目天然包含 Agent 可以读取的规则、状态和 Skills。
  持久主体是项目，而不是某个私有聊天窗口。
- **Harness Native**：尽量使用各 Harness 已经原生支持的路径和格式；只有确实
  需要时，RepoMemo 才添加极薄的导入桥或本地链接。

一句话原则：**项目拥有连续性，Harness 只是可以替换的入口。** RepoMemo
不是 Agent 启动器、套壳、会话管理器，也不是另一个 Harness。

## 只有三个命令

```bash
# 接入项目，或安全升级已有 RepoMemo
repomemo init

# 只读诊断
repomemo doctor

# 只修复安全的 RepoMemo 托管桥和链接
repomemo repair
```

常用形式：

```bash
repomemo init --target path/to/project
repomemo doctor --harness claude
repomemo doctor --json
repomemo repair --harness zcode
```

旧脚本仍可使用 `doctor --repair` 兼容别名。`doctor` 显示 healthy 代表磁盘文件
契约正确，不代表它已经启动、登录、升级或替第三方 Harness 完成 workspace trust。

## 三个共享源

```text
你的项目/
├── AGENTS.md              # 长期项目规则
├── AGENT_STATE.md         # 当前目标、进度、测试和下一步
├── .agents/skills/        # 可复用 Agent Skills
├── CLAUDE.md              # 必要时使用的极薄桥
├── GEMINI.md              # 必要时使用的极薄桥
├── .claude/skills         # 支持时创建本地链接
└── .zcode/skills          # 支持时创建本地链接
```

用户只维护前三个共享源。RepoMemo 只管理带明确标记的区块和安全兼容链接。
托管标记外的文字保持不变；标记损坏或含义不明确时会安全停止，不猜测覆盖。

## 安装

推荐方式，无需全局安装：

```bash
npx repomemo@latest init
```

也可以永久安装：

```bash
# npm
npm install --global repomemo

# Homebrew
brew tap SUN-1024/repomemo
brew install repomemo
```

RepoMemo 需要 Node.js 22 或更高版本，运行时依赖为零。第一次通过 `npx` 下载
需要网络；CLI 安装到本地后，`init`、`doctor`、`repair` 都不会调用 Git 或网络。

## 已有项目直接升级

在同一个 working copy 中重新运行最新版 `init`：

```bash
cd 已有项目
npx repomemo@latest init
npx repomemo@latest doctor
```

兼容升级只更新 RepoMemo 托管区块和缺失的桥，保留源码、用户文字、
`AGENT_STATE.md` 和 `.agents/skills`。再次执行 `init` 应显示 `0 change(s)`。

## Harness 兼容性

`native` 表示 Harness 原生读取；`bridge` 表示 RepoMemo 添加极小的导入或本地
链接。兼容注册表与中英文矩阵统一由
[`data/harnesses.json`](./data/harnesses.json) 生成。

<!-- repomemo:matrix:start -->
| Harness | Rules | Skills | Evidence |
|---|---|---|---|
| Codex | native | native | official |
| Claude Code | bridge | bridge | official |
| Gemini CLI | bridge | native | official |
| OpenCode | native | native | official |
| Cursor | native | native | official |
| GitHub Copilot CLI | native | native | official |
| ZCode | native | bridge | official |
| DeepSeek Harness | native | native | source-verified |
<!-- repomemo:matrix:end -->

RepoMemo 本身保持 Git-neutral。个别 Harness 版本仍可能依赖 `.git` 或其他标记
判断项目根。真实测试中，OpenCode 在 Git working tree 内能原生发现项目 Skills，
但在普通目录中没有发现；`doctor --harness opencode` 会报告这个限制。RepoMemo
不会擅自替用户执行 `git init`。

## RepoMemo 明确不做什么

- 不复制或转换各 Harness 的私有聊天会话。
- 不启动、安装、登录或配置 Harness。
- 不转换 MCP、hooks、权限或 Harness 私有设置。
- 不运行 Git、不修改 `.gitignore`、不联网、不执行 Skill 脚本。
- 不猜写项目进度，也不静默覆盖外来内容。

最短教程见[一分钟用上 RepoMemo](./QUICKSTART.zh.md)。v1 用户请阅读
[MIGRATION-v1-v2.md](./MIGRATION-v1-v2.md)。

## 开发

```bash
pnpm install
pnpm verify
pnpm pack --pack-destination artifacts
pnpm package:smoke
pnpm entrypoint:smoke
```

参见 [CONTRIBUTING.md](./CONTRIBUTING.md)。CI 覆盖 macOS、Linux、Windows
以及 Node.js 22/24。

## License

MIT
