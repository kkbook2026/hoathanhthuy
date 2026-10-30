/*!
 * HOA THANH THÚY - Flora SVG illustration engine v2.0
 * Vẽ minh họa hoa tươi bằng SVG (không cần ảnh), dùng chung cho website và trang quản trị.
 * © 2026 Nguyễn Duy Điển (KK-2026). All rights reserved.
 */
(function (root) {
  'use strict';
  var UID = 0;
  var CACHE = {};

  /* ---------------- utils ---------------- */
  function n1(v) { return Math.round(v * 10) / 10; }
  function hashStr(s) { var h = 2166136261 >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function rng(seed) {
    var a = hashStr(String(seed)) || 7;
    return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function h2r(h) {
    h = String(h || '#cccccc').trim().replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h.slice(0, 6), 16); if (isNaN(n)) n = 0xcccccc;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function r2h(r) { return '#' + r.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function mix(a, b, t) { var A = h2r(a), B = h2r(b); return r2h([0, 1, 2].map(function (i) { return A[i] + (B[i] - A[i]) * t; })); }
  function lt(c, t) { return mix(c, '#ffffff', t); }
  function dk(c, t) { return mix(c, '#2a0f1c', t); }
  function rgb2hsl(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2;
    if (mx !== mn) { var d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    return [h, s, l];
  }
  function hsl2rgb(h, s, l) {
    h /= 360; if (s === 0) return [l * 255, l * 255, l * 255];
    function f(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }
    var q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
  }
  function jit(c, R, dh, dl) { var x = rgb2hsl(h2r(c)); return r2h(hsl2rgb((x[0] + (R() - .5) * 2 * dh + 360) % 360, x[1], Math.max(0, Math.min(.97, x[2] + (R() - .5) * 2 * dl)))); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }
  function G(x, y, extra) { return '<g transform="translate(' + n1(x) + ' ' + n1(y) + ')' + (extra || '') + '">'; }

  /* ---------------- gradient context ---------------- */
  function Ctx() { this.id = 'fl' + (++UID).toString(36); this.defs = []; this.n = 0; this.cache = {}; }
  Ctx.prototype.lg = function (stops, x1, y1, x2, y2) {
    var key = 'l' + stops.join('|') + x1 + y1 + x2 + y2;
    if (this.cache[key]) return this.cache[key];
    var id = this.id + 'g' + (this.n++), m = stops.length - 1;
    this.defs.push('<linearGradient id="' + id + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '">' + stops.map(function (c, i) { return '<stop offset="' + (i / m).toFixed(2) + '" stop-color="' + c + '"/>'; }).join('') + '</linearGradient>');
    return (this.cache[key] = 'url(#' + id + ')');
  };
  Ctx.prototype.rg = function (stops, cx, cy, r) {
    var key = 'r' + stops.join('|') + cx + cy + r;
    if (this.cache[key]) return this.cache[key];
    var id = this.id + 'g' + (this.n++), m = stops.length - 1;
    this.defs.push('<radialGradient id="' + id + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '">' + stops.map(function (c, i) { return '<stop offset="' + (i / m).toFixed(2) + '" stop-color="' + c + '"/>'; }).join('') + '</radialGradient>');
    return (this.cache[key] = 'url(#' + id + ')');
  };
  /* gradient along a petal: base (dark) -> tip (light) */
  Ctx.prototype.pg = function (c, d, l) { return this.lg([dk(c, d), c, lt(c, l)], 0, 1, 0, 0); };

  /* petal path in local coords, base at 0,0 pointing to -y */
  function pp(L, W, k) {
    L = n1(L); W = n1(W);
    if (k === 'pt') return 'M0 0C' + (-W) + ' ' + n1(-L * .3) + ' ' + n1(-W * .42) + ' ' + n1(-L * .84) + ' 0 ' + (-L) + 'C' + n1(W * .42) + ' ' + n1(-L * .84) + ' ' + W + ' ' + n1(-L * .3) + ' 0 0Z';
    if (k === 'rf') return 'M0 0C' + (-W) + ' ' + n1(-L * .14) + ' ' + n1(-W * 1.12) + ' ' + n1(-L * .72) + ' ' + n1(-W * .62) + ' ' + n1(-L * .9) + 'Q' + n1(-W * .34) + ' ' + n1(-L * 1.07) + ' 0 ' + n1(-L * .95) + 'Q' + n1(W * .34) + ' ' + n1(-L * 1.07) + ' ' + n1(W * .62) + ' ' + n1(-L * .9) + 'C' + n1(W * 1.12) + ' ' + n1(-L * .72) + ' ' + W + ' ' + n1(-L * .14) + ' 0 0Z';
    return 'M0 0C' + (-W) + ' ' + n1(-L * .18) + ' ' + n1(-W * 1.02) + ' ' + n1(-L * .92) + ' 0 ' + (-L) + 'C' + n1(W * 1.02) + ' ' + n1(-L * .92) + ' ' + W + ' ' + n1(-L * .18) + ' 0 0Z';
  }
  function P(d, rot, fill, stroke, sw, so, extra) {
    return '<path d="' + d + '"' + (rot ? ' transform="rotate(' + n1(rot) + ')"' : '') + ' fill="' + fill + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="' + n1(sw) + '" stroke-opacity="' + (so || .3) + '"' : '') + (extra || '') + '/>';
  }

  /* ---------------- flower heads ---------------- */
  function rose(c, x, y, r, col, R) {
    var s = G(x, y), ed = dk(col, .45), rot = R() * 360;
    s += '<circle r="' + n1(r * .96) + '" fill="' + dk(col, .32) + '"/>';
    [[6, 1, .92], [5, .82, .88], [5, .64, .86], [4, .47, .84], [3, .32, .82]].forEach(function (q, i) {
      var fill = c.pg(mix(col, dk(col, .18), i * .14), .34, Math.max(.12, .42 - i * .06));
      for (var k = 0; k < q[0]; k++) { var L = r * q[1] * (.94 + R() * .1); s += P(pp(L, L * q[2], 'r'), rot + k * 360 / q[0] + (R() - .5) * 14, fill, ed, r * .018, .3); }
      rot += 180 / q[0] + 13;
    });
    var pts = [], N = 22;
    for (var j = 0; j <= N; j++) { var t = j / N, a = t * 2.3 * Math.PI * 2 + rot, rr = r * (.04 + .24 * t); pts.push(n1(Math.cos(a) * rr) + ' ' + n1(Math.sin(a) * rr)); }
    s += '<path d="M' + pts.join('L') + '" fill="none" stroke="' + dk(col, .5) + '" stroke-width="' + n1(r * .035) + '" stroke-linecap="round" stroke-linejoin="round" opacity=".5"/>';
    return s + '</g>';
  }
  function ranunculus(c, x, y, r, col, R) {
    var s = G(x, y), rot = R() * 360, ed = dk(col, .35), rings = 7;
    s += '<circle r="' + n1(r * .98) + '" fill="' + dk(col, .22) + '"/>';
    for (var i = 0; i < rings; i++) {
      var k = 1 - i / rings * .84, n = Math.max(5, 11 - i), L = r * k, fill = c.pg(mix(col, lt(col, .18), i / rings), .2, .32);
      for (var j = 0; j < n; j++) s += P(pp(L, L * .9, 'r'), rot + j * 360 / n, fill, ed, r * .015, .25);
      rot += 180 / n + 9;
    }
    s += '<circle r="' + n1(r * .12) + '" fill="' + mix(col, '#5f7f22', .6) + '"/>';
    return s + '</g>';
  }
  function mum(c, x, y, r, col, R) {
    var s = G(x, y), rot = R() * 360, ed = dk(col, .4);
    s += '<circle r="' + n1(r * .97) + '" fill="' + dk(col, .28) + '"/>';
    [[18, 1, .3], [16, .85, .32], [14, .7, .34], [12, .55, .36], [9, .4, .4], [6, .25, .5]].forEach(function (q) {
      var fill = c.pg(col, .3, .38);
      for (var j = 0; j < q[0]; j++) { var L = r * q[1] * (.94 + R() * .08); s += P(pp(L, L * q[2], 'r'), rot + j * 360 / q[0], fill, ed, r * .012, .28); }
      rot += 180 / q[0] + 5;
    });
    return s + '</g>';
  }
  function hydrangea(c, x, y, r, col, R) {
    var s = G(x, y), N = 30, fr = r * .25, vars = [], i;
    for (i = 0; i < 5; i++) vars.push(jit(col, R, 12, .07));
    s += '<circle r="' + n1(r * .84) + '" fill="' + dk(col, .26) + '"/>';
    var pts = [];
    for (i = 0; i < N; i++) { var rr = r * .76 * Math.sqrt((i + .5) / N), a = i * 2.39996 + R() * .3; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
    pts.sort(function (a, b) { return a[1] - b[1]; });
    pts.forEach(function (p) {
      var cc = vars[Math.floor(R() * vars.length)], fill = c.pg(cc, .14, .34), t = G(p[0], p[1], ' rotate(' + n1(R() * 90) + ')');
      for (var k = 0; k < 4; k++) t += P(pp(fr, fr * .95, 'r'), k * 90, fill, dk(cc, .3), .6, .25);
      s += t + '<circle r="' + n1(fr * .17) + '" fill="' + dk(cc, .4) + '"/></g>';
    });
    return s + '</g>';
  }
  function lisianthus(c, x, y, r, col, R) {
    var s = G(x, y), rot = R() * 360, ed = dk(col, .35), base = mix(col, '#9cc56a', .25);
    var f1 = c.lg([dk(base, .1), col, lt(col, .5)], 0, 1, 0, 0), f2 = c.lg([dk(base, .05), lt(col, .1), lt(col, .55)], 0, 1, 0, 0);
    for (var i = 0; i < 5; i++) s += P(pp(r, r * .84, 'rf'), rot + i * 72, f1, ed, r * .016, .3);
    for (i = 0; i < 5; i++) s += P(pp(r * .66, r * .62, 'rf'), rot + 36 + i * 72, f2, ed, r * .014, .25);
    for (i = 0; i < 3; i++) s += P(pp(r * .38, r * .4, 'rf'), rot + 15 + i * 120, f2, ed, r * .012, .2);
    s += '<circle r="' + n1(r * .1) + '" fill="#c8e06b"/>';
    return s + '</g>';
  }
  function tulip(c, x, y, r, col, R) {
    var s = G(x, y, ' rotate(' + n1((R() - .5) * 26) + ')'), ed = dk(col, .4), f = c.lg([dk(col, .32), col, lt(col, .32)], 0, 1, 0, 0);
    s += '<path d="M0 ' + n1(r * .5) + 'L0 ' + n1(r * 1.4) + '" stroke="#4f9a3a" stroke-width="' + n1(r * .14) + '" stroke-linecap="round"/>';
    s += '<g transform="translate(' + n1(-r * .2) + ' ' + n1(r * .5) + ') rotate(-17)">' + P(pp(r * 1.05, r * .7, 'pt'), 0, f, ed, r * .02, .3) + '</g>';
    s += '<g transform="translate(' + n1(r * .2) + ' ' + n1(r * .5) + ') rotate(17)">' + P(pp(r * 1.05, r * .7, 'pt'), 0, f, ed, r * .02, .3) + '</g>';
    s += '<g transform="translate(0 ' + n1(r * .56) + ')">' + P(pp(r, r * .82, 'r'), 0, c.lg([dk(col, .2), col, lt(col, .45)], 0, 1, 0, 0), ed, r * .02, .3) + '</g>';
    s += '<path d="M' + n1(-r * .14) + ' ' + n1(r * .3) + 'Q' + n1(-r * .2) + ' ' + n1(-r * .1) + ' 0 ' + n1(-r * .36) + '" stroke="' + lt(col, .6) + '" stroke-width="' + n1(r * .06) + '" fill="none" stroke-linecap="round" opacity=".55"/>';
    return s + '</g>';
  }
  function lily(c, x, y, r, col, R) {
    var s = G(x, y), rot = R() * 360, ed = dk(col, .35), f1 = c.pg(col, .2, .5), f2 = c.pg(lt(col, .15), .15, .6), i;
    for (i = 0; i < 6; i++) s += P(pp(r, r * .44, 'pt'), rot + i * 60, f1, ed, r * .015, .3);
    for (i = 0; i < 6; i++) s += P(pp(r * .76, r * .38, 'pt'), rot + 30 + i * 60, f2, ed, r * .013, .25);
    for (i = 0; i < 6; i++) s += P(pp(r * .48, r * .3, 'pt'), rot + i * 60 + 12, f2, ed, r * .012, .2);
    for (i = 0; i < 6; i++) { var a = (rot + i * 60) * Math.PI / 180 - Math.PI / 2; s += '<path d="M' + n1(Math.cos(a) * r * .2) + ' ' + n1(Math.sin(a) * r * .2) + 'L' + n1(Math.cos(a) * r * .82) + ' ' + n1(Math.sin(a) * r * .82) + '" stroke="' + lt(col, .7) + '" stroke-width="' + n1(r * .03) + '" opacity=".6" stroke-linecap="round"/>'; }
    s += '<circle r="' + n1(r * .13) + '" fill="#cfe38a"/>';
    return s + '</g>';
  }
  function orchid(c, x, y, r, col, R) {
    var s = G(x, y, ' rotate(' + n1((R() - .5) * 30) + ')'), ed = dk(col, .3), b = mix(col, '#e27fb0', .25);
    var fs = c.lg([b, col, lt(col, .45)], 0, 1, 0, 0);
    [0, 128, -128].forEach(function (a) { s += P(pp(r * .95, r * .42, 'r'), a, fs, ed, r * .015, .25); });
    [-70, 70].forEach(function (a) { s += P(pp(r * .92, r * .8, 'r'), a, fs, ed, r * .015, .25); });
    s += P(pp(r * .52, r * .34, 'r'), 180, mix(col, '#c2185b', .6), dk(col, .5), r * .015, .3);
    s += '<ellipse cy="' + n1(-r * .02) + '" rx="' + n1(r * .13) + '" ry="' + n1(r * .16) + '" fill="#ffcf3f"/><circle cy="' + n1(-r * .13) + '" r="' + n1(r * .07) + '" fill="' + lt(col, .7) + '"/>';
    return s + '</g>';
  }
  function blossom(c, x, y, r, col, R) {
    var s = G(x, y), rot = R() * 72, f = c.lg([mix(col, '#e5457a', .4), col, lt(col, .5)], 0, 1, 0, 0), i;
    for (i = 0; i < 5; i++) s += P(pp(r, r * 1.02, 'r'), rot + i * 72, f, dk(col, .3), r * .03, .25);
    for (i = 0; i < 12; i++) { var a = i * 30 * Math.PI / 180, l = r * (.38 + R() * .12); s += '<path d="M0 0L' + n1(Math.cos(a) * l) + ' ' + n1(Math.sin(a) * l) + '" stroke="#e7a33a" stroke-width="' + n1(r * .04) + '"/><circle cx="' + n1(Math.cos(a) * l) + '" cy="' + n1(Math.sin(a) * l) + '" r="' + n1(r * .07) + '" fill="#ffc93c"/>'; }
    return s + '<circle r="' + n1(r * .14) + '" fill="#b8cf4a"/></g>';
  }
  function daisy(c, x, y, r, col, R) {
    var s = G(x, y), rot = R() * 30, f = c.pg(col, .12, .3), i;
    for (i = 0; i < 14; i++) s += P(pp(r, r * .28, 'r'), rot + i * 360 / 14, f, dk(col, .4), r * .02, .25);
    s += '<circle r="' + n1(r * .34) + '" fill="' + c.rg(['#ffe36e', '#f6b400', '#d98a00'], .4, .35, .7) + '"/>';
    return s + '</g>';
  }
  function pingpong(c, x, y, r, col, R) {
    var s = G(x, y) + '<circle r="' + n1(r) + '" fill="' + c.rg([lt(col, .45), col, dk(col, .28)], .38, .32, .75) + '"/>', N = 46;
    for (var i = 0; i < N; i++) { var rr = r * .88 * Math.sqrt((i + .5) / N), a = i * 2.39996; s += '<circle cx="' + n1(Math.cos(a) * rr) + '" cy="' + n1(Math.sin(a) * rr) + '" r="' + n1(r * .09) + '" fill="' + lt(col, .25) + '" opacity=".55"/>'; }
    return s + '</g>';
  }
  function protea(c, x, y, r, col, R) {
    var s = G(x, y), f = c.lg([dk(col, .25), col, lt(col, .35)], 0, 1, 0, 0), ed = dk(col, .4), i;
    for (i = 0; i < 9; i++) s += '<g transform="translate(0 ' + n1(r * .55) + ')">' + P(pp(r * 1.12, r * .32, 'pt'), -76 + i * 19, f, ed, r * .02, .3) + '</g>';
    s += '<ellipse cy="' + n1(-r * .05) + '" rx="' + n1(r * .55) + '" ry="' + n1(r * .52) + '" fill="' + c.rg(['#fff4ec', lt(col, .55), lt(col, .25)], .45, .35, .7) + '"/>';
    for (i = 0; i < 26; i++) { var a = R() * Math.PI * 2, rr = R() * r * .45; s += '<circle cx="' + n1(Math.cos(a) * rr) + '" cy="' + n1(Math.sin(a) * rr - r * .05) + '" r="' + n1(r * .035) + '" fill="' + dk(col, .1) + '" opacity=".5"/>'; }
    for (i = 0; i < 4; i++) s += '<g transform="translate(0 ' + n1(r * .62) + ')">' + P(pp(r * .75, r * .3, 'pt'), -45 + i * 30, f, ed, r * .02, .3) + '</g>';
    return s + '</g>';
  }
  function strelitzia(c, x, y, r, col, R) {
    var s = G(x, y, ' rotate(' + n1((R() - .5) * 20) + ')'), i;
    var fo = c.lg(['#ff6a00', '#ff9a1f', '#ffd166'], 0, 1, 0, 0);
    for (i = 0; i < 4; i++) s += '<g transform="translate(' + n1(r * .05) + ' ' + n1(r * .05) + ')">' + P(pp(r * (1.05 - i * .08), r * .2, 'pt'), -58 + i * 16, fo, '#c2410c', r * .02, .35) + '</g>';
    s += '<g transform="translate(' + n1(r * .1) + ' ' + n1(r * .05) + ')">' + P(pp(r * .8, r * .14, 'pt'), -8, '#3d4fd6', '#1e2a8a', r * .02, .4) + '</g>';
    s += '<path d="M' + n1(-r * 1.05) + ' ' + n1(r * .42) + 'Q' + n1(-r * .2) + ' ' + n1(r * .02) + ' ' + n1(r * .95) + ' ' + n1(r * .02) + 'Q' + n1(r * .1) + ' ' + n1(r * .42) + ' ' + n1(-r * .95) + ' ' + n1(r * .56) + 'Z" fill="' + c.lg(['#5d8a5a', '#7aa874', '#b05a7a'], 0, 0, 1, 0) + '"/>';
    return s + '</g>';
  }
  var HEAD = {
    rose: [rose, 34], ranunculus: [ranunculus, 31], mum: [mum, 40], hydrangea: [hydrangea, 60], lisianthus: [lisianthus, 33],
    tulip: [tulip, 29], lily: [lily, 42], orchid: [orchid, 27], blossom: [blossom, 15], daisy: [daisy, 18], pingpong: [pingpong, 27],
    protea: [protea, 40], strelitzia: [strelitzia, 40]
  };

  /* ---------------- fillers & foliage ---------------- */
  function baby(c, x, y, r, col, R) {
    var s = '<g opacity=".95">', i;
    for (i = 0; i < 5; i++) { var a = R() * Math.PI * 2, d = r * .7; s += '<path d="M' + n1(x) + ' ' + n1(y + r * .6) + 'Q' + n1(x + Math.cos(a) * d * .3) + ' ' + n1(y) + ' ' + n1(x + Math.cos(a) * d) + ' ' + n1(y + Math.sin(a) * d) + '" stroke="#8fb07a" stroke-width="1" fill="none"/>'; }
    for (i = 0; i < 16; i++) { var b = R() * Math.PI * 2, dd = Math.sqrt(R()) * r; s += '<circle cx="' + n1(x + Math.cos(b) * dd) + '" cy="' + n1(y + Math.sin(b) * dd) + '" r="' + n1(r * (.1 + R() * .06)) + '" fill="' + col + '" stroke="' + dk(col, .25) + '" stroke-width=".6" stroke-opacity=".5"/>'; }
    return s + '</g>';
  }
  function statice(c, x, y, r, col, R) {
    var s = '', i;
    for (i = 0; i < 14; i++) { var b = R() * Math.PI * 2, dd = Math.sqrt(R()) * r, cx = x + Math.cos(b) * dd, cy = y + Math.sin(b) * dd, rr = r * (.11 + R() * .05); s += '<circle cx="' + n1(cx) + '" cy="' + n1(cy) + '" r="' + n1(rr) + '" fill="' + jit(col, R, 8, .08) + '"/><circle cx="' + n1(cx) + '" cy="' + n1(cy) + '" r="' + n1(rr * .35) + '" fill="#fff" opacity=".8"/>'; }
    return s;
  }
  function sprig(c, x, y, len, ang, col, R) {
    var a = ang * Math.PI / 180, ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len, bend = (R() - .5) * len * .5;
    var mx = (x + ex) / 2 - Math.sin(a) * bend, my = (y + ey) / 2 + Math.cos(a) * bend;
    var s = '<path d="M' + n1(x) + ' ' + n1(y) + 'Q' + n1(mx) + ' ' + n1(my) + ' ' + n1(ex) + ' ' + n1(ey) + '" stroke="' + dk(col, .3) + '" stroke-width="2" fill="none"/>';
    var f = c.lg([dk(col, .12), col, lt(col, .3)], 0, 1, 1, 0);
    for (var i = 1; i <= 8; i++) {
      var t = i / 8.6, qx = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * mx + t * t * ex, qy = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * my + t * t * ey;
      var rr = len * (.11 - t * .055), side = i % 2 ? 1 : -1, ox = -Math.sin(a) * rr * .9 * side, oy = Math.cos(a) * rr * .9 * side;
      s += '<ellipse cx="' + n1(qx + ox) + '" cy="' + n1(qy + oy) + '" rx="' + n1(rr) + '" ry="' + n1(rr * .86) + '" fill="' + f + '" stroke="' + dk(col, .25) + '" stroke-width=".7" stroke-opacity=".4"/>';
    }
    return s;
  }
  function leaf(c, x, y, len, ang, col, R) {
    var f = c.lg([dk(col, .2), col, lt(col, .25)], 0, 1, 0, 0), w = len * (.26 + R() * .08);
    return '<g transform="translate(' + n1(x) + ' ' + n1(y) + ') rotate(' + n1(ang + 90) + ')">' + P(pp(len, w, 'pt'), 0, f, dk(col, .35), 1, .35) + '<path d="M0 0L0 ' + n1(-len * .9) + '" stroke="' + lt(col, .35) + '" stroke-width="1.2" opacity=".7"/></g>';
  }
  function spike(c, x, y, h, ang, col, R, kind) {
    var a = ang * Math.PI / 180, ex = x + Math.cos(a) * h, ey = y + Math.sin(a) * h;
    var s = '<path d="M' + n1(x) + ' ' + n1(y) + 'L' + n1(ex) + ' ' + n1(ey) + '" stroke="#4f8f3f" stroke-width="3" stroke-linecap="round"/>', N = kind === 'gladiolus' ? 7 : 10;
    for (var i = 0; i < N; i++) {
      var t = .32 + i / N * .66, px = x + Math.cos(a) * h * t, py = y + Math.sin(a) * h * t, sz = h * (kind === 'gladiolus' ? .085 : .07) * (1.1 - t * .6), side = (i % 2 ? 1 : -1) * sz * .4;
      px += -Math.sin(a) * side; py += Math.cos(a) * side;
      if (i > N - 3) { s += '<ellipse cx="' + n1(px) + '" cy="' + n1(py) + '" rx="' + n1(sz * .45) + '" ry="' + n1(sz * .7) + '" fill="' + lt(col, .15) + '" transform="rotate(' + n1(ang + 90) + ' ' + n1(px) + ' ' + n1(py) + ')"/>'; continue; }
      var cc = jit(col, R, 6, .06), f = c.pg(cc, .2, .35), g = G(px, py, ' rotate(' + n1(R() * 72) + ')');
      var pet = kind === 'gladiolus' ? 6 : 5;
      for (var k = 0; k < pet; k++) g += P(pp(sz, sz * .8, kind === 'gladiolus' ? 'rf' : 'r'), k * 360 / pet, f, dk(cc, .3), .6, .3);
      s += g + '<circle r="' + n1(sz * .2) + '" fill="' + (kind === 'delphinium' ? '#f5f5f5' : lt(cc, .5)) + '"/></g>';
    }
    return s;
  }
  var FILL = { baby: 1, statice: 1, euca: 1, leaf: 1, tana: 1, fern: 1 };
  var SPIKE = { delphinium: 1, snapdragon: 1, gladiolus: 1 };

  function split(list) {
    var o = { heads: [], fill: [], spikes: [] };
    (list || []).forEach(function (q) {
      var t = q[0], col = q[1] || '#f48fb1', n = Math.max(0, Math.min(60, +q[2] || 1));
      if (HEAD[t]) for (var i = 0; i < n; i++) o.heads.push({ t: t, col: col, rad: HEAD[t][1] });
      else if (SPIKE[t]) o.spikes.push({ t: t, col: col, n: n });
      else o.fill.push({ t: t, col: col, n: n });
    });
    return o;
  }

  /* pack heads into an ellipse: greedy, centre outwards */
  function arrange(heads, cx, cy, rx, ry, R, maxN) {
    if (maxN && heads.length > maxN) {
      var step = heads.length / maxN, picked = [];
      for (var q = 0; q < maxN; q++) picked.push(heads[Math.floor(q * step)]);
      heads = picked;
    }
    if (!heads.length) return [];
    var area = Math.PI * rx * ry * .95, need = 0;
    heads.forEach(function (h) { need += Math.PI * h.rad * h.rad * .8; });
    var k = Math.max(.42, Math.min(1.25, Math.sqrt(area / need)));
    var cand = [], M = 360, i;
    for (i = 0; i < M; i++) { var t = Math.sqrt((i + .5) / M), a = i * 2.39996; cand.push([cx + Math.cos(a) * rx * t, cy + Math.sin(a) * ry * t]); }
    var order = heads.map(function (h) { return { t: h.t, col: h.col, r: h.rad * k, key: h.rad * k + R() * 6 }; }).sort(function (a, b) { return b.key - a.key; });
    var placed = [];
    order.forEach(function (h) {
      var best = cand[0], bs = 1e9;
      for (var i2 = 0; i2 < cand.length; i2++) {
        var p = cand[i2], ov = 0, ex = Math.pow((p[0] - cx) / rx, 2) + Math.pow((p[1] - cy) / ry, 2);
        for (var j = 0; j < placed.length; j++) { var o = placed[j], d = Math.sqrt((p[0] - o.x) * (p[0] - o.x) + (p[1] - o.y) * (p[1] - o.y)), m = (h.r + o.r) * .8; if (d < m) ov += m - d; }
        var sc = ov * 3 + i2 * .03 + (ex > 1 ? 50 : 0);
        if (sc < bs) { bs = sc; best = p; if (ov === 0) break; }
      }
      h.x = best[0] + (R() - .5) * 4; h.y = best[1] + (R() - .5) * 4; placed.push(h);
    });
    placed.forEach(function (h) { h.r *= .9 + .16 * (h.y - (cy - ry)) / (2 * ry); });
    return placed.sort(function (a, b) { return a.y - b.y; });
  }
  function drawHeads(c, list, R, anim) {
    return list.map(function (h, i) {
      var str = HEAD[h.t][0](c, h.x, h.y, h.r, h.col, R);
      return anim ? '<g class="fl-bloom" style="--d:' + (i * .045).toFixed(2) + 's;transform-origin:' + n1(h.x) + 'px ' + n1(h.y) + 'px">' + str + '</g>' : str;
    }).join('');
  }
  function foliage(c, parts, cx, cy, rx, ry, R, full) {
    var s = '', euca = parts.fill.filter(function (f) { return f.t === 'euca'; }), lf = parts.fill.filter(function (f) { return f.t === 'leaf' || f.t === 'fern'; });
    var nE = euca.reduce(function (a, f) { return a + f.n; }, 0), nL = lf.reduce(function (a, f) { return a + f.n; }, 0) + (full ? 7 : 4), i;
    for (i = 0; i < nL; i++) { var a = -180 + (i + .5) * 180 / nL + (R() - .5) * 12; s += leaf(c, cx + Math.cos(a * Math.PI / 180) * rx * .45, cy + Math.sin(a * Math.PI / 180) * ry * .45, rx * (.62 + R() * .22), a, lf[0] ? lf[0].col : '#3f9e5a', R); }
    for (i = 0; i < Math.min(9, nE); i++) { var b = -190 + (i + .5) * 200 / Math.min(9, nE) + (R() - .5) * 10; s += sprig(c, cx + Math.cos(b * Math.PI / 180) * rx * .3, cy + Math.sin(b * Math.PI / 180) * ry * .3, rx * (.75 + R() * .2), b, euca[0].col, R); }
    return s;
  }
  function fillers(c, parts, cx, cy, rx, ry, R) {
    var s = '';
    parts.fill.forEach(function (f) {
      if (f.t === 'euca' || f.t === 'leaf' || f.t === 'fern') return;
      var n = Math.min(10, f.n);
      for (var i = 0; i < n; i++) {
        var a = (i + .5) / n * Math.PI * 2 + R() * .6, rr = .7 + R() * .28, x = cx + Math.cos(a) * rx * rr, y = cy + Math.sin(a) * ry * rr;
        if (f.t === 'baby') s += baby(c, x, y, 20, f.col, R);
        else if (f.t === 'statice') s += statice(c, x, y, 18, f.col, R);
        else if (f.t === 'tana') { for (var k = 0; k < 3; k++) s += daisy(c, x + (R() - .5) * 26, y + (R() - .5) * 22, 9, f.col, R); }
      }
    });
    return s;
  }
  function spikes(c, parts, x, y, h, spread, R) {
    var s = '', all = [];
    parts.spikes.forEach(function (sp) { for (var i = 0; i < Math.min(8, sp.n); i++) all.push(sp); });
    all.forEach(function (sp, i) { var a = -90 - spread / 2 + (i + .5) * spread / all.length + (R() - .5) * 8; s += spike(c, x + (R() - .5) * 30, y, h * (.82 + R() * .25), a, sp.col, R, sp.t); });
    return s;
  }
  function bow(x, y, col, sc) {
    var d = dk(col, .28), l = lt(col, .25);
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + (sc || 1) + ')"><path d="M-3 4L-24 52L-13 47L-7 58L4 6Z" fill="' + d + '"/><path d="M3 4L20 50L10 47L6 56L-3 6Z" fill="' + col + '"/><path d="M0 0C-12 -26 -50 -22 -44 4C-40 20 -14 10 0 0Z" fill="' + col + '"/><path d="M0 0C12 -26 50 -22 44 4C40 20 14 10 0 0Z" fill="' + col + '"/><path d="M-6 -2C-16 -14 -34 -12 -34 0" stroke="' + l + '" stroke-width="3" fill="none" opacity=".7" stroke-linecap="round"/><ellipse rx="9" ry="8" fill="' + d + '"/></g>';
  }

  /* ---------------- backgrounds ---------------- */
  var CONF = ['#ff4f8b', '#ffb627', '#2bb673', '#6c8cff', '#ff7a45', '#b06cff'];
  function bgLayer(c, bg, R) {
    var s = '<rect width="400" height="480" fill="' + bg + '"/>';
    s += '<circle cx="200" cy="205" r="172" fill="' + lt(bg, .55) + '"/><circle cx="200" cy="205" r="128" fill="' + lt(bg, .75) + '" opacity=".6"/>';
    for (var i = 0; i < 9; i++) {
      var a = R() * Math.PI * 2, d = 175 + R() * 60, x = 200 + Math.cos(a) * d, y = 220 + Math.sin(a) * d * 1.05;
      if (x < 10 || x > 390 || y < 10 || y > 470) continue;
      s += '<ellipse cx="' + n1(x) + '" cy="' + n1(y) + '" rx="' + n1(5 + R() * 5) + '" ry="' + n1(3 + R() * 3) + '" fill="' + CONF[i % CONF.length] + '" opacity=".55" transform="rotate(' + n1(R() * 180) + ' ' + n1(x) + ' ' + n1(y) + ')"/>';
    }
    return s;
  }
  function stems(x, y, n, len, col) {
    var s = '';
    for (var i = 0; i < n; i++) { var dx = (i - (n - 1) / 2) * 5; s += '<path d="M' + n1(x + dx * .4) + ' ' + y + 'L' + n1(x + dx) + ' ' + (y + len) + '" stroke="' + (col || '#4f8f3f') + '" stroke-width="4" stroke-linecap="round"/>'; }
    return s;
  }

  /* ---------------- scenes ---------------- */
  var SCENES = {};
  SCENES.bouquet = function (c, sp, R, o) {
    var w = sp.wrap || '#ffd1e1', parts = split(sp.flowers), s = '';
    s += stems(200, 395, 7, 62);
    s += '<path d="M200 412L56 172Q128 128 200 150Q272 128 344 172Z" fill="' + dk(w, .1) + '"/><path d="M200 412L56 172Q86 160 118 168Z" fill="' + dk(w, .2) + '"/><path d="M200 412L344 172Q314 160 282 168Z" fill="' + dk(w, .16) + '"/>';
    s += foliage(c, parts, 200, 220, 150, 112, R, true) + spikes(c, parts, 200, 290, 210, 70, R) + fillers(c, parts, 200, 218, 136, 100, R);
    s += drawHeads(c, arrange(parts.heads, 200, 216, 118, 90, R, 26), R, o.animate);
    s += '<path d="M200 418L86 278Q146 304 200 298Q254 304 314 278Z" fill="' + w + '"/><path d="M200 418L86 278Q116 292 146 299Z" fill="' + dk(w, .12) + '"/><path d="M200 418L314 278Q290 290 262 297Z" fill="' + lt(w, .3) + '"/>';
    s += bow(200, 386, sp.ribbon || '#ff2e74');
    return s;
  };
  SCENES.bride = function (c, sp, R, o) {
    var w = sp.wrap || '#ffffff', parts = split(sp.flowers), s = '';
    s += '<path d="M200 270L186 420Q200 428 214 420Z" fill="' + dk(w, .08) + '"/><path d="M183 300H217V408Q200 418 183 408Z" fill="' + w + '" stroke="' + dk(w, .15) + '"/>';
    for (var i = 0; i < 5; i++) s += '<circle cx="200" cy="' + (318 + i * 20) + '" r="3" fill="#fff" stroke="#d9c9b8"/>';
    s += '<path d="M200 300C180 350 150 380 160 452" stroke="' + (sp.ribbon || '#ffd6e5') + '" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M200 300C226 360 244 392 236 456" stroke="' + (sp.ribbon || '#ffd6e5') + '" stroke-width="6" fill="none" stroke-linecap="round"/>';
    s += foliage(c, parts, 200, 196, 140, 110, R, true) + fillers(c, parts, 200, 196, 132, 102, R);
    s += drawHeads(c, arrange(parts.heads, 200, 192, 118, 96, R, 24), R, o.animate);
    return s;
  };
  SCENES.basket = function (c, sp, R, o) {
    var w = sp.wrap || '#d9a56b', parts = split(sp.flowers), s = '';
    s += '<path d="M78 282Q78 96 200 96Q322 96 322 282" stroke="' + dk(w, .2) + '" stroke-width="14" fill="none"/><path d="M78 282Q78 96 200 96Q322 96 322 282" stroke="' + lt(w, .15) + '" stroke-width="5" fill="none" stroke-dasharray="10 8"/>';
    s += foliage(c, parts, 200, 234, 156, 90, R, true) + spikes(c, parts, 200, 290, 190, 90, R) + fillers(c, parts, 200, 232, 146, 82, R);
    s += drawHeads(c, arrange(parts.heads, 200, 232, 136, 76, R, 26), R, o.animate);
    s += '<path d="M64 286H336L312 424Q200 446 88 424Z" fill="' + c.lg([lt(w, .1), w, dk(w, .22)], 0, 0, 0, 1) + '"/>';
    for (var i = 0; i < 6; i++) s += '<path d="M' + (70 + i * 2) + ' ' + (304 + i * 21) + 'Q200 ' + (318 + i * 21) + ' ' + (330 - i * 2) + ' ' + (304 + i * 21) + '" stroke="' + dk(w, .3) + '" stroke-width="2.4" fill="none" opacity=".55"/>';
    for (var j = 0; j < 14; j++) s += '<path d="M' + (82 + j * 18) + ' 292L' + (92 + j * 16.4) + ' 430" stroke="' + lt(w, .25) + '" stroke-width="2" opacity=".5"/>';
    s += '<rect x="58" y="276" width="284" height="18" rx="9" fill="' + dk(w, .12) + '"/>';
    s += bow(286, 290, sp.ribbon || '#ff2e74', .62);
    return s;
  };
  SCENES.box = function (c, sp, R, o) {
    var w = sp.wrap || '#ff6fa3', parts = split(sp.flowers), s = '';
    s += '<ellipse cx="200" cy="262" rx="112" ry="28" fill="' + dk(w, .35) + '"/>';
    s += foliage(c, parts, 200, 232, 130, 64, R, false) + fillers(c, parts, 200, 226, 118, 58, R);
    s += drawHeads(c, arrange(parts.heads, 200, 222, 112, 60, R, 20), R, o.animate);
    s += '<path d="M88 262V404Q200 446 312 404V262Q200 300 88 262Z" fill="' + c.lg([dk(w, .15), w, lt(w, .18), dk(w, .1)], 0, 0, 1, 0) + '"/>';
    s += '<path d="M182 281V430Q191 432 200 432Q209 432 218 430V281Q200 284 182 281Z" fill="' + (sp.ribbon || '#ffffff') + '" opacity=".92"/>';
    s += '<path d="M88 262Q200 300 312 262" stroke="' + lt(w, .3) + '" stroke-width="3" fill="none"/>';
    s += bow(200, 300, sp.ribbon || '#ffffff', .7);
    return s;
  };
  SCENES.vase = function (c, sp, R, o) {
    var w = sp.wrap || '#f4f7ff', parts = split(sp.flowers), s = '';
    s += spikes(c, parts, 200, 300, 250, 80, R);
    s += foliage(c, parts, 200, 205, 140, 110, R, false) + fillers(c, parts, 200, 200, 130, 100, R);
    s += stems(200, 270, 6, 40);
    s += drawHeads(c, arrange(parts.heads, 200, 200, 118, 96, R, 22), R, o.animate);
    s += '<path d="M160 290Q148 318 150 330Q118 360 124 400Q132 440 200 444Q268 440 276 400Q282 360 250 330Q252 318 240 290Z" fill="' + c.lg([dk(w, .08), w, lt(w, .4), dk(w, .12)], 0, 0, 1, 0) + '" stroke="' + dk(w, .2) + '" stroke-width="1.5"/>';
    var pat = sp.ribbon || '#2f5bd3';
    s += '<path d="M138 372Q200 392 262 372" stroke="' + pat + '" stroke-width="3" fill="none"/><path d="M134 398Q200 418 266 398" stroke="' + pat + '" stroke-width="2" fill="none"/>';
    for (var i = 0; i < 6; i++) s += '<path d="M' + (150 + i * 20) + ' 385q5 -12 10 0t10 0" stroke="' + pat + '" stroke-width="2" fill="none"/>';
    s += '<ellipse cx="200" cy="290" rx="40" ry="8" fill="' + dk(w, .18) + '"/>';
    return s;
  };
  SCENES.bunch = function (c, sp, R, o) {
    var w = sp.wrap || '#dcb48c', parts = split(sp.flowers), s = '';
    s += stems(200, 250, 9, 200, '#5a9a45');
    s += foliage(c, parts, 200, 170, 120, 90, R, false) + spikes(c, parts, 200, 300, 240, 60, R) + fillers(c, parts, 200, 165, 112, 80, R);
    s += drawHeads(c, arrange(parts.heads, 200, 160, 110, 84, R, 18), R, o.animate);
    s += '<path d="M120 250L280 250L246 436L154 436Z" fill="' + c.lg([dk(w, .12), w, lt(w, .15)], 0, 0, 1, 0) + '"/><path d="M120 250L170 250L176 436L154 436Z" fill="' + dk(w, .1) + '" opacity=".6"/>';
    s += '<path d="M138 330Q200 344 262 330" stroke="#8a5a2b" stroke-width="5" fill="none"/><path d="M196 336l-14 26M204 336l12 28" stroke="#8a5a2b" stroke-width="3"/>';
    s += '<rect x="164" y="376" width="72" height="26" rx="4" fill="#fffaf2" opacity=".9"/><path d="M174 386h52M174 393h36" stroke="' + dk(w, .3) + '" stroke-width="2"/>';
    return s;
  };
  SCENES.stand = function (c, sp, R, o) {
    var parts = split(sp.flowers), s = '', w = sp.wrap || '#ffd166';
    s += '<path d="M200 262L118 468M200 262L282 468M200 262L200 476" stroke="#c99a4b" stroke-width="7" stroke-linecap="round"/><path d="M150 392H250" stroke="#c99a4b" stroke-width="5"/>';
    s += spikes(c, parts, 200, 160, 124, 120, R);
    s += foliage(c, parts, 200, 184, 142, 142, R, true) + fillers(c, parts, 200, 184, 124, 124, R);
    s += '<circle cx="200" cy="184" r="120" fill="' + dk(w, .08) + '" opacity=".35"/>';
    s += drawHeads(c, arrange(parts.heads, 200, 184, 110, 110, R, 30), R, o.animate);
    s += '<path d="M92 236Q200 290 308 236L316 262Q200 318 84 262Z" fill="' + (sp.ribbon || '#e8113f') + '"/><path d="M92 236Q200 290 308 236" stroke="#ffd166" stroke-width="3" fill="none"/><path d="M84 262Q200 318 316 262" stroke="#ffd166" stroke-width="3" fill="none"/>';
    s += '<path d="M90 252L60 330L80 318L84 342L104 262Z" fill="' + dk(sp.ribbon || '#e8113f', .2) + '"/><path d="M310 252L340 330L320 318L316 342L296 262Z" fill="' + dk(sp.ribbon || '#e8113f', .2) + '"/>';
    return s;
  };
  /* potted plants */
  function pot(c, x, y, w, h, col, kind) {
    var f = c.lg([dk(col, .14), col, lt(col, .3), dk(col, .18)], 0, 0, 1, 0);
    if (kind === 'bonsai') return '<path d="M' + (x - w / 2) + ' ' + y + 'H' + (x + w / 2) + 'L' + (x + w / 2 - 14) + ' ' + (y + h) + 'H' + (x - w / 2 + 14) + 'Z" fill="' + f + '"/><rect x="' + (x - w / 2 - 6) + '" y="' + (y - 8) + '" width="' + (w + 12) + '" height="12" rx="4" fill="' + dk(col, .1) + '"/>';
    return '<path d="M' + (x - w / 2) + ' ' + y + 'H' + (x + w / 2) + 'L' + (x + w / 2 - w * .12) + ' ' + (y + h) + 'Q' + x + ' ' + (y + h + 8) + ' ' + (x - w / 2 + w * .12) + ' ' + (y + h) + 'Z" fill="' + f + '"/><rect x="' + (x - w / 2 - 8) + '" y="' + (y - 10) + '" width="' + (w + 16) + '" height="18" rx="9" fill="' + dk(col, .08) + '"/>';
  }
  SCENES.pot = function (c, sp, R, o) {
    var s = '', col = (sp.flowers && sp.flowers[0] && sp.flowers[0][1]) || '#f26baa', pc = sp.wrap || '#ffffff', plant = sp.plant || 'orchid', i, k;
    if (plant === 'orchid' || plant === 'cymbidium') {
      var cym = plant === 'cymbidium';
      if (cym) { for (i = 0; i < 14; i++) { var a = -90 + (i - 6.5) * 13, l = 190 + R() * 60, ex = 200 + Math.cos(a * Math.PI / 180) * l, ey = 350 + Math.sin(a * Math.PI / 180) * l * .8; s += '<path d="M200 350Q' + n1(200 + Math.cos(a * Math.PI / 180) * l * .4) + ' ' + n1(350 - l * .55) + ' ' + n1(ex) + ' ' + n1(Math.min(ey + 60, 300)) + '" stroke="' + (i % 2 ? '#2f8a4c' : '#3fa35c') + '" stroke-width="5" fill="none" stroke-linecap="round"/>'; } }
      else { for (i = 0; i < 4; i++) s += leaf(c, 200 + (i - 1.5) * 18, 352, 92 + R() * 20, (i < 2 ? 200 : -20) + (i % 2 ? 18 : -6), '#2f8a4c', R); }
      var nS = cym ? 6 : 3;
      for (k = 0; k < nS; k++) {
        var off = k - (nS - 1) / 2, sx = 200 + off * (cym ? 13 : 10), cx1, cy1, exx, eyy;
        if (cym) { eyy = 84 + R() * 34 + Math.abs(off) * 22; exx = sx + off * 16; cx1 = sx + off * 4; cy1 = (345 + eyy) / 2; }
        else { var dir = (k === 1 ? -1 : 1) * (40 + k * 10), top = 70 + k * 26; cx1 = sx + dir * .3; cy1 = top - 10; exx = sx + dir * 2.2; eyy = top + 70; }
        s += '<path d="M' + n1(sx) + ' 345Q' + n1(cx1) + ' ' + n1(cy1) + ' ' + n1(exx) + ' ' + n1(eyy) + '" stroke="#5b7f3a" stroke-width="3" fill="none"/>';
        var nb = cym ? 8 : 6;
        for (i = 0; i < nb; i++) {
          var t = (cym ? .38 : .45) + i / nb * (cym ? .62 : .55), bx = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx1 + t * t * exx, by = (1 - t) * (1 - t) * 345 + 2 * (1 - t) * t * cy1 + t * t * eyy;
          if (cym) bx += (i % 2 ? 1 : -1) * 7;
          if (i >= nb - 1) s += '<circle cx="' + n1(bx) + '" cy="' + n1(by) + '" r="5" fill="' + lt(col, .2) + '"/>';
          else s += orchid(c, bx, by, (cym ? 15 : 27) * (1 - i / nb * .35), cym ? jit(col, R, 6, .05) : col, R);
        }
      }
      s += '<rect x="186" y="330" width="28" height="24" fill="#6b4a2b" opacity=".6"/>';
      s += pot(c, 200, 350, 150, 92, pc);
      if (pc.toLowerCase() === '#ffffff' || pc.toLowerCase() === '#fff') s += '<path d="M140 380Q200 396 260 380" stroke="#2f5bd3" stroke-width="3" fill="none"/>';
    } else if (plant === 'rosebush') {
      for (i = 0; i < 70; i++) { var a2 = R() * Math.PI * 2, d = Math.sqrt(R()), x = 200 + Math.cos(a2) * 130 * d, y = 200 + Math.sin(a2) * 110 * d; s += '<ellipse cx="' + n1(x) + '" cy="' + n1(y) + '" rx="13" ry="8" fill="' + (i % 3 ? '#2f8a4c' : '#46a862') + '" transform="rotate(' + n1(R() * 180) + ' ' + n1(x) + ' ' + n1(y) + ')"/>'; }
      s += '<path d="M200 350V250M200 300L170 260M200 290L232 250" stroke="#5b4a2b" stroke-width="6" stroke-linecap="round"/>';
      var bush = []; for (i = 0; i < 12; i++) bush.push({ t: 'rose', col: col, rad: 26 });
      s += drawHeads(c, arrange(bush, 200, 196, 118, 96, R), R, o.animate);
      s += pot(c, 200, 350, 170, 92, pc || '#d9783f');
    } else if (plant === 'bonsai') {
      s += '<path d="M206 392C196 340 238 320 222 280C206 240 150 250 150 206C150 170 196 160 214 128" stroke="#3b2a20" stroke-width="20" fill="none" stroke-linecap="round"/><path d="M222 280C262 270 292 240 300 206M156 214C120 206 96 182 92 150M214 128C230 106 262 100 280 86M186 160C170 130 140 118 120 104" stroke="#3b2a20" stroke-width="8" fill="none" stroke-linecap="round"/>';
      var tips = [[300, 206], [92, 150], [280, 86], [120, 104], [214, 128], [254, 250], [168, 190], [150, 240]];
      tips.forEach(function (p) { for (var j = 0; j < 6; j++) s += blossom(c, p[0] + (R() - .5) * 60, p[1] + (R() - .5) * 46, 10 + R() * 5, j % 3 ? col : lt(col, .4), R); });
      s += '<ellipse cx="206" cy="392" rx="70" ry="10" fill="#6aa84f"/>';
      s += pot(c, 200, 396, 220, 52, pc || '#2f3e6e', 'bonsai');
    }
    return s;
  };

  /* ---------------- public api ---------------- */
  function svgWrap(c, body, vb, opt) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '" preserveAspectRatio="' + (opt.par || 'xMidYMid slice') + '"' + (opt.label ? ' role="img" aria-label="' + esc(opt.label) + '"' : ' aria-hidden="true"') + (opt.cls ? ' class="' + opt.cls + '"' : '') + '><defs>' + c.defs.join('') + '</defs>' + body + '</svg>';
  }
  function scene(spec, opt) {
    opt = opt || {}; spec = spec || {};
    var key = opt.cache !== false ? JSON.stringify(spec) + '|' + (opt.transparent ? 1 : 0) + (opt.animate ? 1 : 0) + (opt.seed || '') + (opt.par || '') : null;
    if (key && CACHE[key] && !opt.animate) return CACHE[key];
    var c = new Ctx(), R = rng(opt.seed || JSON.stringify(spec)), bg = spec.bg || '#ffe3ec', s = '';
    if (!opt.transparent) s += bgLayer(c, bg, R);
    s += '<ellipse cx="200" cy="452" rx="128" ry="14" fill="' + dk(bg, .4) + '" opacity="' + (opt.transparent ? .12 : .22) + '"/>';
    s += (SCENES[spec.scene] || SCENES.bouquet)(c, spec, R, opt);
    var out = svgWrap(c, s, '0 0 400 480', opt);
    if (key && !opt.animate) CACHE[key] = out;
    return out;
  }
  function head(type, color, opt) {
    opt = opt || {};
    var c = new Ctx(), R = rng(type + color + (opt.seed || '')), s = '';
    if (opt.bg) s += '<circle cx="50" cy="50" r="50" fill="' + opt.bg + '"/>';
    if (HEAD[type]) s += HEAD[type][0](c, 50, type === 'tulip' ? 44 : 50, type === 'tulip' ? 30 : 38, color, R);
    else if (SPIKE[type]) s += spike(c, 50, 96, 90, -90, color, R, type);
    else if (type === 'euca') s += sprig(c, 20, 86, 80, -55, color, R);
    else if (type === 'baby') s += baby(c, 50, 46, 34, color, R);
    else if (type === 'statice') s += statice(c, 50, 50, 32, color, R);
    else if (type === 'tana') { s += daisy(c, 34, 40, 18, color, R) + daisy(c, 64, 46, 16, color, R) + daisy(c, 46, 70, 15, color, R); }
    else s += leaf(c, 50, 92, 80, -90, color || '#3f9e5a', R);
    return svgWrap(c, s, '0 0 100 100', { par: 'xMidYMid meet', label: opt.label });
  }
  function landscape(id, opt) {
    opt = opt || {};
    var c = new Ctx(), R = rng('land' + id), s = '', i;
    if (id === 'sapa') {
      s += '<rect width="600" height="360" fill="' + c.lg(['#cfe3ff', '#eaf2ff', '#fff3f6'], 0, 0, 0, 1) + '"/><circle cx="470" cy="80" r="40" fill="#fff1b8"/>';
      s += '<path d="M0 220L90 110L150 160L240 60L330 170L400 120L480 190L540 130L600 170V360H0Z" fill="#8fb0d8"/><path d="M240 60L262 88L240 84L222 92Z" fill="#fff"/>';
      s += '<path d="M0 250L120 170L220 230L330 160L460 240L600 190V360H0Z" fill="#5f9c7a"/>';
      for (i = 0; i < 9; i++) s += '<path d="M0 ' + (262 + i * 12) + 'Q150 ' + (232 + i * 12) + ' 300 ' + (262 + i * 12) + 'T600 ' + (256 + i * 12) + 'V360H0Z" fill="' + (i % 2 ? '#8cc56a' : '#b6d96a') + '" opacity=".95"/>';
      s += '<rect y="150" width="600" height="26" fill="#fff" opacity=".45"/><rect y="200" width="600" height="14" fill="#fff" opacity=".35"/>';
      s += '<path d="M600 40C540 60 520 90 470 100M560 56C560 80 540 96 530 120" stroke="#3b2a20" stroke-width="6" fill="none" stroke-linecap="round"/>';
      [[520, 70], [560, 52], [540, 100], [500, 96], [575, 78]].forEach(function (p) { s += blossom(c, p[0], p[1], 12, '#ffffff', R); });
    } else if (id === 'melinh') {
      s += '<rect width="600" height="360" fill="' + c.lg(['#ffe4ee', '#fff6e8'], 0, 0, 0, 1) + '"/><circle cx="120" cy="90" r="46" fill="#ffd36e"/>';
      s += '<path d="M0 190Q150 170 300 186T600 180V360H0Z" fill="#a8d5a0"/>';
      s += '<path d="M0 214Q200 196 380 220T600 210V236Q400 250 200 230T0 244Z" fill="#7cc3ef"/><path d="M40 226Q200 214 340 230" stroke="#fff" stroke-width="3" opacity=".6" fill="none"/>';
      var rows = ['#ff4f8b', '#ffb627', '#e8113f', '#ffffff', '#ff7aa8', '#ffd166'];
      for (i = 0; i < 6; i++) { var y = 262 + i * 17; s += '<path d="M0 ' + y + 'H600V' + (y + 17) + 'H0Z" fill="' + (i % 2 ? '#5fae5c' : '#4f9e4f') + '"/>'; for (var x = 8; x < 600; x += 16) s += '<circle cx="' + (x + (i % 2) * 8) + '" cy="' + (y + 8) + '" r="5" fill="' + rows[i] + '"/>'; }
      for (i = 0; i < 4; i++) { var hx = 360 + i * 52; s += '<path d="M' + hx + ' 190L' + (hx + 20) + ' 172L' + (hx + 40) + ' 190V206H' + hx + 'Z" fill="#fff6ea"/><path d="M' + (hx - 4) + ' 192L' + (hx + 20) + ' 168L' + (hx + 44) + ' 192" stroke="#d1495b" stroke-width="6" fill="none"/>'; }
    } else {
      s += '<rect width="600" height="360" fill="' + c.lg(['#bfe6ff', '#e8f6ff', '#fff4e6'], 0, 0, 0, 1) + '"/><circle cx="430" cy="96" r="44" fill="#ffd36e"/><circle cx="430" cy="96" r="64" fill="#ffd36e" opacity=".25"/>';
      s += '<path d="M0 180Q120 120 240 170T480 150T600 160V360H0Z" fill="#9fd3b8"/>';
      for (i = 0; i < 16; i++) { var px = 10 + i * 38 + R() * 10, py = 168 + Math.sin(i) * 8, ph = 40 + R() * 26; s += '<path d="M' + n1(px) + ' ' + n1(py - ph) + 'L' + n1(px + 12) + ' ' + n1(py) + 'H' + n1(px - 12) + 'Z" fill="#2f7d5b"/><path d="M' + n1(px) + ' ' + n1(py - ph - 12) + 'L' + n1(px + 9) + ' ' + n1(py - ph * .45) + 'H' + n1(px - 9) + 'Z" fill="#2a6e50"/>'; }
      s += '<path d="M0 230Q160 200 320 226T600 214V360H0Z" fill="#6fbf8a"/>';
      for (i = 0; i < 7; i++) { var gx = 40 + i * 80; s += '<path d="M' + gx + ' 262V236Q' + (gx + 34) + ' 206 ' + (gx + 68) + ' 236V262Z" fill="#ffffff" opacity=".85" stroke="#d8eef7" stroke-width="2"/><path d="M' + (gx + 34) + ' 214V262" stroke="#d8eef7" stroke-width="2"/>'; }
      var fc = ['#ff4f8b', '#ffb627', '#6c8cff', '#ffffff', '#ff7a45'];
      for (i = 0; i < 5; i++) { var y2 = 280 + i * 16; s += '<path d="M0 ' + y2 + 'H600V' + (y2 + 16) + 'H0Z" fill="' + (i % 2 ? '#58ab6e' : '#4c9e63') + '"/>'; for (var x2 = 6; x2 < 600; x2 += 14) s += '<circle cx="' + (x2 + (i % 2) * 7) + '" cy="' + (y2 + 8) + '" r="5" fill="' + fc[i] + '"/>'; }
      s += '<rect y="196" width="600" height="20" fill="#fff" opacity=".5"/><rect y="150" width="600" height="10" fill="#fff" opacity=".35"/>';
    }
    return svgWrap(c, s, '0 0 600 360', { par: opt.par || 'xMidYMid slice', label: opt.label });
  }

  root.Flora = {
    scene: scene, head: head, landscape: landscape,
    types: { heads: Object.keys(HEAD), fillers: Object.keys(FILL), spikes: Object.keys(SPIKE) },
    scenes: ['bouquet', 'bride', 'basket', 'box', 'vase', 'bunch', 'stand', 'pot'],
    plants: ['orchid', 'cymbidium', 'rosebush', 'bonsai'],
    color: { mix: mix, lighten: lt, darken: dk }
  };
})(typeof window !== 'undefined' ? window : this);
