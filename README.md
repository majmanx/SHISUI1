# 石髓 SHISUI · Marble × Venom 弦管合成器

古筝 · 二胡 · 竹笛 · 管子/唢呐 · 弦乐群 的物理建模内核，插电拾音、二极管与电子管放大链，
以及由 **真随机 / 圆周率 / 碳-14 衰变** 驱动的随机接口。大理石里流淌的液态金属，光从金脉中迸出。

## 运行

无需构建、无需安装。

- 直接双击 `index.html`（Chrome / Edge / Firefox / Safari 最新版），点"唤醒石髓"。
- 或本地起个静态服务：`python3 -m http.server 8000` 然后打开 `http://localhost:8000/`。

## 上手

1. **玩**：转四个宏（力 / 光 / 空 / 毒），按 `A S D F…` 弹奏，空格刷新随机接口，点"惊喜"。
2. **塑**：切乐器瓷砖，调拨弦位置 / 弓压 / 笛膜 / 簧片，开插电，调二极管与电子管。
3. **深**：点接口球或源芯片再点任意旋钮接线；写代码：`seq('C4 E4 . G4', 0.25)`、`onDecay(...)`。

4. **录**：底部"录音 · 声音槽"面板按 ● 或 `Shift+R`，录下你听到的一切，停止后进入一个槽；⬇ 导出 WAV。让槽循环再录 = 叠录新素材。

`Ctrl/⌘+K` 查找任何东西。右键旋钮锁定。`💾 存预设` 存到浏览器本地，改动会自动记住。`?` 看完整指南。

## 获取代码

```
git clone https://github.com/majmanx/Claude1.git
cd Claude1
git checkout claude/chinese-instrument-synth-y7nb27
```
或在 GitHub 页面切到该分支后 Code → Download ZIP，解压后双击 `index.html`。

## 测试

```
node --check js/*.js
node test/dsp-smoke.js    # DSP 数值冒烟测试（每种乐器出声、不发散、性能）
```

设计说明、声音架构、对标分析见 [DESIGN.md](DESIGN.md)。
