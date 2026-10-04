# LongPi：住在 Claude Code 里的长寿教练

简体中文 | [English](README.en.md)

LongPi 把 [Claude Code](https://claude.com/claude-code) 变成每个人的长寿教练。它是一个 Claude Code mod（函数钩子插件），装上就能用：
体检报告交给它，它按原样录进本机的健康档案，算出身体年龄和十年心血管风险，起草方案、陪你打卡、提醒复查；
健康页、长寿图鉴、拆包翻牌的动画、通往 120 岁的路，都直接画在 Claude Code 里，不打开网页。

它是 [dsh-plugin-longpi](https://github.com/zwbao/dsh-plugin-longpi) 的完整移植，并且自成一体：

- **方法库**（[longevity-skills](https://github.com/zwbao/longevity-skills)，180 个方法）、**教练**（[longevity-coach](https://github.com/zwbao/longevity-coach-skill)）、
  **深度分析**（[longevity-analyst](https://github.com/zwbao/longevity-analyst-skill)）都打包在 mod 里，不用另外安装。
- **不需要 Mirobody**：档案是本机的一个文件（`~/.longpi`），报告由 Claude 自己读、按原样录入；Apple 健康导出一步导入。
- **每周新研究**：每周自动从 PubMed 找过去一周高质量的衰老研究（随机试验、荟萃分析、大型队列），按长寿图鉴的文案规范写成研究卡上架。

## 安装

需要 Claude Code 2.1.287 或更新版本。

```
/plugin marketplace add zwbao/longpi-mod
/plugin install longpi@longpi-mod
/reload-plugins
```

然后输入 `/longpi`。第一次用时，LongPi 会在后台准备好计算环境（几分钟，一次）：大多数方法只要系统自带的 Python 3.9+；
少数要用 numpy 的方法，它会用 [uv](https://github.com/astral-sh/uv) 在 `~/.longpi/.venv` 里装好，不动你的系统和 shell 配置。

LongPi 的工具都叫 `mcp__longpi__*`。不想每次都确认：`/permissions` → 允许 `mcp__longpi__*`。

## 怎么用

| | |
|---|---|
| 把体检报告拖进对话 | 「帮我录入这份报告」：Claude 读 PDF 或照片，按原样录入，然后讲给你听 |
| `/longpi` | 打开健康页：总览、化验、睡眠、运动、日程、方案、长寿图鉴，`m` 看更多（通往 120、深度分析、档案、设置……） |
| `/longpi <你想问的>` | 以你的口吻问 Pi，带上你的档案（只给模型看） |
| `/longpi 图鉴` · `/longpi 通往120` · `/longpi 方案` | 直接打开某一页 |
| `/longpi 新研究` | 现在就去找本周的新研究 |
| `/longpi setup` | 更新方法库，重新准备计算环境 |
| `/longpi 演示模式` | 屏幕分享时隐藏所有个人数字 |
| Apple 健康 | iPhone「健康」→ 头像 → 导出所有健康数据，把 export.zip 的路径告诉 Claude |

提示行（输入框上方）一次只说一件事：久坐提醒（打开了才有）、实验卡可以翻了、本周新研究上架了。

## 里面有什么

- **健康页**：身体年龄（PhenoAge）和十年心血管风险（China-PAR），超出平时波动的变化，今天的打卡，复查日期，医生简报。
  模型估计都标着「AI 预测」或「模型估计」。
- **长寿图鉴**：两周一个的小实验，装在实验包里；拆包、发牌、翻牌、揭晓都是终端里的像素动画。
  图书馆里是研究卡，按证据分颜色：铜（细胞）、银（动物）、紫（人群）、金（人体随机试验）。
- **通往 120 岁**：你的伙伴 Pi 从一颗蛋长成「百岁的 Pi」；一条十二站的路；奖章墙；每天「今天的三件事」。
  走到新的一站、Pi 长大、拿到奖章，都会放一次庆祝动画。
- **Pi 教练**：在对话里，Claude 以 Pi 的身份给出分级的具体建议，需要看医生时直说。
- **深度分析**：让 Claude 用 longevity-analyst 对整个档案做一次分析，结果导回方案。

### 游戏的规矩

LongPi 想让健康管理像游戏一样让人想参与，但游戏不能骗人：

- Pi 只跟着**留下了记录的事**长大：录入报告、在家自测、读研究卡、开始和揭晓小实验、复查、带简报看医生、加家人、算方法。
- **打卡不加分**：打卡无法核实，奖励打卡等于奖励说谎。化验数值的高低也不加分，奖励从不和指标好坏挂钩。
- 没有抽奖、稀有度、连续天数、每日宝箱和上限；没有任何功能要「解锁」。累计只增不减。
- 好的结果照实夸，但不说是哪个习惯带来的。

## 隐私

档案、方案、打卡都在本机：`~/.longpi`（可用 `LONGPI_HOME` 换地方）。
你交给 Claude 的报告、照片和问题会像平时用 Claude 一样发给模型；LongPi 会附上一段档案摘要，作为给模型看的上下文。
每周新研究只向 PubMed 发送检索词。「档案 → 隐私与数据」里可以撤回同意、删除全部数据。

## 局限

- 这不是诊断，也不是用药建议。紧急情况请拨打 120。
- 「一起研究」的实时上传在本机版里关闭。
- 身体年龄需要同一天的九项常规血检；心血管风险需要 35–74 岁和六项病史。

## 开发

```
claude plugin validate .
claude plugin test .
tsc -p .            # 需要 Claude Code 写入的 .claude-plugin/types
```

`hooks/core` 是 dsh-plugin-longpi 的服务端代码，跑在 `hooks/sys` 的 Node 形状垫片上；`hooks/ui` 是各页；
`hooks/app` 是 mod 自己的部分（录入、Apple 健康、每周新研究、通往 120、运行环境）。

## 许可

MIT，见 [LICENSE](LICENSE)。打包的方法库、教练和分析技能各有许可和第三方声明，见 [NOTICE](NOTICE)。
