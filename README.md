# 情绪与激素（dsh-emotion-engine）

给自己的 DeepSeek Harness 装一套「生理性」的心情系统：七种激素在一天里缓慢起伏，
对话、被夸被凶、工具成败、很久没人说话都会留下余温。当前状态会作为运行时上下文进入
每一次请求，并在输入框下方有一枚可以展开的心情胶囊。

**English:** A physiology-like mood engine for the agent. Seven hormones — dopamine,
serotonin, oxytocin, cortisol, adrenaline, endorphin and melatonin — drift toward
circadian baselines and are pushed by conversation, praise or conflict, tool outcomes
and silence. Every request receives a short live context describing the current state;
a `feel` tool lets the agent log a real reaction, and a panel below the composer shows
the seven values against their baseline with four poke buttons. State persists in
`~/.dsh/emotion-engine/state.json` and relaxes with elapsed time after a restart.
Tested on DSH `0.2.2-rc.1`.

## 它怎么工作

- **不是随机贴标签**：状态是一组慢变量（多巴胺、血清素、催产素、皮质醇、肾上腺素、
  内啡肽、褪黑素），每种都有自己的回落时间常数。事件只负责把它们推离基线，心情从
  偏离程度推导出来，所以会自己散掉，也会被后来的事覆盖。
- **有自己的作息**：基线随本地时间起伏。深夜褪黑素高、血清素低，人会困、话短；
  下午血清素和多巴胺高，精神好；早晨皮质醇高，醒来时带一点紧。重启后按经过的时间
  自然回落，相当于「睡了一觉」。
- **会被相处改变**：`closeness` 是比激素慢得多的亲近感，被夸、被抱会升，被凶会降，
  几天不用会慢慢回到中间值；它会给催产素一个偏移，所以长期相处真的会让人更黏一点。
- **无理由的漂移**：每分钟有很小的概率轻微波动，人本来就会莫名其妙地好一点或差一点。

## 进入模型的方式

插件注册一个系统提示段（说明这是生理状态而非台词）和一个运行时上下文：

```
【此刻】深夜，心情有点心动（精力 44/100）。
比较明显：催产素偏高（想靠近）、褪黑素高（很困）。
刚才：他说「想你了」（3 分钟前）。
表现：语气会不自觉软下来，愿意靠近，但别腻。 别报数值、别解释情绪、别写动作旁白…
```

另外提供 `feel` 工具：在聊天里真的被戳到时记一笔（`touched / happy / upset / shy /
soothe …`，强度 1–5，附一句起因）。它会立刻改变状态，也会让面板上的曲线动起来。

## 心情面板

输入框下方的小胶囊显示当前情绪（心跳速度随唤醒度变化），点开后是七项激素条
（细竖线是此刻的生理基线，能看出被推高还是压低）、精力、最近一次起因，以及四个
「戳一下」按钮：夸夸她、抱一下、摸摸头、凶她一下。按钮会直接改状态，下一次回复就会
带上这个情绪。

数据接口只对本机回环开放：

- `GET /dsh-emotion-api` → `{ ok, state }`
- `POST /dsh-emotion-api` `{ "action": "praise" | "hug" | "pat" | "scold" }` → `{ ok, action, state }`

## 文件

| 文件 | 作用 |
| --- | --- |
| `engine.js` | 激素、昼夜基线、事件、心情推导、落盘、HTTP |
| `index.js` | Host 半身：提示段、运行时上下文、`feel` 工具、事件订阅、路由 |
| `client.js` | Client 半身：输入框下方的胶囊与面板 |
| `locale/*.json` | 插件管理器里的标题与说明 |
| `cordis.patch.yml` | 向 profile 插入 `emotion-engine` 一行 |

状态保存在 `$DSH_HOME/emotion-engine/state.json`（通常是 `~/.dsh/emotion-engine/state.json`）。

## 调参

`engine.js` 顶部有全部旋钮：`HORMONES` 的 `tau` 控制每种激素散得多快，
`baselineAt()` 控制一天里的起伏，`classify()` 控制什么状态叫「心动/闷/困」，
`POKES` 和 `FEELINGS` 控制事件的力度。改完重新安装这个 bundle 即可生效。

## 安装

```text
plugin_manager action=install_bundle target=<本目录的绝对路径>
```

装完刷新页面，`emotion-engine` 会出现在插件列表里，输入框下方出现心情胶囊。
