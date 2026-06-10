# RepoMemo

> **语言:** [English](./README.md) · **简体中文**

一个小型 CLI,把一份共享的、可纳入版本控制的 **AI 项目内存** 写入任何仓库。
执行 `repomemo init` 之后,任何遵循 `CLAUDE.md`、`AGENTS.md` 或 `opencode.md` 约定的 AI 编程
agent 都会以同样的顺序读到同样的项目事实。

```bash
repomemo init      # 在当前仓库生成 .ai/、CLAUDE.md、AGENTS.md、opencode.md
repomemo check     # 校验生成的脚手架是否完整、非空
repomemo check --verify  # 额外验证共享内存是否在真正被使用
repomemo upgrade          # 从本地模板更新根适配器
repomemo upgrade --fetch   # 先从 GitHub 拉取最新模板, 再更新
```

repomemo 是 **工具中立** 的:它不属于任何一个 AI agent,也不是由任何一个 agent
署名开发。被支持/兼容的 agent 列表(Claude Code、OpenCode、Codex、Cursor,
以及任何读取 `CLAUDE.md`、`AGENTS.md` 或 `opencode.md` 的工具)与项目的贡献者
列表不是一回事。

## 快速开始

```bash
# 1. 安装(三选一)
brew tap SUN-1024/repomemo && brew install repomemo
# 或:
curl -fsSL https://raw.githubusercontent.com/SUN-1024/repomemo/main/install.sh | bash
# 或:
npm install -g repomemo

# 2. 在你的项目里运行
cd /path/to/your/repo
repomemo init      # 写入 .ai/、CLAUDE.md、AGENTS.md、opencode.md(已存在的文件会被跳过)
repomemo check     # 校验脚手架是否完整、非空

# 3. 让它真正属于你的项目
#    编辑 .ai/project.md,如实描述项目
#    git add .ai CLAUDE.md AGENTS.md opencode.md && git commit -m "chore: adopt repomemo"
```

第 3 步完成后,所有遵循 `CLAUDE.md`、`AGENTS.md` 或 `opencode.md` 约定的 AI 编程 agent
都会在会话开始时按相同顺序读到相同的项目事实。

## 它生成什么

```
.ai/
  README.md              # 约定、阅读顺序、写入规则
  project.md             # 项目是什么、目录结构、工作流、完成标准
  memory.md              # 稳定的共享知识
  handoff.md             # 当前任务、活跃运行、下一步
CLAUDE.md                # 适配器:用于解析 @./path 导入的 agent
AGENTS.md                # 适配器:用于读编号清单的 agent
opencode.md              # 适配器:用于解析 @./path 导入的 agent
```

`CLAUDE.md`、`AGENTS.md` 与 `opencode.md` 不复制 `.ai/` 中的任何内容,只做指向。每个 agent
读到的是同一套文件、同样的顺序。

## 工作原理

<p align="center">
  <img src="pic_intro_repomemo/pic_ZH_repomemo/ZH_01.png" alt="RepoMemo 概览" width="80%">
</p>

<p align="center">
  <img src="pic_intro_repomemo/pic_ZH_repomemo/ZH_02.png" alt="agent 如何读取脚手架" width="80%">
  <img src="pic_intro_repomemo/pic_ZH_repomemo/ZH_03.png" alt="agent 工作流" width="80%">
  <img src="pic_intro_repomemo/pic_ZH_repomemo/ZH_04.png" alt="多 agent 共享内存" width="80%">
</p>

## 为什么需要它

不同的 AI 编程 agent 在会话开始时会读取不同的指令文件。没有统一布局时,同一
仓库里的两个 agent 会逐渐偏离:一边记住的决定另一边没有,人工合并的成本越来
越高。

repomemo 提供让所有支持的 agent 共享同一份项目内存所需的 **最小约定**,不绑定
具体语言、框架或 agent 运行时。

## 安装

### Homebrew(macOS 推荐)

```bash
brew tap SUN-1024/repomemo
brew install repomemo
```

tap 仓库为 `SUN-1024/homebrew-repomemo`;本仓库内 `homebrew/repomemo.rb` 保留
了一份用于参考的 formula 副本。

### Curl 一键安装(macOS / Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/SUN-1024/repomemo/main/install.sh | bash
```

脚本会下载最新发布的 tarball,把 `repomemo` 装到 `/usr/local/bin/repomemo`,
templates 装到 `/usr/local/share/repomemo/templates`。仅当目标前缀不可写时
才会调用 `sudo`。可以通过环境变量自定义安装路径或版本:

```bash
REPOMEMO_PREFIX="$HOME/.local" \
REPOMEMO_VERSION=v1.0.0 \
  bash <(curl -fsSL https://raw.githubusercontent.com/SUN-1024/repomemo/main/install.sh)
```

### npm(跨平台)

安装 npm 包:

```bash
npm install -g repomemo
# 或:
pnpm add -g repomemo
# 或:
yarn global add repomemo
```

这是对同一个 Bash CLI 的薄封装,因此仍需要本机有 Bash 3.2+ 可用。

### 从源码安装

```bash
git clone https://github.com/SUN-1024/repomemo.git
cd repomemo
ln -s "$PWD/bin/repomemo" /usr/local/bin/repomemo   # 或任何 $PATH 上的目录
```

### 不安装,直接使用

```bash
git clone https://github.com/SUN-1024/repomemo.git
./repomemo/bin/repomemo --help
```

## 使用方式

```bash
repomemo init                    # 在当前目录初始化
repomemo init --target ./my-app  # 在另一个目录初始化
repomemo init --force            # 覆盖已存在的文件(危险)
repomemo upgrade                 # 从本地模板更新根适配器
repomemo upgrade --fetch          # 先从 GitHub 拉取, 再更新
repomemo upgrade --target ./my-app
repomemo check                   # 校验当前目录
repomemo check ./my-app          # 校验另一个路径
repomemo check --strict          # 额外校验适配器顺序和模板同步
repomemo check --verify         # strict + 验证共享内存是否在真正使用
repomemo --version
repomemo --help
```

`repomemo init` **默认是安全的**:已存在的文件会被报告为 *skipped*,不会被
静默覆盖。只有当你确实想替换现有脚手架时,才使用 `--force`。

`repomemo check` 校验脚手架文件存在且非空。`repomemo check --strict`
还会校验根适配器是否按同一顺序指向同一组 `.ai/` 文件。在 repomemo
源码仓库中,它也会校验 `templates/` 是否与 CLI 的脚手架文件列表一致。

执行 `init` 之后,请编辑生成的 `.ai/project.md`,
让它们如实描述你的项目,然后整体提交。

## agent 是如何读这套文件的

```
会话开始
  读取 CLAUDE.md 的 agent   ─► 解析 @./path 导入  ─► 按顺序加载 .ai/*
  读取 opencode.md 的 agent ─► 解析 @./path 导入  ─► 按顺序加载 .ai/*
  读取 AGENTS.md 的 agent   ─► 按编号清单读取    ─► 按顺序加载 .ai/*

agent 开始工作
  在报告"完成"之前:
    更新 .ai/handoff.md   (每次都更新)
    更新 .ai/memory.md    (出现稳定事实时)
```

阅读顺序固定为:
`README.md → project.md → memory.md → handoff.md`。

## 唯一的运行时规则

在**任何一次**实现、调试、重构、评审、文档、初始化、依赖、配置、测试相关任务
之后,**先更新 `.ai/handoff.md`,再宣布任务完成**。如果在过程中发现关于本
项目的稳定知识,请把它追加到 `.ai/memory.md`(或最相关的 `.ai/` 文件)中,
作为同一次变更的一部分提交。

不要在 `.ai/` 中写入 `TODO` / `TBD` 或占位文本。如果某个事实本仓库尚未定义,
请用一句话明确说明"未定义"。

## 不安装 CLI 时:贴提示词

如果你希望让 agent **直接读你的仓库再现场生成** 这套脚手架(而不是使用 CLI),
可以在目标仓库内,把下面这段提示词贴进任意 AI 编程 agent 的全新会话:

```text
请将本仓库初始化为可被任意 AI 编程 agent 共用的项目内存结构,只要该 agent
读取 CLAUDE.md、AGENTS.md 或 opencode.md。

1. 先阅读仓库本身:README、依赖清单、源码目录、配置、脚本、测试、CI、
   Docker / 部署文件、文档,以及已有的 AI 指令文件。只写仓库支持的事实——
   不许 TODO 占位,不许编造目的、命令、架构。

2. 创建 `.ai/`,填入 4 个文件,内容必须来自真实的仓库状态:
   - `README.md`             说明本约定;agent 在每次工作前按顺序读这些
                             文件,完成前先更新 `handoff.md`。
   - `project.md`            项目目的、目录结构、工作流、完成标准。
   - `memory.md`             稳定的共享知识、约定、约束、反复踩到的坑。
   - `handoff.md`            当前任务、活跃运行、下一步、最近完成事项。

3. 创建轻量根适配器:
   - `CLAUDE.md` 只包含 `@./.ai/<file>` 导入,顺序与 `.ai/README.md` 中
     定义的阅读顺序一致。
   - `opencode.md` 也包含同样顺序的 `@./.ai/<file>` 导入。
   - `AGENTS.md` 用编号清单显式列出同样 4 个文件的同样顺序,并写明规则:
     "后续涉及实现、调试、重构、评审、文档、初始化、依赖、配置、测试的
     任务,完成前必须先更新 `.ai/handoff.md`;出现稳定知识时同步更新
     `.ai/memory.md`。"

4. 验证:列出新建文件,运行 `git status`;只在仓库已有配置的情况下跑安全
   检查命令。

5. 最后总结:已创建文件、推断出的关键事实、未知项、已做的检查。
```

## 受支持的 AI 编程 agent

repomemo 同时提供三份适配器,因为不同的 agent 在会话开始时会读取不同的指令
文件:

- `CLAUDE.md` —— 用于原生支持 `@./path` 导入的 agent。
- `opencode.md` —— 用于原生支持 `@./path` 导入的 agent。
- `AGENTS.md` —— 用于按编号清单读取文件的 agent。

列出的 agent 是 **兼容方**,不是项目贡献者。repomemo 不是它们任何一个的插件,
它们也不是本仓库的作者。

## 开发

repomemo 是一个 Bash 脚本加一个 `templates/` 目录。

```bash
# 跑测试
bash tests/test_repomemo.sh

# 不安装,直接从仓库运行 CLI
bash bin/repomemo --help

# repomemo 自身也应当通过它自己的 check
bash bin/repomemo check .
bash bin/repomemo check --strict .
```

### 发布

1. 更新 `bin/repomemo` 中的 `VERSION` 以及 `homebrew/repomemo.rb` 中的
   `version` / `url` 行。
2. 给 commit 打 tag:`git tag v1.0.0 && git push --tags`。
   `.github/workflows/release.yml` 中的发布 workflow 会基于该 tag 创建
   GitHub release,并打印源码 tarball 的 SHA256。
3. 把 SHA256 写回 `homebrew/repomemo.rb`,并把 formula 推送到
   `SUN-1024/homebrew-repomemo`,这样 `brew install repomemo` 才能取到。

## 这不是什么

- 它不是运行时、库、特定语言的框架,也不是 hook 系统。
- 它不是 `settings.json` 生成器(那些属于使用方项目)。
- 它不偏袒任何一个 AI agent —— 每一个被支持的适配器都是平等的。

## 许可证

[MIT](./LICENSE)
