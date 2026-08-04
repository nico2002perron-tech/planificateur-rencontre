#!/usr/bin/env python
"""
Subset the 4 report fonts (Montserrat Bold/ExtraBold, Open Sans Regular/SemiBold)
to a French-Canadian financial-report glyph set and emit WOFF2.

Requires: fonttools >= 4.x and brotli    ->  pip install fonttools brotli

Usage:
    python build-fonts.py <src_ttf_dir> <out_dir> [--no-hinting]

--no-hinting drops the TrueType hinting programs. Saves ~40% of the output
bytes and is harmless for PDF embedding (PDF rasterizers ignore hinting), but
slightly degrades small-size rendering in browsers. Omitted by default.
"""
import os
import shutil
import subprocess
import sys
import tempfile

from fontTools.ttLib import TTFont

FONTS = [
    "Montserrat-Bold",
    "Montserrat-ExtraBold",
    "OpenSans-Regular",
    "OpenSans-SemiBold",
]

# --- Glyph coverage -------------------------------------------------------
# U+0020-007E  every printable ASCII char: A-Z a-z 0-9 and all ASCII
#              punctuation ( . , ; : ! ? ' " ( ) [ ] { } - / \ | * # & @
#              + = < > ~ ^ _ % $ )
# U+00A0       NO-BREAK SPACE
# U+00A2/A3/A9/AE/B0/B1/B7/D7  cent pound copyright registered degree
#                              plus-minus middot multiply
# U+00AB/00BB  French guillemets « »
# accented capitals + lowercase (French), U+0152/0153 Œ/œ, U+0178 Ÿ
# U+2007/2009/202F  figure space, thin space, NARROW NO-BREAK SPACE
# U+2013/2014  en dash, em dash
# U+2018/2019/201A/201C/201D/201E  curly single + double quotes
# U+2022/2026/2030  bullet, ellipsis, per-mille
# U+20AC       euro
# U+2190-2193  arrows (present in Montserrat only)
# U+2212       true minus
# U+2713       check mark (absent from BOTH families -- see report)
UNICODES = ",".join([
    "U+0020-007E",
    "U+00A0", "U+00A2", "U+00A3", "U+00A9", "U+00AB", "U+00AE", "U+00B0",
    "U+00B1", "U+00B7", "U+00BB",
    "U+00C0", "U+00C2", "U+00C4", "U+00C6", "U+00C7", "U+00C8-00CB",
    "U+00CE", "U+00CF", "U+00D4", "U+00D6", "U+00D7", "U+00D9", "U+00DB",
    "U+00DC",
    "U+00E0", "U+00E2", "U+00E4", "U+00E6", "U+00E7", "U+00E8-00EB",
    "U+00EE", "U+00EF", "U+00F4", "U+00F6", "U+00F9", "U+00FB", "U+00FC",
    "U+00FF",
    "U+0152", "U+0153", "U+0178",
    "U+2007", "U+2009", "U+2013", "U+2014",
    "U+2018", "U+2019", "U+201A", "U+201C", "U+201D", "U+201E",
    "U+2022", "U+2026", "U+202F", "U+2030", "U+20AC",
    "U+2190-2193", "U+2212", "U+2713",
])

# Keep kerning + cheap shaping. Drops small caps, fractions, ordinals,
# sub/superscripts, oldstyle/tabular figure alternates, stylistic sets.
LAYOUT_FEATURES = "kern,liga,clig,calt,ccmp,locl,mark,mkmk,rlig"

# U+202F NARROW NO-BREAK SPACE is in NONE of these 4 fonts. Alias it onto an
# existing narrow-space glyph so text using it does not render as tofu.
# Preference order; U+2009 THIN SPACE exists in all four.
ALIAS = {0x202F: [0x2009, 0x2008, 0x200A, 0x00A0, 0x0020]}


def patch_cmap(src, dst):
    """Copy src -> dst, adding cmap aliases for codepoints the font lacks."""
    font = TTFont(src)
    merged = {}
    for t in font["cmap"].tables:
        if t.isUnicode():
            merged.update(t.cmap)

    added = {}
    for target, sources in ALIAS.items():
        if target in merged:
            continue
        for s in sources:
            if s in merged:
                added[target] = merged[s]
                break

    if added:
        for t in font["cmap"].tables:
            if t.isUnicode():
                t.cmap.update(added)

    font.save(dst)
    font.close()
    return added


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    drop_hinting = "--no-hinting" in sys.argv
    src_dir, out_dir = args[0], args[1]

    os.makedirs(out_dir, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="fontsubset-")
    rows = []
    try:
        for base in FONTS:
            src = os.path.join(src_dir, base + ".ttf")
            patched = os.path.join(tmp, base + ".ttf")
            out = os.path.join(out_dir, base + ".woff2")

            added = patch_cmap(src, patched)

            cmd = [
                sys.executable, "-m", "fontTools.subset", patched,
                "--output-file=" + out,
                "--flavor=woff2",
                "--unicodes=" + UNICODES,
                "--layout-features=" + LAYOUT_FEATURES,
                "--name-IDs=1,2,3,4,5,6",
                "--drop-tables+=DSIG",
                "--ignore-missing-unicodes",
            ]
            if drop_hinting:
                cmd.append("--no-hinting")
            subprocess.run(cmd, check=True)

            before = os.path.getsize(src)
            after = os.path.getsize(out)
            with open(out, "rb") as fh:
                magic = fh.read(4)
            rows.append((base, before, after, magic))
            print(f"  {base:24s} {before/1024:7.1f} KB -> {after/1024:5.2f} KB "
                  f"({100 - after*100/before:.1f}% saved)  {magic!r}"
                  f"{'  [aliased U+202F]' if added else ''}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    total = sum(r[2] for r in rows)
    print(f"\n  TOTAL {total/1024:.2f} KB "
          f"({'PASS' if total < 200*1024 else 'FAIL'} vs 200 KB budget)"
          f"{'  [hinting dropped]' if drop_hinting else ''}")
    assert all(r[3] == b"wOF2" for r in rows), "bad woff2 magic!"


if __name__ == "__main__":
    main()
