// @ts-nocheck
import React from "react";
import {useCurrentFrame,useVideoConfig} from "remotion";

function createCharacterRig(){
var D2R = Math.PI / 180, OUT = '#1b1620', UID = 0;
/* ---------- vector / ma trận ---------- */
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function crs(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function vlen(a) { return Math.hypot(a[0], a[1], a[2]); }
function nrm(a) { var l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function mmul(A, B) { var R = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], i, j, k; for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) for (k = 0; k < 3; k++) R[i][j] += A[i][k] * B[k][j]; return R; }
function mv(M, v) { return [M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2], M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2], M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]]; }
function tr(M) { return [[M[0][0], M[1][0], M[2][0]], [M[0][1], M[1][1], M[2][1]], [M[0][2], M[1][2], M[2][2]]]; }
function rX(a) { var c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]; }
function rY(a) { var c = Math.cos(a), s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; }
function rZ(a) { var c = Math.cos(a), s = Math.sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function f1(v) { return Math.round(v * 10) / 10; }

/* ---------- 1. TƯ THẾ MẶC ĐỊNH (đứng chữ A) ---------- */
function sideP() { return { hand: 'rl', sh: [0, 18], el: [0, 0], elr: 0, wr: 0, hip: [0, 3, 13], kn: 0, an: 0 }; }
var P0 = { x: 0, roll: 0, twistP: 0, lean: [0, 0], twist: 0, neck: [0, 0], tilt: 0, yaw: 0, bounce: 0, L: sideP(), R: sideP() };
var ORDER = {}, HYST = 5, LASTORDER = [];
var SEC = { o: [0, 0, 0], v: [0, 0, 0] }, BLINK = 0;
function deep(o) { return JSON.parse(JSON.stringify(o)); }
function merge(base, over) {
  var r = deep(base);
  (function m(a, b) { for (var k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) m(a[k], b[k]); else a[k] = Array.isArray(b[k]) ? b[k].slice() : b[k]; } })(r, over || {});
  return r;
}
function lerpP(a, b, t) {
  if (typeof a === 'string') return t < .5 ? a : b;
  if (typeof a === 'number') return a + (b - a) * t;
  if (Array.isArray(a)) return a.map(function (v, i) { return lerpP(v, b[i], t); });
  var r = {}; for (var k in a) r[k] = lerpP(a[k], b[k], t); return r;
}

/* chuyển tư thế kiểu hoạt hình: thân dẫn, tay/đầu trễ nhịp, hơi vọt quá rồi về (overshoot) */
var DLY = { sh: .05, el: .1, wr: .15, neck: .08, tilt: .08, yaw: .09, hip: .02, kn: .04, an: .09, elr: .1, lean: 0, twist: .03 };
function easeOS(x) { x = clamp(x, 0, 1); var c = 1.0; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }
function lerpS(a, b, x, key) {
  if (typeof a === 'string') return x > .3 ? b : a;
  if (typeof a === 'number') { var d = DLY[key] || 0; return a + (b - a) * easeOS((x - d) / (1 - d)); }
  if (Array.isArray(a)) return a.map(function (v, i) { return lerpS(v, b[i], x, key); });
  var r = {}; for (var k in a) r[k] = lerpS(a[k], b[k], x, DLY[k] != null ? k : key); return r;
}
/* chuyển động thứ cấp (lò xo): tay áo, gấu váy, dải đai, tóc */
var SK = { sl: { L: { o: [0, 0, 0], v: [0, 0, 0] }, R: { o: [0, 0, 0], v: [0, 0, 0] } }, hem: { L: { o: [0, 0, 0], v: [0, 0, 0] }, R: { o: [0, 0, 0], v: [0, 0, 0] } }, tail: { o: [0, 0, 0], v: [0, 0, 0] } };
/* ---------- 2. FK: tư thế -> toạ độ 3D các khớp (x phải nhân vật = +x trái, y xuống, z phía trước) ---------- */
var LEN = { thigh: 185, shin: 163, uarm: 120, farm: 98, hand: 52, hipW: 34, shW: 51, spine: 146, neck: 22 };
function limbDir(a, f, s) { var d = [s * Math.sin(a), Math.cos(a), 0]; return [d[0], d[1] * Math.cos(f) - d[2] * Math.sin(f), d[1] * Math.sin(f) + d[2] * Math.cos(f)]; }
function bendDir(u, fwd, up) {
  var b = sub(fwd, mul(u, dot(fwd, u)));
  if (vlen(b) < .02) b = sub(up, mul(u, dot(up, u)));
  return nrm(b);
}
function rollAxis(u, b, r) { return add(mul(b, Math.cos(r)), mul(crs(u, b), Math.sin(r))); }
function fk(p, dy) {
  var J = {}, Rp = mmul(rZ(p.roll * D2R), rY(p.twistP * D2R)), P = [p.x, 400 + (dy || 0), 0];
  J.pel = P;
  var W = add(P, mv(Rp, [0, -44, 0])); J.wst = W;
  var Rl = mmul(Rp, mmul(rX(-p.lean[0] * .4 * D2R), mmul(rZ(p.lean[1] * .4 * D2R), rY(p.twist * .4 * D2R))));
  var Rs = mmul(Rp, mmul(rX(-p.lean[0] * D2R), mmul(rZ(p.lean[1] * D2R), rY(p.twist * D2R))));
  J.Rs = Rs; J.Rp = Rp; J.Rl = Rl;
  var M0 = add(W, mv(Rl, [0, -LEN.spine * .5, 0])); J.mid = M0;
  var C = add(M0, mv(Rs, [0, -LEN.spine * .5, 0])); J.chest = C;
  J.neckB = add(C, mv(Rs, [0, -LEN.neck, 0]));
  var hj = add(J.neckB, mv(Rs, [0, -26, 0])); J.headJ = hj;
  var Rh = mmul(Rs, mmul(rX(-p.neck[0] * D2R), mmul(rZ(p.neck[1] * D2R + p.tilt * D2R), rY((p.yaw || 0) * D2R)))); J.Rh = Rh;
  J.head = add(hj, mv(Rh, [0, -87, 0]));
  var fwdT = mv(Rs, [0, 0, 1]), upT = mv(Rs, [0, -1, 0]), fwdP = mv(Rp, [0, 0, 1]);
  [['L', 1], ['R', -1]].forEach(function (e) {
    var k = e[0], s = e[1], q = p[k];
    var Sh = add(C, mv(Rs, [s * LEN.shW, -clamp((q.sh[1] - 18) / 140, 0, 1) * 16 - clamp(q.sh[0] / 150, 0, 1) * 6, 0])); J['sh' + k] = Sh;
    var u = mv(Rs, limbDir(q.sh[1] * D2R, q.sh[0] * D2R, s));
    var El = add(Sh, mul(u, LEN.uarm)); J['el' + k] = El;
    var b = rollAxis(u, bendDir(u, fwdT, upT), q.elr * s * D2R);
    var fa = nrm(add(mul(u, Math.cos(q.el[0] * D2R)), mul(b, Math.sin(q.el[0] * D2R))));
    var Wr = add(El, mul(fa, LEN.farm)); J['wr' + k] = Wr;
    var b2 = bendDir(fa, fwdT, upT), h = nrm(add(mul(fa, Math.cos(q.wr * D2R)), mul(b2, Math.sin(q.wr * D2R))));
    J['hd' + k] = add(Wr, mul(h, LEN.hand));
    var Hp = add(P, mv(Rp, [s * LEN.hipW, 0, 0])); J['hp' + k] = Hp;
    var t = mv(Rp, limbDir(q.hip[1] * D2R, q.hip[0] * D2R, s));
    var Kn = add(Hp, mul(t, LEN.thigh)); J['kn' + k] = Kn;
    var sh = nrm(mv(Rp, mv(rX(-q.kn * D2R), mv(tr(Rp), t))));
    var An = add(Kn, mul(sh, LEN.shin)); J['an' + k] = An;
    var th = Math.atan2(sh[2], sh[1]), toe = s * q.hip[2] * D2R;
    var Rf = rX(-th + q.an * D2R), fw = mv(Rf, [Math.sin(toe), 0, Math.cos(toe)]), dn = mv(Rf, [0, 1, 0]);
    J['fw' + k] = fw; J['dn' + k] = dn;
    J['hl' + k] = add(An, add(mul(dn, 38), mul(fw, -20)));
    J['to' + k] = add(An, add(mul(dn, 42), mul(fw, 52)));
    J['so' + k] = Math.max(add(An, add(mul(dn, 52), mul(fw, -16)))[1], add(An, add(mul(dn, 52), mul(fw, 58)))[1]);
  });
  return J;
}
function solveOld(p) {
  var J0 = fk(p, 0), low = Math.max(J0.soL, J0.soR, J0.knL[1] + 28, J0.knR[1] + 28), dy = p.ground === false ? 0 : 800 - low - (p.bounce || 0);
  return fk(p, dy);
}
function proj(v, phi) { var c = Math.cos(phi * D2R), s = Math.sin(phi * D2R); return [v[0] * c - v[2] * s, v[1], v[0] * s + v[2] * c]; }


var GH = { rl: { c: [16, 20, 18, 14], sp: 6, th: 28, tb: 12 }, cv: { c: [8, 10, 12, 14], sp: 1, th: 20, tb: 8 }, wv: { c: [-4, -2, -3, -8], sp: 15, th: 42, tb: -4 }, cl: { c: [26, 30, 32, 30], sp: 0, th: 12, tb: 20 }, rc: { c: [24, 30, 28, 22], sp: 16, th: 46, tb: 16 } };
function gfin(pts, wo, wi) {
  var d = 'M' + pts.map(function (q) { return f1(q[0]) + ' ' + f1(q[1]); }).join('L'), e = pts[pts.length - 1];
  return '<path d="' + d + '" stroke="' + OUT + '" stroke-width="' + wo + '" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="' + d + '" stroke="' + SKIN + '" stroke-width="' + wi + '" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
}
function nativeRigHand(h) {
  var o = '<path d="M-8.5 -4 Q-10 12 -8.5 23 Q0 27 8.5 23 Q10.5 12 8.5 -4 Z" fill="' + SKIN + '" stroke="' + OUT + '" stroke-width="2.6" stroke-linejoin="round"/>';
  var a = h.th * D2R, x = 7.5, y = 8, pts = [[x, y]], k;
  for (k = 0; k < 2; k++) { a += h.tb * D2R / 2; x += Math.sin(a) * 9; y += Math.cos(a) * 9; pts.push([x, y]); }
  o += gfin(pts, 5.6, 3.6);
  var bx = [-6.5, -2.2, 2.2, 6.5], ln = [16, 23, 21, 17], cc = [h.c[3], h.c[2], h.c[1], h.c[0]], ii = [3, 2, 1, 0];
  for (var n = 0; n < 4; n++) {
    var i = ii[n], aa = h.sp * (i - 1.5) * D2R, fx = bx[i], fy = 21, q = [[fx, fy]], sg = ln[i] / 3;
    for (k = 0; k < 3; k++) { aa += cc[n] * D2R / 3; fx += Math.sin(aa) * sg; fy += Math.cos(aa) * sg; q.push([fx, fy]); }
    o += gfin(q, 6.2, 4.2);
  }
  return o + '<path d="M-4 12 Q0 15 5 11" stroke="' + SKINSH + '" stroke-width="1.2" fill="none" opacity="0.6"/>';
}
function handSVG(J, k, phi, type) {
  var c = Math.cos(phi * D2R), w2 = proj(J['wr' + k], phi), t2 = proj(J['hd' + k], phi), dx = t2[0] - w2[0], dy = t2[1] - w2[1], l = Math.hypot(dx, dy);
  if (l < 8) { dx = 0; dy = 1; l = 52 * .5; }
  var ux = dx / l, uy = dy / l, ang = Math.atan2(-ux, uy) / D2R, sy = clamp(l / 38, .6, 1.1) * 1.0, sxk = Math.max(.55, Math.abs(c)) * (k === 'L' ? -1 : 1) * (c < -.05 ? -1 : 1);
  return '<g data-edit-part="hands" data-edit-side="' + k + '" transform="translate(' + f1(w2[0]) + ' ' + f1(w2[1]) + ') rotate(' + f1(ang) + ') scale(' + f1(sxk * 1.55) + ' ' + f1(sy * 1.5) + ') translate(0 -3)">' + gHand(GH[type] || GH.rl) + '</g>';
}

/* ---------- 3. ỐNG THAY ĐỔI BỀ RỘNG DỌC THEO XƯƠNG ---------- */
function interp(prof, k) {
  if (k <= prof[0][0]) return [prof[0][1], prof[0][2]];
  for (var i = 1; i < prof.length; i++) if (k <= prof[i][0]) { var a = prof[i - 1], b = prof[i], t = (k - a[0]) / ((b[0] - a[0]) || 1); t = t * t * (3 - 2 * t); return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  var l = prof[prof.length - 1]; return [l[1], l[2]];
}
function chain2d(q, M, passes) {
  var pts = [], i, j, p;
  for (i = 0; i < q.length - 1; i++) for (j = 0; j < M; j++) { var t = j / M; pts.push({ k: i + t, x: q[i][0] + (q[i + 1][0] - q[i][0]) * t, y: q[i][1] + (q[i + 1][1] - q[i][1]) * t }); }
  var l = q[q.length - 1]; pts.push({ k: q.length - 1, x: l[0], y: l[1] });
  for (p = 0; p < passes; p++) {
    var nx = pts.map(function (o) { return { k: o.k, x: o.x, y: o.y }; });
    for (i = 1; i < pts.length - 1; i++) { nx[i].x = (pts[i - 1].x + 2 * pts[i].x + pts[i + 1].x) / 4; nx[i].y = (pts[i - 1].y + 2 * pts[i].y + pts[i + 1].y) / 4; }
    pts = nx;
  }
  return pts;
}

/* ---------- ĐƯỜNG DẪN CHUNG CỦA MỘT CHI: tính MỘT lần, mọi lớp (da, tất, quần, tay áo, cổ tay) cắt từ đây ---------- */
function bezPath(q, rad) {
  var n = q.length, pts = [], seg = [], tr = [0], i, j, STEP = 5;
  for (i = 0; i < n - 1; i++) seg.push(Math.hypot(q[i + 1][0] - q[i][0], q[i + 1][1] - q[i][1]) || 1e-3);
  for (i = 1; i < n - 1; i++) tr[i] = Math.min(rad, .45 * seg[i - 1], .45 * seg[i]);
  tr[n - 1] = 0;
  for (i = 0; i < n - 1; i++) {
    var a = q[i], b = q[i + 1], L = seg[i], u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], s0 = tr[i], s1 = L - tr[i + 1], m = Math.max(1, Math.ceil((s1 - s0) / STEP));
    for (j = 0; j < m; j++) { var s = s0 + (s1 - s0) * j / m; pts.push({ k: i + s / L, x: a[0] + u[0] * s, y: a[1] + u[1] * s }); }
    if (i + 1 < n - 1) {
      var t = tr[i + 1], c = q[i + 2], L2 = seg[i + 1], u2 = [(c[0] - b[0]) / L2, (c[1] - b[1]) / L2], A = [b[0] - u[0] * t, b[1] - u[1] * t], B = [b[0] + u2[0] * t, b[1] + u2[1] * t], kA = i + 1 - t / L, kB = i + 1 + t / L2, NB = 8;
      for (j = 0; j < NB; j++) { var v = j / NB, w0 = (1 - v) * (1 - v), w1 = 2 * v * (1 - v), w2 = v * v; pts.push({ k: kA + (kB - kA) * v, x: w0 * A[0] + w1 * b[0] + w2 * B[0], y: w0 * A[1] + w1 * b[1] + w2 * B[1] }); }
    }
  }
  var l = q[n - 1]; pts.push({ k: n - 1, x: l[0], y: l[1] });
  return pts;
}
function limbQ(ch3, phi, rad) { return bezPath(ch3.map(function (v) { var p = proj(v, phi); return [p[0], p[1]]; }), rad); }
/* cắt đường theo k0..k1, chèn đúng điểm biên để mép các lớp trùng nhau tuyệt đối */
function cutPath(all, k0, k1) {
  var out = [], i, at = function (k) { for (var z = 1; z < all.length; z++) if (k <= all[z].k) { var a = all[z - 1], b = all[z], t = (k - a.k) / ((b.k - a.k) || 1); return { k: k, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; } return all[all.length - 1]; };
  out.push(at(k0)); for (i = 0; i < all.length; i++) if (all[i].k > k0 + 1e-6 && all[i].k < k1 - 1e-6) out.push(all[i]); out.push(at(k1)); return out;
}
/* nếp gập ở mặt trong khuỷu/gối: đậm dần theo góc gập thực của khung 2D */
function crease(path, kj, wj, col, strong) {
  var at = function (k) { for (var z = 1; z < path.length; z++) if (k <= path[z].k) { var a = path[z - 1], b = path[z], t = (k - a.k) / ((b.k - a.k) || 1); return [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t]; } var l = path[path.length - 1]; return [l.x, l.y]; };
  var p = at(kj), a = at(kj - .4), b = at(kj + .4), va = [a[0] - p[0], a[1] - p[1]], vb = [b[0] - p[0], b[1] - p[1]], la = Math.hypot(va[0], va[1]) || 1, lb = Math.hypot(vb[0], vb[1]) || 1;
  var cs = clamp((va[0] * vb[0] + va[1] * vb[1]) / (la * lb), -1, 1), bend = 180 - Math.acos(cs) / D2R;
  if (bend < 14) return '';
  var bx = va[0] / la + vb[0] / lb, by = va[1] / la + vb[1] / lb, bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
  var tx = -by, ty = bx, op = clamp(bend / 100, 0, 1) * (strong || .7);
  var e1 = [p[0] + bx * wj * .3 + tx * wj * .6, p[1] + by * wj * .3 + ty * wj * .6], e2 = [p[0] + bx * wj * .3 - tx * wj * .6, p[1] + by * wj * .3 - ty * wj * .6], cc = [p[0] + bx * wj * (.3 + .55 * clamp(bend / 120, 0, 1)), p[1] + by * wj * (.3 + .55 * clamp(bend / 120, 0, 1))];
  return '<path d="M' + f1(e1[0]) + ' ' + f1(e1[1]) + ' Q' + f1(cc[0]) + ' ' + f1(cc[1]) + ' ' + f1(e2[0]) + ' ' + f1(e2[1]) + '" fill="none" stroke="' + col + '" stroke-width="2.6" stroke-linecap="round" opacity="' + f1(op) + '"/>';
}
/* o: {phi, k0, k1, fill, shade, sw, caps:'rr'|'rf'|'fr'|'ff', lines:[frac...], lineCol, nostroke, scale} */
function tube(ch3, prof, o) {
  var phi = o.phi, c = Math.cos(phi * D2R), s = Math.sin(phi * D2R);
  var q = ch3.map(function (v) { var p = proj(v, phi); return [p[0], p[1]]; });
  var n = ch3.length, all = o.path || chain2d(q, 10, o.pass == null ? 9 : o.pass), k0 = o.k0 == null ? 0 : o.k0, k1 = o.k1 == null ? n - 1 : o.k1;
  var pts = o.path ? cutPath(all, k0, k1) : all.filter(function (p) { return p.k >= k0 - 1e-6 && p.k <= k1 + 1e-6; });
  if (pts.length < 2) return '';
  var L = [], R = [], Q = [], sc = o.scale || 1, i, cnt = pts.length;
  for (i = 0; i < cnt; i++) {
    var a = pts[Math.max(0, i - 1)], b = pts[Math.min(cnt - 1, i + 1)], tx = b.x - a.x, ty = b.y - a.y, tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    var w = interp(prof, pts[i].k), wa = Math.hypot(w[0] * c, w[1] * s) * sc;
    Q.push({ x: pts[i].x, y: pts[i].y, nx: -ty, ny: tx, tx: tx, ty: ty, w: wa });
  }
  var flip = 0; Q.forEach(function (p) { flip += p.nx; }); var sg = flip >= 0 ? 1 : -1;
  var poly = [], sh = [], P = function (p, side, f) { return [p.x + p.nx * p.w * side * (f == null ? 1 : f), p.y + p.ny * p.w * side * (f == null ? 1 : f)]; };
  Q.forEach(function (p) { poly.push(P(p, 1)); });
  var caps = o.caps || 'rr', e = Q[cnt - 1], b0 = Q[0], z;
  if (caps[1] === 'r') for (z = 1; z < 7; z++) { var an = z / 7 * Math.PI; poly.push([e.x + e.nx * e.w * Math.cos(an) + e.tx * e.w * Math.sin(an), e.y + e.ny * e.w * Math.cos(an) + e.ty * e.w * Math.sin(an)]); }
  for (i = cnt - 1; i >= 0; i--) poly.push(P(Q[i], -1));
  if (caps[0] === 'r') for (z = 1; z < 7; z++) { var an2 = z / 7 * Math.PI; poly.push([b0.x - b0.nx * b0.w * Math.cos(an2) - b0.tx * b0.w * Math.sin(an2), b0.y - b0.ny * b0.w * Math.cos(an2) - b0.ty * b0.w * Math.sin(an2)]); }
  var d = 'M' + poly.map(function (p) { return f1(p[0]) + ' ' + f1(p[1]); }).join('L') + 'Z';
  var out = '<path d="' + d + '" fill="' + o.fill + '" stroke="' + (o.nostroke || o.open ? 'none' : OUT) + '" stroke-width="' + (o.sw || 3) + '" stroke-linejoin="round"/>';
  if (o.open) { var le = [], re = []; Q.forEach(function (p) { le.push(P(p, 1)); re.push(P(p, -1)); });
    out += [le, re].map(function (e2) { return '<path d="M' + e2.map(function (p) { return f1(p[0]) + ' ' + f1(p[1]); }).join('L') + '" fill="none" stroke="' + OUT + '" stroke-width="' + (o.sw || 3) + '" stroke-linecap="round" stroke-linejoin="round"/>'; }).join(''); }
  if (o.shade) {
    var s1 = [], s2 = [];
    Q.forEach(function (p) { s1.push(P(p, -sg, .25)); s2.push(P(p, -sg, 1)); });
    out += '<path d="M' + s1.concat(s2.reverse()).map(function (p) { return f1(p[0]) + ' ' + f1(p[1]); }).join('L') + 'Z" fill="' + o.shade + '" opacity="' + (o.shadeOp || .5) + '"/>';
  }
  if (o.lines) o.lines.forEach(function (fr) {
    out += '<path d="M' + Q.filter(function (p, ii) { return ii > cnt * .06 && ii < cnt * .96; }).map(function (p) { var pp = P(p, 1, fr); return f1(pp[0]) + ' ' + f1(pp[1]); }).join('L') + '" fill="none" stroke="' + (o.lineCol || 'rgba(255,255,255,.18)') + '" stroke-width="2" stroke-linecap="round"/>';
  });
  return out;
}
function poly2(pts, fill, extra) { return '<path d="M' + pts.map(function (p) { return f1(p[0]) + ' ' + f1(p[1]); }).join('L') + 'Z" fill="' + fill + '" stroke="' + OUT + '" stroke-width="' + ((extra && extra.sw) || 3) + '" stroke-linejoin="round"' + ((extra && extra.attr) || '') + '/>'; }
function smooth(pts, n) { for (var p = 0; p < (n || 1); p++) { var r = []; for (var i = 0; i < pts.length; i++) { var a = pts[i], b = pts[(i + 1) % pts.length]; r.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); } pts = r; } return pts; }

/* ---------- 4. BẢNG BỀ RỘNG (nửa rộng ngang, nửa dày) THEO k DỌC CHUỖI XƯƠNG ---------- */
var PF = {
  armSkin: [[0, 23, 21], [1, 16, 15], [2, 11, 10]], hand: [[2, 12, 9], [2.35, 16, 9], [2.8, 12, 7], [3, 6, 4]],
  legSkin: [[0, 34, 32], [.5, 31, 29], [1, 23, 22], [1.35, 25, 23], [2, 15, 14], [3, 14, 13]],
  uTorso: [[0, 50, 35], [.4, 40, 29], [.85, 46, 30], [1.15, 52, 30], [1.45, 32, 24], [2, 20, 18]],
  uTorso3: [[0, 50, 35], [.8, 40, 29], [1.7, 46, 30], [2.15, 52, 30], [2.45, 32, 24], [3, 20, 18]],
  pelvis: [[0, 46, 32], [.5, 51, 34], [1, 46, 33]],
  neck: [[0, 17, 16], [1, 15, 14]],
  hair: [[0, 62, 30], [1, 66, 28], [1.55, 58, 25], [2, 30, 15]],
  lock: [[0, 12, 10], [1, 11, 9.5], [1.6, 9, 8], [2, 3, 3]],
  foot: [[0, 21, 18], [1, 18, 12]]
};
/* ---------- 5. TRANG PHỤC = DỮ LIỆU ---------- */
var SKIN = '#fbe1cd', SKINSH = '#e6b99e', HAIRC = '#16141c';
var OUTFITS = {
  sailor: {
    n: 'Đồng phục thuỷ thủ',
    top: { kind: 'sailor', col: '#f8f9fd', sh: '#cfd6ea', navy: '#2b4585', red: '#c8382f', hemDrop: 12,
      sleeve: [[0, 27, 25], [1, 20.5, 19.5], [1.6, 20, 19], [2, 19, 18]], sleeveEnd: 2, cuff: [1.8, 2] },
    bottom: { kind: 'shorts', col: '#30509a', sh: '#1f3a78', len: .6, leg: [[0, 31, 29], [.35, 33, 31], [.6, 38, 34]], pleat: true },
    socks: { col: '#ffffff', sh: '#d9dfee', from: 1.12, prof: [[1, 24.5, 23.5], [1.35, 27, 25], [2, 17, 16], [3, 16.5, 15.5]] },
    shoes: { col: '#6c4026', sh: '#4a2a17' }
  },
  hanfu: {
    n: 'Cổ trang (Hán phục đỏ)',
    top: { kind: 'hanfu', col: '#f6ead8', sh: '#d9c7a8', navy: '#d9a441', red: '#a8322d', hemDrop: 34,
      sleeve: [[0, 28, 26], [.8, 38, 34], [1.5, 54, 46], [2, 62, 50]], sleeveEnd: 1.88, cuff: [1.78, 1.88], flow: .9 },
    bottom: { kind: 'skirt', flow: 1, col: '#a8322d', sh: '#7d1f1d', trim: '#d9a441' },
    socks: null,
    shoes: { col: '#e9dcc0', sh: '#bfae88', sole: '#5a3a2a' }
  },
  uam: {
    n: 'Cô gái u ám (cổ trang)', bg: 'radial-gradient(circle at 50% 44%, #1d3548 0 20%, #142a3b 20% 34%, #0b141d 34% 72%, #070b10 72% 100%)',
    skin: '#efe4e2', skinSh: '#cdb9b8', eye: '#8a8088', hair: '#0f0b14', crown: true, circles: true, blush: false,
    top: { kind: 'hanfu', col: '#4b5568', sh: '#363e4d', navy: '#b8bcc8', red: '#8e1b1f', inner: '#b8bcc8', hemDrop: 40, tassel: true, flow: .9,
      sleeve: [[0, 28, 26], [.8, 36, 32], [1.5, 48, 40], [2, 53, 43]], sleeveEnd: 1.88, cuff: [1.78, 1.88] },
    bottom: { kind: 'skirt', col: '#4b5568', sh: '#363e4d', trim: '#8e1b1f', flow: 1, sashY: 74, sashW: 13, sashCol: '#8e1b1f', tail: 104, hem: 1.12, hemR: 74, hemW: 6, folds: [-.8, -.4, 0, .4, .8] },
    socks: null,
    shoes: { col: '#2a2d38', sh: '#1b1e27', sole: '#15171e' }
  },
  casual: {
    n: 'Áo thun + quần jean',
    top: { kind: 'tee', col: '#f2c14e', sh: '#d19a22', navy: '#e9a93a', hemDrop: 52, sleeve: [[0, 29, 27], [.7, 25, 23]], sleeveEnd: .72, cuff: [.6, .72] },
    bottom: { kind: 'pants', col: '#4a73b8', sh: '#365a94', leg: [[0, 39, 36], [1, 29, 27], [1.4, 27, 26], [2, 25, 24]] },
    socks: null,
    shoes: { col: '#f4f4f7', sh: '#cfd0da', sole: '#d9556b' }
  }
};
var OUTFIT = 'uam';

/* ---------- 6. ĐẦU THEO GÓC NHÌN (tham số hoá trên ellipsoid) ---------- */
function headArt(phi, O) {
  var c = Math.cos(phi * D2R), s = Math.sin(phi * D2R), id = 'bg' + (++UID), g = '';
  var faceW = Math.hypot(66 * c, 60 * s), hairW = Math.hypot(78 * c, 72 * s);
  var sx = function (x, z) { return x * c - z * s; }, dd = function (x, z) { return x * s + z * c; };
  var facing = c > -.2;
  // tóc nền sau đầu
  g += '<ellipse cx="' + f1(10 * s) + '" cy="-4" rx="' + f1(hairW) + '" ry="96" fill="' + HAIRC + '" stroke="' + OUT + '" stroke-width="3"/>';
  if (facing) {
    // tai xa
    var ear = function (x) { var X = sx(x, -2), near = dd(x, -2) > 0, rx = 3.5 + 9 * Math.abs(s) * (near ? 1 : .35); return { X: X, near: near, rx: rx }; };
    [1, -1].forEach(function (sgn) { var e = ear(65 * sgn); if (!e.near) g += '<ellipse cx="' + f1(e.X) + '" cy="10" rx="' + f1(e.rx) + '" ry="14" fill="' + SKIN + '" stroke="' + OUT + '" stroke-width="2.6"/>'; });
    // tóc mai xa
    var lockP = function (sgn) {
      if(side) return profileTempleLock(ACT);
      var X = sx(68 * sgn, -4), w = Math.hypot(11 * c, 13 * s), X2 = sx(60 * sgn, -6);
      return '<path d="M' + f1(X - w) + ' -26 L' + f1(X + w) + ' -26 L' + f1(X2 + w * .85) + ' 104 L' + f1(X2 - w * .85) + ' 104Z" fill="' + HAIRC + '" stroke="' + OUT + '" stroke-width="3" stroke-linejoin="round"/>';
    };
    if (c > -.5) [1, -1].forEach(function (sgn) { if (dd(64 * sgn, -4) < 0 && dd(64 * sgn, -4) > -40) g += lockP(sgn); });
    // mặt
    var w = faceW, ch = -7 * s, pts = [], t;
    for (t = 0; t < 40; t++) { var a = t / 40 * Math.PI * 2, sn = Math.sin(a), cs = Math.cos(a), low = Math.max(0, sn); pts.push([w * cs * (1 - .22 * low * low) + ch * low * low, (sn < 0 ? 76 : 76) * sn]); }
    g += '<path d="M' + pts.map(function (p) { return f1(p[0]) + ' ' + f1(p[1]); }).join('L') + 'Z" fill="' + SKIN + '" stroke="' + OUT + '" stroke-width="3" stroke-linejoin="round"/>';
    if (s > .25) { var nb = -w - 1 + ch * 0; g += '<path d="M' + f1(-w + 3) + ' 8 L' + f1(-w - 8 * s) + ' 25 L' + f1(-w + 3) + ' 31Z" fill="' + SKIN + '" stroke="' + OUT + '" stroke-width="2.6" stroke-linejoin="round"/>'; }
    // tai gần
    [1, -1].forEach(function (sgn) { var e = ear(65 * sgn); if (e.near) g += '<ellipse cx="' + f1(e.X) + '" cy="10" rx="' + f1(e.rx) + '" ry="14" fill="' + SKIN + '" stroke="' + OUT + '" stroke-width="2.6"/><path d="M' + f1(e.X - e.rx * .3) + ' 4 Q' + f1(e.X + e.rx * .4) + ' 10 ' + f1(e.X - e.rx * .2) + ' 18" fill="none" stroke="' + SKINSH + '" stroke-width="1.8"/>'; });
    // đường nét trên mặt cầu
    var feat = function (x, y) { var z = 58 * Math.sqrt(Math.max(0, 1 - (x / 62) * (x / 62) - (y / 76) * (y / 76))), D = dd(x, z); var nx = x / 3844, ny = y / 5776, nz = z / 3364, nl = Math.hypot(nx, ny, nz) || 1; return { X: sx(x, z) + ch * Math.max(0, y / 76) * Math.max(0, y / 76) * .5, D: D, sc: Math.max(0, (nx * s + nz * c) / nl) }; };
    [24, -24].forEach(function (x) { var f = feat(x, 24); if (f.D > 4 && f.sc > .12) { var rx = 10 * Math.max(.3, f.sc), ry = 13.5; g += '<ellipse cx="' + f1(f.X) + '" cy="24" rx="' + f1(rx) + '" ry="' + ry + '" fill="#14111a"/><ellipse cx="' + f1(f.X - 2.2 * f.sc) + '" cy="17" rx="' + f1(3.4 * Math.max(.4, f.sc)) + '" ry="3.4" fill="#fff"/>'; } });
    [37, -37].forEach(function (x) { var f = feat(x, 44); if (f.D > 6 && f.sc > .2) g += '<ellipse cx="' + f1(f.X) + '" cy="47" rx="' + f1(9 * f.sc) + '" ry="5.5" fill="#f19a98" opacity=".45"/>'; });
    var fm = feat(0, 56); if (fm.D > 8) { var mw = 7 * Math.max(.3, fm.sc); g += '<path d="M' + f1(fm.X - mw) + ' 56 Q' + f1(fm.X) + ' 61 ' + f1(fm.X + mw) + ' 56" fill="none" stroke="#7a3f3f" stroke-width="2.4" stroke-linecap="round"/>'; }
    var fnz = feat(0, 28); if (fnz.D > 8 && s < .3) g += '<path d="M' + f1(fnz.X) + ' 26 q2 4 -1 5" fill="none" stroke="' + SKINSH + '" stroke-width="2" stroke-linecap="round"/>';
    // mái bằng (cắt zigzag)
    var bw = hairW + 4, zig = [[-bw, -130]], i;
    var by = function (i) { return (i % 2 ? -31 : -25); };
    var steps = 14;
    zig.push([-bw, -24]);
    for (i = 0; i <= steps; i++) zig.push([-bw + (2 * bw) * i / steps, by(i) + (i % 3 === 0 ? 2 : 0)]);
    zig.push([bw, -130]);
    g += '<clipPath id="' + id + '"><path d="M' + zig.map(function (p) { return f1(p[0]) + ' ' + f1(p[1]); }).join('L') + 'Z"/></clipPath>';
    g += '<g clip-path="url(#' + id + ')"><ellipse cx="' + f1(10 * s) + '" cy="-4" rx="' + f1(hairW) + '" ry="96" fill="' + HAIRC + '"/>' +
      '<path d="M' + f1(-hairW * .8 + 8 * s) + ' -52 Q' + f1(8 * s) + ' -92 ' + f1(hairW * .8 + 8 * s) + ' -52" fill="none" stroke="#3b3850" stroke-width="5" opacity=".55" stroke-linecap="round"/></g>';
    // viền dưới mái
    g += '<path d="M' + zig.slice(2, zig.length - 1).map(function (p) { return f1(p[0]) + ' ' + f1(p[1]); }).join('L') + '" fill="none" stroke="' + OUT + '" stroke-width="2.4" stroke-linejoin="round"/>';
    // tóc mai gần
    if (c > -.5) [1, -1].forEach(function (sgn) { if (dd(64 * sgn, -4) >= 0) g += lockP(sgn); });
    // kẹp hoa
    var fl = (function () { var x = 48, y = -58, z = 36; return { X: sx(x, z), D: dd(x, z) }; })();
    if (fl.D > 4) { var fs = Math.max(.35, Math.min(1, fl.D / 40)); g += '<g transform="translate(' + f1(fl.X) + ' -58) scale(' + f1(Math.max(.45, fs)) + ')">' + [0, 1, 2, 3, 4].map(function (k) { var a = k * 72 * D2R; return '<circle cx="' + f1(Math.cos(a) * 8) + '" cy="' + f1(Math.sin(a) * 8) + '" r="6.4" fill="#d84a4a" stroke="' + OUT + '" stroke-width="1.8"/>'; }).join('') + '<circle r="3.6" fill="#f6c453" stroke="' + OUT + '" stroke-width="1.4"/></g>'; }
  } else {
    // sau đầu: đường rẽ + sợi tóc
    g += '<path d="M' + f1(10 * s) + ' -98 Q' + f1(14 * s - 8) + ' -40 ' + f1(8 * s) + ' 30" fill="none" stroke="#3b3850" stroke-width="4" opacity=".5" stroke-linecap="round"/>';
  }
  return g;
}


function hull2(P) {
  P = P.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
  var cr = function (o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }, lo = [], up = [], i;
  for (i = 0; i < P.length; i++) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], P[i]) <= 0) lo.pop(); lo.push(P[i]); }
  for (i = P.length - 1; i >= 0; i--) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], P[i]) <= 0) up.pop(); up.push(P[i]); }
  lo.pop(); up.pop(); return lo.concat(up);
}
function shoeSVG(J, k, phi, SH) {
  var An = J['an' + k], fw = J['fw' + k], dn = J['dn' + k], lat = nrm(crs(fw, dn));
  /* [f (tới), d (xuống), nửa rộng] theo lát cắt dọc giày */
  var up = [[-20, -3, 14], [-23, 24, 15], [-18, 44, 15], [6, -3, 15], [22, 14, 18], [40, 26, 20], [56, 38, 17], [66, 46, 12], [60, 50, 14], [40, 50, 20], [0, 50, 16]];
  var sole = [[-23, 44, 15], [-20, 54, 15], [0, 54, 17], [40, 54, 21], [60, 54, 15], [67, 48, 12], [66, 44, 12], [40, 44, 20], [0, 44, 16]];
  var mk = function (arr) { var Q = []; arr.forEach(function (p) { [1, -1].forEach(function (sg) { var v = add(An, add(add(mul(fw, p[0]), mul(dn, p[1])), mul(lat, sg * p[2]))); var q = proj(v, phi); Q.push([q[0], q[1]]); }); }); return hull2(Q); };
  var pd = function (H) { return 'M' + H.map(function (q) { return f1(q[0]) + ' ' + f1(q[1]); }).join('L') + 'Z'; };
  var o = '<path d="' + pd(mk(sole)) + '" fill="' + (SH.sole || SH.sh) + '" stroke="' + OUT + '" stroke-width="3" stroke-linejoin="round"/>';
  o += '<path d="' + pd(mk(up)) + '" fill="' + SH.col + '" stroke="' + OUT + '" stroke-width="3" stroke-linejoin="round"/>';
  /* vệt sáng ở mũi + cổ giày */
  var hp = function (f, d, w) { var q = proj(add(An, add(add(mul(fw, f), mul(dn, d)), mul(lat, w))), phi); return f1(q[0]) + ' ' + f1(q[1]); };
  o += '<path d="M' + hp(28, 24, 6) + ' Q' + hp(48, 30, 4) + ' ' + hp(60, 42, 2) + '" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="2.4" stroke-linecap="round"/>';
  o += '<path d="M' + hp(-18, 10, 13) + ' Q' + hp(0, 4, 14) + ' ' + hp(10, 6, 13) + '" fill="none" stroke="' + SH.sh + '" stroke-width="2.4" stroke-linecap="round"/>';
  return o;
}
/* ---------- 7. DỰNG MỘT KHUNG HÌNH CHO MỘT GÓC ---------- */
function renderView(p, phi) {
  var J = solve(p), O = OUTFITS[OUTFIT], items = [], c = Math.cos(phi * D2R), s = Math.sin(phi * D2R);
  var D = function (v) { return proj(v, phi)[2]; };
  var P2 = function (v) { var q = proj(v, phi); return [q[0], q[1]]; };
  var T = O.top, B = O.bottom, SO = O.socks, SH = O.shoes;
  SKIN = O.skin || '#fbe1cd'; SKINSH = O.skinSh || '#e6b99e'; HAIRC = O.hair || '#16141c'; EYEC = O.eye || '#6b4a3a'; KH.eye = EYEC; KH.crown = !!O.crown; KH.circles = !!O.circles; KH.blush = O.blush !== false;
  // bóng đất
  var gx = P2(J.pel)[0];
  var shadow = '<ellipse cx="' + f1(gx) + '" cy="806" rx="' + f1(Math.hypot(150 * c, 120 * s) * .9 + 24) + '" ry="13" fill="#000" opacity=".16"/>';
  // chân: MỘT đường dẫn Q cho da, tất, quần; mọi lớp cắt từ cùng Q nên mép trùng nhau
  var aw = function (pr, kk, sc) { var w = interp(pr, kk); return Math.hypot(w[0] * c, w[1] * s) * (sc || 1); };
  [['L', 1], ['R', -1]].forEach(function (e) {
    var k = e[0], An = J['an' + k], sdir = nrm(sub(An, J['kn' + k])), g = '';
    var ext = [add(J['hp' + k], mv(J.Rp, [-e[1] * 14, -26, 0])), J['hp' + k], J['kn' + k], An, add(An, mul(sdir, 12))];
    var Q = limbQ(ext, phi, 38), up1 = function (pr) { return pr.map(function (r) { return [r[0] + 1, r[1], r[2]]; }); }, sh1 = function (pr) { return [[0, 28, 26]].concat(up1(pr)); };
    g += tube(ext, up1(PF.legSkin), { phi: phi, path: Q, fill: SKIN, shade: SKINSH, caps: 'fr', k0: 1.3, k1: 4 });
    var kneeProf = up1(PF.legSkin), kneeCol = SKINSH;
    if (SO) { var sp = up1(SO.prof); g += tube(ext, sp, { phi: phi, path: Q, fill: SO.col, shade: SO.sh, k0: SO.from + 1, k1: 3.7, caps: 'ff' }) + tube(ext, sp, { phi: phi, path: Q, fill: 'none', k0: SO.from + 1, k1: SO.from + 1.1, caps: 'ff', sw: 2 }); }
    if (B.kind === 'pants') { g += tube(ext, sh1(B.leg), { phi: phi, path: Q, fill: B.col, shade: B.sh, k0: 0, k1: 2.96, caps: 'ff', lines: [-.1] }) + tube(ext, sh1(B.leg), { phi: phi, path: Q, fill: B.sh, k0: 2.86, k1: 2.96, caps: 'ff', nostroke: true, scale: 1.01 }); kneeProf = sh1(B.leg); kneeCol = B.sh; }
    else if (B.kind !== 'skirt') g += tube(ext, sh1(B.leg), { phi: phi, path: Q, fill: B.col, shade: B.sh, k0: 0, k1: 1 + B.len, caps: 'ff' }) + tube(ext, sh1(B.leg), { phi: phi, path: Q, fill: B.sh, k0: .93 + B.len, k1: 1 + B.len, caps: 'ff', nostroke: true, scale: 1.01 });
    g += crease(Q, 2, aw(kneeProf, 2), kneeCol, .8);
    // giày: bao lồi (convex hull) của hình giày loafer, mọi góc đều ra hình bàn chân
    g += shoeSVG(J, k, phi, SH);
    items.push({ id: 'leg' + k, d: .5 + .001 * D(J['kn' + k]), svg: g });
  });
  // khung chậu + quần
  (function () {
    var W2 = add(J.pel, mv(J.Rp, [0, -50, 0])), Cr = add(J.pel, mv(J.Rp, [0, 22, 0])), mid = add(J.pel, mv(J.Rp, [0, -15, 0]));
    var g = tube([W2, mid, Cr], [[0, 42, 30], [1, 56, 35], [2, 58, 34]], { phi: phi, fill: B.col, shade: B.sh, caps: 'ff', open: true });
    if (B.kind === 'shorts' && B.pleat && c > .25) {
      [-17, 17].forEach(function (x) { var a = P2(add(J.pel, mv(J.Rp, [x, -48, 34]))), b = P2(add(J.pel, mv(J.Rp, [x * 1.1, 8, 34]))); g += '<path d="M' + f1(a[0]) + ' ' + f1(a[1]) + ' L' + f1(b[0]) + ' ' + f1(b[1]) + '" stroke="' + B.sh + '" stroke-width="2.4" stroke-linecap="round"/>'; });
    }
    var wb = tube([W2, add(W2, mv(J.Rp, [0, 7, 0]))], [[0, 42, 30], [1, 43, 31]], { phi: phi, fill: B.sh, caps: 'ff', nostroke: true });
    if (B.kind !== 'skirt') items.push({ id: 'pel', d: D(J.pel) + 1.5, svg: g + wb });
    else (function () {
      var ring = function (ctr, R, Rz, Mx) { var o = []; for (var a = 0; a < 10; a++) { var t = a / 10 * Math.PI * 2; o.push(add(ctr, mv(Mx, [R * Math.cos(t), 0, Rz * Math.sin(t)]))); } return o; };
      var tc = add(J.chest, mv(J.Rs, [0, B.sashY || 26, 0])), pts3 = ring(tc, 48, 30, J.Rs).concat(ring(add(J.pel, mv(J.Rp, [0, 34, 0])), 62, 40, J.Rp)), hc = [];
      ['L', 'R'].forEach(function (k) { var h = add(J['kn' + k], mul(sub(J['an' + k], J['kn' + k]), B.hem || .62)), ho = mul(SK.hem[k].o, B.flow || 0), hmid = add(J.pel, mv(J.Rp, [0, B.short ? 210 : 330, 0])); h = add(add(mul(hmid, .45), mul(h, .55)), ho); hc.push(h); pts3 = pts3.concat(ring(h, B.hemR || 68, (B.hemR || 68) * .74, J.Rp)).concat(B.short ? [] : ring(add(add(J['kn' + k], mv(J.Rp, [0, -6, 0])), mul(ho, .35)), 56, 44, J.Rp)); });
      var H = hull2(pts3.map(function (v) { return P2(v); }));
      var sg = '<path d="M' + H.map(function (q) { return f1(q[0]) + ' ' + f1(q[1]); }).join('L') + 'Z" fill="' + B.col + '" stroke="' + OUT + '" stroke-width="3" stroke-linejoin="round"/>';
      var my = Math.max.apply(null, H.map(function (q) { return q[1]; })), hb = H.filter(function (q) { return q[1] > my - 9; }).sort(function (a, b) { return a[0] - b[0]; });
      if (hb.length > 1) sg += '<path d="M' + hb.map(function (q) { return f1(q[0]) + ' ' + f1(q[1] - 4); }).join('L') + '" fill="none" stroke="' + B.trim + '" stroke-width="' + (B.hemW || 7) + '" stroke-linecap="round"/>';
      var hm = mul(add(hc[0], hc[1]), .5);
      (B.folds || [-.55, 0, .55]).forEach(function (f) { var tp = P2(add(tc, mv(J.Rs, [f * 48, 0, 30]))), bt = P2(add(hm, mv(J.Rp, [f * 120, 0, 50]))); if (c > .2) sg += '<path d="M' + f1(tp[0]) + ' ' + f1(tp[1]) + ' Q' + f1((tp[0] + bt[0]) / 2) + ' ' + f1((tp[1] + bt[1]) / 2 + 6) + ' ' + f1(bt[0]) + ' ' + f1(bt[1]) + '" fill="none" stroke="' + B.sh + '" stroke-width="2.4" opacity=".55" stroke-linecap="round"/>'; });
      var zf = c >= -.05 ? 32 : -30, bl = P2(add(tc, mv(J.Rs, [-50 * Math.max(.35, Math.abs(c)) / Math.max(.35, Math.abs(c)), 0, zf]))), br = P2(add(tc, mv(J.Rs, [50, 0, zf])));
      sg += tube([add(tc, mv(J.Rs, [-50, 0, zf])), add(tc, mv(J.Rs, [50, 0, zf]))], [[0, B.sashW || 9, B.sashW || 9], [1, B.sashW || 9, B.sashW || 9]], { phi: phi, fill: B.sashCol || B.trim, caps: 'ff', pass: 0 });
      if (c > .2 && !B.noTail) { var kc = P2(add(tc, mv(J.Rs, [0, 2, 34]))); sg += '<g transform="translate(' + f1(kc[0]) + ' ' + f1(kc[1] + (B.sashY ? 8 : 0)) + ') scale(1 ' + f1((B.tail || 42) / 42) + ') skewX(' + f1(Math.atan(((SK.tail.o[0] * c - SK.tail.o[2] * s) * (B.flow || 0)) / (B.tail || 42) * 1.4) / D2R) + ')"><path d="M0 0 L-6 40 L2 36 L6 44 L5 4Z M0 0 L12 38 L4 34 L0 46Z" fill="' + (B.sashCol || B.col) + '" stroke="' + OUT + '" stroke-width="2.2" stroke-linejoin="round"/></g><circle cx="' + f1(kc[0]) + '" cy="' + f1(kc[1] + (B.sashY ? 8 : 0)) + '" r="' + (B.sashW ? 11 : 7) + '" fill="' + (B.sashCol || B.trim) + '" stroke="' + OUT + '" stroke-width="2.4"/>'; }
      items.push({ id: 'skirt', d: 3.6, svg: sg });
    })();
  })();
  // cổ
  items.push({ id: 'neck', d: 2, svg: tube([J.neckB, J.headJ], PF.neck, { phi: phi, fill: SKIN, shade: SKINSH, caps: 'rr' }) });
  // thân áo
  (function () {
    var hem = add(J.wst, mv(J.Rl, [0, T.hemDrop, 0])), g = '';
    g += tube([hem, J.mid, J.chest, J.neckB], PF.uTorso3, { phi: phi, fill: T.col, shade: T.sh, caps: 'fr', pass: 4 });
    var loc = function (x, y, z) { return P2(add(J.chest, mv(J.Rs, [x, y, z]))); };
    if (T.kind === 'sailor') {
      var back = c < .06, front = c > -.06, navy = T.navy;
      if (back) { var bp = smooth([loc(-57, 2, -12), loc(57, 2, -12), loc(54, 70, -24), loc(-54, 70, -24)], 1); g += poly2(bp, navy) + '<path d="M' + [loc(-50, 56, -24), loc(50, 56, -24)].map(function (q) { return f1(q[0]) + ' ' + f1(q[1]); }).join('L') + '" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M' + [loc(-48, 62, -24), loc(48, 62, -24)].map(function (q) { return f1(q[0]) + ' ' + f1(q[1]); }).join('L') + '" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/>'; }
      if (front) {
        [1, -1].forEach(function (sg2) {
          var fp = smooth([loc(sg2 * 20, -16, 20), loc(sg2 * 64, 2, 8), loc(sg2 * 56, 36, 18), loc(sg2 * 18, 78, 30), loc(0, 82, 30), loc(sg2 * 4, 24, 26)], 1);
          g += poly2(fp, navy);
          var st = smooth([loc(sg2 * 26, -6, 22), loc(sg2 * 57, 8, 11), loc(sg2 * 50, 33, 20), loc(sg2 * 16, 68, 31)], 0);
          g += '<path d="M' + st.map(function (q) { return f1(q[0]) + ' ' + f1(q[1]); }).join('L') + '" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
        });
        if (c > .22) {
          var bc = loc(0, 76, 33), bs = Math.max(.4, c), bow = '<g transform="translate(' + f1(bc[0]) + ' ' + f1(bc[1]) + ') scale(' + f1(bs) + ' 1)"><path d="M0 0 L-24 -12 Q-30 0 -24 12Z M0 0 L24 -12 Q30 0 24 12Z" fill="' + T.red + '" stroke="' + OUT + '" stroke-width="2.6" stroke-linejoin="round"/><path d="M-3 4 L-17 54 L-5 48 L0 60 L4 8Z" fill="' + T.red + '" stroke="' + OUT + '" stroke-width="2.4" stroke-linejoin="round"/><path d="M3 4 L16 50 L5 46 L0 58 L-4 8Z" fill="' + T.red + '" stroke="' + OUT + '" stroke-width="2.4" stroke-linejoin="round" opacity=".9"/><rect x="-7" y="-8" width="14" height="16" rx="5" fill="' + T.red + '" stroke="' + OUT + '" stroke-width="2.6"/></g>';
          g += bow;
        }
      }
    } else if (T.kind === 'hanfu') {
      var tcol = T.navy;
      if (T.inner && c > -.06) g += poly2(smooth([loc(-17, -22, 22), loc(17, -22, 22), loc(5, 46, 31), loc(-5, 46, 31)], 1), T.inner);
      if (c < .06) g += poly2(smooth([loc(-26, -14, -16), loc(26, -14, -16), loc(24, -4, -20), loc(-24, -4, -20)], 1), T.red);
      if (c > -.06) {
        g += poly2(smooth([loc(-30, -20, 20), loc(-16, -22, 22), loc(10, 44, 32), loc(-4, 50, 32)], 1), T.red) + poly2(smooth([loc(30, -20, 20), loc(16, -22, 22), loc(-12, 38, 32), loc(2, 46, 32)], 1), T.red);
        g += '<path d="M' + [loc(-23, -18, 21), loc(5, 42, 32)].map(function (q) { return f1(q[0]) + ' ' + f1(q[1]); }).join('L') + '" stroke="' + tcol + '" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M' + [loc(23, -18, 21), loc(-5, 38, 32)].map(function (q) { return f1(q[0]) + ' ' + f1(q[1]); }).join('L') + '" stroke="' + tcol + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
      }
    } else if (T.kind === 'tee') {
      var nk = tube([add(J.neckB, mv(J.Rs, [0, 6, 6])), add(J.neckB, mv(J.Rs, [0, -2, 6]))], [[0, 25, 21], [1, 24, 20]], { phi: phi, fill: T.navy, caps: 'ff', sw: 2.6, pass: 0 });
      if (c > -.1) g += nk;
      g += tube([hem, add(hem, mv(J.Rl, [0, -9, 0]))], [[0, 53, 35], [1, 53, 35]], { phi: phi, fill: T.sh, caps: 'ff', nostroke: true, scale: 1.01 });
    }
    items.push({ id: 'torso', d: 3, svg: g });
  })();
  renderHair(J, phi, items);
  outfitDetails(J, phi, items, T, B);
  // tay
  [['L', 1], ['R', -1]].forEach(function (e) {
    var k = e[0], ch3 = [J['sh' + k], J['el' + k], J['wr' + k]], g = '', Qa = limbQ(ch3, phi, 26), w2 = add(J['wr' + k], mul(SK.sl[k].o, T.flow || 0)), Qs = T.flow ? limbQ([ch3[0], ch3[1], w2], phi, 26) : Qa;
    if (T.sleeveEnd < 2) g += tube(ch3, PF.armSkin, { phi: phi, path: Qa, fill: SKIN, shade: SKINSH, caps: 'rf' });
    g += handSVG(J, k, phi, p[k].hand);
    g += tube(ch3, T.sleeve, { phi: phi, path: Qs, fill: T.col, shade: T.sh, k0: 0, k1: T.sleeveEnd, caps: 'rf' });
    if (T.cuff) g += tube(ch3, T.sleeve, { phi: phi, path: Qs, fill: T.navy, k0: T.cuff[0], k1: T.cuff[1], caps: 'ff', scale: 1.02 }) + (T.kind === 'sailor' ? [1.86, 1.94].map(function (kk) { return tube(ch3, T.sleeve, { phi: phi, path: Qs, fill: '#fff', k0: kk, k1: kk + .03, caps: 'ff', nostroke: true, scale: 1.025 }); }).join('') : '');
    if (T.tassel) { var tw = P2(w2); g += [-27, 27].map(function (dx) { return '<path d="M' + f1(tw[0] + dx) + ' ' + f1(tw[1] - 6) + ' l' + (dx < 0 ? -2 : 2) + ' 22" stroke="' + T.red + '" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="' + f1(tw[0] + dx + (dx < 0 ? -3 : 3)) + '" cy="' + f1(tw[1] + 17) + '" r="2.6" fill="' + T.red + '"/>'; }).join(''); }
    g += crease(Qa, 1, aw(T.sleeveEnd > 1 ? T.sleeve : PF.armSkin, 1), T.sleeveEnd > 1 ? T.sh : SKINSH, .75);
    items.push({ id: 'arm' + k, d: D(J['el' + k]) + 4, svg: g });
  });
  // đầu
  var fh = mv(J.Rh, [0, 0, 1]), hpsi = Math.atan2(fh[0], fh[2]) / D2R;
  var Hc = P2(J.head), up = proj(mv(J.Rh, [0, -1, 0]), phi), ang = Math.atan2(up[0], -up[1]) / D2R;
  var dHair = (items.filter(function (i) { return i.id === 'hairB'; })[0] || { d: 0 }).d;
  items.push({ id: 'head', d: Math.max(6, dHair) + .5, svg: '<g transform="translate(' + f1(Hc[0]) + ' ' + f1(Hc[1]) + ') rotate(' + f1(ang) + ')">' + headSel(phi - hpsi, O) + '</g>' });
  var pv = ORDER[phi] || {};
  items.sort(function (a, b) { var df = a.d - b.d; if (HYST && Math.abs(df) < HYST && pv[a.id] != null && pv[b.id] != null) return pv[a.id] - pv[b.id]; return df; });
  var nw = {}; items.forEach(function (it, ix) { nw[it.id] = ix; }); ORDER[phi] = nw; LASTORDER = items.map(function (i) { return i.id; });
  return { svg: shadow + items.map(function (i) { return pickableItem(i); }).join(''), J: J, phi: phi };
}

/* ---------- 8. LỚP PHỦ KHỚP ---------- */
var BONES = [['pel', 'wst'], ['wst', 'chest'], ['chest', 'neckB'], ['neckB', 'headJ'], ['headJ', 'head'], ['chest', 'shL'], ['chest', 'shR'], ['shL', 'elL'], ['elL', 'wrL'], ['wrL', 'hdL'], ['shR', 'elR'], ['elR', 'wrR'], ['wrR', 'hdR'],
  ['pel', 'hpL'], ['pel', 'hpR'], ['hpL', 'knL'], ['knL', 'anL'], ['anL', 'hlL'], ['anL', 'toL'], ['hpR', 'knR'], ['knR', 'anR'], ['anR', 'hlR'], ['anR', 'toR']];
var JNAMES = { pel: 'Hông', wst: 'Eo', chest: 'Ngực', neckB: 'Cổ', headJ: 'Đầu', head: 'Tâm đầu', shL: 'Vai T', shR: 'Vai P', elL: 'Khuỷu T', elR: 'Khuỷu P', wrL: 'Cổ tay T', wrR: 'Cổ tay P', hdL: 'Ngón T', hdR: 'Ngón P',
  hpL: 'Khớp hông T', hpR: 'Khớp hông P', knL: 'Gối T', knR: 'Gối P', anL: 'Mắt cá T', anR: 'Mắt cá P', hlL: 'Gót T', hlR: 'Gót P', toL: 'Mũi chân T', toR: 'Mũi chân P' };
function overlay(J, phi) {
  var g = '<g class="skel">';
  BONES.forEach(function (b) { var a = proj(J[b[0]], phi), c = proj(J[b[1]], phi); g += '<line x1="' + f1(a[0]) + '" y1="' + f1(a[1]) + '" x2="' + f1(c[0]) + '" y2="' + f1(c[1]) + '" stroke="#12a4c7" stroke-width="2.4" stroke-linecap="round"/>'; });
  for (var k in JNAMES) { var q = proj(J[k], phi), main = /^(sh|el|wr|hp|kn|an|pel|chest|neckB|headJ)/.test(k); g += '<circle cx="' + f1(q[0]) + '" cy="' + f1(q[1]) + '" r="' + (main ? 6 : 4) + '" fill="' + (main ? '#ff9f1c' : '#fff') + '" stroke="#0b1720" stroke-width="1.6"><title>' + JNAMES[k] + '</title></circle>'; }
  return g + '</g>';
}

/* ===== ĐẦU kiểu Kho 2: mắt có tròng + điểm sáng, mái có sợi + dải sáng, mặt nghiêng theo khuôn đường nét ===== */
var PROF_LINE = 'M161.1 78.0 C159.0 80.0 152.3 85.2 148.6 89.8 C144.9 94.5 141.4 100.8 138.9 106.0 C136.5 111.1 135.2 115.6 134.0 121.0 C132.7 126.4 131.7 132.8 131.4 138.2 C131.1 143.6 131.5 148.8 132.3 153.2 C133.0 157.7 134.7 161.5 136.1 165.1 C137.6 168.7 139.9 171.3 141.1 174.8 C142.3 178.2 143.3 181.9 143.2 185.5 C143.1 189.1 142.3 193.2 140.6 196.2 C139.0 199.3 136.0 201.7 133.1 203.8 C130.2 205.9 125.4 207.1 123.2 208.7 C121.0 210.3 120.0 211.7 120.0 213.4 C120.0 215.2 121.7 217.7 123.2 219.5 C124.8 221.3 127.3 222.8 129.2 224.2 C131.1 225.6 133.5 226.6 134.6 228.1 C135.7 229.6 136.2 231.5 135.7 233.2 C135.2 234.9 132.4 236.6 131.8 238.2 C131.3 239.7 131.5 241.0 132.5 242.5 C133.5 243.9 136.8 245.5 137.8 246.8 C138.8 248.0 138.1 248.2 138.5 250.0 C138.8 251.8 138.7 255.4 140.0 257.5 C141.2 259.7 144.7 260.9 146.0 262.9 C147.4 264.9 147.7 266.8 148.2 269.4 C148.6 271.9 147.8 275.1 148.6 277.9 C149.4 280.8 150.6 284.5 152.9 286.5 C155.2 288.6 159.0 289.9 162.6 290.4 C166.2 291.0 168.5 291.0 174.4 289.8 C180.3 288.6 189.8 285.9 198.0 283.3 C206.3 280.7 216.0 277.5 223.8 274.1 C231.7 270.7 239.6 266.4 245.3 262.9 C251.1 259.4 254.9 256.2 258.2 253.2 C261.6 250.2 264.2 246.2 265.3 244.8';
var EYEC = '#6b4a3a', HL = '#5b5874', HD = '#0c0b11';
function eyeArt(sc, flip) {
  if (BLINK > .5) return '<g transform="scale(' + f1(sc * (flip || 1)) + ' 1)"><g transform="scale(.8)"><path d="M-22 2 Q0 16 22 0" stroke="' + OUT + '" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M-22 2 l-8 -2 M-19 6 l-6 3" stroke="' + OUT + '" stroke-width="3.2" stroke-linecap="round"/></g></g>';
  /* mắt Kho 2 thu 0.8, gốc ở tâm mắt */
  var o = '<g transform="scale(' + f1(sc * (flip || 1)) + ' 1)"><g transform="scale(.8)">' +
    '<ellipse rx="20" ry="22" fill="#fbf4f2" stroke="' + OUT + '" stroke-width="3"/>' +
    '<g clip-path="url(#__ECLIP__)"><ellipse cy="1" rx="14" ry="16" fill="' + EYEC + '"/><ellipse cy="9" rx="13" ry="8" fill="#a9825f" opacity=".55"/>' +
    '<ellipse cy="1" rx="14" ry="16" fill="none" stroke="#2e1d16" stroke-width="2"/><ellipse cy="1" rx="7.2" ry="9.4" fill="#120d10"/>' +
    '<circle cx="-4.6" cy="-5" r="3.8" fill="#fff"/><circle cx="5" cy="6" r="1.9" fill="#fff" opacity=".85"/>' +
    '<ellipse cy="-16" rx="22" ry="10" fill="#6b5a62" opacity=".35"/></g>' +
    '<path d="M-22 -4 Q0 -26 22 -6" stroke="' + OUT + '" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M-22 -4 l-8 -5 M-19 -9 l-6 -7" stroke="' + OUT + '" stroke-width="3.4" stroke-linecap="round"/>' +
    '<path d="M-17 18 Q0 27 17 18" stroke="' + SKINSH + '" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".85"/></g></g>';
  return o;
}
function headArt(phi, O) {
  var c = Math.cos(phi * D2R), s = Math.sin(phi * D2R), id = 'bg' + (++UID), ec = 'ec' + UID, g = '';
  var side = Math.abs(s) > .95, facing = c > -.2;
  var faceW = Math.hypot(66 * c, 60 * s), hairW = Math.hypot(80 * c, 90 * s), hs = 16 * s;
  var sx = function (x, z) { return x * c - z * s; }, dd = function (x, z) { return x * s + z * c; };
  g += '<defs><clipPath id="' + ec + '"><ellipse cy="1" rx="20" ry="22"/></clipPath></defs>';
  /* tóc nền sau đầu */
  g += '<path data-edit-part="hairStyle" d="M' + f1(hs - hairW) + ' 8 C' + f1(hs - hairW) + ' -62 ' + f1(hs - hairW * .55) + ' -100 ' + f1(hs) + ' -100 C' + f1(hs + hairW * .55) + ' -100 ' + f1(hs + hairW) + ' -62 ' + f1(hs + hairW) + ' 8 C' + f1(hs + hairW) + ' 52 ' + f1(hs + hairW * .8) + ' 86 ' + f1(hs) + ' 90 C' + f1(hs - hairW * .8) + ' 86 ' + f1(hs - hairW) + ' 52 ' + f1(hs - hairW) + ' 8Z" fill="' + HAIRC + '" stroke="' + OUT + '" stroke-width="3" stroke-linejoin="round"/>';
  if (facing) {
    var ear = function (x) { var X = sx(x, -2), near = dd(x, -2) > 0, rx = 3.5 + 9 * Math.abs(s) * (near ? 1 : .35); return { X: X, near: near, rx: rx }; };
    if (!side) [1, -1].forEach(function (sgn) { var e = ear(62 * sgn); if (!e.near) g += '<ellipse cx="' + f1(e.X) + '" cy="12" rx="' + f1(e.rx) + '" ry="15" fill="' + SKIN + '" stroke="' + OUT + '" stroke-width="2.6"/>'; });
    var lockP = function (sgn) {
      if(side) return profileTempleLock(ACT);
      var X = sx(66 * sgn, -4), w = Math.hypot(11 * c, 14 * s), X2 = sx(62 * sgn, -6);
      if (side) { X = 27; X2 = 27; w = 11; }
      return '<path d="M' + f1(X - w) + ' -8 Q' + f1(X) + ' -20 ' + f1(X + w) + ' -8 C' + f1(X2 + w * 1.1) + ' 30 ' + f1(X2 + w) + ' 80 ' + f1(X2 + w * .5) + ' 108 L' + f1(X2 - w * .5) + ' 108 C' + f1(X2 - w) + ' 80 ' + f1(X2 - w * 1.1) + ' 30 ' + f1(X - w) + ' -8Z" fill="' + HAIRC + '" stroke="' + OUT + '" stroke-width="3" stroke-linejoin="round"/>' +
        '<path d="M' + f1(X2 - w * .2) + ' -4 C' + f1(X2 - w * .3) + ' 40 ' + f1(X2 - w * .3) + ' 80 ' + f1(X2 - w * .1) + ' 100" stroke="' + HL + '" stroke-width="1.6" fill="none" opacity=".5" stroke-linecap="round"/>';
    };
    if (!side && c > -.5) [1, -1].forEach(function (sgn) { if (dd(70 * sgn, -4) < 0 && dd(70 * sgn, -4) > -40) g += lockP(sgn); });
    if (side) {
      /* mặt nghiêng: khuôn đường nét của Kho 2 */
      var K = .74;
      g += '<g transform="translate(' + f1(-62 - 120 * K) + ' ' + f1(-184 * K) + ') scale(' + K + ')">';
      g += '<path d="' + PROF_LINE + ' L250 246 L252 196 L252 150 L240 120 L200 100 L161 78Z" fill="' + SKIN + '"/>';
      g += '<path d="M254 186 C266 174 285 184 284 204 C283 222 273 234 261 232 C253 222 252 204 254 186Z" fill="' + SKIN + '" stroke="' + OUT + '" stroke-width="3.4" stroke-linejoin="round"/><path d="M261 194 C272 190 277 200 274 212 C272 219 267 222 264 221" fill="none" stroke="' + SKINSH + '" stroke-width="2.6" stroke-linecap="round"/>';
      if (KH.circles) g += '<path d="M150 196 Q166 204 184 194" fill="none" stroke="#6a5a7a" stroke-width="6" opacity=".35" stroke-linecap="round"/>';
      if(KH.blush || KH.expr==='shy') g += '<ellipse cx="176" cy="216" rx="16" ry="8.5" fill="#ee7f8a" opacity=".3"/>';
      var white = 'M144 164 Q157 154 184 160 L186 188 Q168 198 148 188 Q141 176 144 164Z';
      g += profileEyeMarkup({skin:SKIN,eye:EYEC,eyeStyle:KH.eyeStyle,expr:KH.expr},ec,white);
      g += '<path d="M127 224 Q131 226 135 224" stroke="' + SKINSH + '" stroke-width="2" fill="none" stroke-linecap="round"/>' + profileMouth(KH.expr) + '';
      g += '<path d="' + PROF_LINE + '" fill="none" stroke="' + OUT + '" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></g>';
    } else {
      var w = faceW, ch = -7 * s, pts = [], t;
      for (t = 0; t < 44; t++) { var a = t / 44 * Math.PI * 2, sn = Math.sin(a), cs = Math.cos(a), low = Math.max(0, sn); var tp = sn < 0 ? (1 + .06 * sn * sn) : (1 - .34 * Math.pow(low, 2.1)); pts.push([w * cs * tp + ch * low * low, (sn < 0 ? 78 : 88) * sn]); }
      g += '<path d="M' + pts.map(function (p) { return f1(p[0]) + ' ' + f1(p[1]); }).join('L') + 'Z" fill="' + SKIN + '" stroke="' + OUT + '" stroke-width="3" stroke-linejoin="round"/>';
      [1, -1].forEach(function (sgn) { var e = ear(62 * sgn); if (e.near) g += '<ellipse cx="' + f1(e.X) + '" cy="12" rx="' + f1(e.rx) + '" ry="15" fill="' + SKIN + '" stroke="' + OUT + '" stroke-width="2.6"/><path d="M' + f1(e.X - e.rx * .3) + ' 5 Q' + f1(e.X + e.rx * .4) + ' 12 ' + f1(e.X - e.rx * .2) + ' 20" fill="none" stroke="' + SKINSH + '" stroke-width="1.8"/>'; });
      /* má bóng đổ dưới cằm */
      g += '<path d="M' + f1(-w * .8) + ' 40 Q' + f1(ch) + ' 96 ' + f1(w * .8) + ' 40 Q' + f1(ch) + ' 82 ' + f1(-w * .8) + ' 40Z" fill="' + SKINSH + '" opacity=".35"/>';
      var feat = function (x, y) { var z = 60 * Math.sqrt(Math.max(0, 1 - (x / 66) * (x / 66) - (y / 82) * (y / 82))), D = dd(x, z); var nx = x / 4356, ny = y / 6400, nz = z / 3600, nl = Math.hypot(nx, ny, nz) || 1; return { X: sx(x, z) + ch * Math.max(0, y / 80) * Math.max(0, y / 80) * .5, D: D, sc: Math.max(0, (nx * s + nz * c) / nl) }; };
      [1, -1].forEach(function (sgn) { var f = feat(sgn * 32, 18); if (f.D > 4 && f.sc > .1) g += '<g transform="translate(' + f1(f.X) + ' 19)">' + eyeArt(Math.max(.34, f.sc) * 1.22, -sgn).replace('__ECLIP__', ec) + '</g>'; });
      [1, -1].forEach(function (sgn) { var f = feat(sgn * 42, 46); if (f.D > 6 && f.sc > .2) g += '<ellipse cx="' + f1(f.X) + '" cy="52" rx="' + f1(11 * f.sc) + '" ry="6" fill="#ee7f8a" opacity=".33"/>'; });
      [1, -1].forEach(function (sgn) { var f = feat(sgn * 33, -10); if (f.D > 6 && f.sc > .2) g += '<path d="M' + f1(f.X - 14 * f.sc) + ' -10 Q' + f1(f.X) + ' -16 ' + f1(f.X + 14 * f.sc) + ' -10" fill="none" stroke="#2a2430" stroke-width="3.2" stroke-linecap="round"/>'; });
      var fm = feat(0, 62); if (fm.D > 8) { var mw = 8 * Math.max(.3, fm.sc); g += '<path d="M' + f1(fm.X - mw) + ' 63 Q' + f1(fm.X) + ' 70 ' + f1(fm.X + mw) + ' 63" fill="none" stroke="#7a3a45" stroke-width="2.8" stroke-linecap="round"/>'; }
      var fnz = feat(0, 44); if (fnz.D > 8 && s < .5) g += '<path d="M' + f1(fnz.X - 1) + ' 40 q3 4 0 6" fill="none" stroke="' + SKINSH + '" stroke-width="2.2" stroke-linecap="round"/>';
      if (s > .25) g += '<path d="M' + f1(-w + 3) + ' 14 L' + f1(-w - 7 * s) + ' 32 L' + f1(-w + 3) + ' 38Z" fill="' + SKIN + '" stroke="' + OUT + '" stroke-width="2.6" stroke-linejoin="round"/>';
    }
    /* mái bằng có sợi */
    var bw = hairW + 6, zig = [[-bw, -140], [-bw, -34]], i, steps = 16, sc2 = [];
    for (i = 0; i <= steps; i++) { var xx = -bw + 2 * bw * i / steps; zig.push([xx, -36 + 4 * Math.sin(i * 1.7) + (i % 2 ? 3 : -1)]); sc2.push(xx); }
    zig.push([bw, -140]);
    g += '<clipPath id="' + id + '"><path d="M' + zig.map(function (p) { return f1(p[0]) + ' ' + f1(p[1]); }).join('L') + 'Z"/></clipPath>';
    g += '<g data-edit-part="hairStyle" clip-path="url(#' + id + ')"><path d="M' + f1(hs - hairW) + ' 8 C' + f1(hs - hairW) + ' -62 ' + f1(hs - hairW * .55) + ' -100 ' + f1(hs) + ' -100 C' + f1(hs + hairW * .55) + ' -100 ' + f1(hs + hairW) + ' -62 ' + f1(hs + hairW) + ' 8 L' + f1(hs + hairW) + ' 30 L' + f1(hs - hairW) + ' 30Z" fill="' + HAIRC + '"/>';
    if(side) g += profileHairStrands(hairW,hs); else {
    for (i = 1; i < steps; i += 1) { var x0 = sc2[i]; if (Math.abs(x0 - hs) > hairW * .8) continue; g += '<path d="M' + f1(x0 * .35 + 4 * s) + ' -98 Q' + f1(x0 * .8) + ' -60 ' + f1(x0) + ' -24" fill="none" stroke="' + HL + '" stroke-width="1.5" opacity=".38"/>'; }
    }
    var hw2 = hairW * (side ? .5 : .78); g += '<path d="M' + f1(-hw2 + 8 * s) + ' -50 Q' + f1(8 * s) + ' -92 ' + f1(hw2 + 8 * s) + ' -50" fill="none" stroke="' + HL + '" stroke-width="7" opacity=".5" stroke-linecap="round"/></g>';
    g += '<path d="M' + zig.slice(2, zig.length - 1).filter(function (p) { return Math.abs(p[0] - hs) < hairW * .88 && (!side || p[0] < hs + hairW * .5); }).map(function (p) { return f1(p[0]) + ' ' + f1(p[1]); }).join('L') + '" fill="none" stroke="' + OUT + '" stroke-width="2.4" stroke-linejoin="round"/>';
    if (!side && c > -.5) [1, -1].forEach(function (sgn) { if (dd(70 * sgn, -4) >= 0) g += lockP(sgn); });
    if (side) g += lockP(1);
    var fl = (function () { var x = 50, y = -62, z = 38; return { X: sx(x, z), D: dd(x, z) }; })();
    if (KH.crown) g += crownSVG(phi);
    else if (false && fl.D > 4) { var fs = Math.max(.45, Math.min(1, fl.D / 40)); g += '<g transform="translate(' + f1(fl.X) + ' -62) scale(' + f1(fs) + ')">' + [0, 1, 2, 3, 4].map(function (k) { var a = k * 72 * D2R; return '<ellipse cx="' + f1(Math.cos(a) * 8) + '" cy="' + f1(Math.sin(a) * 8) + '" rx="6.4" ry="6.4" fill="#d84a4a" stroke="' + OUT + '" stroke-width="1.8"/>'; }).join('') + '<circle r="3.6" fill="#f6c453" stroke="' + OUT + '" stroke-width="1.4"/></g>'; }
  } else {
    g += '<path d="M' + f1(hs) + ' -98 Q' + f1(14 * s - 8) + ' -40 ' + f1(8 * s) + ' 40" fill="none" stroke="' + HL + '" stroke-width="2" opacity=".5" stroke-linecap="round"/>';
    g += '<path d="M' + f1(-hairW * .75 + hs) + ' -48 Q' + f1(hs) + ' -92 ' + f1(hairW * .75 + hs) + ' -48" fill="none" stroke="' + HL + '" stroke-width="7" opacity=".42" stroke-linecap="round"/>';
  }
  return g;
}

/* ===== ĐẦU TRƯỚC: nét vẽ tay của Kho 2, dùng nguyên khuôn (không suy ra bằng công thức) ===== */
var KH = { expr: 'smile', eyeStyle: 'normal', blush: true, eye: '#6b4a3a', crown: false, circles: false };
function crownSVG(phi) {
  var c = Math.cos(phi * D2R), s = Math.sin(phi * D2R), L = [], a, o = '';
  for (a = 0; a < 20; a++) { var t = a / 20 * Math.PI * 2, x = 60 * Math.sin(t), z = 50 * Math.cos(t), y = -86 + 26 * Math.pow(Math.sin(t), 2) * (z > 0 ? 1 : .5), D = x * s + z * c; L.push({ X: x * c - z * s, y: y, D: D, k: a }); }
  L.filter(function (p) { return p.D > -8; }).sort(function (p, q) { return p.D - q.D; }).forEach(function (p) { var sc = .62 + .38 * Math.min(1, Math.max(0, (p.D + 8) / 50)), col = p.k % 2 ? '#9fb8d4' : '#e9eef5'; o += '<g transform="translate(' + f1(p.X) + ' ' + f1(p.y) + ') scale(' + f1(sc) + ')">' + [0, 1, 2, 3, 4].map(function (q) { var b = q * 72 * D2R; return '<circle cx="' + f1(Math.cos(b) * 6) + '" cy="' + f1(Math.sin(b) * 6) + '" r="5.2" fill="' + col + '" stroke="' + OUT + '" stroke-width="1.5"/>'; }).join('') + '<circle r="3" fill="#e8d38a" stroke="' + OUT + '" stroke-width="1"/></g>'; });
  return o;
}
function kh2r(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function kmix(a, b, t) { var x = kh2r(a), y = kh2r(b); return '#' + [0, 1, 2].map(function (i) { return Math.max(0, Math.min(255, Math.round(x[i] + (y[i] - x[i]) * t))).toString(16).padStart(2, '0'); }).join(''); }
function kshade(c, t) { return t >= 0 ? kmix(c, '#ffffff', t) : kmix(c, '#000000', -t); }
  function nativeEyeNew(st, o) {
    var O = OUT;
    var es = st.eyeStyle; if (['sparkle', 'round', 'cat', 'heart', 'sleepy', 'happy'].indexOf(es) < 0) return null;
    var e = st.eye, ed = kshade(e, -.45), w = o.w, h = o.h, rx = o.irx, ry = o.iry, cx = o.cx || 0, skin = st.skin, small = (st.expr === 'creepy' || st.expr === 'grin') ? .72 : 1, a = '';
    function iris(col, k) { k = k || 1; return '<ellipse cx="' + cx + '" rx="' + rx * k + '" ry="' + ry * k + '" fill="' + col + '"/><ellipse cx="' + cx + '" cy="' + ry * k * .5 + '" rx="' + rx * k * .8 + '" ry="' + ry * k * .42 + '" fill="' + kshade(col, .35) + '" opacity=".55"/><ellipse cx="' + cx + '" rx="' + rx * k + '" ry="' + ry * k + '" fill="none" stroke="' + ed + '" stroke-width="' + Math.max(1.4, rx * .13) + '"/>'; }
    function pupil(kx, ky, col) { return '<ellipse cx="' + cx + '" rx="' + rx * kx * small + '" ry="' + ry * ky * small + '" fill="' + (col || O) + '"/>'; }
    function hl(x, y, kx, ky) { return '<ellipse cx="' + (cx + rx * x) + '" cy="' + ry * y + '" rx="' + rx * kx + '" ry="' + ry * ky + '" fill="#fff"/>'; }
    function star(x, y, s) { return '<path d="M0 -1 L.26 -.26 L1 0 L.26 .26 L0 1 L-.26 .26 L-1 0 L-.26 -.26Z" transform="translate(' + (cx + rx * x) + ' ' + ry * y + ') scale(' + rx * s + ')" fill="#fff"/>'; }
    var base = '#f7f3f2';
    if (es === 'sparkle') a = iris(e, 1.05) + pupil(.36, .42) + hl(-.3, -.42, .3, .34) + hl(.36, .42, .15, .15) + star(.42, -.5, .22) + star(-.45, .5, .13);
    else if (es === 'round') a = iris(e, 1.12) + pupil(.5, .52) + hl(-.32, -.38, .36, .38) + hl(.34, .42, .16, .16);
    else if (es === 'cat') a = iris(kshade(e, .12), 1.05) + '<ellipse cx="' + cx + '" rx="' + rx * .15 * small + '" ry="' + ry * .92 + '" fill="' + O + '"/>' + hl(-.34, -.4, .22, .26);
    else if (es === 'heart') a = iris(e, 1.05) + '<path d="M' + cx + ' ' + ry * .34 + ' C' + (cx - rx * .8) + ' ' + -ry * .12 + ' ' + (cx - rx * .55) + ' ' + -ry * .62 + ' ' + (cx - rx * .2) + ' ' + -ry * .5 + ' C' + (cx - rx * .06) + ' ' + -ry * .46 + ' ' + cx + ' ' + -ry * .36 + ' ' + cx + ' ' + -ry * .3 + ' C' + cx + ' ' + -ry * .36 + ' ' + (cx + rx * .06) + ' ' + -ry * .46 + ' ' + (cx + rx * .2) + ' ' + -ry * .5 + ' C' + (cx + rx * .55) + ' ' + -ry * .62 + ' ' + (cx + rx * .8) + ' ' + -ry * .12 + ' ' + cx + ' ' + ry * .34 + 'Z" fill="#e0415f"/>' + hl(-.4, -.44, .24, .27);
    else if (es === 'sleepy') a = iris(e, 1) + pupil(.42, .46) + hl(-.3, .1, .22, .24) +
      '<path d="M' + (-w - 2) + ' ' + -h * .05 + ' L' + (-w - 2) + ' ' + (-h - 4) + ' L' + (w + 2) + ' ' + (-h - 4) + ' L' + (w + 2) + ' ' + -h * .05 + ' Q0 ' + h * .28 + ' ' + (-w - 2) + ' ' + -h * .05 + 'Z" fill="' + skin + '"/><path d="M' + (-w) + ' ' + -h * .05 + ' Q0 ' + h * .28 + ' ' + w + ' ' + -h * .05 + '" fill="none" stroke="' + O + '" stroke-width="' + Math.max(2, w * .13) + '" stroke-linecap="round"/>';
    else { base = skin; a = '<path d="M' + -w * .78 + ' ' + h * .3 + ' Q0 ' + -h * 1.0 + ' ' + w * .78 + ' ' + h * .3 + '" fill="none" stroke="' + O + '" stroke-width="' + Math.max(2.4, w * .2) + '" stroke-linecap="round"/>'; }
    return { base: base, art: a, closed: es === 'happy' };
  }
function khoFront() {
  var st = { skin: SKIN, hair: HAIRC, eye: KH.eye, expr: KH.expr, eyeStyle: KH.eyeStyle, blush: KH.blush }, O = OUT, e = st.expr, hair = HAIRC, hl = kshade(hair, .4), skinD = kshade(SKIN, -.14), uid = 'kf' + (++UID);
  var P = function (d, f, sw) { return '<path d="' + d + '" fill="' + f + '" stroke="' + O + '" stroke-width="' + (sw || 3) + '" stroke-linejoin="round" stroke-linecap="round"/>'; };
  var sym = function (x) { return x + '<g transform="translate(380 0) scale(-1 1)">' + x + '</g>'; };
  var s = '<defs><clipPath id="' + uid + 'e"><ellipse rx="17" ry="13"/></clipPath></defs>';
  s += '<g data-edit-part="hairStyle">' + P('M120 150 C110 52 160 34 190 34 C230 34 270 52 260 150Z', hair) + '</g>';
  s += P('M130 140 C130 100 155 80 190 80 C225 80 250 100 250 140 C250 175 232 200 212 208 Q190 216 168 208 C148 200 130 175 130 140Z', SKIN, 3.5);
  s += '<path d="M188 174 Q190 178 193 175" fill="none" stroke="' + skinD + '" stroke-width="2" stroke-linecap="round"/>';
  if (KH.circles) s += sym('<ellipse cx="160" cy="168" rx="15" ry="5" fill="#6a5a7a" opacity=".38"/>');
  if (st.blush || e === 'shy') s += sym('<ellipse cx="150" cy="180" rx="12" ry="6" fill="#e8757f" opacity=".32"/>');
  var inner, en = kEyeNew(st, { w: 17, h: 13, irx: 11, iry: 11, cx: 1 });
  if (en) inner = '<ellipse rx="17" ry="13" fill="' + en.base + '"/>' + en.art;
  else inner = '<ellipse rx="17" ry="13" fill="#f6f2f2"/><circle cx="1" cy="1" r="11" fill="' + st.eye + '"/><circle cx="1" cy="1" r="11" fill="none" stroke="' + kshade(st.eye, -.45) + '" stroke-width="2"/><circle cx="1" cy="1" r="4.6" fill="' + O + '"/><circle cx="-3" cy="-4" r="3.2" fill="#fff"/><circle cx="5" cy="4" r="1.6" fill="#fff" opacity=".8"/>';
  var eyeG = BLINK > .5 ? '<path d="M-17 1 Q0 12 17 1" fill="none" stroke="' + O + '" stroke-width="3.6" stroke-linecap="round"/><path d="M-17 1 L-23 -3" fill="none" stroke="' + O + '" stroke-width="3" stroke-linecap="round"/>' :
    '<g clip-path="url(#' + uid + 'e)">' + inner + '<ellipse cx="0" cy="-10" rx="17" ry="6" fill="#000" opacity=".16"/></g>' +
    '<path d="M-18 0 Q-9 -15 6 -14 Q16 -12 19 -1" fill="none" stroke="' + O + '" stroke-width="3.6" stroke-linecap="round"/><path d="M-18 0 L-23 -5" fill="none" stroke="' + O + '" stroke-width="3" stroke-linecap="round"/><path d="M-11 11 Q0 15 12 10" fill="none" stroke="' + O + '" stroke-width="1.5" opacity=".45" stroke-linecap="round"/>';
  s += sym('<g data-edit-part="eyes" transform="translate(160 152)">' + eyeG + '</g>');
  var brow = { smile: 'M144 128 Q158 121 176 126', neutral: 'M144 128 Q160 125 176 128', shy: 'M144 130 Q160 124 176 127', sad: 'M144 132 Q160 126 176 119', creepy: 'M144 127 Q160 115 176 126', grin: 'M144 126 Q160 116 176 125' }[e];
  s += sym('<path d="' + brow + '" fill="none" stroke="' + kshade(hair, .08) + '" stroke-width="3.2" stroke-linecap="round"/>');
  var M = '#7a3a45', mouth = '';
  if (e === 'smile') mouth = '<path d="M178 189 Q190 199 202 189" fill="none" stroke="' + M + '" stroke-width="2.6" stroke-linecap="round"/>';
  else if (e === 'neutral') mouth = '<path d="M180 191 L200 191" fill="none" stroke="' + M + '" stroke-width="2.6" stroke-linecap="round"/>';
  else if (e === 'sad') mouth = '<path d="M179 195 Q190 187 201 195" fill="none" stroke="' + M + '" stroke-width="2.6" stroke-linecap="round"/>';
  else if (e === 'shy') mouth = '<path d="M180 191 Q185 196 190 191 Q195 196 200 191" fill="none" stroke="' + M + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
  else if (e === 'grin') mouth = '<path d="M164 183 Q190 220 216 183 Q190 196 164 183Z" fill="#2a0a10" stroke="' + O + '" stroke-width="2.2" stroke-linejoin="round"/>';
  else mouth = '<path d="M170 186 Q190 212 210 186 Q190 195 170 186Z" fill="#4a1019" stroke="' + O + '" stroke-width="2" stroke-linejoin="round"/>';
  s += '<g data-edit-part="expr">' + mouth + '</g>';
  s += '<g data-edit-part="hairStyle">';
  /* mái + dải sáng (hairFront của Kho 2) */
  s += sym(P('M190 64 C148 66 120 98 122 156 C132 128 148 112 172 106 C182 104 188 100 190 94Z', hair));
  s += '<path d="M150 84 Q190 62 232 86" fill="none" stroke="' + hl + '" stroke-width="4" stroke-linecap="round" opacity=".4"/>';
  s += '</g>';
  /* kẹp hoa */
  var clip = '';
  if (false) {
  var fx = 190 + 50 / 1.1, fy = 146 + (-62 - 5) / 1.1;
  s += '<g transform="translate(' + f1(fx) + ' ' + f1(fy) + ')">' + [0, 1, 2, 3, 4].map(function (k) { var a = k * 72 * D2R; return '<ellipse cx="' + f1(Math.cos(a) * 8) + '" cy="' + f1(Math.sin(a) * 8) + '" rx="6.4" ry="6.4" fill="#d84a4a" stroke="' + O + '" stroke-width="1.8"/>'; }).join('') + '<circle r="3.6" fill="#f6c453" stroke="' + O + '" stroke-width="1.4"/></g>';
  }
  return '<g transform="translate(0 5) scale(1.1) translate(-190 -146)">' + s + '</g>' + (KH.crown ? crownSVG(0) : '');
}
/* chọn nét vẽ theo góc nhìn hiệu dụng của đầu: trước / nghiêng (lật nếu quay phải) / sau */
function nativeHeadSel(theta, O) {
  var t = ((theta + 540) % 360) - 180, a = Math.abs(t);
  if (a <= 45) return khoFront();
  if (a < 135) return t < 0 ? '<g transform="scale(-1 1)">' + headArt(90, O) + '</g>' : headArt(90, O);
  return headArt(180, O);
}

/* ===== Thư viện động tác: chỉ là số, không dính nghệ thuật / trang phục ===== */
function sym(o) { return { L: deep(o), R: deep(o) }; }
var LIB = [
  { id: 'stand', n: 'Đứng chữ A', p: {}, anim: function (t) { var b = Math.sin(t * 1.5); return { lean: [.9 * b, 0], neck: [-.5 * b, 0], L: { sh: [0, 18 - .6 * b] }, R: { sh: [0, 18 - .6 * b] } }; } },
  { id: 'relax', n: 'Thả lỏng', p: { L: { sh: [4, 7], el: [10, 0] }, R: { sh: [4, 7], el: [10, 0] }, neck: [0, 2] }, anim: function (t) { var b = Math.sin(t * 1.5); return { lean: [.9 * b, 0], neck: [-.5 * b, 2], L: { sh: [4, 7 - .6 * b] }, R: { sh: [4, 7 - .6 * b] } }; } },
  { id: 'walk', n: 'Đi bộ', loop: 1, idle: .15, speed: 'walk', anim: function (t) { return walkGait(t); } },
  { id: 'wave', n: 'Vẫy tay', loop: 1, p: { R: { hand: 'wv', sh: [0, 96], el: [90, 0], elr: 90 }, L: { sh: [3, 8] }, neck: [0, -6], tilt: -3 }, anim: function (t) { return { R: { el: [78 + 22 * Math.sin(t * 9), 0], wr: 12 * Math.sin(t * 9 + 1) } }; } },
  { id: 'hips', n: 'Chống hông', p: { L: { hand: 'cl', sh: [-6, 34], el: [100, 0], elr: -62 }, R: { hand: 'cl', sh: [-6, 34], el: [100, 0], elr: -62 }, tilt: 3 } },
  { id: 'think', n: 'Suy nghĩ', p: { R: { hand: 'cv', sh: [50, 12], el: [128, 0], elr: 0 }, L: { hand: 'cl', sh: [28, 4], el: [105, 0], elr: -75 }, neck: [6, 6], tilt: 4 } },
  { id: 'cheer', n: 'Giơ hai tay', loop: 1, p: { L: { hand: 'wv', sh: [0, 158], el: [14, 0] }, R: { hand: 'wv', sh: [0, 158], el: [14, 0] }, neck: [-6, 0] }, anim: function (t) { var b = Math.sin(t * 7); return { L: { sh: [0, 158 + 6 * b] }, R: { sh: [0, 158 - 6 * b] }, x: 0 }; } },
  { id: 'point', n: 'Chỉ tay', p: { R: { hand: 'rc', sh: [82, 24], el: [6, 0] }, L: { sh: [4, 8], el: [14, 0] }, twist: -10, neck: [0, 0] } },
  { id: 'bow', n: 'Cúi chào', p: { lean: [36, 0], neck: [18, 0], L: { sh: [14, 4], el: [20, 0] }, R: { sh: [14, 4], el: [20, 0] } } },
  { id: 'sad', n: 'Buồn', p: { lean: [9, 0], neck: [26, 3], L: { sh: [6, 5], el: [8, 0] }, R: { sh: [6, 5], el: [8, 0] }, tilt: 3 } },
  { id: 'sit', n: 'Ngồi', p: { L: { hip: [88, 6, 8], kn: 92, sh: [38, 10], el: [68, 0] }, R: { hip: [88, 6, 8], kn: 92, sh: [38, 10], el: [68, 0] }, neck: [3, 0] } },
  { id: 'talk', n: 'Nói chuyện', p: { L: { sh: [4, 10], el: [18, 0] }, R: { sh: [32, 14], el: [75, 0] }, tilt: -2 }, anim: function (t) { return { neck: [4 * Math.sin(t * 3.1), 0], lean: [.8 * Math.sin(t * 1.5), 0], R: { sh: [32 + 6 * Math.sin(t * 1.9), 14], el: [75 + 10 * Math.sin(t * 2.3), 0] } }; } },
  { id: 'explain', n: 'Giải thích', p: { L: { hand: 'cv', sh: [36, 22], el: [82, 0], wr: -10 }, R: { hand: 'cv', sh: [36, 22], el: [82, 0], wr: -10 } }, anim: function (t) { var b = Math.sin(t * 2); return { neck: [2 * b, 0], L: { sh: [36 + 5 * b, 22] }, R: { sh: [36 + 5 * b, 22] } }; } },
  { id: 'clasp', n: 'Chắp tay chào', p: { neck: [8, 0], lean: [4, 0], L: { hand: 'cl', sh: [34, 4], el: [108, 0], elr: -27 }, R: { hand: 'cl', sh: [34, 4], el: [108, 0], elr: -27 } } },
  { id: 'pointU', n: 'Chỉ lên', p: { R: { hand: 'rc', sh: [150, 12], el: [6, 0] }, L: { sh: [4, 8], el: [14, 0] }, neck: [-6, 0], tilt: -4 } },
  { id: 'look', n: 'Ngoảnh lại', p: { twist: 14, yaw: 46, tilt: -3, L: { sh: [8, 8], el: [18, 0] }, R: { sh: [-6, 8], el: [18, 0] } } },
  { id: 'fear', n: 'Sợ hãi', p: { lean: [10, 0], neck: [-6, 0], L: { hand: 'cl', sh: [42, 8], el: [118, 0], elr: -50, hip: [10, 3, 8], kn: 26 }, R: { hand: 'cl', sh: [42, 8], el: [118, 0], elr: -50, hip: [10, 3, 8], kn: 26 } }, anim: function (t) { return { lean: [10 + 1.2 * Math.sin(t * 14), 0], L: { el: [118 + 3 * Math.sin(t * 13), 0] }, R: { el: [118 + 3 * Math.sin(t * 13 + 1), 0] } }; } },
  { id: 'joy', n: 'Vui mừng nhảy', loop: 1, p: { neck: [-4, 0], L: { hand: 'wv', sh: [20, 110], el: [22, 0], hip: [6, 3, 8], kn: 12 }, R: { hand: 'wv', sh: [20, 110], el: [22, 0], hip: [6, 3, 8], kn: 12 } }, anim: function (t) { var s = Math.sin(t * 6), j = Math.max(0, s); return { bounce: 16 * j, L: { sh: [20, 110 + 10 * s], hip: [6 + 10 * j, 3, 8], kn: 12 + 22 * j, an: -12 * j }, R: { sh: [20, 110 + 10 * s], hip: [6 + 10 * j, 3, 8], kn: 12 + 22 * j, an: -12 * j } }; } },
  { id: 'kneel', n: 'Quỳ ngồi', p: { neck: [4, 0], L: { hand: 'cv', sh: [14, 10], el: [70, 0], hip: [84, 0, 0], kn: 164, an: -78 }, R: { hand: 'cv', sh: [14, 10], el: [70, 0], hip: [84, 0, 0], kn: 164, an: -78 } } },
  { id: 'dance', n: 'Múa', loop: 1, p: { twist: -10, tilt: -8, neck: [0, 8], L: { hand: 'wv', sh: [20, 70], el: [25, 0], elr: -20, hip: [48, 6, 8], kn: 70, an: -28 }, R: { hand: 'wv', sh: [10, 155], el: [30, 0], wr: 10 } }, anim: function (t) { var s = Math.sin(t * 2); return { twist: -10 + 6 * s, tilt: -8 + 4 * s, R: { sh: [10, 155 + 8 * s] }, L: { sh: [20, 70 - 8 * s] } }; } },
  { id: 'sword', n: 'Rút kiếm', p: { lean: [4, 0], twist: 18, yaw: -14, neck: [0, 0], L: { hand: 'cl', sh: [40, 12], el: [85, 0], hip: [-8, 3, 13], kn: 6 }, R: { hand: 'cl', sh: [72, 24], el: [72, 0], hip: [20, 3, 13], kn: 28 } }, anim: function (t) { var b = Math.sin(t * 2.2); return { R: { sh: [72 + 4 * b, 24], el: [72 + 6 * b, 0] }, lean: [4 + .8 * b, 0] }; } },
  { id: 'shy', n: 'Ngại ngùng', p: { lean: [3, 0], neck: [10, 3], tilt: 5, L: { hand: 'cl', sh: [26, 6], el: [96, 0], elr: -40, hip: [0, 0, 13] }, R: { hand: 'cl', sh: [26, 6], el: [96, 0], elr: -40, hip: [0, 0, 13] } }, anim: function (t) { var b = Math.sin(t * 1.3); return { tilt: 5 + 2 * b, twist: 3 * b }; } },
  { id: 'cross', n: 'Khoanh tay', p: { L: { hand: 'cl', sh: [38, 4], el: [128, 0], elr: -80 }, R: { hand: 'cl', sh: [38, 4], el: [128, 0], elr: -80 }, tilt: 2 } }
];

/* ===== ĐI BỘ THEO BƯỚC CHÂN (không còn là sóng sin trên khớp háng) =====
   Mỗi bàn chân có quỹ đạo riêng trong khung chậu: chạm đất thì trượt LÙI ĐỀU đúng bằng tốc độ nền (chân không trượt),
   nhấc chân thì vẽ cung có nâng. Háng/gối/cổ chân giải ngược bằng IK 2 xương; độ cao chậu suy ra từ chân trụ. */
var WK = { T: 1.2, zH: 85, zT: -105, ds: .6, Lmax: 338 };
WK.speed = (WK.zH - WK.zT) / (WK.ds * WK.T);
function ss(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
function ySo(psi) { var r = psi * Math.PI / 180; return 52 * Math.cos(r) + Math.max(-16 * Math.sin(r), 58 * Math.sin(r)); }
function legIK(z, yd, psi) {
  var a = 185, b = 163, d = Math.min(Math.hypot(z, yd), a + b - .5), D = Math.PI / 180;
  var kn = 180 - Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - d * d) / (2 * a * b)))) / D;
  var be = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d)))), th = (Math.atan2(z, yd) + be) / D;
  return { hip: th, kn: kn, an: th - kn - psi };
}
/* chân trụ: điểm tiếp đất CỐ ĐỊNH trong thế giới (gót -> cả bàn -> mũi), nên khi chậu tiến lên thì cổ chân trượt lùi + xoay quanh điểm đó */
function stAnk(s) {
  var ds = WK.ds, psi = -16 * (1 - ss(s / .15)) + 38 * ss((s - .6) / .4), r = psi * Math.PI / 180, tau = s * ds * WK.T, Wh = 83;
  var zh = -52 * Math.sin(r) - 16 * Math.cos(r), zt = -52 * Math.sin(r) + 58 * Math.cos(r);
  return { z: s < .6 ? Wh - WK.speed * tau - zh : Wh + 74 - WK.speed * tau - zt, psi: psi };
}
function gaitFoot(u) {
  u = ((u % 1) + 1) % 1; var ds = WK.ds, z, psi, lift = 0, pen;
  if (u < ds) { var st = stAnk(u / ds); z = st.z; psi = st.psi; }
  else {
    var s2 = (u - ds) / (1 - ds), Ts = (1 - ds) * WK.T, e = .01, A = stAnk(1), A2 = stAnk(1 - e), B = stAnk(0), B2 = stAnk(e);
    var m0 = (A.z - A2.z) / (e * ds * WK.T) * Ts, m1 = (B2.z - B.z) / (e * ds * WK.T) * Ts, q2 = s2 * s2, q3 = q2 * s2;
    z = (2 * q3 - 3 * q2 + 1) * A.z + (q3 - 2 * q2 + s2) * m0 + (-2 * q3 + 3 * q2) * B.z + (q3 - q2) * m1;
    lift = 64 * Math.pow(Math.sin(Math.PI * s2), 1.2); psi = 38 + (-16 - 38) * ss(s2 * 1.1);
  }
  pen = u < ds - .1 ? 0 : u < ds ? 60 * ss((u - ds + .1) / .1) : u < .9 ? 60 : 60 * (1 - ss((u - .9) / .1));
  return { z: z, psi: psi, lift: lift, pen: pen };
}
function walkGait(t) {
  var uL = t / WK.T, F = { L: gaitFoot(uL), R: gaitFoot(uL + .5) }, tau = 4, e = 0, k;
  ['L', 'R'].forEach(function (k) { var f = F[k]; f.v = Math.sqrt(WK.Lmax * WK.Lmax - f.z * f.z) + ySo(f.psi) + f.lift + f.pen; e += Math.exp(-f.v / tau); });
  e += Math.exp(-386 / tau);
  var H = -tau * Math.log(e), o = { lean: [4, 0], L: {}, R: {} };
  ['L', 'R'].forEach(function (k) { var f = F[k], ik = legIK(f.z, H - ySo(f.psi) - f.lift, f.psi); o[k] = { hip: [ik.hip, 2.5, 8], kn: ik.kn, an: ik.an }; });
  var dz = (F.L.z - F.R.z) / 130, sw = Math.cos(2 * Math.PI * (uL - .3));
  o.twistP = -5 * dz; o.twist = 9 * dz; o.yaw = -6 * dz; o.x = 7 * sw; o.roll = -3.2 * sw; o.lean = [5, 2.6 * sw]; o.tilt = 0; o.neck = [-3, 0];
  var Fl = { L: gaitFoot(uL - .08), R: gaitFoot(uL + .5 - .08) };
  [['L', 'R'], ['R', 'L']].forEach(function (pr) {
    var a = pr[0], leg = pr[1], f = (F[leg].z - 20) / 65, fl = (Fl[leg].z - 20) / 65;
    o[a].sh = [30 * f, 11 + 2 * Math.max(0, -f)]; o[a].el = [16 + 28 * Math.max(0, fl + .15), 0]; o[a].elr = 8; o[a].wr = 5 * fl;
  });
  return o;
}
/* lớp sống động chung cho MỌI tư thế: thở, dồn trọng tâm, đầu và tay trôi nhẹ; chỉ phụ thuộc t */
function withIdle(p, t, a) {
  var q = deep(p), b = Math.sin(t * 1.55), s2 = Math.sin(t * .53 + .7), s3 = Math.sin(t * .37 + 2.1);
  q.lean[0] += .9 * b * a; q.neck[0] += (-.6 * b + 1.3 * s3) * a; q.neck[1] += 1.5 * s2 * a; q.yaw += 3 * s3 * a; q.roll += .5 * s2 * a; q.x += 2 * s2 * a;
  ['L', 'R'].forEach(function (k, i) { var o = q[k]; o.sh[1] += .8 * b * a; o.sh[0] += 1.4 * Math.sin(t * .9 + i * 1.3) * a; o.el[0] += 1.8 * Math.sin(t * .8 + i) * a * (o.el[0] > 5 ? 1 : .4); o.wr += 2.2 * Math.sin(t * 1.1 + i * 2) * a; });
  return q;
}
function poseAt(id, t) {
  var e = LIB.filter(function (x) { return x.id === id; })[0] || LIB[0];
  return withIdle(merge(merge(P0, e.p || {}), e.anim ? e.anim(t) : {}), t, e.idle == null ? 1 : e.idle);
}


/* ===== BỘ XƯƠNG CHI TIẾT: dựng từ chính các khớp FK (cột sống từng đốt, xương sườn, sọ, chậu, tay, ngón, chân, bàn chân) ===== */
function spl(P, t) {
  var i = Math.min(P.length - 2, Math.max(0, Math.floor(t))), u = t - i, p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
  return [0, 1, 2].map(function (k) { return .5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u * u + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u * u * u); });
}
function perp(v, a) { var r = sub(v, mul(a, dot(v, a))); return vlen(r) < 1e-3 ? [1, 0, 0] : nrm(r); }
function fade(sv) { var o = $('skel').checked ? .5 : 1; return o < 1 ? '<g opacity="' + o + '">' + sv + '</g>' : sv; }


/* ===== ĐỘNG CƠ KHỚP CỦA FILE RIG: cột sống 57 đoạn (lưng/ngực/cổ), vai & hông xoay 3 trục, khuỷu/gối/cổ chân.
   Rig cho ra HƯỚNG và PHÉP QUAY của từng đoạn; độ dài xương và hình vẽ vẫn của nhân vật nữ. ===== */
var RGENG = (function () {
  var D = Math.PI / 180, SIN = Math.sin, COS = Math.cos;
  function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
  var v3 = {
    add: function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }, sub: function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; },
    mul: function (a, k) { return [a[0] * k, a[1] * k, a[2] * k]; },
    norm: function (a) { var l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    lerp: function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  };
  function mMul(A, B) { var o = new Array(9), i, j, k; for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) { var q = 0; for (k = 0; k < 3; k++) q += A[i * 3 + k] * B[k * 3 + j]; o[i * 3 + j] = q; } return o; }
  function mVec(R, v) { return [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]]; }
  function mRx(t) { t *= D; var c = COS(t), s = SIN(t); return [1, 0, 0, 0, c, -s, 0, s, c]; }
  function mRy(t) { t *= D; var c = COS(t), s = SIN(t); return [c, 0, s, 0, 1, 0, -s, 0, c]; }
  function mRz(t) { t *= D; var c = COS(t), s = SIN(t); return [c, -s, 0, s, c, 0, 0, 0, 1]; }
  function mAx(u, t) { t *= D; u = v3.norm(u); var c = COS(t), s = SIN(t), C = 1 - c, x = u[0], y = u[1], z = u[2]; return [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C]; }
  function aboutPivot(R, c) { var Rc = mVec(R, c); return { R: R, t: [c[0] - Rc[0], c[1] - Rc[1], c[2] - Rc[2]] }; }
  function aApply(A, p) { var q = mVec(A.R, p); return [q[0] + A.t[0], q[1] + A.t[1], q[2] + A.t[2]]; }
  var BODYARM = 10;
  function J(s) {
    var gh = [s * 16.0, 137.0, -1.0], hip = [s * 8.9, 90, .2], knee = [s * 8.4, 47.4, .4], ank = [s * 8.7, 9.0, -.6], ab = BODYARM * D, ab2 = (BODYARM + 4) * D;
    var el = v3.add(gh, [s * 29.8 * SIN(ab), -29.8 * COS(ab), .4]);
    var wr = v3.add(el, [s * 25.6 * SIN(ab2) * .98, -25.6 * COS(ab2) * COS(7 * D), 25.6 * SIN(7 * D) + .5]);
    return { gh: gh, el: el, wr: wr, hip: hip, knee: knee, ank: ank };
  }
  function nz(P) {
    P = P || {};
    var side = function (S) { S = S || {}; return { sh: (S.sh || [0, 0, 0]).slice(0, 3).concat([0, 0, 0]).slice(0, 3), el: (S.el || [0, 0]).concat([0, 0]).slice(0, 2), wr: (S.wr || [0, 0]).concat([0, 0]).slice(0, 2), hip: (S.hip || [0, 0, 0]).concat([0, 0, 0]).slice(0, 3), kn: [S.kn || 0], an: [S.an || 0], hand: 'rl' }; };
    var r = P.root || {};
    return { root: [r.pitch || 0, r.roll || 0, r.yaw || 0, r.tx || 0, r.tz || 0], lum: (P.lum || [0, 0, 0]).slice(), thor: (P.thor || [0, 0, 0]).slice(), neck: (P.neck || [0, 0, 0]).slice(), L: side(P.L), R: side(P.R), bounce: 0 };
  }
  function build(N) {
    var rt = { pitch: N.root[0], roll: N.root[1], yaw: N.root[2], tx: N.root[3], tz: N.root[4] }, c0 = [0, 90, 0];
    var Rr = mMul(mRy(rt.yaw), mMul(mRz(-rt.roll), mRx(rt.pitch)));
    var W0 = aboutPivot(Rr, c0), Wroot = { R: Rr, t: [W0.t[0] + rt.tx, W0.t[1], W0.t[2] + rt.tz] };
    var n = 57, C = [], R = [], i;
    C[0] = aApply(Wroot, [0, 96, 0]); R[0] = Rr;
    for (i = 0; i < n - 1; i++) {
      var y = 96 + i, ang, w;
      if (y < 118) { ang = N.lum; w = 1 / 22; } else if (y < 140) { ang = N.thor; w = 1 / 22; } else { ang = N.neck; w = 1 / 12; }
      var inc = mMul(mRy(ang[2] * w), mMul(mRz(-ang[1] * w), mRx(ang[0] * w)));
      R[i + 1] = mMul(R[i], inc); C[i + 1] = v3.add(C[i], mVec(R[i], [0, 1, 0]));
    }
    var M = {};
    M.frame = function (y) {
      var yy = cl(y, 96, 152), fi = yy - 96, i0 = Math.min(Math.floor(fi), n - 2), f = fi - i0, Rm = new Array(9), k;
      for (k = 0; k < 9; k++) Rm[k] = R[i0][k] + (R[i0 + 1][k] - R[i0][k]) * f;
      return { C: v3.lerp(C[i0], C[i0 + 1], f), R: Rm };
    };
    [1, -1].forEach(function (s) {
      var S = s > 0 ? N.L : N.R, j = J(s), tag = s > 0 ? '+' : '-';
      var u0 = v3.norm(v3.sub(j.el, j.gh)), uf0 = v3.norm(v3.sub(j.wr, j.el));
      var Rsh = mMul(mRz(s * S.sh[1]), mMul(mRx(-S.sh[0]), mAx(u0, s * S.sh[2])));
      var T137 = { C: C[41], R: R[41] };
      var shT = function (q) { return v3.add(T137.C, mVec(T137.R, [q[0], q[1] - 137, q[2]])); };
      var ua = function (p) { return shT(v3.add(j.gh, mVec(Rsh, v3.sub(p, j.gh)))); };
      var Rel = mMul(mRx(-S.el[0]), mAx(uf0, s * S.el[1]));
      var fa = function (p) { return ua(v3.add(j.el, mVec(Rel, v3.sub(p, j.el)))); };
      var Rwr = mMul(mRx(-S.wr[0]), mRz(s * S.wr[1]));
      var ha = function (p) { return fa(v3.add(j.wr, mVec(Rwr, v3.sub(p, j.wr)))); };
      M['ua' + tag] = ua; M['fa' + tag] = fa; M['ha' + tag] = ha;
      var uth0 = v3.norm(v3.sub(j.knee, j.hip));
      var Rhip = mMul(mRz(s * S.hip[1]), mMul(mRx(-S.hip[0]), mAx(uth0, s * S.hip[2])));
      var th = function (p) { return aApply(Wroot, v3.add(j.hip, mVec(Rhip, v3.sub(p, j.hip)))); };
      var Rkn = mRx(S.kn[0]), Ran = mRx(S.an[0]);
      var sh = function (p) { return th(v3.add(j.knee, mVec(Rkn, v3.sub(p, j.knee)))); };
      var ft = function (p) { return sh(v3.add(j.ank, mVec(Ran, v3.sub(p, j.ank)))); };
      M['th' + tag] = th; M['sh' + tag] = sh; M['ft' + tag] = ft;
    });
    return M;
  }
  return { build: build, J: J, nz: nz, v3: v3 };
})();

/* Rig (y lên) -> nhân vật nữ (y xuống): lật trục y; độ dài xương lấy theo LEN của nhân vật nữ */
function rigFK(N, dy) {
  var B = RGENG.build(N), K = 4.3, Jt = {}, Fl = function (v) { return [v[0], -v[1], v[2]]; }, V = RGENG.v3;
  var cR = function (R) { var Fs = [1, -1, 1], o = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], i, j; for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) o[i][j] = Fs[i] * Fs[j] * R[i * 3 + j]; return o; };
  var Rp = cR(B.frame(96).R), Rl = cR(B.frame(112).R), Rs = cR(B.frame(136).R), Rh = cR(B.frame(152).R);
  var P = [N.root[3] * K, 400 + (dy || 0), N.root[4] * K];
  Jt.pel = P; Jt.Rp = Rp; Jt.Rl = Rl; Jt.Rs = Rs; Jt.Rh = Rh;
  var W = add(P, mv(Rp, [0, -44, 0])); Jt.wst = W;
  var M0 = add(W, mv(Rl, [0, -LEN.spine * .5, 0])); Jt.mid = M0;
  var C = add(M0, mv(Rs, [0, -LEN.spine * .5, 0])); Jt.chest = C;
  Jt.neckB = add(C, mv(Rs, [0, -LEN.neck, 0]));
  var hj = add(Jt.neckB, mv(Rs, [0, -26, 0])); Jt.headJ = hj; Jt.head = add(hj, mv(Rh, [0, -87, 0]));
  [['L', 1], ['R', -1]].forEach(function (e) {
    var k = e[0], s = e[1], S = N[k], t = s > 0 ? '+' : '-', j = RGENG.J(s);
    var gh = B['ua' + t](j.gh), el = B['ua' + t](j.el), wr = B['fa' + t](j.wr), dfa = V.norm(V.sub(j.wr, j.el));
    var hh = B['ha' + t](V.add(j.wr, V.mul(dfa, 10)));
    var u = Fl(nrm(sub(el, gh))), fa = Fl(nrm(sub(wr, el))), h = Fl(nrm(sub(hh, wr)));
    var raise = clamp((S.sh[1] + 10 - 18) / 140, 0, 1) * 16 + clamp(S.sh[0] / 150, 0, 1) * 6;
    var Sh = add(C, mv(Rs, [s * LEN.shW, -raise, 0])); Jt['sh' + k] = Sh;
    var El = add(Sh, mul(u, LEN.uarm)); Jt['el' + k] = El;
    var Wr = add(El, mul(fa, LEN.farm)); Jt['wr' + k] = Wr; Jt['hd' + k] = add(Wr, mul(h, LEN.hand));
    var Hp = add(P, mv(Rp, [s * LEN.hipW, 0, 0])); Jt['hp' + k] = Hp;
    var hip = B['th' + t](j.hip), kn = B['th' + t](j.knee), an = B['sh' + t](j.ank), ftf = function (q) { return B['ft' + t](q); };
    var thd = Fl(nrm(sub(kn, hip))), shd = Fl(nrm(sub(an, kn)));
    var Kn = add(Hp, mul(thd, LEN.thigh)); Jt['kn' + k] = Kn;
    var An = add(Kn, mul(shd, LEN.shin)); Jt['an' + k] = An;
    var a0 = ftf(j.ank), fw = Fl(nrm(sub(ftf(V.add(j.ank, [0, 0, 10])), a0))), dn = Fl(nrm(sub(ftf(V.add(j.ank, [0, -10, 0])), a0)));
    Jt['fw' + k] = fw; Jt['dn' + k] = dn;
    Jt['hl' + k] = add(An, add(mul(dn, 38), mul(fw, -20))); Jt['to' + k] = add(An, add(mul(dn, 42), mul(fw, 52)));
    Jt['so' + k] = Math.max(add(An, add(mul(dn, 52), mul(fw, -16)))[1], add(An, add(mul(dn, 52), mul(fw, 58)))[1]);
  });
  return Jt;
}
var _rc = { p: null, J: null };
function solve(p) {
  if (p === _rc.p) return _rc.J;
  var J0 = rigFK(p, 0), low = Math.max(J0.soL, J0.soR, J0.knL[1] + 28, J0.knR[1] + 28), dy = p.ground === false ? 0 : 800 - low - (p.bounce || 0) * 4.3, J = rigFK(p, dy);
  _rc.p = p; _rc.J = J; return J;
}
var RGSPEED = 560;
var HANDS = { wave: { R: 'wv' }, cheer: { L: 'wv', R: 'wv' }, joy: { L: 'wv', R: 'wv' }, dance: { L: 'wv', R: 'wv' }, hips: { L: 'cl', R: 'cl' }, think: { R: 'cv', L: 'cl' }, pointF: { R: 'rc' }, pointU: { R: 'rc' }, explain: { L: 'cv', R: 'cv' }, clasp: { L: 'cl', R: 'cl' }, cross: { L: 'cl', R: 'cl' }, fear: { L: 'cl', R: 'cl' }, sword: { L: 'cl', R: 'cl' }, shy: { L: 'cl', R: 'cl' }, kneel: { L: 'cv', R: 'cv' } };
var SN = Math.sin;
var LIB = [
  { id: 'idle', n: 'Đứng thả lỏng', P: { L: { sh: [0, -4, 0], el: [10, 0] }, R: { sh: [0, -4, 0], el: [10, 0] } }, anim: function (t, N) { var b = SN(t * 1.5); N.thor[0] += .9 * b; N.neck[0] += -.5 * b; N.L.sh[1] += -.6 * b; N.R.sh[1] += -.6 * b; return 0; } },
  { id: 'stand', n: 'Đứng nghiêm', P: { L: { sh: [0, -12, 0] }, R: { sh: [0, -12, 0] } } },
  { id: 'walk', n: 'Đi bộ', P: { root: { pitch: 3 }, L: { el: [14, 0] }, R: { el: [14, 0] } }, anim: function (t, N) { var ph = t * 5.2, s = SN(ph), c = Math.cos(ph); N.L.hip[0] += 26 * s; N.R.hip[0] -= 26 * s; N.L.kn[0] += 6 + 34 * Math.max(0, c); N.R.kn[0] += 6 + 34 * Math.max(0, -c); N.L.an[0] += -8 * c; N.R.an[0] += 8 * c; N.L.sh[0] += -24 * s; N.R.sh[0] += 24 * s; N.thor[2] += 5 * s; N.lum[2] -= 4 * s; return .9 * (1 - Math.abs(s)); } },
  { id: 'talk', n: 'Nói chuyện', P: { L: { sh: [4, -6, 0], el: [18, 0] }, R: { sh: [32, 14, 8], el: [75, 0] }, neck: [0, 0, -4] }, anim: function (t, N) { N.neck[0] += 4 * SN(t * 3.1); N.R.el[0] += 10 * SN(t * 2.3); N.R.sh[0] += 6 * SN(t * 1.9); N.thor[0] += .8 * SN(t * 1.5); return 0; } },
  { id: 'wave', n: 'Vẫy tay', P: { L: { sh: [0, -6, 0], el: [10, 0] }, R: { sh: [10, 90, -80], el: [110, 0], wr: [0, 10] }, neck: [0, -6, -6] }, anim: function (t, N) { N.R.wr[1] += 22 * SN(t * 8); N.R.el[0] += 4 * SN(t * 8); return 0; } },
  { id: 'pointF', n: 'Chỉ tay phía trước', P: { R: { sh: [85, -8, 0], el: [6, 0] }, L: { sh: [0, -6, 0], el: [14, 0] }, neck: [0, 0, -6], thor: [0, 0, -8] } },
  { id: 'pointU', n: 'Chỉ tay lên', P: { R: { sh: [150, 12, 0], el: [6, 0] }, L: { sh: [0, -6, 0], el: [14, 0] }, neck: [-6, 0, -4] } },
  { id: 'explain', n: 'Giơ tay giải thích', P: { L: { sh: [36, 22, 6], el: [82, 0], wr: [-10, 0] }, R: { sh: [36, 22, 6], el: [82, 0], wr: [-10, 0] } }, anim: function (t, N) { var b = SN(t * 2); N.L.sh[0] += 5 * b; N.R.sh[0] += 5 * b; N.neck[0] += 2 * b; return 0; } },
  { id: 'clasp', n: 'Chắp tay hành lễ', P: { neck: [8, 0, 0], thor: [4, 0, 0], L: { sh: [17.6, -15.7, 51.2], el: [82, .7] }, R: { sh: [17.6, -15.7, 51.2], el: [82, .7] } } },
  { id: 'bow', n: 'Cúi chào', P: { lum: [14, 0, 0], thor: [18, 0, 0], neck: [10, 0, 0], L: { sh: [28, -14, 0], el: [30, 0] }, R: { sh: [28, -14, 0], el: [30, 0] } } },
  { id: 'kneel', n: 'Quỳ ngồi', P: { neck: [4, 0, 0], L: { sh: [11.1, -16.2, 30.7], el: [60.3, -22.9], hip: [84, 0, 0], kn: 164, an: 84 }, R: { sh: [11.1, -16.2, 30.7], el: [60.3, -22.9], hip: [84, 0, 0], kn: 164, an: 84 } } },
  { id: 'dance', n: 'Múa uyển chuyển', P: { root: { yaw: -10 }, lum: [0, -8, 10], thor: [0, -6, 14], neck: [0, 10, -10], L: { sh: [20, 70, 10], el: [25, -20], wr: [-10, 0], hip: [48, 6, 0], kn: 70, an: 30 }, R: { sh: [10, 155, 0], el: [30, 0], wr: [10, 0], hip: [-4, 0, 0] } }, anim: function (t, N) { var b = SN(t * 2); N.thor[2] += 4 * b; N.R.sh[1] += 6 * b; N.L.sh[1] -= 5 * b; N.neck[2] -= 4 * b; return 0; } },
  { id: 'look', n: 'Ngoảnh nhìn lại', P: { root: { yaw: 35 }, thor: [0, 0, -8], neck: [0, 0, -40], L: { sh: [8, -8, 0], el: [18, 0] }, R: { sh: [-6, -8, 0], el: [18, 0] } } },
  { id: 'fear', n: 'Sợ hãi', P: { lum: [8, 0, 0], thor: [12, 0, 0], neck: [-6, 0, 0], L: { sh: [42, 8, 0], el: [118, 0], hip: [10, 0, 0], kn: 26 }, R: { sh: [42, 8, 0], el: [118, 0], hip: [10, 0, 0], kn: 26 } }, anim: function (t, N) { N.thor[0] += 1.2 * SN(t * 14); N.L.el[0] += 3 * SN(t * 13); N.R.el[0] += 3 * SN(t * 13 + 1); return 0; } },
  { id: 'sad', n: 'Buồn', P: { lum: [6, 0, 0], thor: [12, 0, 0], neck: [26, 0, 0], L: { sh: [2, -4, 0], el: [16, 0] }, R: { sh: [2, -4, 0], el: [16, 0] } }, anim: function (t, N) { N.thor[0] += .8 * SN(t * 1.1); return 0; } },
  { id: 'joy', n: 'Vui mừng nhảy', P: { L: { sh: [30, 95, 0], el: [22, 0], hip: [6, 0, 0], kn: 12 }, R: { sh: [30, 95, 0], el: [22, 0], hip: [6, 0, 0], kn: 12 }, neck: [-4, 0, 0] }, anim: function (t, N) { var j = Math.max(0, SN(t * 6)); N.L.hip[0] += 10 * j; N.R.hip[0] += 10 * j; N.L.kn[0] += 22 * j; N.R.kn[0] += 22 * j; N.L.sh[1] += 10 * SN(t * 6); N.R.sh[1] += 10 * SN(t * 6); return 3.5 * j; } },
  { id: 'sword', n: 'Rút kiếm', P: { lum: [4, 0, 12], thor: [0, 0, 18], neck: [0, 0, -14], L: { sh: [40, 12, 0], el: [85, 0], hip: [-8, 0, 0], kn: 6 }, R: { sh: [72, -26, 10], el: [72, 0], hip: [20, 0, 0], kn: 28 } }, anim: function (t, N) { var b = SN(t * 2.2); N.R.sh[0] += 4 * b; N.R.el[0] += 6 * b; N.thor[0] += .8 * b; return 0; } },
  { id: 'hips', n: 'Chống hông', P: { neck: [0, 3, 0], L: { sh: [-6, 22, 85], el: [110, 0] }, R: { sh: [-6, 22, 85], el: [110, 0] } } },
  { id: 'think', n: 'Suy nghĩ', P: { neck: [6, 4, 0], R: { sh: [50, 2, 0], el: [128, 0] }, L: { sh: [28, -6, 40], el: [105, 0] } } },
  { id: 'cross', n: 'Khoanh tay', P: { neck: [0, 2, 0], L: { sh: [38, -6, 50], el: [128, 0] }, R: { sh: [38, -6, 50], el: [128, 0] } } },
  { id: 'cheer', n: 'Giơ hai tay', P: { neck: [-6, 0, 0], L: { sh: [0, 148, 0], el: [14, 0] }, R: { sh: [0, 148, 0], el: [14, 0] } }, anim: function (t, N) { var b = SN(t * 7); N.L.sh[1] += 6 * b; N.R.sh[1] -= 6 * b; return 0; } },
  { id: 'sit', n: 'Ngồi', P: { neck: [3, 0, 0], L: { hip: [88, 0, 0], kn: 92, sh: [38, 0, 0], el: [68, 0] }, R: { hip: [88, 0, 0], kn: 92, sh: [38, 0, 0], el: [68, 0] } } },
  { id: 'shy', n: 'Ngại ngùng', P: { lum: [3, 0, 0], neck: [10, 4, 0], L: { sh: [22, -6, 45], el: [85, 0] }, R: { sh: [22, -6, 45], el: [85, 0] } }, anim: function (t, N) { var b = SN(t * 1.3); N.neck[1] += 2 * b; N.thor[2] += 3 * b; return 0; } }
];
function withIdleN(N, t, a) {
  var b = SN(t * 1.55), s2 = SN(t * .53 + .7), s3 = SN(t * .37 + 2.1);
  N.thor[0] += .9 * b * a; N.neck[0] += (-.6 * b + 1.3 * s3) * a; N.neck[1] += 1.2 * s2 * a; N.neck[2] += 3 * s3 * a; N.root[1] += .5 * s2 * a; N.root[3] += .5 * s2 * a;
  ['L', 'R'].forEach(function (k, i) { var o = N[k]; o.sh[1] += .8 * b * a; o.sh[0] += 1.4 * SN(t * .9 + i * 1.3) * a; o.el[0] += 1.8 * SN(t * .8 + i) * a * (o.el[0] > 5 ? 1 : .4); o.wr[0] += 2.2 * SN(t * 1.1 + i * 2) * a; });
  return N;
}
function poseAt(id, t) {
  var e = LIB.filter(function (x) { return x.id === id; })[0] || LIB[0], N = RGENG.nz(e.P), bn = e.anim ? (e.anim(t, N) || 0) : 0, hd = HANDS[e.id] || {};
  N.L.hand = hd.L || 'rl'; N.R.hand = hd.R || 'rl'; N.bounce = bn;
  return withIdleN(N, t, e.id === 'idle' ? 0 : (e.id === 'walk' ? .15 : 1));
}


function spring(s,acc,dt,K,D,g,cm,gy){var n=Math.max(1,Math.ceil(dt/.008)),h=dt/n,q,i;for(q=0;q<n;q++)for(i=0;i<3;i++){s.v[i]+=(-K*s.o[i]-D*s.v[i]-(i===1?gy:g)*acc[i])*h;var m=i===1?cm*.35:cm;s.o[i]=clamp(s.o[i]+s.v[i]*h,-m,m);}}
function anchor(key,pos,dt){var st=ST[key]||(ST[key]={p:null,v:[0,0,0]});var acc=[0,0,0];if(st.p){var v=[0,1,2].map(function(i){return(pos[i]-st.p[i])/dt});acc=[0,1,2].map(function(i){return clamp((v[i]-st.v[i])/dt,-2600,2600)});st.v=v;}st.p=pos;return acc;}
function stepSec(dt){
 if(dt<=0)return;
 var J=solve(cur);
 spring(SE,anchor('head',J.head,dt),dt,70,11.5,2.2,20,.25);
 ['L','R'].forEach(function(k){
  spring(SK.sl[k],anchor('w'+k,J['wr'+k],dt),dt,45,9.4,1.5,28,.3);
  spring(SK.hem[k],anchor('a'+k,J['an'+k],dt),dt,40,8.9,.6,26,.1);
 });
 spring(SK.tail,anchor('ch',J.chest,dt),dt,50,9.9,2.2,24,.3);
}

/* Keep the source face outlines and profile drawing. Only feature choices vary. */
function profileTempleLock(st){
  var style=st.hairStyle||'long',width={bun:5.5,highbun:5,pixie:5,bob:9,hime:10}[style]||10.5;
  var end={bun:65,highbun:58,pixie:20,bob:77,hime:99}[style]||108,x=27,bend=style==='wavy'?8:style==='bun'||style==='highbun'?4:2;
  var d='M'+f1(x-width)+' -8 C'+f1(x-width-1)+' -20 '+f1(x+width+1)+' -20 '+f1(x+width)+' -6 C'+f1(x+width)+' '+f1(end*.35)+' '+f1(x+width+bend)+' '+f1(end*.76)+' '+f1(x+bend+1)+' '+end+' Q'+f1(x+bend-2)+' '+f1(end-1)+' '+f1(x-width*.45+bend)+' '+f1(end-9)+' C'+f1(x-width+bend)+' '+f1(end*.65)+' '+f1(x-width-1)+' 20 '+f1(x-width)+' -8Z';
  return '<g class="profile-temple-lock" data-edit-part="hairStyle"><path d="'+d+'" fill="'+HAIRC+'" stroke="'+OUT+'" stroke-width="2.6" stroke-linejoin="round"/><path d="M'+f1(x-width*.25)+' -5 C'+f1(x-width*.4)+' '+f1(end*.3)+' '+f1(x+bend)+' '+f1(end*.7)+' '+f1(x+bend)+' '+f1(end-12)+'" fill="none" stroke="'+kshade(HAIRC,.3)+'" stroke-width="1.1" opacity=".35" stroke-linecap="round"/></g>';
}
function profileHairStrands(w,x){
  var id='scalp'+(++UID),d='M'+f1(x-w)+' 8 C'+f1(x-w)+' -62 '+f1(x-w*.55)+' -100 '+f1(x)+' -100 C'+f1(x+w*.55)+' -100 '+f1(x+w)+' -62 '+f1(x+w)+' 8 L'+f1(x+w)+' 90 L'+f1(x-w)+' 90Z';
  return '<defs><clipPath id="'+id+'"><path d="'+d+'"/></clipPath></defs><g class="profile-hair-strands" clip-path="url(#'+id+')" fill="none" stroke="'+kshade(HAIRC,.28)+'" stroke-width="1.3" opacity=".28" stroke-linecap="round"><path d="M-34 -80 C-18 -99 6 -102 31 -90"/><path d="M-44 -65 C-27 -94 8 -100 44 -78"/><path d="M-48 -49 C-30 -82 10 -92 54 -64"/></g>';
}
function profileEyeMarkup(st,ec,white){
  var en=kEyeNew(st,{w:17,h:13,irx:11,iry:11,cx:1}),closed=BLINK>.5||st.eyeStyle==='happy';
  var inner=en?en.art:'<circle cx="1" cy="1" r="11" fill="'+st.eye+'"/><circle cx="1" cy="1" r="11" fill="none" stroke="'+kshade(st.eye,-.45)+'" stroke-width="2"/><circle cx="1" cy="1" r="4.6" fill="'+OUT+'"/><circle cx="-3" cy="-4" r="3.2" fill="#fff"/><circle cx="5" cy="4" r="1.6" fill="#fff" opacity=".8"/>';
  var base=en?en.base:'#f6f2f2';
  var g='<defs><clipPath id="'+ec+'p"><path d="'+white+'"/></clipPath></defs><g data-edit-part="eyes" transform="translate(19 14) scale(.92)"><path d="'+white+'" fill="'+base+'"/><g clip-path="url(#'+ec+'p)"><g transform="translate(166 175) scale(1.18 1.59)">'+inner+'</g><path d="M142 156 L190 156 L190 164 Q166 158 142 166Z" fill="#000" opacity=".2"/></g>';
  g+='<path d="M142 167 Q156 152 186 159 Q192 159 198 152" stroke="'+OUT+'" stroke-width="5.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M186 159 L194 149" stroke="'+OUT+'" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M148 192 Q166 200 184 190" stroke="'+OUT+'" stroke-width="1.9" fill="none" opacity=".55" stroke-linecap="round"/>';
  var brow={smile:'M148 146 Q166 140 190 143',neutral:'M148 146 Q166 144 190 146',shy:'M148 148 Q166 142 190 145',sad:'M148 151 Q166 143 190 137',creepy:'M148 144 Q166 131 190 141',grin:'M148 142 Q166 131 190 141'}[st.expr]||'M148 146 Q166 140 190 143';
  g+='<path d="'+brow+'" stroke="'+kshade(HAIRC,.08)+'" stroke-width="3.4" fill="none" stroke-linecap="round"/>';
  if(closed)g+='<path d="M142 160 Q157 150 188 158 L190 192 Q168 202 146 192Z" fill="'+SKIN+'"/><path d="M144 '+(st.eyeStyle==='happy'?178:170)+' Q166 '+(st.eyeStyle==='happy'?154:184)+' 192 164" stroke="'+OUT+'" stroke-width="5" fill="none" stroke-linecap="round"/>';
  return g+'</g>';
}
function profileMouth(expr){
  var d={smile:'M139 247 Q151 253 166 244',neutral:'M140 247 L166 247',sad:'M139 251 Q151 240 166 250',shy:'M139 247 Q145 253 152 247 Q158 253 166 247',grin:'M135 241 Q151 272 171 239 Q151 251 135 241Z',creepy:'M139 243 Q151 266 168 241 Q152 253 139 243Z'}[expr]||'M139 247 Q151 253 166 244';
  return '<path d="'+d+'" stroke="'+(expr==='grin'||expr==='creepy'?OUT:'#7a3a45')+'" stroke-width="2.8" fill="'+(expr==='grin'?'#2a0a10':expr==='creepy'?'#4a1019':'none')+'" stroke-linecap="round" stroke-linejoin="round"/>';
}
function gHand(h){
  if(!h.shape)return nativeRigHand(h);
  var palm='<path d="M-8 -4L8 -4L10 9Q14 17 8 25Q0 29 -9 23L-11 9Z" fill="'+SKIN+'" stroke="'+OUT+'" stroke-width="2.6" stroke-linejoin="round"/>';
  if(h.shape==='point')palm+=gfin([[-6,19],[-7,33],[-8,47]],6.2,4.2);
  if(h.shape==='peace')palm+=gfin([[-5,19],[-11,34],[-15,46]],6.2,4.2)+gfin([[0,18],[5,35],[9,48]],6.2,4.2);
  palm+='<path d="M-8 9Q-5 6 -2 10 M-2 9Q1 6 4 10 M4 10Q7 7 9 12" fill="none" stroke="'+SKINSH+'" stroke-width="1.5" stroke-linecap="round"/>';
  return palm+'<path d="M7 10Q15 12 11 20L2 18Q-2 15 2 12Z" fill="'+SKIN+'" stroke="'+OUT+'" stroke-width="2.2" stroke-linejoin="round"/>';
}

/* Semantic SVG groups only: no geometry, paint or typography changes. */
function pickableItem(item){
  var part=/^(hair|lock|bun|tie|braid)/.test(item.id)?'hairStyle':item.id==='head'?'expr':/^arm/.test(item.id)?'sleeves':/^(leg|pel|skirt|torso|aodai|outfit)/.test(item.id)?'outfit':'';
  return part?'<g data-edit-part="'+part+'">'+item.svg+'</g>':item.svg;
}

/* This code is appended inside createCharacterRig, after the unmodified rig math. */
var ACT = null, cur = poseAt('stand', 0), livePose = null, liveKey = '', blendFrom = null, blend = 1;
var SE = SEC, ST = {}, lastTime = 0;
var STATIC_SEC = deep(SEC), STATIC_SK = deep(SK);
var SOURCE_OUTFITS = deep(OUTFITS);
GH.fist={shape:'fist'};GH.point={shape:'point'};GH.peace={shape:'peace'};
var ALIASES = {g_relax:'idle',g_cover:'cover',g_wave:'wave',g_clasp:'clasp',g_reach:'reach',g_heart:'heart',g_hips:'hips',g_think:'think',g_cheer:'cheer',g_salute:'salute',g_hug:'cross',relax:'idle',point:'pointF'};
LIB.push(
  {id:'run',n:'Chạy',P:{root:{pitch:10},thor:[8,0,0],L:{el:[80,0]},R:{el:[80,0]}},anim:function(t,N){var s=Math.sin(t*9),c=Math.cos(t*9);N.L.hip[0]=48*s;N.R.hip[0]=-48*s;N.L.kn[0]=28+70*Math.max(0,c);N.R.kn[0]=28+70*Math.max(0,-c);N.L.sh[0]=-42*s;N.R.sh[0]=42*s;N.L.an[0]=-14*c;N.R.an[0]=14*c;N.thor[2]=7*s;return 4*Math.abs(c);}},
  {id:'cover',n:'Che miệng',P:{neck:[6,4,-4],R:{sh:[50,0,0],el:[135,0]},L:{sh:[0,-6,0],el:[12,0]}}},
  {id:'heart',n:'Tay đặt tim',P:{neck:[4,-5,0],R:{sh:[35,-8,55],el:[105,0]},L:{sh:[0,-6,0],el:[12,0]}}},
  {id:'reach',n:'Đưa tay',P:{L:{sh:[38,6,0],el:[8,0]},R:{sh:[38,6,0],el:[8,0]}}},
  {id:'salute',n:'Chào',P:{neck:[0,2,0],R:{sh:[25,65,-65],el:[125,0]},L:{sh:[0,-6,0],el:[12,0]}}}
);
HANDS.cover={R:'cv'};HANDS.heart={R:'cv'};HANDS.salute={R:'cl'};HANDS.reach={L:'rc',R:'rc'};

function makeOutfit(st) {
  var id=st.outfit, base=id==='uniform'?'sailor':(id==='casual'?'casual':(id==='uam'?'uam':(id==='sailor'?'sailor':'hanfu')));
  var o=deep(SOURCE_OUTFITS[base]), c1=st.c1, c2=st.c2, c3=st.c3;
  o.skin=st.skin;o.skinSh=kshade(st.skin,-.14);o.hair=st.hair;o.eye=st.eye;
  o.crown=st.acc==='flowers'&&id==='uam';o.circles=!!st.circles;o.blush=!!st.blush;
  var t=o.top,b=o.bottom;
  if(id==='hanfu_v2'){t.col=c2;t.sh=kshade(c2,-.18);t.red=c1;t.navy=c3;b.col=c1;b.sh=kshade(c1,-.24);b.trim=c3;}
  else if(id==='hanfu'||id==='uam'){t.col=c1;t.sh=kshade(c1,-.22);t.red=c3;t.navy=c2;t.inner=c2;b.col=c1;b.sh=kshade(c1,-.24);b.trim=c2;b.sashCol=c3;b.sashY=74;b.tail=96;t.flow=.9;b.flow=1;}
  else if(id==='uniform'||id==='sailor'){t.col=c2;t.sh=kshade(c2,-.15);t.navy=c1;t.red=c3;b.col=c1;b.sh=kshade(c1,-.22);if(id==='uniform'){o.bottom={kind:'skirt',col:c1,sh:kshade(c1,-.22),trim:c1,sashCol:c1,sashY:74,sashW:5,flow:.35,hem:-.45,hemR:68,short:true,noTail:true,folds:[-.8,-.55,-.25,0,.25,.55,.8]};}}
  else if(id==='casual'){t.col=c1;t.sh=kshade(c1,-.18);t.navy=c3;b.col=c2;b.sh=kshade(c2,-.22);}
  else {
    t.kind=id;t.col=c1;t.sh=kshade(c1,-.2);t.navy=c2;t.red=c3;t.inner=c2;t.tassel=false;t.flow=id==='ghost'?.8:.15;t.hemDrop=36;
    t.sleeve=[[0,27,25],[1,21,20],[2,19,18]];t.sleeveEnd=2;t.cuff=[1.84,2];
    o.shoes={col:id==='aodai'?c2:'#34303d',sh:'#24212c',sole:c3};o.socks=null;
    if(id==='aodai'){
      t.sleeve=[[0,25,23],[1,18,17],[2,15,14]];t.cuff=null;
      b={kind:'pants',col:c2,sh:kshade(c2,-.18),leg:[[0,38,33],[1,31,28],[2,30,26]]};o.panels=true;
    } else if(id==='dress'||id==='ghost'){
      t.sleeveEnd=id==='dress'?.52:1.96;t.sleeve=id==='dress'?[[0,27,25],[.52,31,27]]:[[0,28,26],[1,35,30],[2,48,38]];
      t.cuff=id==='dress'?null:[1.84,1.96];
      b={kind:'skirt',col:c1,sh:kshade(c1,-.23),trim:c3,sashCol:c3,sashY:74,sashW:7,flow:id==='ghost'?1:.55,hem:id==='dress'?.08:1.08,hemR:id==='dress'?76:66,short:id==='dress',folds:[-.7,-.35,0,.35,.7],noTail:true};
    } else {
      t.hemDrop=id==='hoodie'?64:50;
      t.sleeve=[[0,30,27],[1,26,23],[2,22,20]];
      b={kind:'pants',col:c2,sh:kshade(c2,-.22),leg:[[0,37,32],[1,29,25],[2,23,21]]};
    }
    o.bottom=b;
  }
  if(st.bottomColor){o.bottom.col=st.bottomColor;o.bottom.sh=kshade(st.bottomColor,-.22);}
  if(st.shoesColor){o.shoes.col=st.shoesColor;o.shoes.sh=kshade(st.shoesColor,-.25);}
  if(st.socksStyle==='none')o.socks=null;
  else if(st.socksStyle==='ankle'||st.socksStyle==='knee')o.socks={col:st.socksColor||'#f4f4f7',sh:kshade(st.socksColor||'#f4f4f7',-.15),from:st.socksStyle==='ankle'?1.76:1.12,prof:deep(SOURCE_OUTFITS.sailor.socks.prof)};
  if(o.socks&&st.socksColor){o.socks.col=st.socksColor;o.socks.sh=kshade(st.socksColor,-.15);}
  var sleeve=st.sleeveStyle;
  if(sleeve&&sleeve!=='auto'){
    t.flow=sleeve==='wide'?.9:0;
    t.sleeveEnd={none:.015,short:.55,half:1.28,long:2,wide:1.96}[sleeve]||2;
    t.sleeve=sleeve==='wide'?[[0,28,26],[1,38,33],[2,56,45]]:[[0,27,25],[1,21,19],[2,18,17]];
    t.cuff=sleeve==='none'?null:[Math.max(0,t.sleeveEnd-.14),t.sleeveEnd];
  }
  return o;
}

/* Every hair style uses the same moving head/chest anchors and secondary spring. */
function renderHair(J,phi,items) {
  var st=ACT,style=st.hairStyle||'long',c=Math.cos(phi*D2R),s=Math.sin(phi*D2R),so=SEC.o,col=st.hair,sh=kshade(col,-.24),hl=kshade(col,.33);
  function local(v){return add(J.head,mv(J.Rh,v));}
  function strand(id,pts,widths,depth){items.push({id:id,d:depth,svg:tube(pts,widths,{phi:phi,fill:col,shade:sh,caps:'rr',pass:3,lines:[-.45,0,.45],lineCol:hl})});}
  function tail(id,x,y,z,len,width,depth,wave){
    var a=local([x,y,z]),m=add(local([x+(wave||0),y+len*.5,z-3]),mul(so,.45)),e=add(local([x-(wave||0)*.4,y+len,z+8]),so);
    strand(id,[a,m,e],[[0,width*.8,width*.5],[1,width,width*.55],[2,4,4]],depth);
    return [a,m,e];
  }
  var d=c<-.3?8:1;
  if(['long','hime','wavy'].indexOf(style)>=0){
    if(style==='wavy')[-1,0,1].forEach(function(k){tail('hairB'+k,k*36,22,-40,290,34,d,k===0?16:k*24);});
    else {var h0=local([0,8,-26]),m=add(add(J.chest,mv(J.Rs,[0,-16,-30])),mul(so,.5)),e=add(add(J.chest,mv(J.Rs,[0,126,-30])),so);strand('hairB',[h0,m,e],PF.hair,d);}
    [-1,1].forEach(function(k){if(c<-.2||Math.abs(c)<.3)return;var len=style==='hime'?115:185;tail('lock'+k,k*64,6,-8,len,style==='hime'?14:11,5,style==='wavy'?k*12:0);});
  } else if(style==='twin')[-1,1].forEach(function(k){tail('hairB'+k,k*77,-12,-18,255,29,d,k*13);var q=proj(local([k*77,-12,-18]),phi);items.push({id:'tie'+k,d:d+.1,svg:'<circle cx="'+f1(q[0])+'" cy="'+f1(q[1])+'" r="11" fill="'+st.c3+'" stroke="'+OUT+'" stroke-width="2.5"/>'});});
  else if(style==='ponytail')tail('hairB',48,-42,-69,300,35,d,35);
  else if(style==='braid'){
    var pts=tail('hairB',73,42,-28,255,20,c>0?5:d,7),g='';
    for(var i=0;i<11;i++){var u=i/11,a=add(mul(pts[0],1-u),mul(pts[2],u)),q=proj(a,phi);g+='<path d="M'+f1(q[0]-16)+' '+f1(q[1])+' l32 17 l-28 15" fill="none" stroke="'+hl+'" stroke-width="3.3" stroke-linecap="round"/>';}
    items.push({id:'braidPattern',d:(c>0?5:d)+.01,svg:g});
  } else if(style==='bob')tail('hairB',0,10,-27,108,76,d,0);
  else if(style==='pixie')tail('hairB',0,-5,-27,58,65,d,0);
  else {
    var high=style==='highbun',p=local([0,high?-125:-100,high?-6:-50]),q=proj(p,phi);
    items.push({id:'hairB',d:d,svg:'<ellipse cx="'+f1(q[0])+'" cy="'+f1(q[1])+'" rx="'+(high?31:40)+'" ry="'+(high?31:35)+'" fill="'+col+'" stroke="'+OUT+'" stroke-width="3"/><path d="M'+f1(q[0]-24)+' '+f1(q[1])+' q24 -25 48 0" fill="none" stroke="'+hl+'" stroke-width="3"/>'});
    if(!high)[-1,1].forEach(function(k){tail('lock'+k,k*61,20,0,75,8,5,0);var b=proj(local([k*56,-75,-28]),phi);items.push({id:'bun'+k,d:d,svg:'<ellipse cx="'+f1(b[0])+'" cy="'+f1(b[1])+'" rx="27" ry="25" fill="'+col+'" stroke="'+OUT+'" stroke-width="3"/>'});});
  }
}

function outfitDetails(J,phi,items,T,B) {
  var st=ACT,c=Math.cos(phi*D2R);
  function loc(x,y,z){return proj(add(J.chest,mv(J.Rs,[x,y,z])),phi);}
  function line(points,color,w){return '<path d="M'+points.map(function(p){return f1(p[0])+' '+f1(p[1]);}).join('L')+'" fill="none" stroke="'+color+'" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round"/>';}
  var g='',id=st.outfit,z=c>=0?36:-35;
  if(id==='aodai'){
    var top=loc(0,78,z),a=proj(add(J.pel,mv(J.Rp,[-49,8,z])),phi),b=proj(add(J.pel,mv(J.Rp,[49,8,z])),phi);
    [-1,1].forEach(function(k){var ankle=add(J['an'+(k>0?'L':'R')],mv(J.Rp,[k*12,-24,z])),end=proj(add(ankle,mul(SK.hem[k>0?'L':'R'].o,.65)),phi),mid=proj(add(J['kn'+(k>0?'L':'R')],mv(J.Rp,[k*28,0,z])),phi);g+=poly2(smooth([top,k<0?a:b,[mid[0]+k*21,mid[1]],[end[0]+k*25,end[1]],end,[top[0]+k*3,mid[1]]],1),st.c1);});
    items.push({id:'aodaiPanels',d:c>=0?3.7:2.5,svg:g});g='';
    g+=line([loc(-15,-22,z),loc(-15,5,z),loc(15,5,z),loc(15,-22,z)],st.c3,5);
    if(c>0)g+=line([loc(16,8,z),loc(30,34,z),loc(42,74,z)],st.c3,2.4);
  } else if(id==='hoodie'){
    g+=poly2(smooth([loc(-29,-17,-30),loc(-53,8,-45),loc(-37,52,-48),loc(37,52,-48),loc(53,8,-45),loc(29,-17,-30)],2),kshade(st.c1,-.15));
    if(c>0){[-1,1].forEach(function(k){g+=line([loc(k*20,4,37),loc(k*16,76,38)],st.c2,3);});g+=poly2(smooth([loc(-30,82,34),loc(30,82,34),loc(36,118,34),loc(-36,118,34)],1),kshade(st.c1,-.12));}
  } else if(id==='cardigan'&&c>0){
    g+=poly2([loc(-13,-12,z),loc(13,-12,z),loc(14,124,z),loc(-14,124,z)],st.c2);
    g+=line([loc(0,4,z+1),loc(0,124,z+1)],st.c3,3);
    [40,65,90,114].forEach(function(y){var p=loc(7,y,z+2);g+='<circle cx="'+f1(p[0])+'" cy="'+f1(p[1])+'" r="3.2" fill="'+st.c3+'"/>';});
  } else if(id==='sweater'){
    for(var k=-4;k<=4;k++)g+=line([loc(k*10,22,z),loc(k*9,112,z)],kshade(st.c1,.18),1.3);
    g+=line([loc(-44,121,z),loc(44,121,z)],st.c3,9);
  } else if(id==='dress'&&c>0){g+=poly2([loc(-25,-16,z),loc(0,12,z),loc(25,-16,z)],st.c2);}
  if(g)items.push({id:'outfitDetails',d:3.8,svg:g});
}

function kEyeNew(st,o){
  if(['black','glow','blank'].indexOf(st.eyeStyle)<0)return nativeEyeNew(st,o);
  var art=st.eyeStyle==='blank'?'':('<ellipse rx="'+o.irx+'" ry="'+o.iry+'" fill="'+(st.eyeStyle==='black'?'#090910':st.eye)+'"/>'+(st.eyeStyle==='glow'?'<ellipse rx="'+(o.irx*.48)+'" ry="'+(o.iry*.65)+'" fill="#fff"/>':''));
  return {base:st.eyeStyle==='black'?'#090910':'#f9fafc',art:art};
}

function headSel(theta,O){
  var t=((theta+540)%360)-180,a=Math.abs(t),st=ACT,style=st.hairStyle,g=nativeHeadSel(theta,O),extras='',front=a<=45;
  var accessory=st.accessoryColor||st.c3,accessoryLight=st.accessoryColor?kshade(st.accessoryColor,.55):st.c2;
  if(st.accessoryColor&&O.crown)g=g.replace(/#9fb8d4/g,accessory).replace(/#e9eef5/g,accessoryLight);
  function p(d,fill){return '<path d="'+d+'" fill="'+fill+'" stroke="'+OUT+'" stroke-width="3" stroke-linejoin="round"/>';}
  if(front){
    if(style==='hime'||style==='bob')extras+=p('M-73 -40 Q0 -94 73 -40 L67 -8 L51 -8 L42 -19 L28 -8 L12 -8 L0 -16 L-14 -8 L-28 -8 L-41 -19 L-52 -8 L-67 -8Z',st.hair);
    if(style==='pixie')extras+=p('M-72 -36 Q-20 -112 66 -54 L43 -16 L28 -36 L8 -7 L-8 -27 L-31 -10 L-38 -36 L-62 -9Z',st.hair);
    if(style==='wavy')extras+=p('M-72 -28 Q-72 -78 -20 -83 Q3 -59 -15 -30 Q-25 -18 -33 -10 Q-13 -43 -20 -46 Q-41 -18 -72 -28Z',st.hair);
    if(st.hairCover)extras+=p('M-58 -42 Q-12 -75 23 -48 L39 55 Q-9 27 -35 4Z',st.hair);
    if(st.crack)extras+='<path d="M23 12 l-9 14 l10 12 l-6 15 l10 18 M24 38 l14 -2" fill="none" stroke="#65535d" stroke-width="2.4"/>';
  }
  var hairExtras=extras;extras='';
  var ca=Math.max(.25,Math.abs(Math.cos(t*D2R))),sx=front?1:ca,offset=front?0:-12*Math.sin(t*D2R);
  if(st.acc==='cat')extras+=p('M-64 -62 L-64 -116 L-19 -84Z M19 -84 L64 -116 L64 -62Z',st.hair)+p('M-57 -77 L-57 -102 L-34 -85Z M34 -85 L57 -102 L57 -77Z',accessory);
  else if(st.acc==='horns')extras+=p('M-60 -60 Q-88 -92 -58 -124 Q-67 -91 -33 -80Z M60 -60 Q88 -92 58 -124 Q67 -91 33 -80Z',accessory);
  else if(st.acc==='ribbon')extras+='<g transform="translate('+f1(offset-50*sx)+' -66)">'+p('M0 0 L-28 -20 L-30 17Z M0 0 L28 -20 L30 17Z',accessory)+'<circle r="7" fill="'+accessory+'" stroke="'+OUT+'" stroke-width="2.5"/></g>';
  else if(st.acc==='flowers'&&!O.crown){for(var i=0;i<4;i++){var x=46*sx+offset+(i%2)*12,y=-67+i*13;extras+='<g transform="translate('+f1(x)+' '+y+')">';for(var k=0;k<5;k++)extras+='<ellipse cy="-6" rx="4" ry="6" transform="rotate('+k*72+')" fill="'+(i%2?accessoryLight:accessory)+'" stroke="'+OUT+'" stroke-width="1"/>';extras+='<circle r="3" fill="#d9b875"/></g>';}}
  else if(st.acc==='veil')extras+='<path d="M-75 -60 Q0 -115 75 -60 L112 262 Q0 286 -112 262Z" fill="'+(st.accessoryColor||st.c2)+'" fill-opacity=".23" stroke="'+accessory+'" stroke-width="2.4"/>';
  return g+'<g data-edit-part="hairStyle">'+hairExtras+'</g><g data-edit-part="acc">'+extras+'</g>';
}

function basePoseFor(st,t){
  var id=ALIASES[st.pose]||st.pose||'stand';
  if(id==='g_custom'&&st.rig)return deep(st.rig);
  if(id==='g_custom'&&st.cust){var n=poseAt('idle',0);['L','R'].forEach(function(k){var a=st.cust[k];if(!a||!a.W)return;var sx=k==='L'?146:234,sg=k==='L'?-1:1,ex=a.E[0]-sx,ey=a.E[1]-212,wx=a.W[0]-a.E[0],wy=a.W[1]-a.E[1];n[k].sh[1]=Math.atan2(ex*sg,ey)/D2R-10;n[k].el[0]=Math.abs(Math.atan2(ex*wy-ey*wx,ex*wx+ey*wy)/D2R);n[k].sh[2]=0;n[k].hand=a.h||'rl';});n.neck[1]=st.cust.tilt||0;return n;}
  return poseAt(id,t);
}
function poseFor(st,t){
  var p=basePoseFor(st,t);
  if(st.armPose&&st.armPose!=='auto'){var arms=poseAt(st.armPose,t);['L','R'].forEach(function(k){['sh','el','wr','hand'].forEach(function(key){p[k][key]=Array.isArray(arms[k][key])?arms[k][key].slice():arms[k][key];});});}
  if(st.handL&&st.handL!=='auto')p.L.hand=st.handL;
  if(st.handR&&st.handR!=='auto')p.R.hand=st.handR;
  return p;
}

function render(st,opts){
  opts=opts||{};ACT=st;var live=!!opts.live,t=opts.time||0,dt=opts.dt||0,key=st.pose+JSON.stringify(st.pose==='g_custom'?(st.rig||st.cust):null),target=poseFor(st,t);
  var sec=SEC,sk=SK,order=ORDER;
  if(live){
    if(liveKey!==key){blendFrom=livePose?deep(livePose):deep(target);blend=livePose&&opts.play&&!opts.skeleton?0:1;liveKey=key;ST={};}
    blend=Math.min(1,blend+dt/.65);cur=blend<1?lerpS(blendFrom,target,blend):target;livePose=deep(cur);stepSec(dt);BLINK=opts.play&&t%3.7<.12?1:0;
  } else {SEC=deep(STATIC_SEC);SK=deep(STATIC_SK);ORDER={};cur=target;BLINK=0;}
  OUTFITS.active=makeOutfit(st);OUTFIT='active';KH.expr=st.expr||'smile';KH.eyeStyle=st.eyeStyle||'normal';HL=kshade(st.hair,.3);HD=kshade(st.hair,-.18);
  var phi=opts.view==='side'?90:opts.view==='right'?-90:opts.view==='back'?180:0,r=renderView(cur,phi),g=r.svg;
  if(opts.skeleton)g+=overlay(r.J,phi);
  if(opts.noShadow)g=g.replace(/^<ellipse[^>]*\/>/,'');
  SEC=sec;SK=sk;ORDER=order;lastTime=t;
  return {svg:g,pose:deep(cur),joints:r.J,phi:phi};
}

return {render:render,pose:poseFor,resolve:function(id){return ALIASES[id]||id;},poses:LIB.map(function(p){return [p.id,p.n];}),colors:function(st){var o=makeOutfit(st);return {bottomColor:o.bottom.col,shoesColor:o.shoes.col,socksColor:o.socks?o.socks.col:'#f4f4f7',accessoryColor:st.accessoryColor||st.c3,hasSocks:!!o.socks};},handPreview:function(type,skin){var saved=[SKIN,SKINSH];SKIN=skin;SKINSH=kshade(skin,-.14);var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="-30 -8 60 62" aria-hidden="true">'+gHand(GH[type]||GH.rl)+'</svg>';SKIN=saved[0];SKINSH=saved[1];return svg;},factorySource:function(){return createCharacterRig.toString();}};

}
const config = {"name":"Cô gái u ám","outfit":"hanfu","hairStyle":"long","expr":"smile","acc":"flowers","circles":true,"blush":false,"bg":"moon","eyeStyle":"normal","hairCover":false,"crack":false,"skin":"#efe4e2","hair":"#0f0b14","eye":"#8a8088","c1":"#233a6b","c2":"#b8bcc8","c3":"#8e1b1f","mood":0,"pose":"stand","rig":{"root":[3,0.06498785471296409,0,0.06498785471296409,0],"lum":[25,0,1.083443969144822],"thor":[0.11490686444152,0,-1.3543049614310276],"neck":[0.06308131287933236,0.1559708513111138,0.3223520519392593],"L":{"sh":[6.617710686126006,0.10213943505912891,0],"el":[14.135448984441576,0],"wr":[0.2182387795582665,0],"hip":[-7.042385799441344,0,0],"kn":[6],"an":[7.7009477769229715],"hand":"rl"},"R":{"sh":[-6.301351720955916,0.10213943505912891,0],"el":[14.269723304593708,0],"wr":[0.13426036286325538,0],"hip":[7.042385799441344,0,0],"kn":[38.729028051922626],"an":[-7.7009477769229715],"hand":"rl"},"bounce":0.6562251069424151},"armPose":"auto","handL":"auto","handR":"auto"};
export const Character = ({size=740,view="front"}) => {
  const frame=useCurrentFrame(); const {fps}=useVideoConfig();
  const result=React.useMemo(()=>{
    const engine=createCharacterRig(); const time=frame/fps; let r;
    const start=Math.max(0,time-1);
    for(let t=start;t<time;t+=1/60) r=engine.render(config,{time:t,dt:1/60,live:true,play:true,view});
    return engine.render(config,{time,dt:1/60,live:true,play:true,view,noShadow:true});
  },[frame,fps,view]);
  return <svg viewBox="-235 -60 470 920" width={size*470/920} height={size} dangerouslySetInnerHTML={{__html:result.svg}}/>;
};
