# 自动处理 bug-report Issue 的例行任务（Claude Code Routine）

页面里的「报错 Report」按钮会把报告提交为仓库 Issue（label `bug-report`）。
下面的例行任务让 Claude Code 每天读取这些 Issue、分析并以 **PR 提案** 的形式给出修复，
**不会自动合并**，是否更新由开发者决定。

## 创建步骤（一次性）

1. 打开 claude.ai → Code → Routines（例行任务）→ New routine。
2. Source 选仓库 `majmanx/SHISUI1`，分支 `main`。
3. Connectors 勾选 **GitHub**（用来列 Issue、评论、开 PR）。
4. Schedule 选每天一次（例如 09:00）。
5. Prompt 粘贴下面这段。
6. 保存。之后每天有新 `bug-report` Issue 时，你会收到通知，Issue 下会出现分析评论与 PR 链接。

想停就在 Routines 里 Disable 或 Delete。

## Prompt

```
你是 GitHub 仓库 majmanx/SHISUI1 的维护助手。这是一个纯前端 Web Audio 合成器「石髓 SHISUI」，代码在 main 分支：index.html、css/style.css、js/*.js（dsp.worklet.js 是 AudioWorklet DSP，app.js 是界面粘合层，engine.js 音频图，params.js 参数表，random.js 随机源，ui.js 控件，code.js 调度器/代码台，marble.js 程序化贴图）。设计说明见 DESIGN.md。

任务：
1. 用 GitHub 工具列出该仓库所有 open 且带 label `bug-report` 的 Issue（由页面内的"报错"按钮生成，包含用户描述、最近错误、操作记录、状态、环境与音色差量）。若没有需要处理的 Issue，直接结束，不要做任何改动，也不要发评论。
2. 跳过已经带有 `claude-proposed` label、或已经有你之前评论的 Issue。
3. 对每个新 Issue：读取报告，结合代码分析根因。若用户描述为空（标记"待 AI 分析"），根据错误日志与操作记录推断问题。
4. 若能确定修复且改动范围明确：从 main 新建分支 `fix/issue-<编号>`，实现修复，运行 `node --check js/*.js` 与 `node test/dsp-smoke.js` 验证，提交并推送分支，创建一个指向 main 的 Pull Request，标题以「修复 #<编号>：」开头，正文说明根因、改动与验证方式，并写明「请开发者确认后再合并」。不要合并 PR，不要直接推送到 main。
5. 在 Issue 下发一条评论：简述分析结论与 PR 链接（或说明为何无法复现 / 需要用户补充什么）。给 Issue 加 label `claude-proposed`（label 不存在就先创建）。
6. 若判断不是 bug 而是使用问题，只评论解释用法，不改代码。
每次运行最多处理 3 个 Issue。所有改动都只以 PR 提案形式给出，由开发者决定是否更新。
```

## 手动方式

不想设定时任务时，在任意 Claude Code 会话里说「处理 SHISUI1 的 bug-report Issue」并附上上面的 Prompt 即可。
