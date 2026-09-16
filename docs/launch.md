# 石髓 SHISUI · 公开发布计划

> 目标：让"会玩合成器的人"和"喜欢国乐 / 视觉的人"都能 30 秒内看懂、点进去、发出第一个声音。

## 0. 发布前一小时清单

- [ ] GitHub 用户名 / 版权名改好（LICENSE 已写 SYXMadeit）。改用户名后 Pages 网址会变成 `https://<新用户名>.github.io/SHISUI1/`，旧网址会 404；README 与例行任务提示词里的链接同步改。
- [ ] 仓库 Settings → General：Description 一句话、Website 填 Pages 网址、Topics：`web-audio` `synthesizer` `chinese-instruments` `guzheng` `erhu` `cymatics` `physical-modeling` `generative-music`。
- [ ] 发 Release `v0.5.0-beta`，正文三行：是什么、怎么玩、怎么反馈。
- [ ] 录 3 段素材（见下），一张 1280×640 的社交封面图（金沙大理石 + 一件乐器图标 + 「石髓 SHISUI」）。
- [ ] 手机 Safari 亲自打开一次，确认能出声。

## 1. 素材：先录，再发

同一批素材剪成不同长度，所有平台都能用。

| 素材 | 长度 | 内容 |
| --- | --- | --- |
| A · 钩子 | 8–15 s | 竖屏。手指点"唤醒石髓"，金色启动页 → 弹二胡滑音 → 沙盘金沙瞬间聚成图形。字幕一句："声音有形状。" |
| B · 一分钟演示 | 45–60 s | 横屏或竖屏。四步：选乐器（图标）→ 转宏"毒"开毒液 → 碳-14 衰变触发琶音 → 录音导出。每步 10 秒字幕。 |
| C · 深讲 | 3–6 min | 横屏。物理建模是怎么做的（拨弦 / 弓弦 / 簧片）、Chladni 定律与沙盘、π 与碳-14 当随机源、鎏金大理石怎么程序生成。给 B 站 / YouTube。 |

录屏：桌面 Chrome 窗口 1280×720 或 1080×1920 竖屏（用 DevTools 设备模式）。系统声音用 OBS 采集"应用音频"，不要用麦克风录扬声器。

## 2. 平台与节奏

**第一周：中文圈**
- **Bilibili**：发 C（深讲）+ 简介放网址与 GitHub。标题写清"开源 / 网页 / 免安装 / 中国乐器合成器"。分区：科技 → 软件应用，或音乐 → 演奏。B 站观众吃"原理 + 演示"。
- **抖音 / 小红书**：发 A（钩子）和 B 的竖屏版。文案放简介："浏览器打开就能弹，链接在评论 / 主页"。抖音不能直接跳外链，把网址做成图片和评论置顶。
- **知乎 / V2EX / 少数派**：一篇图文（可以直接用 DESIGN.md 精简）："我用 Web Audio 做了一台大理石鎏金的国乐合成器"。

**第二周：英文圈**
- **YouTube**：C 的英文字幕版 + B 作为 Shorts。标题示例："SHISUI — a browser synth of Chinese instruments, gilded marble & Chladni sand (open source)"。
- **Instagram Reels / TikTok**：A 和 B。TikTok 简介可放链接，Instagram 放主页链接。标签：#webaudio #synth #cymatics #guzheng #erhu #generativemusic #creativecoding。
- **Reddit**：r/synthesizers（周末的 "show off" 帖）、r/webaudio、r/creativecoding、r/generative。每个板块单独发，内容改成"我做了什么 + 一个 GIF + 网址"，不要复制粘贴同一段。
- **Hacker News**：`Show HN: SHISUI – a browser synth of Chinese instruments with a Chladni sand plate`。周二到周四上午（美东）发，正文两三句 + 链接。

**持续**
- GitHub Discussions 开一个"你做的声音"板块；README 放"用户作品"链接。
- 每次合并新功能发 Release，把变更贴到 B 站 / 推特动态。

## 3. 每条内容都带的三样东西

1. 网址（能点就点，不能点就做成图 + 评论置顶）。
2. 一句怎么玩：**"打开 → 点 AWAKEN → 按 Z X C V"**。
3. 一句怎么反馈：**"页面右上角 报错 Report，一键提 Issue"**。

## 4. 发布后看什么

- GitHub Insights → Traffic：哪来的流量。
- Issue 标签 `bug-report` 数量与内容：手机问题优先修。
- 视频里被问最多的问题 → 下一条视频的题目。

## 5. 命名与署名

- 作者署名统一用 **SYXMadeit**（LICENSE、视频片尾、社交主页）。
- 项目名统一写 **石髓 SHISUI**，英文语境用 SHISUI。
