"""Build the Gina variable font (+ static instances) from glyphs.py.

    pip install fonttools skia-pathops brotli
    python build.py            # writes ../GinaVF.ttf, ../static/*.ttf, ../web/*.woff2

Axes
  wght 300..800  stroke weight
  wdth  90..115  90 = "Birlik" (parent: calm, squarer, tighter)
                115 = "Kesif"  (child: wider, rounder, taller x-height,
                                looser spacing, single-storey a)
Every glyph is a set of stroked centerlines; each stroke becomes its own
overlapping contour with a fixed point count, so all masters interpolate.
"""

import math
import os
import sys

from fontTools.designspaceLib import (AxisDescriptor, DesignSpaceDocument, InstanceDescriptor,
                                      RuleDescriptor, SourceDescriptor)
from fontTools.fontBuilder import FontBuilder
from fontTools.otlLib.builder import buildStatTable
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import flagOverlapSimple
from fontTools import varLib
from fontTools.varLib import instancer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import glyphs as G  # noqa: E402

S_STEM = G.S

OUT = os.path.normpath(os.path.join(HERE, ".."))
BUILD = os.path.join(HERE, "build")

VERSION = "0.1"


def params(wght, wdth):
    t = (wght - 300) / 500.0
    u = (wdth - 90) / 25.0
    vw = 56 + t * (166 - 56)
    return dict(
        vw=vw,
        hw=vw * (0.80 + 0.08 * u),     # Kesif has less contrast (friendlier)
        xh=522 + 22 * u,               # Kesif: taller x-height, bigger counters
        cap=700, asc=760, desc=-230, o=12,
        wx=1.01 + 0.14 * u,            # horizontal stretch of the skeleton
        sq=2.55 - 0.45 * u,            # bowl superellipse: squarer -> rounder
        sbs=1.08 + 0.18 * u,            # spacing
    )


# ---------------------------------------------------------------------------
# stroke expansion
# ---------------------------------------------------------------------------

def _smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def _norm(x, y):
    d = math.hypot(x, y) or 1e-9
    return x / d, y / d


def expand(stroke, p, wx):
    pts = [(x * wx, y) for x, y in stroke["pts"]]
    n = len(pts)
    closed = stroke["closed"]
    vw, hw = p["vw"], p["hw"]

    def P(i):
        return pts[i % n] if closed else pts[max(0, min(n - 1, i))]

    # arc length
    acc = [0.0]
    for i in range(1, n):
        acc.append(acc[-1] + math.dist(pts[i - 1], pts[i]))
    total = acc[-1] or 1.0

    tang, half_l, half_r = [], [], []
    for i in range(n):
        a, b = P(i - 1), P(i + 1)
        if not closed and i == 0:
            a = pts[0]
        if not closed and i == n - 1:
            b = pts[-1]
        tx, ty = _norm(b[0] - a[0], b[1] - a[1])
        tang.append((tx, ty))
        w = hw + (vw - hw) * abs(ty) ** 1.2
        w *= stroke["m"]
        if not closed:
            u = acc[i] / total
            if stroke["s"] != 1.0 and u < stroke["sl"]:
                w *= stroke["s"] + (1 - stroke["s"]) * _smooth(u / stroke["sl"])
            if stroke["e"] != 1.0 and u > 1 - stroke["el"]:
                w *= stroke["e"] + (1 - stroke["e"]) * _smooth((1 - u) / stroke["el"])
        hl = hr = w / 2
        # keep the inner side of tight curves from folding over itself
        if closed or 0 < i < n - 1:
            p0, p1, p2 = P(i - 1), P(i), P(i + 1)
            ax, ay = p1[0] - p0[0], p1[1] - p0[1]
            bx, by = p2[0] - p1[0], p2[1] - p1[1]
            cr = ax * by - ay * bx
            la, lb, lc = math.hypot(ax, ay), math.hypot(bx, by), math.dist(p0, p2)
            if la * lb * lc > 1e-6 and abs(cr) > 1e-9:
                radius = (la * lb * lc) / (2 * abs(cr))
                lim = 0.9 * radius
                if cr > 0:
                    hl = min(hl, lim)
                else:
                    hr = min(hr, lim)
        half_l.append(hl)
        half_r.append(hr)

    # smooth the curvature limits so inner edges stay calm
    for arr in (half_l, half_r):
        src = list(arr)
        for i in range(n):
            if not closed and (i == 0 or i == n - 1):
                continue
            nb = [src[(i + d) % n] if closed else src[max(0, min(n - 1, i + d))] for d in (-2, -1, 0, 1, 2)]
            arr[i] = min(src[i], sum(nb) / 5 + 0.15 * (src[i] - min(nb)))
    left = [(x - ty * hl, y + tx * hl) for (x, y), (tx, ty), hl in zip(pts, tang, half_l)]
    right = [(x + ty * hr, y - tx * hr) for (x, y), (tx, ty), hr in zip(pts, tang, half_r)]

    left, right = _untangle(left, tang, closed), _untangle(right, tang, closed)

    if closed:
        return [[(q, False) for q in left], [(q, False) for q in right]]

    def cap(c, t, r, start):
        tx, ty = t
        nx, ny = -ty, tx
        out = []
        k = 1 / math.cos(math.radians(22.5))
        for j in range(1, 8):
            th = math.radians(22.5 * j)
            rr = r * (k if j % 2 else 1)
            ct, sn = math.cos(th), math.sin(th)
            if not start:   # from left(+n) round the front (+t) to right(-n)
                dx, dy = ct * nx + sn * tx, ct * ny + sn * ty
            else:           # from right(-n) round the back (-t) to left(+n)
                dx, dy = -ct * nx - sn * tx, -ct * ny - sn * ty
            out.append(((c[0] + rr * dx, c[1] + rr * dy), j % 2 == 0))
        return out

    r_end = (half_l[-1] + half_r[-1]) / 2
    r_beg = (half_l[0] + half_r[0]) / 2
    c = []
    c.append((left[0], True))
    c += [(q, False) for q in left[1:-1]]
    c.append((left[-1], True))
    c += cap(pts[-1], tang[-1], r_end, False)
    c.append((right[-1], True))
    c += [(q, False) for q in reversed(right[1:-1])]
    c.append((right[0], True))
    c += cap(pts[0], tang[0], r_beg, True)
    return [c]


def _untangle(side, tang, closed):
    """replace offset points that run backwards (inner side of tight curves)
    by interpolating between the neighbours that still move forward."""
    n = len(side)
    for _ in range(3):
        bad = [False] * n
        for i in range(1, n - 1) if not closed else range(n):
            a, b = side[i - 1], side[i]
            if (b[0] - a[0]) * tang[i][0] + (b[1] - a[1]) * tang[i][1] < 0.5:
                bad[i] = True
        if not any(bad):
            break
        out = list(side)
        i = 0
        while i < n:
            if bad[i]:
                j = i
                while j < n and bad[j]:
                    j += 1
                lo, hi = (i - 2) % n if closed else max(0, i - 2), j % n if closed else min(n - 1, j)
                cnt = (j - i) + 2
                for t, idx in enumerate(range(i - 1, j)):
                    f = (t + 1) / (cnt + 1) if cnt else 0.5
                    out[idx % n] = (side[lo][0] + (side[hi][0] - side[lo][0]) * f,
                                    side[lo][1] + (side[hi][1] - side[lo][1]) * f)
                i = j
            else:
                i += 1
        side = out
    return side


def dot_contour(x, y, r):
    c = []
    k = 1 / math.cos(math.radians(22.5))
    for j in range(16):
        th = math.radians(22.5 * j)
        rr = r * (k if j % 2 else 1)
        c.append(((x + rr * math.cos(th), y + rr * math.sin(th)), j % 2 == 0))
    return c


def area(c):
    s = 0.0
    for i in range(len(c)):
        (x0, y0), _ = c[i]
        (x1, y1), _ = c[(i + 1) % len(c)]
        s += x0 * y1 - x1 * y0
    return s / 2


def draw_glyph(fn, p):
    k = G.K(p)
    fn(k)
    wx = p["wx"]
    contours = []
    for st in k.strokes:
        cs = expand(st, p, wx)
        if len(cs) == 2:      # closed ring: outer clockwise, inner counter-clockwise
            a0, a1 = area(cs[0]), area(cs[1])
            outer, inner = (cs[0], cs[1]) if abs(a0) >= abs(a1) else (cs[1], cs[0])
            if area(outer) > 0:
                outer = outer[::-1]
            if area(inner) < 0:
                inner = inner[::-1]
            contours += [outer, inner]
        else:
            c = cs[0]
            if area(c) > 0:
                c = c[::-1]
            contours.append(c)
    for x, y, r in k.dots:
        c = dot_contour(x * wx, y, r)
        contours.append(c[::-1])
    return k, contours


def place(k, contours, p):
    wx = p["wx"]
    xs = [q[0] for c in contours for q, _ in c]
    if getattr(k, "fixed_width", None):
        adv = k.fixed_width * wx
        if xs:
            w = max(xs) - min(xs)
            adv = max(adv, w + 60)
            shift = (adv - w) / 2 - min(xs)
        else:
            shift = 0
        return shift, int(round(adv))
    lsb, rsb = (s * p["sbs"] for s in k.sb)
    if hasattr(k, "lsb_from_stem"):  # j: hook tucks under the previous letter
        shift = (S_STEM * p["sbs"]) + p["vw"] / 2
        return shift, int(round(max(xs) + shift + rsb))
    shift = lsb - min(xs)
    adv = max(xs) - min(xs) + lsb + rsb
    return shift, int(round(adv))


def to_ttglyph(contours, shift):
    pen = TTGlyphPen(None)
    for c in contours:
        c = [((x + shift, y), on) for (x, y), on in c]
        ons = [i for i, (_, on) in enumerate(c) if on]
        if not ons:
            pen.qCurveTo(*[q for q, _ in c], None)
            pen.closePath()
            continue
        st = ons[0]
        c = c[st:] + c[:st]
        pen.moveTo(c[0][0])
        offs = []
        for q, on in c[1:] + [c[0]]:
            if on:
                if offs:
                    pen.qCurveTo(*offs, q)
                else:
                    pen.lineTo(q)
                offs = []
            else:
                offs.append(q)
        pen.closePath()
    g = pen.glyph(dropImpliedOnCurves=False)
    if g.numberOfContours > 0:
        g.flags[0] |= flagOverlapSimple
    return g


FEA = """
languagesystem DFLT dflt;
languagesystem latn dflt;
languagesystem latn TRK;
feature ss01 {
  featureNames { name "Okul a"; };
  sub a by a.ss01;
} ss01;
"""


def build_master(wght, wdth, path):
    p = params(wght, wdth)
    order = [n for n, _, _ in G.GLYPHS]
    cmap = {u: n for n, u, _ in G.GLYPHS if u is not None}
    glyf, metrics = {}, {}
    for name, _, fn in G.GLYPHS:
        k, contours = draw_glyph(fn, p)
        if contours:
            shift, adv = place(k, contours, p)
        else:
            shift, adv = 0, int(round(getattr(k, "fixed_width", 250) * p["wx"]))
        glyf[name] = to_ttglyph(contours, shift)
        metrics[name] = adv
    fb = FontBuilder(1000, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyf)
    g = fb.font["glyf"]
    hm = {}
    for n in order:
        gl = g[n]
        gl.recalcBounds(g)
        hm[n] = (metrics[n], getattr(gl, "xMin", 0) if gl.numberOfContours else 0)
    fb.setupHorizontalMetrics(hm)
    fb.setupHorizontalHeader(ascent=1000, descent=-300, lineGap=0)
    fb.setupNameTable(dict(
        familyName="Gina", styleName="Regular",
        uniqueFontIdentifier=f"Gina-{wght}-{wdth};{VERSION}",
        fullName="Gina Regular", psName="Gina-Regular", version=f"Version {VERSION}",
        copyright="Copyright 2026 Enes Cevik. Prototype.",
    ))
    fb.setupOS2(
        version=4, sTypoAscender=1000, sTypoDescender=-300, sTypoLineGap=0,
        usWinAscent=1050, usWinDescent=320, sxHeight=int(p["xh"]), sCapHeight=700,
        usWeightClass=int(wght), fsType=0, achVendID="GINA",
        fsSelection=0x80,  # USE_TYPO_METRICS
    )
    fb.setupPost()
    fb.addOpenTypeFeatures(FEA)
    fb.save(path)


AXES = [("wght", "Weight", 300, 400, 800), ("wdth", "Width", 90, 90, 115)]
MASTERS = [(300, 90), (400, 90), (800, 90), (300, 115), (800, 115)]
INSTANCES = [
    ("Birlik Regular", "Birlik-Regular", 400, 90),
    ("Birlik Medium", "Birlik-Medium", 500, 90),
    ("Birlik SemiBold", "Birlik-SemiBold", 600, 90),
    ("Keşif Regular", "Kesif-Regular", 450, 115),
    ("Keşif SemiBold", "Kesif-SemiBold", 600, 115),
    ("Keşif Bold", "Kesif-Bold", 700, 115),
]


def main():
    os.makedirs(BUILD, exist_ok=True)
    ds = DesignSpaceDocument()
    for tag, name, lo, df, hi in AXES:
        a = AxisDescriptor()
        a.tag, a.name, a.minimum, a.default, a.maximum = tag, name, lo, df, hi
        ds.addAxis(a)
    for w, d in MASTERS:
        path = os.path.join(BUILD, f"master-{w}-{d}.ttf")
        build_master(w, d, path)
        s = SourceDescriptor()
        s.path = path
        s.location = {"Weight": w, "Width": d}
        s.familyName, s.styleName = "Gina", f"{w} {d}"
        ds.addSource(s)
    rule = RuleDescriptor()
    rule.name = "kesif-school-a"
    rule.conditionSets.append([dict(name="Width", minimum=104, maximum=115)])
    rule.subs.append(("a", "a.ss01"))
    ds.addRule(rule)
    for style, ps, w, d in INSTANCES:
        i = InstanceDescriptor()
        i.familyName, i.styleName = "Gina", style
        i.postScriptFontName = "Gina-" + ps
        i.location = {"Weight": w, "Width": d}
        ds.addInstance(i)
    ds_path = os.path.join(BUILD, "Gina.designspace")
    ds.write(ds_path)

    vf, _, _ = varLib.build(ds_path)
    buildStatTable(vf, [
        dict(tag="wght", name="Weight", values=[
            dict(value=300, name="Light"), dict(value=400, name="Regular", flags=0x2),
            dict(value=500, name="Medium"), dict(value=600, name="SemiBold"),
            dict(value=700, name="Bold"), dict(value=800, name="ExtraBold")]),
        dict(tag="wdth", name="Width", values=[
            dict(value=90, name="Birlik", flags=0x2), dict(value=115, name="Keşif")]),
    ])
    vf_path = os.path.join(OUT, "GinaVF.ttf")
    vf.save(vf_path)
    print("wrote", vf_path)

    os.makedirs(os.path.join(OUT, "static"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "web"), exist_ok=True)
    for style, ps, w, d in INSTANCES:
        f = TTFont(vf_path)
        st = instancer.instantiateVariableFont(
            f, {"wght": w, "wdth": d}, overlap=instancer.OverlapMode.REMOVE)
        cut, weight = style.split(" ")
        fam = f"Gina {cut}"
        name = st["name"]
        for nid in list({r.nameID for r in name.names}):
            if nid >= 256:
                name.removeNames(nameID=nid)
        name.setName(fam if weight in ("Regular",) else f"{fam} {weight}", 1, 3, 1, 0x409)
        name.setName("Regular", 2, 3, 1, 0x409)
        name.setName(f"Gina-{ps};{VERSION}", 3, 3, 1, 0x409)
        name.setName(f"{fam} {weight}", 4, 3, 1, 0x409)
        name.setName(f"Gina{ps.split('-')[0]}-{weight}", 6, 3, 1, 0x409)
        name.setName(fam, 16, 3, 1, 0x409)
        name.setName(weight, 17, 3, 1, 0x409)
        for t in ("STAT",):
            if t in st:
                del st[t]
        st["OS/2"].usWeightClass = w
        if d >= 104:  # bake the school "a" for renderers without rvrn
            for sub in st["cmap"].tables:
                if 0x61 in sub.cmap:
                    sub.cmap[0x61] = "a.ss01"
        fn = f"Gina{ps.replace('-', '-')}"
        p = os.path.join(OUT, "static", f"{fn}.ttf")
        st.save(p)
        st.flavor = "woff2"
        st.save(os.path.join(OUT, "web", f"{fn}.woff2"))
        print("wrote", p)
    f = TTFont(vf_path)
    f.flavor = "woff2"
    f.save(os.path.join(OUT, "web", "GinaVF.woff2"))


if __name__ == "__main__":
    main()
