# 论文、代码、另一套同名东西

Immunity（2024），doi:10.1016/j.immuni.2024.08.019。全文来自 Europe PMC PMC13138122。JSON 的 github 为空。方法节把阈值写在 https://github.com/JetBrains-Research/cd38-in-cd8-cd4-naive-cytek ，克隆在 /tmp/paper-code/p57。

| | 内容 |
| --- | --- |
| 论文声称 | CD38 高表达标记 CD8 和 CD4 的近期胸腺迁出细胞，转录上是 SOX4、IKZF2、TOX。158 人、年龄 25 到 85 岁，分成 25–34、35–44、45–54、55–64、>64 岁，每组 21–45 人。正文没有写出每一组的人数。两条共同老化轴是 CD38++ 下降、CXCR3 hi 上升；CD4 另有 CD25 lo 上升。初始 CD8 比例随年龄下降，初始 CD4 比例不变。年轻 <35 岁，年老 >64 岁。 |
| 代码实际算 | `visualization.qmd` 的阈值：CD8 的 CxCR3 1.5、CD38 2.2、CD25 0.75、PTK7 0.85；CD4 的 CxCR3 0.55、CD38 2.75、CD25 0.7、PTK7 0.9。赋值循环是 `rev(threshold_selected_features)`，后写覆盖先写，所以 CXCR3 优先于 CD38，CD38 优先于 CD25。表达高于阈值才标成阳性。 |
| 同名的另一套 | 把 CD38 当作浆细胞或血液肿瘤治疗靶点的方案。那不是这套初始 T 细胞门控。 |

正文把 CD25 那一步称为 CD25 lo，仓库把高于阈值的细胞标成 CD25+。报告跟随仓库的大于号，并在句子里保留正文的叫法。PTK7 阈值在仓库里，但不进入这三条老化轴的顺序。
