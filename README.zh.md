# RepoMemo

> **语言：** [English](./README.md) · **简体中文**

**一个项目，任意 Coding Agent，切换无需仪式。**

RepoMemo 是面向 Agent-native 项目目录的极简、Git-neutral 连续性层。它只
负责一次性建立可移植的文件契约；此后可以直接切换 Coding Harness，无需
再运行 convert、sync、generate、export 或 handoff。

## 快速开始

```bash
cd my-project
npx repomemo@latest init

# 一次初始化后直接切换
codex
claude
gemini
opencode
```

首次通过 `npx @latest` 获取 RepoMemo 可能需要网络；CLI 已经在本地可用后，
`init` 和 `doctor` 不会联网。

## 文件契约

```text
my-project/
├── AGENTS.md              # 永久治理规则唯一真源
├── AGENT_STATE.md         # 当前任务和交接的建议性数据
├── .agents/
│   └── skills/            # Agent Skills 唯一真源
├── CLAUDE.md              # 极薄 @AGENTS.md 导入桥
├── GEMINI.md              # 极薄 @AGENTS.md 导入桥
├── .claude/skills         # 可用时链接到 .agents/skills
└── .zcode/skills          # 可用时链接到 .agents/skills
```

三个平面保持分离：

- **治理：** `AGENTS.md` 与 `.agents/skills`。
- **连续性：** `AGENT_STATE.md`。
- **兼容：** 只在确有需要时使用极薄导入或项目内链接。

RepoMemo 只修改带明确 HTML 注释标记的托管区块。标记外的用户内容完整
保留；重复、缺失或损坏的标记会 fail closed，不猜测、不覆盖。

## 命令

```bash
repomemo init [--target DIR] [--dry-run]
repomemo doctor [--target DIR] [--harness ID] [--json]
repomemo doctor --repair [--target DIR] [--harness ID] [--json]
```

- `init` 精确使用指定目录或当前目录，不寻找 Git root；目标目录必须已存在。
- `doctor` 默认完全只读，检查契约、状态 schema、桥、链接、嵌套/祖先指令和
  兼容性证据。
- `doctor --repair` 只修复规范托管区块和安全链接，绝不重写
  `AGENT_STATE.md` 或外国内容。

RepoMemo 不运行 Git、不执行 `git init`、不修改 `.gitignore`、不联网，也不
执行 Skills 中的脚本。

## 状态是数据，不是权威指令

`AGENT_STATE.md` 使用固定 Markdown 结构，Status 仅允许 `idle`、`active`、
`blocked`、`done`，并记录目标、已完成事项、决策、失败尝试、触碰路径、
验证和下一步。所有路径必须是项目内相对路径。

当前文件系统和权威项目文档优先于过期状态；治理冲突时 `AGENTS.md` 优先。
同一工作目录单写入者只是工作假设，不是文件锁或并发保证。

## Harness 兼容性

兼容方式与证据等级分开显示：`native` 表示 Harness 直接读取权威路径；
`bridge` 表示需要指针、导入或链接；`manual` 表示依赖 `AGENTS.md` 指示按需
读取；`unsupported` 表示没有安全路径。只有官方证据加真实版本 smoke test
才会显示完整验证，不用乐观绿色勾选夸大兼容性。

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

注册表记录官方文档、验证日期、路径和机制。RepoMemo 不转换 MCP、hooks、
permissions、commands 或 Harness 专有配置。

## Git-neutral，但不承诺 Harness-root-neutral

RepoMemo 在普通目录和 Git 工作树中生成相同核心契约，且从不调用 Git。
不同 Harness 仍可能根据 `.git` 或其他标记选择项目根。`doctor` 会把附近的
根目录和指令文件报告出来，而不是隐藏差异。

每个 working copy 初始化一次。symlink 与 Windows junction 属于本地文件
系统细节，不应被当作可移植会话状态。

## 安装

```bash
# 无需全局安装
npx repomemo@latest init

# npm 全局安装
npm install --global repomemo

# Homebrew
brew tap SUN-1024/repomemo
brew install repomemo
```

需要 Node.js 22 或更高版本。RepoMemo 的运行时依赖为零。

## v1 用户

v2 是明确的断代升级，不会自动把 `.ai/` 记忆转换到新契约。请按照
[MIGRATION-v1-v2.md](./MIGRATION-v1-v2.md) 人工核对和迁移有价值的知识。
v1 tags 和 `v1` 分支继续保留。

## 开发

```bash
pnpm install
pnpm verify
pnpm pack --pack-destination artifacts
pnpm package:smoke artifacts/repomemo-2.0.0.tgz
```

参见 [CONTRIBUTING.md](./CONTRIBUTING.md)。CI 覆盖 macOS、Linux、Windows
以及 Node.js 22/24。

## License

MIT
