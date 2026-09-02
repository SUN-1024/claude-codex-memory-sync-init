# 一分钟用上 RepoMemo

[English](./QUICKSTART.md)

**项目拥有连续性，Agent Harness 只是可以替换的入口。** RepoMemo 让项目成为
Agent Native，并尽量使用各 Harness 原生支持的路径。

## 1. 只初始化一次

```bash
cd 你的项目
npx repomemo@latest init
```

Git 完全可选。完成这一步后，切换 Coding Agent 时不需要再运行 RepoMemo。
同一个命令也可以用于已经做到一半的项目，不需要重建项目。

RepoMemo 会保留现有文件，但不会重建各 Harness 的私有聊天历史；切换前请让
当前 Agent 把真实进度写入 `AGENT_STATE.md`。

## 2. 只维护三个共享源

- 永久项目规则写在 `AGENTS.md`。
- 当前目标、进度和下一步写在 `AGENT_STATE.md`。
- 可复用 Skill 放在 `.agents/skills/<skill-name>/SKILL.md`。

不要把这些内容复制到各 Harness 的私有文件。RepoMemo 优先使用原生发现，
只有确实需要时才添加极薄桥接。

## 3. 直接切换

```bash
codex
# 也可以：claude、gemini、opencode、cursor、copilot、zcode、dsh
```

让 Agent 读取项目规则和当前状态后继续工作；完成有意义的工作后，让它更新
`AGENT_STATE.md`，下一个 Agent 就能接着做。

不需要 `convert`、`sync`、`generate`、`export` 或 `handoff`。
请使用支持上述项目路径的 Harness 版本；若产品要求 workspace trust，仍需完成
它自己的首次信任提示。

## 4. 只在需要时检查

```bash
npx repomemo@latest doctor
```

只修复安全的托管桥和链接：

```bash
npx repomemo@latest repair
```

以后升级 RepoMemo 时，在同一个项目里重新运行 `npx repomemo@latest init`。
它会原地升级托管区块，不应改动项目状态、Skills、源码和用户自写文字。

RepoMemo 不初始化 Git、不执行 Skill 脚本，也不迁移私有聊天历史。项目目录中
的文件，才是可以跨 Harness 携带的交接内容。`doctor` 检查文件契约，但不会
运行或升级本机安装的 Harness。
