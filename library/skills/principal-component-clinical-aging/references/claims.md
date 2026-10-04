# 论文、脚本、另一个项目

## 论文声称

训练队列是 NHANES IV 1999–2000，40–84 岁，男性 923 人、女性 852 人；测试队列是 2001–2002，男性 1094 人、女性 942 人（Results，Methods）。前 18 个主成分解释训练数据 99% 的方差（Results，Methods）。PCAge 把风险比换成 Gompertz 年龄差：Δage = ln(hpc/h0) / (ln(2) · MRDTsex)，BA = CA + Δage（Methods）。LinAge 用 61 个参数，权重在 Supplementary Table 7，正文给出的是 LinAge(X) = βCA·CA + Σ βi·Xz_i + C0，标准化用健康衰老簇的中位数和 MAD（Methods）。Fig. 6c，测试队列 20 年死亡：PCAge 的 AUC 是 0.8643，LinAge 是 0.8655，两者无显著差别；ASCVD 是 0.7594；ChronAge 是 0.8289；CFS 是 0.6585；PhenoAge 是 0.8474。Fig. 6d：NHANES III 上 LinAge 的 AUC 是 0.8741，ChronAge 是 0.8590。Fig. 7：CALinAge 的 AUC 是 0.8282，同一年龄范围的实足年龄 AUC 是 0.7910。Fig. 6a：LinAge 与 PCAge 的 PCC 是 0.92（n = 2036）。Fig. 6b：男性 LinAge 与实足年龄的 PCC 是 0.79（n = 715），女性是 0.87（n = 819）。可替宁分档、22 项并存病指数、自评健康公式和就医使用指数（HUQ050 的编码）都在 Methods。微量白蛋白尿引用的尿白蛋白肌酐比分界是 ≥30 mg/g。

## 代码实际计算

论文写代码在 Supplementary Information 的 R 压缩包里，JSON 没有给出 GitHub。本技能没有假装那个压缩包在本地。脚本计算 Methods 里写全了的四件东西：可替宁分档、并存病计数除以 22、自评健康指数，以及用户给出的 HUQ050 编码。它不把就诊次数重编码，因为正文没有印出编码表。它不计算 LinAge 或 PCAge 的岁数，因为 β、hpc、h0、MRDT 和健康簇的中位数、MAD 不在读到的正文里。

## 同名的另一个项目

PhenoAge、ASCVD 和 CFS 是文中用来对照的别的分数，不是 PCAge。Nakamura 等较早的主成分生物年龄也不是这份 NHANES 时钟。不要把那些分数写进这份报告。
