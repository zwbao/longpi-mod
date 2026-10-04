---
name: grainyhead-drug-inducible-lifespan
description: >-
  Lists the three GRHL1-linked compounds whose worm lifespan gain exceeded 10 percent in Grigolon et al., Nature Communications 2022. It does not rank the rest of the 2560-compound screen. Use when the user mentions GRHL1, Grainyhead, vorinostat, papaverine, or piperlongumine in this paper. A missing medicine is not a reason to stop.
---

# 线虫寿命试验里的化合物

这次不把你的测量算成寿命。名单是 vorinostat 伏立诺他、papaverine 罂粟碱、piperlongumine 荜茇酰胺。寿命变化是论文在线虫里的结果，不是你的结局，也不能据此开始服用。

不要向用户要筛选库或 PDF。不要另造化合物权重。现用药对不上时写「不能据此停」。体检不增删这三个化合物。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 50 \
  --out out
```

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
