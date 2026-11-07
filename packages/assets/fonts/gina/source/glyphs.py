"""Gina font: skeleton (centerline) drawings for every glyph.

Each glyph is drawn as centerline strokes; strokes.py expands them into
outlines. All coordinates are design units (UPM 1000) at width factor 1.0;
x is scaled by the master's width factor afterwards.

Signature details (what makes Gina not "just another rounded sans"):
  * Arches branch out of stems with a thin neck (n m h r u a b d p q):
    the "yan yana" two-arch logo motif.
  * Bowls are superellipses: calmer/squarer in Birlik, rounder in Kesif.
  * Open terminals (c e s a f r t l j y g) swell slightly, like a felt pen.
  * k/K: the leg springs from the arm, not from the stem.
  * l and t end in a soft tail (also keeps I / l / 1 apart).
"""

import math

# sidebearing classes
S, R, T, D = 54, 38, 28, 12


class K:
    """Drawing context for one master."""

    def __init__(self, p):
        self.p = p
        self.vw, self.hw = p["vw"], p["hw"]
        self.xh, self.cap, self.asc, self.desc = p["xh"], p["cap"], p["asc"], p["desc"]
        self.o = p["o"]
        self.sq = p["sq"]
        vw, hw, o = self.vw, self.hw, self.o
        self.xt = self.xh - hw / 2
        self.xto = self.xh + o - hw / 2
        self.b = hw / 2
        self.bo = -o + hw / 2
        self.sb_ = vw / 2
        self.st = self.xh - vw / 2
        self.at = self.asc - vw / 2
        self.ct = self.cap - vw / 2
        self.ctf = self.cap - hw / 2
        self.cto = self.cap + o - hw / 2
        self.dt = self.desc + vw / 2
        self.dto = self.desc - o + hw / 2
        self.strokes = []
        self.dots = []
        self.sb = (S, S)

    # ---- pieces -------------------------------------------------------
    def L(self, x0, y0, x1, y1, n=4):
        return [(x0 + (x1 - x0) * i / (n - 1), y0 + (y1 - y0) * i / (n - 1)) for i in range(n)]

    def A(self, cx, cy, rx, ry, a0, a1, sq=None, step=11.25):
        """superellipse arc, resampled evenly by arc length."""
        sq = self.sq if sq is None else sq
        e = 2.0 / sq
        n = max(3, int(round(abs(a1 - a0) / step))) + 1
        M = 40 * n
        dense = []
        for i in range(M + 1):
            a = math.radians(a0 + (a1 - a0) * i / M)
            c, s = math.cos(a), math.sin(a)
            dense.append((cx + rx * math.copysign(abs(c) ** e, c),
                          cy + ry * math.copysign(abs(s) ** e, s)))
        acc = [0.0]
        for i in range(1, len(dense)):
            acc.append(acc[-1] + math.dist(dense[i - 1], dense[i]))
        pts, j = [], 0
        for i in range(n):
            target = acc[-1] * i / (n - 1)
            while j < len(acc) - 2 and acc[j + 1] < target:
                j += 1
            seg = (acc[j + 1] - acc[j]) or 1
            f = min(1.0, max(0.0, (target - acc[j]) / seg))
            pts.append((dense[j][0] + (dense[j + 1][0] - dense[j][0]) * f,
                        dense[j][1] + (dense[j + 1][1] - dense[j][1]) * f))
        return pts

    def C(self, p0, p1, p2, p3, n=10):
        pts = []
        for i in range(n):
            t = i / (n - 1)
            mt = 1 - t
            x = mt**3 * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t**3 * p3[0]
            y = mt**3 * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t**3 * p3[1]
            pts.append((x, y))
        return pts

    # ---- strokes ------------------------------------------------------
    def stroke(self, *pieces, s=1.0, sl=0.25, e=1.0, el=0.25, m=1.0, closed=False):
        pts = list(pieces[0])
        for pc in pieces[1:]:
            pts.extend(pc[1:])
        if closed:
            pts = pts[:-1]
        self.strokes.append(dict(pts=pts, s=s, sl=sl, e=e, el=el, m=m, closed=closed))

    def dot(self, x, y, r):
        self.dots.append((x, y, r))

    # ---- shared parts --------------------------------------------------
    def idot_r(self):
        return 0.52 * self.vw + 6

    def idot_y(self, base):
        return base + 0.45 * self.vw + 46 + self.idot_r()

    def acc_r(self):
        return 0.46 * self.vw + 6

    def dieresis(self, cx, base, gap=96):
        r = self.acc_r()
        y = base + 0.42 * self.vw + 44 + r
        self.dot(cx - gap - 0.15 * self.vw, y, r)
        self.dot(cx + gap + 0.15 * self.vw, y, r)

    def breve(self, cx, base):
        y0 = base + 0.4 * self.vw + 50
        rb = 64
        self.stroke(self.A(cx, y0 + rb, 104, rb, 200, 340, sq=2), m=0.8)

    def cedilla(self, x0, ybot):
        self.stroke(
            self.C((x0, ybot), (x0 + 22, -70), (x0 + 6, -150), (x0 - 82, -182), n=10),
            s=0.75, sl=0.2, e=1.0, m=0.9,
        )

    def accdot(self, cx, base):
        r = self.idot_r()
        self.dot(cx, base + 0.4 * self.vw + 44 + r, r)


# ---------------------------------------------------------------------------
# lowercase
# ---------------------------------------------------------------------------

def o_ring(k, cx=200, rx=200):
    cy = (k.xto + k.bo) / 2
    k.stroke(k.A(cx, cy, rx, (k.xto - k.bo) / 2, 90, 450), closed=True)


def g_o(k):
    o_ring(k)
    k.sb = (R, R)


def c_bowl(k, cx=190, rx=190):
    cy = (k.xto + k.bo) / 2
    ry = (k.xto - k.bo) / 2
    k.stroke(k.A(cx, cy, rx, ry, 50, 312), s=1.08, sl=0.12, e=1.08, el=0.12)
    return cx


def g_c(k):
    c_bowl(k)
    k.sb = (R, T)


def g_ccedilla(k):
    cx = c_bowl(k)
    k.cedilla(cx + 10, k.bo)
    k.sb = (R, T)


def g_e(k):
    cx, rx = 200, 200
    cy = (k.xto + k.bo) / 2 + 0.03 * k.xh
    ryt = k.xto - cy
    ryb = cy - k.bo
    k.stroke(
        k.A(cx, cy, rx, ryt, 0, 180),
        k.A(cx, cy, rx, ryb, 180, 322)[0:],
        e=1.08, el=0.12,
    )
    k.stroke(k.L(0, cy, 2 * rx, cy, n=2))
    k.sb = (R, T)


def bowl_right_stem(k, cx=178, rx=172):
    """bowl that joins a stem on its right (a.ss01 d q g)."""
    cy = (k.xto + k.bo) / 2
    ry = (k.xto - k.bo) / 2
    k.stroke(k.A(cx, cy, rx, ry, 24, 336), s=0.42, sl=0.2, e=0.42, el=0.2)
    return cx + rx


def bowl_left_stem(k, cx=178, rx=172):
    cy = (k.xto + k.bo) / 2
    ry = (k.xto - k.bo) / 2
    k.stroke(k.A(cx, cy, rx, ry, 156, -156), s=0.42, sl=0.2, e=0.42, el=0.2)


def g_a(k):
    R_ = 330
    cxh = 168
    cyh = 0.6 * k.xh
    k.stroke(
        k.A(cxh, cyh, R_ - cxh, k.xto - cyh, 150, 0),
        k.L(R_, cyh, R_, k.sb_),
        s=1.08, sl=0.1,
    )
    ybt = 0.6 * k.xh - k.hw / 2
    cxb = 176
    cyb = (ybt + k.bo) / 2
    k.stroke(
        k.L(R_, ybt, cxb, ybt),
        k.A(cxb, cyb, cxb - 6, (ybt - k.bo) / 2, 90, 270, sq=2.0),
        k.C((cxb, k.bo), (cxb + 80, k.bo), (R_, k.bo + 30), (R_, 0.25 * k.xh), n=6),
        s=0.45, sl=0.18, e=0.42, el=0.3,
    )
    k.sb = (T + 4, S)


def g_a_ss01(k):
    R_ = bowl_right_stem(k)
    k.stroke(k.L(R_, k.st, R_, k.sb_, n=2))
    k.sb = (R, S)


def g_d(k):
    R_ = bowl_right_stem(k)
    k.stroke(k.L(R_, k.at, R_, k.sb_, n=2))
    k.sb = (R, S)


def g_q(k):
    R_ = bowl_right_stem(k)
    k.stroke(k.L(R_, k.st, R_, k.dt, n=2))
    k.sb = (R, S)


def g_b(k):
    bowl_left_stem(k, cx=172 + 6)
    k.stroke(k.L(6, k.at, 6, k.sb_, n=2))
    k.sb = (S, R)


def g_p(k):
    bowl_left_stem(k, cx=178)
    k.stroke(k.L(6, k.st, 6, k.dt, n=2))
    k.sb = (S, R)


def g_g(k):
    R_ = bowl_right_stem(k)
    yh = -10
    cx = 172
    k.stroke(
        k.L(R_, k.st, R_, yh),
        k.A(cx, yh, R_ - cx, yh - k.dto, 0, -158),
        e=1.08, el=0.12,
    )
    k.sb = (R, S)


def g_gbreve(k):
    g_g(k)
    k.breve(178, k.xh)


def arch(k, x0, x1, ybase, cy=None):
    cy = 0.5 * k.xh if cy is None else cy
    cx, rx = (x0 + x1) / 2, (x1 - x0) / 2
    k.stroke(
        k.A(cx, cy, rx, k.xto - cy, 180, 0),
        k.L(x1, cy, x1, ybase),
        s=0.34, sl=0.32,
    )


def g_n(k):
    k.stroke(k.L(0, k.st, 0, k.sb_, n=2))
    arch(k, 0, 332, k.sb_)


def g_m(k):
    k.stroke(k.L(0, k.st, 0, k.sb_, n=2))
    arch(k, 0, 262, k.sb_)
    arch(k, 262, 524, k.sb_)


def g_h(k):
    k.stroke(k.L(0, k.at, 0, k.sb_, n=2))
    arch(k, 0, 332, k.sb_)


def g_u(k, accent=None):
    cy = 0.5 * k.xh
    k.stroke(
        k.L(0, k.st, 0, cy),
        k.A(166, cy, 166, cy - k.bo, 180, 360),
        e=0.34, el=0.32,
    )
    k.stroke(k.L(332, k.st, 332, k.sb_, n=2))


def g_udieresis(k):
    g_u(k)
    k.dieresis(166, k.xh)


def g_r(k):
    k.stroke(k.L(0, k.st, 0, k.sb_, n=2))
    cy = 0.5 * k.xh
    k.stroke(k.A(150, cy, 150, k.xto - cy, 180, 58), s=0.34, sl=0.4, e=1.1, el=0.15)
    k.sb = (S, 10)


def g_i(k):
    k.stroke(k.L(0, k.st, 0, k.sb_, n=2))
    k.dot(0, k.idot_y(k.xh), k.idot_r())


def g_dotlessi(k):
    k.stroke(k.L(0, k.st, 0, k.sb_, n=2))


def g_j(k):
    yj = -30
    k.stroke(
        k.L(0, k.st, 0, yj),
        k.A(-112, yj, 112, yj - k.dto, 0, -165),
        e=1.08, el=0.12,
    )
    k.dot(0, k.idot_y(k.xh), k.idot_r())
    k.sb = (-6, S)
    k.lsb_from_stem = 0


def tail(k, x, ytop, rl=112):
    yl = 0.3 * k.xh
    k.stroke(
        k.L(x, ytop, x, yl),
        k.A(x + rl, yl, rl, yl - k.bo, 180, 296),
        e=1.08, el=0.15,
    )


def g_l(k):
    tail(k, 0, k.at)
    k.sb = (S, T - 6)


def g_t(k):
    tail(k, 0, 0.93 * k.cap - k.vw / 2)
    k.stroke(k.L(-112, k.xt, 172, k.xt, n=2))
    k.sb = (T, T - 6)


def g_f(k):
    yf = k.asc - 160
    rf = 128
    k.stroke(
        k.L(0, k.sb_, 0, yf),
        k.A(rf, yf, rf, k.asc + k.o - k.hw / 2 - yf, 180, 36),
        e=1.08, el=0.15,
    )
    k.stroke(k.L(-104, k.xt, 176, k.xt, n=2))
    k.sb = (T, 0)


def arm_leg(k, x_arm, ytop, ymid, x_leg):
    k.stroke(k.L(x_arm, ytop, 0, ymid, n=2), e=0.75, el=0.3, m=0.94)
    f = 0.44
    px, py = x_arm * f, ymid + (ytop - ymid) * f
    k.stroke(
        k.C((px, py), (px + 70, py - 70), (x_leg - 50, 140), (x_leg, k.sb_), n=8),
        s=0.8, sl=0.3, m=0.96,
    )


def g_k(k):
    k.stroke(k.L(0, k.at, 0, k.sb_, n=2))
    arm_leg(k, 292, k.st, 0.34 * k.xh, 314)
    k.sb = (S, D + 6)


def g_v(k):
    yb = k.vw * 0.46
    k.stroke(k.L(0, k.st, 182, yb, n=2), m=0.93)
    k.stroke(k.L(182, yb, 364, k.st, n=2), m=0.93)
    k.sb = (D, D)


def g_w(k):
    yb = k.vw * 0.46
    ym = k.st * 0.86
    k.stroke(k.L(0, k.st, 136, yb, n=2), m=0.9)
    k.stroke(k.L(136, yb, 270, ym, n=2), m=0.9)
    k.stroke(k.L(270, ym, 404, yb, n=2), m=0.9)
    k.stroke(k.L(404, yb, 540, k.st, n=2), m=0.9)
    k.sb = (D, D)


def g_x(k):
    k.stroke(k.L(0, k.st, 340, k.sb_, n=2), m=0.93)
    k.stroke(k.L(340, k.st, 0, k.sb_, n=2), m=0.93)
    k.sb = (D, D)


def g_y(k):
    k.stroke(k.L(0, k.st, 186, 30, n=2), m=0.93)
    k.stroke(
        k.C((366, k.st), (262, 150), (210, -110), (40, k.dt + 6), n=12),
        e=1.08, el=0.15, m=0.93,
    )
    k.sb = (D, D)


def g_z(k):
    k.stroke(k.L(14, k.xt, 316, k.xt, n=2))
    k.stroke(k.L(316, k.xt, 0, k.b, n=2), m=0.9)
    k.stroke(k.L(0, k.b, 330, k.b, n=2))
    k.sb = (T, T)


def s_shape(k, top, bot, cx, rxu, rxl, spine):
    cyu, ryu = (top + spine) / 2, (top - spine) / 2
    cyl, ryl = (spine + bot) / 2, (spine - bot) / 2
    k.stroke(
        k.A(cx, cyu, rxu, ryu, 26, 270, sq=2.15),
        k.A(cx, cyl, rxl, ryl, 90, -152, sq=2.15),
        s=1.08, sl=0.1, e=1.08, el=0.1, m=0.95,
    )


def g_s(k):
    s_shape(k, k.xto, k.bo, 162, 150, 162, 0.535 * k.xh)
    k.sb = (T + 6, T + 6)


def g_scedilla(k):
    g_s(k)
    k.cedilla(166, k.bo)


def g_odieresis(k):
    g_o(k)
    k.dieresis(200, k.xh)


# ---------------------------------------------------------------------------
# uppercase
# ---------------------------------------------------------------------------

def stem(k, x, top=None, bot=None):
    k.stroke(k.L(x, k.ct if top is None else top, x, k.sb_ if bot is None else bot, n=2))


def g_A(k):
    yb = k.sb_
    k.stroke(k.L(0, yb, 240, k.ct, n=2), m=0.95)
    k.stroke(k.L(240, k.ct, 480, yb, n=2), m=0.95)
    y = 0.3 * k.cap
    xl = 240 * (y - yb) / (k.ct - yb)
    k.stroke(k.L(xl, y, 480 - xl, y, n=2))
    k.sb = (D, D)


def g_B(k):
    stem(k, 0)
    ym = 0.54 * k.cap
    cyu, ryu = (k.ctf + ym) / 2, (k.ctf - ym) / 2
    cyl, ryl = (ym + k.b) / 2, (ym - k.b) / 2
    k.stroke(k.L(0, k.ctf, 214, k.ctf), k.A(214, cyu, 150, ryu, 90, -90, sq=2.2), k.L(214, ym, 0, ym))
    k.stroke(k.L(0, ym, 230, ym), k.A(230, cyl, 172, ryl, 90, -90, sq=2.2), k.L(230, k.b, 0, k.b))
    k.sb = (S + 4, R)


def C_bowl(k, cx=316, a0=46, a1=314):
    cy = (k.cto + k.bo) / 2
    ry = (k.cto - k.bo) / 2
    return cy, ry


def g_C(k):
    cy, ry = C_bowl(k)
    k.stroke(k.A(316, cy, 316, ry, 46, 314), s=1.08, sl=0.12, e=1.08, el=0.12)
    k.sb = (R, T)


def g_Ccedilla(k):
    g_C(k)
    k.cedilla(326, k.bo)


def g_D(k):
    stem(k, 0)
    cy, ry = (k.ctf + k.b) / 2, (k.ctf - k.b) / 2
    k.stroke(k.L(0, k.ctf, 196, k.ctf), k.A(196, cy, 256, ry, 90, -90), k.L(196, k.b, 0, k.b))
    k.sb = (S + 4, R)


def g_E(k):
    stem(k, 0)
    k.stroke(k.L(0, k.ctf, 344, k.ctf, n=2))
    k.stroke(k.L(0, 0.5 * k.cap, 316, 0.5 * k.cap, n=2))
    k.stroke(k.L(0, k.b, 352, k.b, n=2))
    k.sb = (S + 4, T)


def g_F(k):
    stem(k, 0)
    k.stroke(k.L(0, k.ctf, 344, k.ctf, n=2))
    k.stroke(k.L(0, 0.48 * k.cap, 310, 0.48 * k.cap, n=2))
    k.sb = (S + 4, T)


def g_G(k):
    cy, ry = C_bowl(k)
    cx = 326
    k.stroke(k.A(cx, cy, cx, ry, 46, 360), s=1.08, sl=0.1)
    k.stroke(k.L(2 * cx, cy, 2 * cx - 236, cy, n=2))
    k.sb = (R, S)


def g_Gbreve(k):
    g_G(k)
    k.breve(326, k.cap)


def g_H(k):
    stem(k, 0)
    stem(k, 470)
    k.stroke(k.L(0, 0.5 * k.cap, 470, 0.5 * k.cap, n=2))
    k.sb = (S + 4, S + 4)


def g_I(k):
    stem(k, 0)
    k.sb = (S + 4, S + 4)


def g_Idotaccent(k):
    g_I(k)
    k.accdot(0, k.cap)


def g_J(k):
    yj = 0.32 * k.cap
    k.stroke(k.L(300, k.ct, 300, yj), k.A(152, yj, 148, yj - k.bo, 0, -168), e=1.08, el=0.12)
    k.sb = (T, S + 4)


def g_K(k):
    stem(k, 0)
    arm_leg(k, 400, k.ct, 0.36 * k.cap, 424)
    k.sb = (S + 4, D + 4)


def g_L(k):
    stem(k, 0)
    k.stroke(k.L(0, k.b, 330, k.b, n=2))
    k.sb = (S + 4, T - 4)


def g_M(k):
    stem(k, 0)
    stem(k, 580)
    yv = 0.24 * k.cap
    k.stroke(k.L(0, k.ct, 290, yv, n=2), m=0.92)
    k.stroke(k.L(290, yv, 580, k.ct, n=2), m=0.92)
    k.sb = (S + 4, S + 4)


def g_N(k):
    stem(k, 0)
    stem(k, 480)
    k.stroke(k.L(0, k.ct, 480, k.sb_, n=2), m=0.94)
    k.sb = (S + 4, S + 4)


def g_O(k):
    cy, ry = (k.cto + k.bo) / 2, (k.cto - k.bo) / 2
    k.stroke(k.A(340, cy, 340, ry, 90, 450), closed=True)
    k.sb = (R, R)


def g_Odieresis(k):
    g_O(k)
    k.dieresis(340, k.cap, gap=110)


def g_P(k):
    stem(k, 0)
    yp = 0.4 * k.cap
    cy, ry = (k.ctf + yp) / 2, (k.ctf - yp) / 2
    k.stroke(k.L(0, k.ctf, 214, k.ctf), k.A(214, cy, 196, ry, 90, -90, sq=2.2), k.L(214, yp, 0, yp))
    k.sb = (S + 4, R)


def g_Q(k):
    g_O(k)
    k.stroke(k.C((450, 150), (500, 70), (560, 10), (690, -50), n=6), s=0.7, sl=0.3, e=1.06, m=0.95)
    k.sb = (R, R - 30)


def g_R(k):
    g_P(k)
    yp = 0.4 * k.cap
    k.stroke(k.L(214, yp, 430, k.sb_, n=2), m=0.95)
    k.sb = (S + 4, D + 4)


def g_S(k):
    s_shape(k, k.cto, k.bo, 236, 210, 228, 0.535 * k.cap)
    k.sb = (T + 6, T + 6)


def g_Scedilla(k):
    g_S(k)
    k.cedilla(240, k.bo)


def g_T(k):
    k.stroke(k.L(0, k.ctf, 500, k.ctf, n=2))
    stem(k, 250, top=k.ctf)
    k.sb = (T - 6, T - 6)


def g_U(k):
    yu = 0.42 * k.cap
    k.stroke(k.L(0, k.ct, 0, yu), k.A(246, yu, 246, yu - k.bo, 180, 360), k.L(492, yu, 492, k.ct))
    k.sb = (S + 4, S + 4)


def g_Udieresis(k):
    g_U(k)
    k.dieresis(246, k.cap, gap=104)


def g_V(k):
    yb = k.vw * 0.46
    k.stroke(k.L(0, k.ct, 256, yb, n=2), m=0.95)
    k.stroke(k.L(256, yb, 512, k.ct, n=2), m=0.95)
    k.sb = (D, D)


def g_W(k):
    yb = k.vw * 0.46
    ym = 0.84 * k.ct
    k.stroke(k.L(0, k.ct, 190, yb, n=2), m=0.92)
    k.stroke(k.L(190, yb, 380, ym, n=2), m=0.92)
    k.stroke(k.L(380, ym, 570, yb, n=2), m=0.92)
    k.stroke(k.L(570, yb, 760, k.ct, n=2), m=0.92)
    k.sb = (D, D)


def g_X(k):
    k.stroke(k.L(0, k.ct, 480, k.sb_, n=2), m=0.95)
    k.stroke(k.L(480, k.ct, 0, k.sb_, n=2), m=0.95)
    k.sb = (D, D)


def g_Y(k):
    ym = 0.44 * k.cap
    k.stroke(k.L(0, k.ct, 246, ym, n=2), m=0.95)
    k.stroke(k.L(492, k.ct, 246, ym, n=2), m=0.95)
    stem(k, 246, top=ym)
    k.sb = (D, D)


def g_Z(k):
    k.stroke(k.L(20, k.ctf, 446, k.ctf, n=2))
    k.stroke(k.L(446, k.ctf, 0, k.b, n=2), m=0.92)
    k.stroke(k.L(0, k.b, 460, k.b, n=2))
    k.sb = (T, T)


# ---------------------------------------------------------------------------
# figures (lining, tabular width)
# ---------------------------------------------------------------------------

FIG_W = 560


def fig(k, fn):
    fn(k)
    k.fixed_width = FIG_W


def g_zero(k):
    cy, ry = (k.cto + k.bo) / 2, (k.cto - k.bo) / 2
    k.stroke(k.A(220, cy, 220, ry, 90, 450), closed=True)


def g_one(k):
    stem(k, 230)
    k.stroke(k.C((230, k.ct), (180, k.ct - 70), (120, k.ct - 110), (50, k.ct - 130), n=6), e=1.05)


def g_two(k):
    cy = 0.7 * k.cap
    k.stroke(
        k.A(212, cy, 200, k.cto - cy, 160, -24, sq=2.2),
        k.C((394, 0.56 * k.cap), (330, 0.4 * k.cap), (120, 0.22 * k.cap), (8, k.b), n=8),
        s=1.08, sl=0.1,
    )
    k.stroke(k.L(8, k.b, 420, k.b, n=2))


def g_three(k):
    ym = 0.55 * k.cap
    cyu, ryu = (k.cto + ym) / 2, (k.cto - ym) / 2
    cyl, ryl = (ym + k.bo) / 2, (ym - k.bo) / 2
    k.stroke(k.A(204, cyu, 184, ryu, 152, -90, sq=2.2), k.L(204, ym, 150, ym, n=2), s=1.08, sl=0.12)
    k.stroke(k.L(150, ym, 210, ym, n=2), k.A(210, cyl, 206, ryl, 90, -150, sq=2.2), e=1.08, el=0.12)


def g_four(k):
    yb = 0.27 * k.cap
    k.stroke(k.L(330, k.ct, 0, yb, n=2), m=0.92)
    k.stroke(k.L(0, yb, 440, yb, n=2))
    stem(k, 330, top=0.56 * k.cap)


def g_five(k):
    top5 = 0.6 * k.cap
    cy, ry = (top5 + k.bo) / 2, (top5 - k.bo) / 2
    k.stroke(k.L(392, k.ctf, 72, k.ctf, n=2))
    sx, sy = k.A(214, cy, 204, ry, 154, 154, sq=2.2)[0]
    k.stroke(k.L(72, k.ctf, sx, sy, n=2), m=0.95)
    k.stroke(k.A(214, cy, 204, ry, 154, -152, sq=2.2), s=0.6, sl=0.2, e=1.08, el=0.12)


def g_six(k):
    top6 = 0.62 * k.cap
    cy, ry = (top6 + k.bo) / 2, (top6 - k.bo) / 2
    k.stroke(k.A(222, cy, 208, ry, 90, 450), closed=True)
    k.stroke(k.A(236, cy, 222, k.cto - cy, 58, 180), s=1.08, sl=0.12)


def g_nine(k):
    b9 = 0.38 * k.cap
    cy, ry = (k.cto + b9) / 2, (k.cto - b9) / 2
    k.stroke(k.A(218, cy, 208, ry, 90, 450), closed=True)
    k.stroke(k.A(204, cy, 222, cy - k.bo, 0, -122), e=1.08, el=0.12)


def g_seven(k):
    k.stroke(k.L(6, k.ctf, 420, k.ctf, n=2))
    k.stroke(k.C((420, k.ctf), (330, 0.55 * k.cap), (230, 0.3 * k.cap), (176, k.sb_), n=8), m=0.95)


def g_eight(k):
    ym = 0.55 * k.cap
    k.stroke(k.A(220, (k.cto + ym) / 2, 182, (k.cto - ym) / 2, 90, 450), closed=True)
    k.stroke(k.A(220, (ym + k.bo) / 2, 210, (ym - k.bo) / 2, 90, 450), closed=True)


# ---------------------------------------------------------------------------
# punctuation & symbols
# ---------------------------------------------------------------------------

def pdot_r(k):
    return 0.6 * k.vw + 10


def g_period(k):
    r = pdot_r(k)
    k.dot(0, r - 4, r)
    k.sb = (T + 20, T + 20)


def comma_at(k, x, y):
    r = pdot_r(k)
    k.dot(x, y + r - 4, r)
    k.stroke(k.C((x + 2, y + r - 4), (x + 12, y - 40), (x - 6, y - 110), (x - 62, y - 160), n=8),
             s=1.45, sl=0.4, e=0.8, el=0.3, m=1.0)


def g_comma(k):
    comma_at(k, 0, 0)
    k.sb = (T + 20, T + 20)


def g_colon(k):
    r = pdot_r(k)
    k.dot(0, r - 4, r)
    k.dot(0, k.xh - r + 4, r)
    k.sb = (T + 20, T + 20)


def g_semicolon(k):
    r = pdot_r(k)
    comma_at(k, 0, 0)
    k.dot(0, k.xh - r + 4, r)
    k.sb = (T + 20, T + 20)


def g_exclam(k):
    r = pdot_r(k)
    k.stroke(k.L(0, k.ct, 0, 0.3 * k.cap + 40), e=0.7, el=0.6)
    k.dot(0, r - 4, r)
    k.sb = (T + 24, T + 24)


def g_question(k):
    r = pdot_r(k)
    cy = 0.7 * k.cap
    k.stroke(
        k.A(168, cy, 168, k.cto - cy, 160, -60, sq=2.2),
        k.C((252, 0.47 * k.cap), (200, 0.42 * k.cap), (170, 0.38 * k.cap), (170, 0.3 * k.cap + 30), n=6),
        s=1.08, sl=0.1, e=0.8, el=0.3,
    )
    k.dot(170, r - 4, r)
    k.sb = (T, T)


def g_quotesingle(k):
    k.stroke(k.L(0, k.ct, 0, 0.68 * k.cap, n=2), e=0.75, el=0.6)
    k.sb = (T + 20, T + 20)


def g_quotedbl(k):
    k.stroke(k.L(0, k.ct, 0, 0.68 * k.cap, n=2), e=0.75, el=0.6)
    k.stroke(k.L(170, k.ct, 170, 0.68 * k.cap, n=2), e=0.75, el=0.6)
    k.sb = (T + 20, T + 20)


def g_quoteright(k):
    comma_at(k, 0, k.cap - 2 * pdot_r(k) + 8)
    k.sb = (T + 20, T + 20)


def g_quoteleft(k):
    r = pdot_r(k)
    y = 0.6 * k.cap
    k.dot(0, y + r, r)
    k.stroke(k.C((-2, y + r), (-12, y + r + 50), (6, y + r + 120), (62, y + r + 170), n=8),
             s=1.45, sl=0.4, e=0.8, el=0.3)
    k.sb = (T + 20, T + 20)


def g_quotedblright(k):
    comma_at(k, 0, k.cap - 2 * pdot_r(k) + 8)
    comma_at(k, 190, k.cap - 2 * pdot_r(k) + 8)
    k.sb = (T + 20, T + 20)


def g_quotedblleft(k):
    for x in (0, 190):
        r = pdot_r(k)
        y = 0.6 * k.cap
        k.dot(x, y + r, r)
        k.stroke(k.C((x - 2, y + r), (x - 12, y + r + 50), (x + 6, y + r + 120), (x + 62, y + r + 170), n=8),
                 s=1.45, sl=0.4, e=0.8, el=0.3)
    k.sb = (T + 20, T + 20)


def g_hyphen(k):
    y = 0.47 * k.xh
    k.stroke(k.L(0, y, 200, y, n=2))
    k.sb = (T + 10, T + 10)


def g_endash(k):
    y = 0.47 * k.xh
    k.stroke(k.L(0, y, 460, y, n=2))
    k.sb = (T, T)


def g_periodcentered(k):
    r = pdot_r(k) * 0.9
    k.dot(0, 0.5 * k.xh, r)
    k.sb = (T + 20, T + 20)


def g_parenleft(k):
    cy = (k.asc + k.desc) / 2 + 20
    k.stroke(k.A(300, cy, 270, (k.asc - k.desc) / 2 - 10, 118, 242, sq=2), s=1.05, e=1.05)
    k.sb = (T + 10, T - 6)


def g_parenright(k):
    cy = (k.asc + k.desc) / 2 + 20
    k.stroke(k.A(-120, cy, 270, (k.asc - k.desc) / 2 - 10, 62, -62, sq=2), s=1.05, e=1.05)
    k.sb = (T - 6, T + 10)


def g_slash(k):
    k.stroke(k.L(0, k.desc + 40, 330, k.asc - 40, n=2), m=0.92)
    k.sb = (D, D)


def g_plus(k):
    y = 0.5 * k.xh
    k.stroke(k.L(0, y, 400, y, n=2))
    k.stroke(k.L(200, y - 200, 200, y + 200, n=2))
    k.sb = (T + 10, T + 10)


def g_equal(k):
    y = 0.5 * k.xh
    d = 70 + 0.3 * k.vw
    k.stroke(k.L(0, y + d, 400, y + d, n=2))
    k.stroke(k.L(0, y - d, 400, y - d, n=2))
    k.sb = (T + 10, T + 10)


def g_percent(k):
    r = 100
    k.stroke(k.A(110, 0.72 * k.cap, 100, 0.26 * k.cap - 10, 90, 450, sq=2.2), closed=True, m=0.8)
    k.stroke(k.A(530, 0.24 * k.cap, 100, 0.26 * k.cap - 10, 90, 450, sq=2.2), closed=True, m=0.8)
    k.stroke(k.L(560, k.ct, 80, k.sb_, n=2), m=0.85)
    k.sb = (T, T)


def g_asterisk(k):
    cy, r = 0.7 * k.cap, 150
    for a in (90, 30, 150):
        ar = math.radians(a)
        c, s = r * math.cos(ar), r * math.sin(ar)
        k.stroke(k.L(-c, cy - s, c, cy + s, n=2), m=0.8)
    k.sb = (T + 10, T + 10)


def g_lira(k):
    # Turkish lira sign
    yb = 0.3 * k.cap
    k.stroke(k.L(110, k.ct, 110, yb), k.A(250, yb, 140, yb - k.b, 180, 352), e=1.06, el=0.12)
    k.stroke(k.L(20, 0.42 * k.cap, 330, 0.56 * k.cap, n=2), m=0.85)
    k.stroke(k.L(20, 0.6 * k.cap, 330, 0.74 * k.cap, n=2), m=0.85)
    k.sb = (T, T)


def g_space(k):
    k.fixed_width = 236


def g_notdef(k):
    k.stroke(k.L(0, k.b, 400, k.b, n=2))
    k.stroke(k.L(400, k.b, 400, k.ctf, n=2))
    k.stroke(k.L(400, k.ctf, 0, k.ctf, n=2))
    k.stroke(k.L(0, k.ctf, 0, k.b, n=2))


# name -> (unicode or None, draw fn, figure?)
GLYPHS = [
    (".notdef", None, g_notdef),
    ("space", 0x20, g_space),
    ("nbspace", 0xA0, g_space),
]

_lower = "abcdefghijklmnopqrstuvwxyz"
for ch in _lower:
    GLYPHS.append((ch, ord(ch), globals()["g_" + ch]))
for ch in _lower.upper():
    GLYPHS.append((ch, ord(ch), globals()["g_" + ch]))

GLYPHS += [
    ("a.ss01", None, g_a_ss01),
    ("ccedilla", 0xE7, g_ccedilla),
    ("gbreve", 0x11F, g_gbreve),
    ("dotlessi", 0x131, g_dotlessi),
    ("odieresis", 0xF6, g_odieresis),
    ("scedilla", 0x15F, g_scedilla),
    ("udieresis", 0xFC, g_udieresis),
    ("Ccedilla", 0xC7, g_Ccedilla),
    ("Gbreve", 0x11E, g_Gbreve),
    ("Idotaccent", 0x130, g_Idotaccent),
    ("Odieresis", 0xD6, g_Odieresis),
    ("Scedilla", 0x15E, g_Scedilla),
    ("Udieresis", 0xDC, g_Udieresis),
]

for i, nm in enumerate("zero one two three four five six seven eight nine".split()):
    fn = globals()["g_" + nm]
    GLYPHS.append((nm, 0x30 + i, (lambda f: (lambda k: fig(k, f)))(fn)))

GLYPHS += [
    ("period", 0x2E, g_period),
    ("comma", 0x2C, g_comma),
    ("colon", 0x3A, g_colon),
    ("semicolon", 0x3B, g_semicolon),
    ("exclam", 0x21, g_exclam),
    ("question", 0x3F, g_question),
    ("quotesingle", 0x27, g_quotesingle),
    ("quotedbl", 0x22, g_quotedbl),
    ("quoteright", 0x2019, g_quoteright),
    ("quoteleft", 0x2018, g_quoteleft),
    ("quotedblright", 0x201D, g_quotedblright),
    ("quotedblleft", 0x201C, g_quotedblleft),
    ("hyphen", 0x2D, g_hyphen),
    ("endash", 0x2013, g_endash),
    ("periodcentered", 0xB7, g_periodcentered),
    ("parenleft", 0x28, g_parenleft),
    ("parenright", 0x29, g_parenright),
    ("slash", 0x2F, g_slash),
    ("plus", 0x2B, g_plus),
    ("equal", 0x3D, g_equal),
    ("percent", 0x25, g_percent),
    ("asterisk", 0x2A, g_asterisk),
    ("lira", 0x20BA, g_lira),
]
