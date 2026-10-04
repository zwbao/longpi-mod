# 论文、仓库、另一套同名东西

Cui 等，Nature Aging（2025），doi:10.1038/s43587-025-00824-2。全文读自 EuropePMC PMC12003174。方法仓库 https://github.com/JingtaoLab/Testicular_Aging 已克隆到 /tmp/paper-code/p85。CellChat 没有当作本方法克隆。

| | 内容 |
| --- | --- |
| 论文声称 | 35 名供体、214,369 个细胞，年龄 21 到 69。分组：20多岁 3、30多岁 4、40多岁 10、50多岁 8、60多岁 10。30多岁管周细胞出现细胞外基质和 Notch 变化。50多岁莱迪希细胞类固醇代谢改变，巨噬细胞免疫反应改变。图六c：大于 45 岁且体质指数至少 30 与生育力风险有关。图六d：体质指数与年龄的交互尤其在 40 岁及以后。 |
| 代码实际算 | 笔记本 `4_xgbc_param_test.ipynb` 搜索 XGBClassifier，网格含 max_depth 5、n_estimators 8000、learning_rate 0.03 或 0.05。没有保存的模型。本技能不用这组超参预测年龄，只做上述分组对照。 |
| 同名的另一套 | https://github.com/sqjin/CellChat 是细胞通讯工具，不是这个年龄图谱。 |
