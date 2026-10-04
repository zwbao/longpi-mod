# 论文、仓库、另一套同名东西

Wang 等，Nature Aging（2025），doi:10.1038/s43587-025-01016-8。全文读自 EuropePMC PMC12823432。

| | 内容 |
| --- | --- |
| 论文声称 | UK Biobank n = 43,616，训练 30,536，70:30。Olink 2,916 个蛋白，418 个（14.3%）至少在一个器官富集；脑 117，免疫 109。全身时钟 240 个蛋白，器官时钟从心脏 5 个到免疫 76 个。测试集全身 r = 0.94，脑 r = 0.78。CKB n = 3,977，NHS n = 800。摘要写跨队列 r = 0.98 和 0.93，正文没有把这两个数分配到哪一对队列。年龄差是蛋白质年龄对实足年龄回归的残差。极端年龄型是至少一个器官的年龄差越过 ±1.5 个标准差。实足年龄是天数除以 365.25。 |
| 代码实际算 | `41way5/Organ-PAC` 的 `Organ model training.py` 用 LightGBM、Optuna 和 BoostBoruta（`max_iter=200`，`perc=100`），`train_test_split(..., test_size=0.3, random_state=1996)`。器官循环是 Brain、Heart、Lung、Immune、Artery、Intestine、Liver、Muscle、Pancreas、Kidney。年龄差是预测年龄减去 `linregress` 的斜率乘实足年龄再加截距。pickle 写到字面路径 `file_name`，克隆件里没有模型，也没有 `orgain_spec` 蛋白表。 |
| 同名的另一套 | Oh 等的 `organageUKB` 是 LASSO 器官年龄，不是这个 LightGBM。本仓库的 R 脚本读的是本地预测表，不是可调用的权重。 |

这次核对：Supplementary Table 4 是各器官时钟的蛋白名单（心脏 5 个，全身 240 个），Table 3 有可读蛋白名。没有 LightGBM 权重。个人能做的是蛋白对名单，以及已给出的 z 是否越过 1.5 个标准差。
