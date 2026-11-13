#!/usr/bin/env python3
"""Extract Bahra catalogue tables into app/src/main/assets/data-bahra.js.

Usage: extract_bahra.py <dir with `pdftotext -layout` output of Low_Voltage.pdf,
BahraTBS_Busway_AE.pdf and AlBuswayCat-LoRes.pdf> <output js>
The PDFs are not kept in the repo (see docs/REFERENCES.md).
"""
import json, re, sys

src, out = sys.argv[1], sys.argv[2]
lv = open(f"{src}/Low_Voltage.txt", encoding="utf-8").read().split("\n")
NUM = r"-|\d+(?:\.\d+)?"


def table(n, ncols):
    """Rows of current-rating table n: lists of ncols values (None for '-')."""
    start = next(i for i, l in enumerate(lv) if re.match(rf"\s*Table {n} :", l))
    rows = []
    for l in lv[start + 1:]:
        if re.match(r"\s*Table \d+ ?:", l) or "VOLTAGE DROP" in l:
            break
        t = l.split()
        if len(t) == ncols and all(re.fullmatch(NUM, x) for x in t):
            rows.append([None if x == "-" else float(x) for x in t])
    return rows


def dims(type_, title):
    """Overall diameter by size from the dimension page of `type_` titled `title`."""
    od = {}
    for i, l in enumerate(lv):
        if l.strip() != type_:
            continue
        j = i + 1
        while j < i + 16 and lv[j].strip() != title and title not in lv[j].split("  "):
            j += 1
        if j >= i + 16 or not re.search(rf"(^|\s{{2,}}){re.escape(title)}\s*$", lv[j]):
            continue
        for l2 in lv[j + 1:j + 60]:
            m = re.match(r"\s*\d{8}\s+(\d+(?:\.\d+)?)\s?(?:rmc|smc|rm|sm|re)\b(.*)", l2)
            if m:
                nums = re.findall(r"\d+(?:\.\d+)?", re.sub(r"/\d+", "", m.group(2)))
                # ... thicknesses ..., overall diameter, weight, drum
                od[float(m.group(1))] = float(nums[-3])
            elif od and re.match(r"\s*\d{1,3}\s*$", l2):
                break
        if od:
            return od
    raise SystemExit(f"no dimension table for {type_} / {title}")


def rows(tn, ncols, pick, type_, title):
    """[S, Rdc20, Rac, I ground, I duct, I air, OD]"""
    od = dims(type_, title)
    res = []
    for r in table(tn, ncols):
        vals = [r[k] for k in pick]
        if any(v is None for v in vals) or r[0] not in od:
            continue
        res.append([r[0], r[1]] + vals + [od[r[0]]])
    return res


# single core tables: S, Rdc, Rac flat, Rac trefoil, gnd flat, gnd trefoil, duct, air flat, air trefoil, pipes
# multicore tables:   S, Rdc, Rac, gnd, duct, gnd armoured, air, pipes, air armoured
CABLES = {
    "b_cuX4": dict(label="Cu/XLPE/PVC — 4 قلوب", mat="Cu", ins="XLPE", core="multi", src="Bahra LV, Table 21",
                   rows=rows(21, 9, (2, 3, 4, 6), "CU/XLPE/PVC", "Four cores")),
    "b_cuX4a": dict(label="Cu/XLPE/SWA/PVC — 4 قلوب مسلح", mat="Cu", ins="XLPE", core="multi", src="Bahra LV, Table 21 (Armoured)",
                    rows=rows(21, 9, (2, 5, 4, 8), "CU/XLPE/SWA/PVC", "Four cores")),
    "b_cuP4": dict(label="Cu/PVC/PVC — 4 قلوب", mat="Cu", ins="PVC", core="multi", src="Bahra LV, Table 19",
                   rows=rows(19, 9, (2, 3, 4, 6), "CU/PVC/PVC", "Four cores")),
    "b_cuP4a": dict(label="Cu/PVC/SWA/PVC — 4 قلوب مسلح", mat="Cu", ins="PVC", core="multi", src="Bahra LV, Table 19 (Armoured)",
                    rows=rows(19, 9, (2, 5, 4, 8), "CU/PVC/SWA/PVC", "Four cores")),
    "b_alX4": dict(label="Al/XLPE/PVC — 4 قلوب", mat="Al", ins="XLPE", core="multi", src="Bahra LV, Table 23",
                   rows=rows(23, 9, (2, 3, 4, 6), "AL/XLPE/PVC", "Four cores")),
    "b_alX4a": dict(label="Al/XLPE/SWA/PVC — 4 قلوب مسلح", mat="Al", ins="XLPE", core="multi", src="Bahra LV, Table 23 (Armoured)",
                    rows=rows(23, 9, (2, 5, 4, 8), "AL/XLPE/SWA/PVC", "Four cores")),
    "b_cuX1": dict(label="Cu/XLPE/PVC — مفرد Trefoil (3×1C)", mat="Cu", ins="XLPE", core="single", src="Bahra LV, Table 20",
                   rows=rows(20, 10, (3, 5, 6, 8), "CU/XLPE/PVC", "Single core")),
    "b_cuP1": dict(label="Cu/PVC/PVC — مفرد Trefoil (3×1C)", mat="Cu", ins="PVC", core="single", src="Bahra LV, Table 18",
                   rows=rows(18, 10, (3, 5, 6, 8), "CU/PVC/PVC", "Single core")),
    "b_alX1": dict(label="Al/XLPE/PVC — مفرد Trefoil (3×1C)", mat="Al", ins="XLPE", core="single", src="Bahra LV, Table 22",
                   rows=rows(22, 10, (3, 5, 6, 8), "AL/XLPE/PVC", "Single core")),
}
# Armoured types: tables 19/21/23 give armoured ratings for direct-laid and free air only;
# the duct rating is the unarmoured column of the same table.
for k, c in CABLES.items():
    c["mfr"] = "bahra"
    assert len(c["rows"]) >= 10, (k, len(c["rows"]))


def busway(path, title, stop):
    L = open(path, encoding="utf-8").read().replace("ﬆ", "st").split("\n")
    s = next(i for i, l in enumerate(L) if title in l)
    blk = L[s:s + 60]
    def row(key, cast=float):
        for l in blk:
            norm = re.sub(r"(?<=\w) (?=\w\b)|(?<=\b\w) (?=\w)", "", l)
            if key.lower() in norm.lower().replace(" ", "") or key.lower() in l.lower().replace(" ", ""):
                tail = l.split("]")[-1] if "]" in l else l
                tail = re.sub(r"\(0\.5s\)|rms", "", tail)
                vals = re.findall(r"NA|\d+x\d+|\d+(?:\.\d+)?", tail)
                return [None if v == "NA" else (v if "x" in v else cast(v)) for v in vals]
        raise SystemExit(f"{path}: row {key} not found")
    In = row("Ratedcurrent", int)
    data = dict(In=In, dim=row("Overalldimension", str), Icw=row("Ratedshort-timecurrent(1s)"),
                R20=row("resistanceat20"), X=row("Averagephasereactance"),
                R=row("resistanceatthermal"))
    for k, v in data.items():
        assert len(v) == len(In), (path, k, len(v), len(In))
    return data


BUSWAY = {
    "tbs_cu": dict(label="Bahra TBS Compact AE — نحاس 4 موصلات", mat="Cu", src="Bahra TBS Compact Busways AE, Technical Data (4 Conductors)",
                   **busway(f"{src}/BahraTBS_Busway_AE.txt", "Compact Busway Rating - 4 Conductors", None)),
    "tbs_al": dict(label="Bahra TBS SCB-AN — ألومنيوم 4 موصلات", mat="Al", src="Bahra TBS Super Compact Busway Al (SCB-AN 4C 50Hz)",
                   **busway(f"{src}/AlBuswayCat-LoRes.txt", "SCB AN - 4C - 50Hz", None)),
}

with open(out, "w", encoding="utf-8") as f:
    f.write("/* GENERATED by tools/extract_bahra.py from the Bahra catalogues — do not edit by hand.\n"
            "   cable row = [S mm², Rdc20 Ω/km, Rac(op, trefoil for 1C) Ω/km, I ground A, I duct A, I air A, OD mm]\n"
            "   busway: R20/X/R(thermal) in mΩ/m, Icw in kA (1 s) */\n")
    f.write("const BAHRA_CABLES=" + json.dumps(CABLES, ensure_ascii=False, separators=(",", ":")) + ";\n")
    f.write("const BUSWAY=" + json.dumps(BUSWAY, ensure_ascii=False, separators=(",", ":")) + ";\n")
print({k: len(c["rows"]) for k, c in CABLES.items()})
for k, b in BUSWAY.items():
    print(k, b["In"], b["R"], b["X"], b["Icw"], b["dim"])
