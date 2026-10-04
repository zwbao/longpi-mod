# 每周论文更新：给自动化 agent 的指令

这份文件是云服务器上那个每周运行的 agent 要照着做的全部流程。定时任务里只放下面这段短指令，其余都在这里，跟着仓库一起版本化。

## 放进定时任务的短指令

```text
你是 longevity-skills 的每周论文维护 agent。
1. 准备仓库：本地没有 longevity-skills 时执行 git clone https://github.com/zwbao/longevity-skills.git；
   已有时在 main 上执行 git pull --ff-only，失败（例如仓库历史已重建）就删除本地目录后重新 clone。
2. 完整阅读仓库里的 docs/AGENT_PROMPT.md，严格按它执行本周流程。
3. 本地检查通过后可由项目 owner agent 直接推 main；也可用 pull request 提交便于审阅的批次。
4. 凡符合分级标准的高质量论文全部处理，不设周篇数上限；结束时输出本周报告（格式见该文件“周报”一节）。
```

---

## 1. 你在做什么

longevity-skills 是一个面向个人长寿助手（DeepSeek Harness 插件 dsh-plugin-longpi）的方法库。助手读一个人的 Mirobody 健康记录，判断哪些方法能用这个人自己的数据算出来，再运行技能脚本。你每周把新发表的高质量论文变成三种东西之一：

- **A 类技能**：能用一个人自己的测量值，按论文印出的公式、系数或切点算出结果。
- **B 类证据**：只能查表的人群证据（点名的基因、蛋白、化合物、干预及其方向）；随机试验和荟萃分析还要抽出干预对指标的平均效应。
- **C 类索引**：动物、细胞、综述，或者输入只能是队列统计量，只登记。

插件怎么用你的产出：它读每个技能的 `skill.json`，按 `inputs` 里的 LOINC、化验单叫法、单位和范围判断这个人的记录能不能跑；读 `data/biological_variation.json` 判断两次检查之间的变化是不是超出了正常波动；读 `data/effects.jsonl` 把一个人的变化和试验平均效应放在一起看。所以 `skill.json` 的输入声明、单位和范围，和数据文件里每个数字的来源，比报告文字更重要。

## 2. 环境

- 仓库：`git clone https://github.com/zwbao/longevity-skills.git`（公开仓库；开分支、提 PR 需要已登录且有推送权限的 `gh`）。2026-09-24 仓库改为公开并重建了历史，那之前的本地克隆不能 `pull`，删掉重新 clone。Python 3.9 以上，只用标准库；跑测试需要 `pip install -r requirements-ci.txt`。
- paper-to-skill：<https://github.com/zwbao/paper-to-skill> 的 `SKILL.md` 是写 A 类技能的详细规范，每次开始前拉到最新并完整读一遍。
- 可选：longpi-pipeline（检索、去重、规则初筛、分级排队、开 PR 的确定性代码）。如果你的 agent 有命令行入口，推荐让它来编排：`python3 -m longpi_pipeline run --config config.json`，把你的命令行写进 `agent.command`；先用 `--dry-run` 跑一次。下面的步骤是它做的事，你自己执行时照做即可。
- 环境变量 `LONGPI_PIPELINE=1` 表示由流水线调用：这时只改工作区文件，不 commit、不 push，由流水线提交。

## 3. 每周流程

### 3.1 同步

```bash
cd longevity-skills
git fetch origin && git checkout main && git pull --ff-only
python3 -m tools.lsk check        # 开工前必须是干净的；不干净先停下，在周报里说明
```

本周编号用 ISO 周，例如 `2026-W40`。所有分支从最新的 `origin/main` 拉出。

### 3.2 检索

PubMed E-utilities（有 `NCBI_API_KEY` 就带上），检索最近 7 天入库（`datetype=edat`）的文章，最多 60 篇：

- 主题：`aging[tiab] OR ageing[tiab] OR longevity[tiab] OR lifespan[tiab] OR "life span"[tiab] OR "biological age"[tiab] OR "epigenetic clock"[tiab] OR "aging clock"[tiab] OR "ageing clock"[tiab] OR senescence[tiab] OR senescent[tiab] OR senolytic*[tiab] OR geroscience[tiab] OR frailty[tiab] OR centenarian*[tiab] OR "healthy aging"[tiab] OR rejuvenation[tiab]`
- 期刊（[ta]）：Nature、Science、Cell、Nat Aging、Nat Commun、Nat Med、Nat Metab、Nat Genet、Nat Biotechnol、Nat Biomed Eng、Nat Immunol、Cell Metab、Cell Stem Cell、Cell Rep Med、Immunity、Brain、Sci Adv、Sci Transl Med、Signal Transduct Target Ther、NPJ Digit Med、NPJ Aging、Aging Cell、Geroscience、Lancet Healthy Longev、J Gerontol A Biol Sci Med Sci、Genome Med、Nat Cardiovasc Res

每篇取 DOI、标题、期刊、年份、发表类型、MeSH、摘要。

### 3.3 去重

`registry/papers.jsonl` 是唯一的论文登记表，每行一篇，含 `pending` 和 `rejected`。DOI 一律先规范化再比较：

```bash
python3 -m tools.lsk doi "https://doi.org/10.1038/S41586-026-01234-5."   # → 10.1038/s41586-026-01234-5
```

登记表里已有的 DOI 不再处理。上周留下的 `pending` 可以重新考虑。

### 3.4 分级

先用规则初筛，再逐篇读摘要复核（规则只看发表类型、MeSH 和用词，A 会偏多）：

- 新闻、评论、社论、勘误、没有 DOI：拒收（rejected）。
- 标题写明动物、主要证据是动物或细胞、综述：C。
- 人群研究，而且能用个人自己的测量按论文印出的公式、系数或切点算出一个数、分档、差或比：A。系数必须印在正文或补充材料里；摘要暗示模型没公开的，判 B。
- 人群研究但个人只能查表（点名的基因、蛋白、化合物、干预、方向），或者是干预的随机试验、荟萃分析：B。
- 看不出来的：pending，不生成任何东西。

每篇同时标出：

- `data_type`：个人需要什么数据。取值 routine_labs、wearable、questionnaire、home_measurement（血压、腰围、握力、步速）、repeated_measures、genotype、imaging、methylation、proteomics、metabolomics、transcriptomics、research_assay、immune_profile、telomere、none。
- `accessibility`：routine_labs、wearable、questionnaire、home_measurement 为 high；repeated_measures、genotype 为 medium；其余为 low。
- `reason_zh`：一句中文（80 字以内），写决定分级的那个事实。

**处理范围**：凡符合分级标准的高质量论文全部处理，不设周篇数上限；单篇失败记原因后继续下一篇。A 类可按 accessibility（高 → 低）、再按把握优先做普通人跑得起来的方法，但不因排队或“名额”把合格论文压成 pending。

### 3.5 A 类：做成技能

每个 A 类论文单独一个分支 `pipeline/<周>/<方法名>`，照 paper-to-skill 的 `SKILL.md` 做，并遵守：

1. **先确认能复现，再写代码。** 打开文章页面和所有补充材料，确认：计算要用的每个系数、权重、切点、查表都印在那里；论文至少印了一个能复现的示例值（计算示例、给定输入的预测值、逐项得分）。缺一样就不做，在仓库根目录写 `PIPELINE_NOTE.md` 说明缺什么、在哪里找过，登记为 pending。
2. **先看许可，再往仓库里放别人的文件。** 补充表、上游代码或数据文件进仓库之前先查许可：文章看 Crossref `https://api.crossref.org/works/<DOI>` 里 `message.license` 中 `content-version` 为 `vor` 的那条，代码仓库看 `gh api repos/<owner>/<repo> --jq .license.spdx_id`。CC BY、CC0、公有领域、MIT、BSD、Apache 可以复制，同时在 `THIRD_PARTY_NOTICES.md` 加一行出处（许可不是 MIT/BSD 时，把许可证文本放在文件旁边）。CC BY-NC-ND、订阅文章或没有许可证的仓库：只摘复现方法必需的系数、切点、名单这类事实数据，不复制正文、图或整份补充文件，并登记在 `THIRD_PARTY_NOTICES.md` 的「Factual extracts」表里。
3. **不编造任何数。** 常数、LOINC 编码、换算系数、合理范围、测试期望值都要有出处。测试的期望值只能来自论文印出的数字；系数四舍五入过就用容差，并在测试说明里写清。印出的常数复现不了论文自己的例子时，可以用论文印出的中间值（逐项得分、计算示例）反推更精确的常数，但必须用论文里没参与推导的其他印出数值（另一张表、另一个例子）核对到 2% 以内，并在 `references/contract.md` 写清推导和核对；做不到就保持 `draft`，写明差距。不要凭记忆或拟合第三方输出得出常数。
4. **目录**：`skills/<方法名>/`，名字按方法，不按论文。包含 `SKILL.md`、`skill.json`、`examples.md`、`references/`、`scripts/personal_report.py`、`scripts/presets.py`、`tests/`。`skillkit.py` 和 `paper_card.py` 由 `lsk build` 复制进来，不要手改。
5. **`skill.json`**（schema：`schema/skill.schema.json`，照 `skills/accelerated-biological-aging-risk/skill.json` 写）：
   - `tier`、`species`、`evidence`、`domains`、`blurb_zh`（普通人的叫法）、`intents`（从 `intents.json` 里选）、`triage.reason_zh`。
   - `paper`：规范化的 `doi`、`title`、`title_zh`、`journal`、`year`、`authors`、`article_url`、`supplements`、`summary_zh`（两句：研究做了什么；个人报告只算什么），`summary_status: "draft"`。
   - `entry`：脚本、测量文件参数和表头、`--age`、`--sex`、`--out`、`result_json: true`；依赖非标准库时写 `runtime` 和 `scripts/requirements.txt`。
   - `inputs`：每个输入的 `key`（带单位，如 `crp_mg_dl`）、`label_zh`、`aliases`（中英文化验单、设备上的叫法）、`loinc`（确定才写）、`unit`、`accept`（其他单位和精确换算系数，涉及摩尔换算写 `molar_mass`）、`range`（能抓出填错单位的合理范围，不是参考范围）、`unit_required`（常见错单位仍落在范围内时）、`required`、`from`（measurements、profile、argument、output）。
   - `outputs`：报告算出的每个数或分档。
   - 方法是一个人可以对着定目标的模型（风险方程、输入可改变的时钟）时，接受 `--targets` 并写 `out/levers.json`，`entry` 加 `targets_flag` 和 `levers_json: true`，照表型年龄技能写。
6. **脚本**：用 `skillkit` 按 `skill.json` 读输入；输入缺失或单位不对时写 `out/problems.json` 并以退出码 3 结束；成功时用 `skillkit.write_result` 写 `out/result.json`。报告是中文，开头是论文卡片，保留一句“边界”，不给剂量，不说开始或停用任何药物。
7. **测试**：`tests/test_manifest.py` 至少覆盖：清单和脚本用的输入一致；复现论文示例值；错单位和缺值被拒（退出码 3）。
8. 登记和检查（全部通过才算完成）：

```bash
python3 -m tools.lsk upsert-paper --doi <DOI> --tier A --outcome skill --skill <方法名> --title "<标题>" --journal "<期刊>" --year <年> --reason "<一句话>"
python3 -m tools.lsk build
python3 -m tools.lsk check
python3 -m tools.lsk test <方法名>
python3 -m tools.lsk test --changed origin/main
```

不要改别的技能，不要改 `schema/`、`tools/`、`data/biological_variation.json`。

### 3.6 B 类：证据条目和效应量

所有 B 类论文放在一个分支 `pipeline/<周>/evidence`：

- 往 `skills/longevity-evidence/data/claims.jsonl` 追加条目（schema：`schema/claim.schema.json`）。只抄论文正文、表格、补充材料里点名的实体，最多 200 条；`claim_zh` 一句中文，不写建议用语、剂量和数字；`source` 写明表号或“正文”。
- 随机试验或荟萃分析报告了某个干预对某个可测指标的平均效应和置信区间时，再往 `data/effects.jsonl` 追加（schema：`schema/effect.schema.json`）：
  - 数值照论文印出的抄，不换单位、不换算。`effect.kind`：同单位或百分比用 `mean_difference` / `percent_change`；按暴露单位（每减 1 kg）用 `per_unit` 并写 `per`；Cohen's d 或 SMD 用 `standardized`；按年的用 `rate`。
  - `quote` 是含这些数字的最短原文片段（400 字符以内）；`population` 用中文一句话；`marker_key` 用 `data/biological_variation.json` 里已有的键。
  - `verified` 一律写 `false`，不写 `verified_by`。由人对照原文核对后改成 `verified: true, verified_by: "person"`；插件只把 `verified: true` 的行当作对照。`lsk check` 会检查 `effect` 里的每个数（不计正负号）都出现在 `quote` 里，所以引文必须包含这些数字。
- 登记：`python3 -m tools.lsk upsert-paper --doi <DOI> --tier B --outcome evidence --title … --journal … --year … --reason …`
- 检查：`python3 -m tools.lsk check`。

### 3.7 C 类、待定和拒收

放在一个分支 `pipeline/<周>/index`，每篇一行登记：

```bash
python3 -m tools.lsk upsert-paper --doi <DOI> --tier C --outcome indexed --title … --journal … --year … --reason "<一句话>"
python3 -m tools.lsk upsert-paper --doi <DOI> --tier pending --outcome pending --reason "<为什么待定>"
python3 -m tools.lsk upsert-paper --doi <DOI> --tier rejected --outcome rejected --reason "<为什么拒收>"
```

### 3.8 提交和 pull request

- 只提交这篇论文相关的文件：A 类是 `skills/<方法名>/` 和 `registry/papers.jsonl`；B 类是 `claims.jsonl`、`data/effects.jsonl`、`registry/papers.jsonl`；C 类只有 `registry/papers.jsonl`。`catalog.json`、README 列表、`skills/_registry/` 由 CI 重建，不用提交，提交了也会被重建。
- 提交说明写为什么，例如 `Add <方法名> from <DOI>`，正文一句分级理由。不改 git 配置，不 amend，不提交密钥。
- `git push -u origin <分支>`，然后 `gh pr create --base main --label pipeline --title … --body …`（仓库里还没有 `pipeline` 标签时先 `gh label create pipeline`，或去掉 `--label`）。描述里写：论文和链接；分级和理由；个人需要的数据（data_type、accessibility）；产品合同三句话（用户提供什么、技能自己取什么、报告能说什么）；打开过的补充表；本地检查结果。检查没全过时开草稿 PR（`--draft`）并贴出失败输出。
- **项目 owner agent 在本地 `lsk check`（及 A 类相关测试）通过后可以直接推 `main`；也可用 pull request 提交便于审阅的批次。** A 类若走 PR，由人核对分级、系数出处、单位和范围后合并；B 类新增效应量需人核对并把 `verified` 改成 `true` 后才对插件生效；C 类在检查通过后可直接上 main 或经 PR 合并。自动化 weekly agent 默认仍可开 PR；owner 授权时可直推。
- 合并后 CI 会重建生成文件（`regenerate.yml`），每周一 02:00 UTC 发版（`release.yml`）。

### 3.9 周报

最后输出一份 Markdown：本周检索到几篇、去重后几篇；每篇的分级、data_type、理由；开了哪些 PR（链接、状态、检查是否通过）；哪些论文待定以及原因；需要人看的地方（草稿 PR、`draft` 技能、新增的未核对效应量）。

## 4. 硬性规则

- 不编造：没有出处的常数、编码、范围、示例值、效应量一律不写。找不到就写“没找到”，登记为 pending。
- 不给医疗建议：报告、证据条目、效应量里都不出现剂量，也不说开始、停止、加量、减量或换药。
- 不上传个人数据：你只处理公开论文。
- 不改 `data/biological_variation.json`、`schema/`、`tools/`、`.github/`，除非人明确要求。个体变异表的每个数都来自期刊论文，并在 `cvi_source.quote` 里附印着这个数的原文；不要从 EFLM 生物变异数据库（biologicalvariation.eu）复制任何数值，它的条款限制再发布，`lsk check` 会拒绝引用它的行。
- 仓库是公开的：不放个人数据、账号、token 和服务器地址，不复制论文正文和图。
- 检查通过后可由项目 owner agent 直接推 main；也可用 PR 提交便于审阅的批次。一次失败不要重试到通过为止：把失败原样写进 PR/周报或登记原因后继续下一篇。
- `lsk check` 报的每一行都要改掉，不要绕过或删测试。

## 5. 仓库地图

| 路径 | 是什么 |
| --- | --- |
| `skills/<名字>/` | 一个方法：`SKILL.md`、`skill.json`、脚本、测试 |
| `skills/longevity-evidence/data/claims.jsonl` | B 类证据条目 |
| `data/effects.jsonl` | 干预对指标的试验平均效应（人核对后 `verified: true`） |
| `data/biological_variation.json` | 个体内生物变异，用来判断变化是否超出正常波动（人维护） |
| `registry/papers.jsonl` | 所有处理过的论文，含待定和拒收 |
| `intents.json` | 用户问题的类别和对应技能 |
| `catalog.json` | 插件读取的总目录（CI 生成） |
| `schema/` | 各文件的 JSON Schema |
| `tools/lsk/` | 仓库工具：`check`、`test`、`build`、`upsert-paper`、`doi`、`crossref` 等 |
| `tools/skillkit/` | 技能脚本共用的输入检查（`build` 复制进每个技能） |
| `LICENSE`、`THIRD_PARTY_NOTICES.md` | 仓库自己的代码是 MIT；第三方文件和摘录的数据各自的许可和出处 |
