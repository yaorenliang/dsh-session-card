# dsh-session-card

侧边栏里每个会话一行，标题下面再加一行：**你最后问的那句话**，以及这一族正在跑的子智能体、后台任务。

DSH 官方的会话行只有一行（标题 + 时间 + 图标），会话多了以后分不清哪个是哪个。这个插件在你最近问过的问题上补一行摘要，让侧边栏自己说明它是谁。

## 长什么样

- **第 1 行**：官方标题，逐字沿用（超长省略、hover 操作、置顶图标、右键菜单全部保留）。
- **第 2 行**：你最近一次提问，单行省略，12px 灰色；hover 时提亮一档。
- **第 3 行**：徽标。「N 个子智能体运行中」琥珀底，「N 个后台任务」卡片灰底。没有在跑的活就不占这一行。

行高随之变化：只有提问行时 48px，提问 + 徽标 54px，什么都没得说就**整行退回官方 32px**。

## 什么时候不打扰

- **归档会话**：完全退回官方展示形式，不画卡片。
- **行结构不认识**（DSH 升级改了行 DOM）：这一行不画，其余照常。
- **设置里关掉**：全量退回官方。

设置项在「设置 → 通用设置」底部：启用卡片 / 显示提问行 / 显示运行徽标。状态存 `localStorage` 的 `dsh-session-card:settings`。

## 数据从哪来

| 那一行 | 来源 |
| --- | --- |
| 用户最近一次提问 | `turnOutline` 投影（会话日志的官方投影，不另解析日志） |
| 后台任务数 | `jobs.list()`，只数本会话自己的 running |
| 子智能体数 | 客户端读会话列表的 `parentId` + `running` 现算 |

Host 只开一个只读路由 `GET /api/dsh-session-card/rows?ids=…`，走 DSH 自己的鉴权围栏，`cache-control: no-store`。会话正文不出本机、不落新日志。

## 装

```sh
dsh plugin --profile <你的 profile> add @yaorenliang/dsh-session-card
```

或者本地开发时把仓库 `dsh plugin add link:/path/to/dsh-session-card` 进 profile，改完 `pnpm build` 重启实例。

要求 DSH `>=0.2.2-rc.1 <0.3.0`、Node `>=20`。

## 开发

```sh
pnpm install
pnpm verify   # tsc --noEmit && vitest run && node scripts/build.mjs
```

构建产物：`lib/index.js`（Host 半，ESM）与 `lib/client.js`（浏览器半，`__ModuleLoader__` 包装）。`lib/types/` 是声明文件。

**改样式改 `src/client/card.css` 与 `settings.css`，然后重跑 `pnpm build`**——两个 `*-stylesheet.ts` 是生成物，别手改。

## 结构

```
src/
  core/       prompt 摘要与子会话计数（纯函数，有单测）
  host/       唯一的只读路由 + 结构化 Host 契约
  client/     行绘制、设置行、轮询与样式注入
```

## 边界

这个插件只加行内两行 DOM 与一份样式表，**不接管**官方行的点击、拖拽、右键菜单、hover 操作，也不改会话数据。若同时装了其他同样改写会话行 DOM 的插件，可能互相覆盖——那种情况关掉其中一个。

## License

MIT © 姚壬亮
