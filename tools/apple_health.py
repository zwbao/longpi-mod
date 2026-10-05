#!/usr/bin/env python3
"""Apple Health export -> daily wearable values for LongPi's record (date,name,value,unit CSV).

Reads export.zip, export.xml or the unzipped apple_health_export folder with the standard library only
(Python 3.9+), streaming the XML so a large export does not fill memory. Per day:

  dailySteps         steps (the busiest source of the day, so iPhone and Watch are not added together)
  restingHeartRate   mean resting heart rate, count/min
  hrv                mean heart rate variability (SDNN), ms
  sleepDuration      hours asleep, counted on the morning the night ends
  spo2Min            lowest blood oxygen, %
  activeEnergy       active energy, kcal (busiest source)
  vo2Max             mL/kg/min
  bodyMass           kg (the day's last reading)
  systolicPressures / diastolicPressures   the day's mean, mmHg

Usage: apple_health.py EXPORT [--days 365] [--out FILE]
"""

import argparse
import csv
import io
import os
import sys
import zipfile
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from xml.etree.ElementTree import iterparse

SUM = {
    "HKQuantityTypeIdentifierStepCount": ("dailySteps", "count"),
    "HKQuantityTypeIdentifierActiveEnergyBurned": ("activeEnergy", "kcal"),
}
MEAN = {
    "HKQuantityTypeIdentifierRestingHeartRate": ("restingHeartRate", "count/min"),
    "HKQuantityTypeIdentifierHeartRateVariabilitySDNN": ("hrv", "ms"),
    "HKQuantityTypeIdentifierVO2Max": ("vo2Max", "mL/kg/min"),
    "HKQuantityTypeIdentifierBloodPressureSystolic": ("systolicPressures", "mmHg"),
    "HKQuantityTypeIdentifierBloodPressureDiastolic": ("diastolicPressures", "mmHg"),
}
MIN = {"HKQuantityTypeIdentifierOxygenSaturation": ("spo2Min", "%")}
LAST = {"HKQuantityTypeIdentifierBodyMass": ("bodyMass", "kg")}
SLEEP = "HKCategoryTypeIdentifierSleepAnalysis"
ASLEEP = ("HKCategoryValueSleepAnalysisAsleep", "HKCategoryValueSleepAnalysisAsleepUnspecified",
          "HKCategoryValueSleepAnalysisAsleepCore", "HKCategoryValueSleepAnalysisAsleepDeep",
          "HKCategoryValueSleepAnalysisAsleepREM")


def main_xml(names):
    """The export's main file: export.xml in English, 导出.xml in Chinese and other names elsewhere; never the
    clinical-records (cda) file or the workout routes. The largest remaining .xml wins."""
    xmls = [n for n in names if n.lower().endswith(".xml") and "cda" not in os.path.basename(n).lower()
            and "/workout-routes/" not in n.replace("\\", "/") and "/electrocardiograms/" not in n.replace("\\", "/")]
    english = [n for n in xmls if os.path.basename(n).lower() == "export.xml"]
    return english or xmls


def open_export(path):
    if os.path.isdir(path):
        found = []
        for root, _dirs, files in os.walk(path):
            for f in files:
                full = os.path.join(root, f)
                found.append(full)
        picks = main_xml(found)
        if not picks:
            raise SystemExit("这个文件夹里没有健康数据文件：请给出 Apple 健康导出的 zip（export.zip 或 导出.zip）或解压后的文件夹。")
        return open(max(picks, key=os.path.getsize), "rb")
    if path.lower().endswith(".zip"):
        archive = zipfile.ZipFile(path)
        picks = main_xml(archive.namelist())
        if not picks:
            raise SystemExit("压缩包里没有健康数据文件（export.xml 或 导出.xml）。")
        return archive.open(max(picks, key=lambda n: archive.getinfo(n).file_size))
    return open(path, "rb")


def when(text):
    # 2026-09-30 07:12:44 +0800
    return datetime.strptime(text, "%Y-%m-%d %H:%M:%S %z")


def number(text):
    try:
        return float(text)
    except (TypeError, ValueError):
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("export")
    parser.add_argument("--days", type=int, default=365)
    parser.add_argument("--out", default="")
    args = parser.parse_args()

    since = (datetime.now(timezone.utc) - timedelta(days=args.days)).date()
    sums = defaultdict(lambda: defaultdict(float))       # (name, day) -> source -> total
    means = defaultdict(list)                            # (name, day) -> values
    mins = {}                                            # (name, day) -> value
    lasts = {}                                           # (name, day) -> (time, value)
    sleep = defaultdict(lambda: defaultdict(float))      # day -> source -> hours
    units = {}
    seen = 0

    with open_export(args.export) as stream:
        for _event, el in iterparse(stream, events=("end",)):
            if el.tag != "Record":
                if el.tag in ("Workout", "ActivitySummary", "ClinicalRecord", "Correlation"):
                    el.clear()
                continue
            kind = el.get("type", "")
            try:
                if kind == SLEEP:
                    if el.get("value") in ASLEEP:
                        start, end = when(el.get("startDate")), when(el.get("endDate"))
                        day = end.date()
                        if day >= since:
                            sleep[day][el.get("sourceName", "")] += (end - start).total_seconds() / 3600
                elif kind in SUM or kind in MEAN or kind in MIN or kind in LAST:
                    start = when(el.get("startDate"))
                    day = start.date()
                    value = number(el.get("value"))
                    if day < since or value is None:
                        continue
                    unit = el.get("unit", "")
                    if kind in SUM:
                        name, out_unit = SUM[kind]
                        if kind.endswith("ActiveEnergyBurned") and unit == "kJ":
                            value /= 4.184
                        sums[(name, day)][el.get("sourceName", "")] += value
                    elif kind in MEAN:
                        name, out_unit = MEAN[kind]
                        means[(name, day)].append(value)
                    elif kind in MIN:
                        name, out_unit = MIN[kind]
                        if value <= 1:
                            value *= 100
                        mins[(name, day)] = min(value, mins.get((name, day), value))
                    else:
                        name, out_unit = LAST[kind]
                        if unit == "lb":
                            value *= 0.45359237
                        held = lasts.get((name, day))
                        if not held or start >= held[0]:
                            lasts[(name, day)] = (start, value)
                    units[name] = out_unit
                    seen += 1
            finally:
                el.clear()

    rows = []
    for (name, day), by_source in sums.items():
        rows.append((day, name, round(max(by_source.values())), units[name]))
    for (name, day), values in means.items():
        rows.append((day, name, round(sum(values) / len(values), 1), units[name]))
    for (name, day), value in mins.items():
        rows.append((day, name, round(value, 1), units[name]))
    for (name, day), (_t, value) in lasts.items():
        rows.append((day, name, round(value, 1), units[name]))
    for day, by_source in sleep.items():
        hours = max(by_source.values())
        if 0.5 <= hours <= 16:
            rows.append((day, "sleepDuration", round(hours, 2), "h"))
    rows.sort()

    out = open(args.out, "w", newline="", encoding="utf-8") if args.out else io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", newline="")
    writer = csv.writer(out)
    writer.writerow(["date", "name", "value", "unit"])
    for day, name, value, unit in rows:
        writer.writerow([day.isoformat(), name, value, unit])
    out.flush()
    if args.out:
        out.close()
    days = len({row[0] for row in rows})
    print(f"{len(rows)} values over {days} days from {seen} records", file=sys.stderr)


if __name__ == "__main__":
    main()
