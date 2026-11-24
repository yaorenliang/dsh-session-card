# 怎么进插件市场

市场本身不持有一份列表。它自己的 README 写得很直接：*「This repo is the market
app, not the catalog.」* 你在「发现」里看到的每一条都来自一个策展注册表，市场每次
打开时实时读的订阅源是 `https://awesome-dsh-plugin.com/plugins.json`。

所以没有表单要填，也没有后台可登。收录是向
[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
提一个 PR。

## 注册表校验什么

一次投稿就是一个文件：`data/plugins/<owner>__<repo>.yml`。门禁在
`.github/workflows/pr-gate.yml`，真正判定的是 `scripts/check-submission.mjs`：

| 规则 | 细节 |
| --- | --- |
| `dsh.bundle` 清单 | `package.json` 必须声明 `dsh.bundle`；只写 `dsh.client` 装不上 |
| 仓库年龄 | `MIN_AGE_DAYS = 1`；时间造不了假，PR 前几分钟才建的仓库会被拒 |
| 真实代码 | 占位仓库、纯 README 仓库不收 |
| topic | 仓库要带 `dsh-plugin` topic |
| 描述属实 | 描述被当作对插件的声明并与代码核对；夸大是打回的主因 |

`check` 变绿只是前置条件，不是结论——维护者合并前会实际读仓库。

## 怎么提

1. fork 一次 `awesome-dsh-plugin`。
2. 在分支上加 `data/plugins/<owner>__<repo>.yml`：

   ```yaml
   url: https://github.com/<owner>/<repo>
   name: <owner>/<repo>
   category: session        # 选它实际做的事，不是你想让它出现在哪
   description:
     en: 'One line, ending with a period.'
     zh: '一句话描述，以句号结尾。'
   ```

   描述里含 `: ` 必须加引号——不加引号 YAML 会当成嵌套键，解析直接失败。
3. 对 `main` 提 PR。一个文件就是全部投稿；README 由合并后的 CI 重新生成，不要手改。

## 封面图，以及「图为什么不显示」

市场抓的是 `README.md`——精确这个文件名，从不看 `README.zh.md`。候选图要过四道闸
（`client/client.js`）：

- 必须 `https`，主机在 `raw.githubusercontent.com`、
  `user-images.githubusercontent.com`、`camo.githubusercontent.com`、`github.com` 之内
- `.svg` 直接拒
- 宽 ≥ 280、高 ≥ 150、面积 ≥ 48000、宽高比 1.05–3.2
- 语义分至少 20

分数是好截图悄悄失手的地方：`NON_PREVIEW_WORDS`——
`badge`、`logo`、`icon`、`npm`、`license`、`build`、`coverage`——出现在 alt
里扣 **140**，出现在路径里扣 120。所以一张真截图，alt 写成「status badge」就会掉到
门槛以下。alt 里的预览词（`screenshot`、`preview`、`showcase`、截图、预览）加 55。

这就是 `README.md` 用 `## Screenshots` 标题、alt 写成
`<名字> screenshot: <它展示了什么>`、文件命名 `docs/screenshot-*.png` 的全部原因。

## 合并之后

注册表会重新生成 README，实时 `plugins.json` 跟随下一次定时刷新。市场每次打开都读
这个源，所以新条目不用等市场更新——但卡片封面是从仓库抓的，`README.md` 过期就会
显示成一张空白瓦片，直到下一次抓取。

## 本仓库现状

- 包：`@yaorenliang/dsh-session-card`，公开，MIT。每个 release 都挂着打好的包，
  所以市场能给下载而不是源码构建：`releases/latest/download/dsh-session-card.tgz`。
  这个仓库的 registry 发布从来没成功过：没配 npm trusted publishing，而没有
  trusted publisher 的 tag 发不出任何东西。所以下面那条条目指向 tarball，不是包名。
- 封面图：`docs/screenshot-card-en.png`，对 20 分门槛实测 167 分。
- 注册表条目：PR [awesome-dsh-plugin#18225](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/18225)。
  首次门禁只有一行没过——仓库当时 0.1 天——而这一项门禁每天自己重跑，不需要重新提交。