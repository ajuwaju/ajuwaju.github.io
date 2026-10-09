// poster maker. everything happens in this browser; the photo is never uploaded anywhere.
(function () {
  "use strict";

  var W = 1200, H = 1600;
  var canvas = document.getElementById("canvas");
  var ctx = canvas.getContext("2d");
  var $ = function (id) { return document.getElementById(id); };
  var status = $("status");

  var state = { img: null, seed: Date.now() % 100000, recipe: "random", palette: "random", resolved: {},
                photo: { zoom: 1, px: 0, py: 0, frame: 1 }, flowers: null };

  // ---------- random ----------
  function mulberry(seed) {
    var a = seed >>> 0;
    return function () { a += 0x6D2B79F5; var t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function pick(rnd, arr) { return arr[Math.floor(rnd() * arr.length)]; }
  function between(rnd, a, b) { return a + rnd() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ---------- palettes ----------
  var PALETTES = {
    bubblegum: { bg: "#f9a8c5", bg2: "#fbd5e2", ink: "#1f1a1c", accent: "#ff7fb0", accent2: "#ffd0e0", paper: "#fff6f9", duo: ["#2a1f33", "#f6dfe9"] },
    blush:     { bg: "#f6dde6", bg2: "#fbeef2", ink: "#1b1719", accent: "#e0609d", accent2: "#f7cfe0", paper: "#fbf6f3", duo: ["#3a2630", "#f8e9ef"] },
    powder:    { bg: "#c9d6ec", bg2: "#e3eaf5", ink: "#1e2230", accent: "#7f98cc", accent2: "#dfe6f3", paper: "#f7f8fb", duo: ["#2b3250", "#e9eef8"] },
    sage:      { bg: "#c6d2b7", bg2: "#e3e9d9", ink: "#1f241b", accent: "#7f9a6a", accent2: "#e0e8d3", paper: "#f7f8f3", duo: ["#2c3526", "#e6ecdc"] },
    lilac:     { bg: "#d8cdec", bg2: "#ece6f6", ink: "#231c2e", accent: "#9a7fd1", accent2: "#e6def4", paper: "#faf8fd", duo: ["#2e2440", "#ece6f6"] }
  };

  // ---------- fonts ----------
  var FONTS = ['italic 400 80px "Instrument Serif"', '400 80px "Instrument Serif"', '400 80px "Pinyon Script"', '600 80px "Caveat"', '900 80px "DM Sans"', '400 80px "DM Sans"', 'italic 400 80px "DM Sans"', '400 80px "Silkscreen"'];
  function fontsReady() { return Promise.all(FONTS.map(function (f) { return document.fonts.load(f).catch(function () {}); })); }
  var SERIF = '"Instrument Serif", Georgia, serif', SCRIPT = '"Pinyon Script", cursive', HAND = '"Caveat", cursive', SANS = '"DM Sans", system-ui, sans-serif', TYPE = '"Courier New", Courier, monospace';

  // ---------- image helpers ----------
  // where the photo sits inside a frame: cover-fit, then the user's zoom and drag
  function coverRect(iw, ih, w, h, fx, fy) {
    var ph = state.photo;
    var s = Math.max(w / iw, h / ih) * ph.zoom, sw = iw * s, sh = ih * s;
    var x = -(sw - w) * (fx == null ? 0.5 : fx) + ph.px * w * 0.6;
    var y = -(sh - h) * (fy == null ? 0.35 : fy) + ph.py * h * 0.6;
    return { x: x, y: y, w: sw, h: sh };
  }
  function drawCover(c, img, x, y, w, h, fx, fy) {
    var r = coverRect(img.width, img.height, w, h, fx, fy);
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.drawImage(img, x + r.x, y + r.y, r.w, r.h); c.restore();
  }
  function offscreen(w, h) { var o = document.createElement("canvas"); o.width = w; o.height = h; return o; }
  function fr(v) { return Math.round(v * state.photo.frame); }
  function hex(h) { h = h.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }

  function process(img, w, h, opts, fx, fy) {
    var o = offscreen(w, h), c = o.getContext("2d");
    c.fillStyle = opts.fill || "#ffffff"; c.fillRect(0, 0, w, h);
    drawCover(c, img, 0, 0, w, h, fx, fy);
    var id = c.getImageData(0, 0, w, h), d = id.data, n = d.length;
    var gray = opts.gray || 0, contrast = opts.contrast || 1, grain = opts.grain || 0, lift = opts.lift || 0;
    var tint = opts.tint ? hex(opts.tint) : null, tintAmt = opts.tintAmt || 0;
    var duo = opts.duo ? [hex(opts.duo[0]), hex(opts.duo[1])] : null;
    var rnd = mulberry(opts.seed || 1);
    for (var i = 0; i < n; i += 4) {
      var r = d[i], g = d[i + 1], b = d[i + 2];
      var l = 0.299 * r + 0.587 * g + 0.114 * b;
      if (gray) { r = r + (l - r) * gray; g = g + (l - g) * gray; b = b + (l - b) * gray; }
      r = (r - 128) * contrast + 128 + lift; g = (g - 128) * contrast + 128 + lift; b = (b - 128) * contrast + 128 + lift;
      if (grain) { var gn = (rnd() - 0.5) * grain; r += gn; g += gn; b += gn; }
      if (duo) { var k2 = clamp((0.299 * r + 0.587 * g + 0.114 * b) / 255, 0, 1); r = duo[0][0] + (duo[1][0] - duo[0][0]) * k2; g = duo[0][1] + (duo[1][1] - duo[0][1]) * k2; b = duo[0][2] + (duo[1][2] - duo[0][2]) * k2; }
      if (tint) { var k = tintAmt * (l / 255); r += (tint[0] - r) * k; g += (tint[1] - g) * k; b += (tint[2] - b) * k; }
      d[i] = clamp(r, 0, 255); d[i + 1] = clamp(g, 0, 255); d[i + 2] = clamp(b, 0, 255);
    }
    c.putImageData(id, 0, 0);
    return o;
  }
  var BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  // ordered dither to two colours, drawn at a coarse pixel size for the bitmap look
  function dither(src, px, dark, light) {
    var w = src.width, h = src.height, o = offscreen(w, h), c = o.getContext("2d");
    var d = src.getContext("2d").getImageData(0, 0, w, h).data, dk = hex(dark), lt = hex(light);
    var out = c.createImageData(w, h), od = out.data;
    for (var y = 0; y < h; y += px) for (var x = 0; x < w; x += px) {
      var i = (y * w + x) * 4, l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      var thr = (BAYER[(y / px) & 3][(x / px) & 3] + 0.5) / 16, col = l > thr ? lt : dk;
      for (var yy = 0; yy < px && y + yy < h; yy++) for (var xx = 0; xx < px && x + xx < w; xx++) { var j = ((y + yy) * w + (x + xx)) * 4; od[j] = col[0]; od[j + 1] = col[1]; od[j + 2] = col[2]; od[j + 3] = 255; }
    }
    c.putImageData(out, 0, 0); return o;
  }
  function halftone(src, cell, ink, paper) {
    var w = src.width, h = src.height, o = offscreen(w, h), c = o.getContext("2d");
    var d = src.getContext("2d").getImageData(0, 0, w, h).data;
    c.fillStyle = paper; c.fillRect(0, 0, w, h); c.fillStyle = ink;
    for (var y = 0; y < h; y += cell) for (var x = 0; x < w; x += cell) {
      var sum = 0, cnt = 0;
      for (var yy = 0; yy < cell && y + yy < h; yy += 2) for (var xx = 0; xx < cell && x + xx < w; xx += 2) { var i = ((y + yy) * w + (x + xx)) * 4; sum += d[i]; cnt++; }
      var dark = 1 - (sum / cnt) / 255, rad = dark * cell * 0.62;
      if (rad > 0.4) { c.beginPath(); c.arc(x + cell / 2, y + cell / 2, rad, 0, Math.PI * 2); c.fill(); }
    }
    return o;
  }
  function cutout(src, threshold, color) {
    var w = src.width, h = src.height, o = offscreen(w, h), c = o.getContext("2d");
    var id = src.getContext("2d").getImageData(0, 0, w, h), d = id.data, col = hex(color);
    for (var i = 0; i < d.length; i += 4) {
      var l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (l < threshold) { d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255; } else { d[i + 3] = 0; }
    }
    c.putImageData(id, 0, 0); return o;
  }
  function tornClip(c, x, y, w, h, rnd, amp) {
    amp = amp || 10; var n = 26, i;
    c.beginPath(); c.moveTo(x, y + between(rnd, 0, amp));
    for (i = 1; i <= n; i++) c.lineTo(x + w * i / n, y + between(rnd, 0, amp));
    for (i = n; i >= 0; i--) c.lineTo(x + w * i / n, y + h - between(rnd, 0, amp));
    c.closePath(); c.clip();
  }
  function tape(c, x, y, w, rot, color) { c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha = 0.85; c.fillStyle = color; c.fillRect(-w / 2, -14, w, 28); c.restore(); }
  function star(c, x, y, r, color) {
    c.save(); c.translate(x, y); c.fillStyle = color; c.beginPath();
    for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4, rr = i % 2 ? r * 0.28 : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    c.closePath(); c.fill(); c.restore();
  }
  function paperclip(c, x, y, s, color) {
    c.save(); c.translate(x, y); c.scale(s, s); c.strokeStyle = color; c.lineWidth = 2.4; c.lineCap = "round"; c.beginPath();
    c.moveTo(9, 18); c.lineTo(9, 56); c.bezierCurveTo(9, 64, 21, 64, 21, 56); c.lineTo(21, 12); c.bezierCurveTo(21, 6, 13, 6, 13, 12); c.lineTo(13, 52); c.bezierCurveTo(13, 55, 17, 55, 17, 52); c.lineTo(17, 20); c.stroke(); c.restore();
  }
  function paperGrain(c, w, h, rnd, alpha) {
    c.save(); c.globalAlpha = alpha || 0.08;
    for (var i = 0; i < 9000; i++) { c.fillStyle = rnd() > 0.5 ? "#000" : "#fff"; c.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }
    c.restore();
  }
  function smudges(c, w, h, rnd, colors, count) {
    c.save(); c.lineCap = "round";
    for (var i = 0; i < count; i++) {
      c.strokeStyle = pick(rnd, colors); c.globalAlpha = between(rnd, 0.05, 0.22); c.lineWidth = between(rnd, 6, 60);
      var x = rnd() * w, y = rnd() * h; c.beginPath(); c.moveTo(x, y);
      c.bezierCurveTo(x + between(rnd, -200, 200), y + between(rnd, -120, 120), x + between(rnd, -300, 300), y + between(rnd, -200, 200), x + between(rnd, -260, 260), y + between(rnd, -160, 160)); c.stroke();
    }
    c.restore();
  }
  function spiral(c, x, y, r, color) {
    c.save(); c.strokeStyle = color; c.lineWidth = 2; c.beginPath();
    for (var a = 0; a < Math.PI * 7; a += 0.1) { var rr = r * a / (Math.PI * 7); c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.stroke(); c.restore();
  }
  function flourishFrame(c, x, y, w, h, color) {
    c.save(); c.strokeStyle = color; c.lineWidth = 1.6; c.globalAlpha = 0.9;
    c.strokeRect(x + 10, y + 10, w - 20, h - 20); c.strokeRect(x + 22, y + 22, w - 44, h - 44);
    var corners = [[x + 22, y + 22, 1, 1], [x + w - 22, y + 22, -1, 1], [x + 22, y + h - 22, 1, -1], [x + w - 22, y + h - 22, -1, -1]];
    corners.forEach(function (k) {
      c.save(); c.translate(k[0], k[1]); c.scale(k[2], k[3]);
      for (var i = 0; i < 4; i++) { c.beginPath(); c.arc(40 + i * 34, 26, 16 - i * 2, Math.PI, Math.PI * 2.6); c.stroke(); c.beginPath(); c.arc(26, 40 + i * 34, 16 - i * 2, Math.PI * 1.5, Math.PI * 3.1); c.stroke(); }
      c.beginPath(); c.arc(70, 70, 22, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(70, 70, 10, 0, Math.PI * 2); c.stroke(); c.restore();
    });
    // scallops along the edges
    for (var i = 60; i < w - 60; i += 30) { c.beginPath(); c.arc(x + i, y + 22, 9, Math.PI, 0); c.stroke(); c.beginPath(); c.arc(x + i, y + h - 22, 9, 0, Math.PI); c.stroke(); }
    c.restore();
  }
  function lace(c, x, y, w, color, rnd) {
    c.save(); c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 1.2;
    for (var i = 0; i < w; i += 70) {
      var cx = x + i + 35, cy = y;
      c.globalAlpha = 0.9; c.beginPath(); c.arc(cx, cy, 34, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(cx, cy, 24, 0, Math.PI * 2); c.stroke();
      for (var a = 0; a < Math.PI * 2; a += Math.PI / 8) { c.beginPath(); c.arc(cx + Math.cos(a) * 29, cy + Math.sin(a) * 29, 2, 0, Math.PI * 2); c.fill(); }
      for (var b = 0; b < Math.PI * 2; b += Math.PI / 6) { c.beginPath(); c.arc(cx + Math.cos(b) * 40, cy + Math.sin(b) * 40, 6, 0, Math.PI * 2); c.stroke(); }
      c.globalAlpha = 0.5; c.beginPath(); c.moveTo(cx - 35, cy + 44); c.quadraticCurveTo(cx, cy + 62, cx + 35, cy + 44); c.stroke();
    }
    c.restore();
  }

  // ---------- text helpers ----------
  function fit(c, text, font, maxW, startPx, minPx) {
    var px = startPx;
    while (px > minPx) { c.font = font.replace("{px}", px); if (c.measureText(text).width <= maxW) break; px -= 4; }
    c.font = font.replace("{px}", px); return px;
  }
  function wrap(c, text, maxW) {
    var words = text.split(/\s+/), lines = [], cur = "";
    words.forEach(function (w) { var t = cur ? cur + " " + w : w; if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur); return lines;
  }
  function textAt(c, text, x, y, o) {
    c.save(); c.font = o.font; c.fillStyle = o.color; c.textAlign = o.align || "left"; c.textBaseline = o.baseline || "alphabetic";
    if (o.rotate) { c.translate(x, y); c.rotate(o.rotate); x = 0; y = 0; }
    if (o.alpha != null) c.globalAlpha = o.alpha;
    if (o.shadow) { c.shadowColor = o.shadow; c.shadowBlur = o.shadowBlur || 18; }
    if (o.stroke) { c.lineWidth = o.stroke; c.strokeStyle = o.strokeColor || o.color; c.lineJoin = "round"; c.strokeText(text, x, y); }
    if (!o.strokeOnly) c.fillText(text, x, y);
    c.restore();
  }
  function paragraph(c, text, x, y, maxW, o) {
    c.font = o.font; var lines = wrap(c, text, maxW);
    lines.forEach(function (l, i) { textAt(c, l, x, y + i * o.lh, o); });
    return lines.length * o.lh;
  }
  function scatter(c, words, box, rnd, o) {
    var cols = o.cols || 4, rows = Math.ceil(words.length / (cols - 1)) + 1, cw = box.w / cols, ch = box.h / rows, cells = [];
    for (var r = 0; r < rows; r++) for (var k = 0; k < cols; k++) cells.push({ r: r, k: k });
    var chosen = [];
    for (var i = 0; i < words.length; i++) {
      var rowCells = cells.filter(function (cell) { return cell.r === Math.floor(i / (cols - 1)) % rows; });
      var cell = rowCells.length ? pick(rnd, rowCells) : pick(rnd, cells);
      cells.splice(cells.indexOf(cell), 1); chosen.push(cell);
    }
    chosen.forEach(function (cell, i) {
      var x = box.x + cell.k * cw + between(rnd, 10, cw * 0.5), y = box.y + cell.r * ch + between(rnd, ch * 0.4, ch * 0.9);
      textAt(c, words[i], x, y, { font: o.font, color: o.color, rotate: o.tilt ? between(rnd, -0.06, 0.06) : 0, shadow: o.shadow, shadowBlur: o.shadowBlur });
    });
  }
  function texts() {
    return { word: $("word").value.trim() || $("word").placeholder, line: $("line").value.trim() || $("line").placeholder,
             sentence: $("sentence").value.trim() || $("sentence").placeholder, name: $("name").value.trim() || $("name").placeholder, date: $("date").value.trim() || $("date").placeholder };
  }

  // ---------- recipes ----------
  var RECIPES = {
    bubblegum: function (c, img, t, p, rnd) {
      var split = clamp(fr(Math.round(W * between(rnd, 0.58, 0.68))), 500, 1050);
      c.fillStyle = p.bg; c.fillRect(0, 0, W, H);
      c.drawImage(process(img, split, H, { gray: 0.92, contrast: 1.08, grain: 28, seed: rnd() * 1e6 }, between(rnd, 0.3, 0.7), 0.25), 0, 0);
      fit(c, t.word, 'italic 400 {px}px ' + SCRIPT, H * 0.5, 260, 120);
      textAt(c, t.word, split - between(rnd, 40, 110), H * between(rnd, 0.3, 0.42), { font: c.font, color: p.accent2, rotate: -Math.PI / 2, align: "center" });
      var reps = 5 + Math.floor(rnd() * 5);
      for (var i = 0; i < reps; i++) {
        var size = pick(rnd, [26, 30, 34, 40]);
        textAt(c, t.line, split + between(rnd, 60, Math.max(80, W - split - 40)), between(rnd, H * 0.08, H * 0.75), { font: 'italic 400 ' + size + 'px ' + SANS, color: p.ink, rotate: -Math.PI / 2, alpha: between(rnd, 0.55, 1) });
      }
      fit(c, t.word, 'italic 400 {px}px ' + SCRIPT, W * 1.05, 520, 240);
      var by = H * between(rnd, 0.9, 0.97);
      textAt(c, t.word, W * 0.02, by, { font: c.font, color: "rgba(0,0,0,0)", stroke: 3, strokeColor: "rgba(255,255,255,0.55)", strokeOnly: true });
      textAt(c, t.word, W * 0.02 + 3, by + 3, { font: c.font, color: p.accent, alpha: 0.35 });
      textAt(c, "edit by " + t.name, W - 40, H - 28, { font: '400 20px ' + SANS, color: p.ink, align: "right", alpha: 0.6 });
    },

    light: function (c, img, t, p, rnd) {
      var band = clamp(Math.round(H * between(rnd, 0.28, 0.36) * (2 - state.photo.frame)), 260, 760);
      c.fillStyle = "#ffffff"; c.fillRect(0, 0, W, H);
      c.drawImage(process(img, W, H - band, { contrast: 1.04, lift: 8, grain: 10, seed: rnd() * 1e6 }, 0.5, 0.3), 0, band);
      var ink = pick(rnd, ["#3a4a44", "#2c2c34", "#4a3b48"]);
      textAt(c, t.name + "  |  " + t.date + "  |  poster design", 44, 52, { font: '400 24px ' + SERIF, color: ink });
      star(c, W - 90, 80, 42, ink);
      paragraph(c, t.line, 70, band * 0.42, W * 0.3, { font: '400 32px ' + SERIF, color: ink, lh: 40 });
      var px = fit(c, t.word, '400 {px}px ' + HAND, W * 0.8, 420, 160);
      textAt(c, t.word, W * between(rnd, 0.55, 0.65), band + px * 0.28, { font: c.font, color: ink, align: "center", rotate: between(rnd, -0.08, -0.02) });
      textAt(c, "~ " + t.sentence.split(/\s+/).slice(0, 4).join(" ") + " ~", 60, H - 60, { font: '600 48px ' + HAND, color: "#ffffff" });
    },

    scattered: function (c, img, t, p, rnd) {
      var cut = clamp(fr(Math.round(H * between(rnd, 0.5, 0.58))), 600, 1100);
      c.fillStyle = p.paper; c.fillRect(0, 0, W, H);
      c.drawImage(process(img, W, cut, { gray: 0.25, contrast: 0.92, lift: 26, grain: 14, seed: rnd() * 1e6 }, 0.5, 0.3), 0, 0);
      var fade = c.createLinearGradient(0, 0, 0, cut); fade.addColorStop(0, "rgba(255,255,255,0.35)"); fade.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = fade; c.fillRect(0, 0, W, cut);
      c.drawImage(process(img, W, H - cut, { grain: 10, seed: rnd() * 1e6 }, 0.5, 0.6), 0, cut);
      var ghost = cutout(process(img, W, H - cut, { gray: 1, contrast: 1.3, seed: 2 }, 0.5, 0.6), 110, p.paper);
      c.globalAlpha = 0.92; c.drawImage(ghost, 0, cut); c.globalAlpha = 1;
      scatter(c, t.sentence.split(/\s+/), { x: 40, y: 40, w: W - 80, h: cut - 80 }, rnd, { font: '400 34px ' + SANS, color: p.ink, cols: 5 });
      textAt(c, pick(rnd, ["<3", "♡", "*"]), W * between(rnd, 0.4, 0.6), cut * between(rnd, 0.2, 0.5), { font: '400 40px ' + SANS, color: p.ink });
      textAt(c, t.line, W - 50, cut + 50, { font: '700 30px ' + SANS, color: p.ink, align: "right" });
    },

    crossword: function (c, img, t, p, rnd) {
      c.fillStyle = p.bg2; c.fillRect(0, 0, W, H);
      var m = clamp(Math.round(110 * (2 - state.photo.frame)), 40, 240), pw = W - 2 * m, ph = H - 2 * m + 20;
      c.drawImage(halftone(process(img, pw, ph, { gray: 1, contrast: 1.15, seed: rnd() * 1e6 }, 0.5, 0.3), 6, "#1a1718", "#f2f0ee"), m, m);
      var cell = pick(rnd, [52, 56, 60]);
      c.strokeStyle = "rgba(20,15,18,0.75)"; c.lineWidth = 1.2;
      for (var x = m; x <= m + pw; x += cell) { c.beginPath(); c.moveTo(x, m); c.lineTo(x, m + ph); c.stroke(); }
      for (var y = m; y <= m + ph; y += cell) { c.beginPath(); c.moveTo(m, y); c.lineTo(m + pw, y); c.stroke(); }
      var words = t.line.toUpperCase().split(/\s+/), cols = Math.floor(pw / cell), rows = Math.floor(ph / cell), used = [];
      words.forEach(function (w) {
        var r, tries = 0; do { r = 1 + Math.floor(rnd() * (rows - 2)); tries++; } while (used.indexOf(r) !== -1 && tries < 20);
        used.push(r); if (w.length > cols - 2) w = w.slice(0, cols - 2);
        var k = 1 + Math.floor(rnd() * Math.max(1, cols - w.length - 1));
        for (var j = 0; j < w.length; j++) {
          var cx = m + (k + j) * cell, cy = m + r * cell;
          c.fillStyle = p.accent2; c.fillRect(cx + 1, cy + 1, cell - 2, cell - 2);
          textAt(c, w[j], cx + cell / 2, cy + cell * 0.72, { font: '700 ' + Math.round(cell * 0.6) + 'px ' + SANS, color: p.ink, align: "center" });
        }
      });
      textAt(c, t.word, Math.max(58, m * 0.5), H * 0.5, { font: '400 220px ' + SCRIPT, color: p.ink, rotate: Math.PI / 2, align: "center" });
    },

    grain: function (c, img, t, p, rnd) {
      c.drawImage(process(img, W, H, { gray: 1, contrast: 1.25, grain: 90, tint: p.accent, tintAmt: 0.12, seed: rnd() * 1e6 }, 0.5, 0.25), 0, 0);
      c.strokeStyle = p.accent; c.lineWidth = 1.2; c.globalAlpha = 0.8;
      var gx = pick(rnd, [4, 5, 6]), gy = gx + 2;
      for (var i = 1; i < gx; i++) { c.beginPath(); c.moveTo(W * i / gx, 0); c.lineTo(W * i / gx, H); c.stroke(); }
      for (var j = 1; j < gy; j++) { c.beginPath(); c.moveTo(0, H * j / gy); c.lineTo(W, H * j / gy); c.stroke(); }
      c.globalAlpha = 1;
      c.font = '900 170px ' + SANS; var lines = wrap(c, t.line.toUpperCase(), W * 0.84);
      var size = Math.min(170, Math.floor((H * 0.4) / lines.length)), y0 = H * between(rnd, 0.3, 0.38);
      lines.forEach(function (l, i) { textAt(c, l, W * 0.09, y0 + i * size * 0.98, { font: '900 ' + size + 'px ' + SANS, color: p.accent }); });
      star(c, W * 0.5, y0 + lines.length * size * 0.98 + 40, 18, p.accent);
      fit(c, t.word, 'italic 400 {px}px ' + SCRIPT, W * 0.92, 420, 200);
      textAt(c, t.word, W * 0.5, H * 0.95, { font: c.font, color: p.accent, align: "center" });
      textAt(c, t.name, 36, H - 44, { font: 'italic 400 24px ' + SERIF, color: p.accent });
      textAt(c, t.date, W - 36, H - 44, { font: 'italic 400 24px ' + SERIF, color: p.accent, align: "right" });
    },

    zine: function (c, img, t, p, rnd) {
      c.fillStyle = "#f6f1ea"; c.fillRect(0, 0, W, H);
      if (state.flowers) { c.globalAlpha = 0.9; c.drawImage(state.flowers, -60, between(rnd, -300, 0), 520, 1733); c.globalAlpha = 1; }
      var pw = clamp(fr(Math.round(W * between(rnd, 0.6, 0.68))), 420, 1100), ph = Math.round(pw * between(rnd, 1.25, 1.4));
      var x = Math.round(W * between(rnd, 0.26, 0.32)), y = Math.round(H * between(rnd, 0.1, 0.14)), rot = between(rnd, -0.03, 0.03);
      var photo = process(img, pw, ph, { gray: 1, contrast: 1.1, grain: 24, seed: rnd() * 1e6 }, 0.5, 0.3);
      c.save(); c.translate(x + pw / 2, y + ph / 2); c.rotate(rot); c.translate(-pw / 2, -ph / 2);
      c.shadowColor = "rgba(40,20,30,0.25)"; c.shadowBlur = 30; c.shadowOffsetY = 14; c.fillStyle = "#fff"; c.fillRect(0, 0, pw, ph); c.shadowColor = "transparent";
      tornClip(c, 0, 0, pw, ph, rnd, 9); c.drawImage(photo, 0, 0); c.restore();
      tape(c, x + pw * between(rnd, 0.3, 0.7), y + 2, 120, between(rnd, -0.1, 0.1), "rgba(246,206,224,0.85)");
      paperclip(c, x + pw * 0.1, y - 30, 1.6, p.accent);
      textAt(c, t.line, W - 40, y - 24, { font: '400 26px ' + SANS, color: p.accent, align: "right" });
      textAt(c, t.word, W - 40, y - 56, { font: 'italic 400 56px ' + SCRIPT, color: p.accent, align: "right" });
      var bits = t.sentence.split(/\s+/), chunk = Math.ceil(bits.length / 3), yy = Math.min(y + ph + 80, H - 120);
      for (var i = 0; i < bits.length; i += chunk) textAt(c, bits.slice(i, i + chunk).join(" "), W - 50, yy + (i / chunk) * 34, { font: '400 26px ' + SANS, color: p.accent, align: "right" });
      textAt(c, t.name + " · " + t.date, 40, H - 40, { font: '400 20px ' + TYPE, color: p.ink, alpha: 0.6 });
    },

    // ---- the birds: coarse two-colour dither, ornate script dead centre, small caption at the foot
    birds: function (c, img, t, p, rnd) {
      var duo = pick(rnd, [["#2d3a5c", "#dfe6f2"], ["#1f2740", "#e8ecf3"], [p.duo[0], p.duo[1]]]);
      var src = process(img, W, H, { gray: 1, contrast: 1.35, lift: 10, seed: rnd() * 1e6 }, 0.5, 0.4);
      c.drawImage(dither(src, pick(rnd, [3, 4, 5]), duo[0], duo[1]), 0, 0);
      var px = fit(c, t.word, '400 {px}px ' + SCRIPT, W * 0.9, 440, 180);
      textAt(c, t.word, W * 0.5, H * between(rnd, 0.5, 0.58), { font: c.font, color: "#ffffff", align: "center", shadow: "rgba(0,0,0,0.35)", shadowBlur: 24, stroke: 1.5, strokeColor: "rgba(255,255,255,0.9)" });
      c.font = '400 26px ' + SANS; var lines = wrap(c, t.sentence, W * 0.62);
      lines.forEach(function (l, i) { textAt(c, l, W * 0.5, H * 0.9 + i * 32, { font: '400 26px ' + SANS, color: "#ffffff", align: "center", alpha: 0.9 }); });
      textAt(c, t.name, W - 36, H - 34, { font: '400 18px ' + SANS, color: "#ffffff", align: "right", alpha: 0.6 });
    },

    // ---- army of me: cream folded sheet, handwritten lyrics, an outlined script word, a framed photo below
    army: function (c, img, t, p, rnd) {
      c.fillStyle = "#f3eee2"; c.fillRect(0, 0, W, H);
      paperGrain(c, W, H, rnd, 0.07);
      c.strokeStyle = "rgba(0,0,0,0.07)"; c.lineWidth = 2; c.beginPath(); c.moveTo(0, H * 0.33); c.lineTo(W, H * 0.33); c.stroke(); c.beginPath(); c.moveTo(0, H * 0.66); c.lineTo(W, H * 0.66); c.stroke();
      var ink = pick(rnd, ["#5b4a8a", "#6e5aa6", "#4e4b7a"]);
      var top = clamp(fr(Math.round(H * between(rnd, 0.44, 0.5))), 480, 900);
      var px = fit(c, t.word, 'italic 400 {px}px ' + SCRIPT, W * 0.8, 440, 220);
      textAt(c, t.word, W * between(rnd, 0.45, 0.6), top * between(rnd, 0.5, 0.62), { font: c.font, color: "rgba(0,0,0,0)", stroke: 2.2, strokeColor: ink, strokeOnly: true, align: "center", rotate: between(rnd, -0.08, 0.02) });
      var words = t.sentence.split(/\s+/), half = Math.ceil(words.length / 2);
      var l1 = wrap(c, words.slice(0, half).join(" "), W * 0.34), l2 = wrap(c, words.slice(half).join(" "), W * 0.4);
      c.font = '600 38px ' + HAND;
      l1.forEach(function (l, i) { textAt(c, l, 70, 110 + i * 44, { font: '600 38px ' + HAND, color: "#2b2535" }); });
      l2.forEach(function (l, i) { textAt(c, l, W * 0.56, top * 0.72 + i * 44, { font: '600 38px ' + HAND, color: "#2b2535" }); });
      var y = top + 20, ph = H - y - 30, x = 30, pw = W - 60;
      c.drawImage(process(img, pw, ph, { gray: 1, contrast: 1.2, grain: 40, tint: ink, tintAmt: 0.25, seed: rnd() * 1e6 }, 0.5, 0.3), x, y);
      flourishFrame(c, x, y, pw, ph, "rgba(255,255,255,0.85)");
      textAt(c, t.line, W * 0.5, H - 46, { font: '400 20px ' + TYPE, color: "#ffffff", align: "center", alpha: 0.8 });
    },

    // ---- girlhood: pale invitation, a washed photo, a rough stamped word, a spiral emboss
    girlhood: function (c, img, t, p, rnd) {
      c.fillStyle = "#f4f3f1"; c.fillRect(0, 0, W, H);
      smudges(c, W, H, rnd, ["#c9d2e2", "#dcd4e6", "#e8e0d8", "#b9c6dc"], 26);
      paperGrain(c, W, H, rnd, 0.06);
      var rose = pick(rnd, ["#c77ba8", "#d58ab6", "#b86f9c"]), ink = "#2f3a5a";
      textAt(c, "*", W - 330, 150, { font: '700 110px ' + SANS, color: rose, alpha: 0.9 });
      fit(c, t.word, '700 {px}px ' + SANS, W * 0.45, 150, 70);
      textAt(c, t.word, W - 40, 170, { font: c.font, color: rose, align: "right" });
      textAt(c, "inviting you to", 70, 300, { font: '400 36px ' + SERIF, color: ink });
      paragraph(c, t.line, 130, 356, W * 0.7, { font: '400 44px ' + SERIF, color: ink, lh: 50 });
      var fw = clamp(fr(Math.round(W * 0.74)), 500, 1120), fh = Math.round(fw * between(rnd, 0.95, 1.1)), fx = 40, fy = 430;
      c.drawImage(process(img, fw, fh, { gray: 0.85, contrast: 0.7, lift: 70, grain: 12, seed: rnd() * 1e6 }, 0.5, 0.3), fx, fy);
      c.globalAlpha = 0.25; c.fillStyle = "#dfe5f0"; c.fillRect(fx, fy, fw, fh); c.globalAlpha = 1;
      // stamped word, rough double stroke in a box
      var sw = t.sentence.split(/\s+/).slice(0, 2).join(" ").toUpperCase(), sx = fx + 10, sy = fy + fh - 60;
      c.save(); c.translate(sx, sy); c.rotate(between(rnd, -0.03, 0.02));
      var spx = fit(c, sw, '400 {px}px ' + SANS, fw * 0.8, 120, 50), tw = c.measureText(sw).width;
      c.globalAlpha = 0.85; c.strokeStyle = rose; c.lineWidth = 5; c.strokeRect(-14, -spx * 0.95, tw + 28, spx * 1.25);
      c.lineWidth = 2; c.strokeRect(-9, -spx * 0.9, tw + 18, spx * 1.15);
      textAt(c, sw, 0, 0, { font: c.font, color: rose, alpha: 0.8 }); c.restore();
      var by = fy + fh + 60;
      textAt(c, t.date, 70, Math.min(by + 40, H - 160), { font: '400 22px ' + SERIF, color: ink });
      textAt(c, t.name, 70, Math.min(by + 90, H - 110), { font: '400 46px ' + SERIF, color: ink });
      spiral(c, W - 160, H - 150, 90, "rgba(60,60,80,0.18)");
      textAt(c, "@   " + t.name, 60, H - 50, { font: '400 30px ' + SERIF, color: ink });
      textAt(c, "see you soon ♡~", W - 60, H - 50, { font: '400 30px ' + SERIF, color: ink, align: "right" });
    },

    // ---- pillow: one tinted blown-up copy behind, a sharp halftone square in front, scattered words
    pillow: function (c, img, t, p, rnd) {
      var tone = pick(rnd, [["#6f7a5e", "#e9ecdf"], ["#5e6b45", "#eef0e4"], [p.duo[0], p.duo[1]]]);
      var back = process(img, W, H, { gray: 1, contrast: 0.9, lift: 20, grain: 50, duo: tone, seed: rnd() * 1e6 }, between(rnd, 0.3, 0.7), 0.3);
      c.drawImage(back, 0, 0);
      c.globalAlpha = 0.5; c.drawImage(back, W * -0.12, H * 0.08, W * 1.25, H * 1.25); c.globalAlpha = 1;
      c.fillStyle = tone[1]; c.globalAlpha = 0.35; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
      var sw = clamp(fr(Math.round(W * 0.62)), 360, 1000), sh = Math.round(sw * between(rnd, 1.0, 1.25)), sx = W - sw - 40, sy = H - sh - 40;
      var tile = halftone(process(img, sw, sh, { gray: 1, contrast: 1.2, seed: 3 }, 0.5, 0.3), 5, tone[0], tone[1]);
      c.drawImage(tile, sx, sy);
      scatter(c, t.sentence.split(/\s+/), { x: 60, y: 90, w: W * 0.72, h: sy - 60 }, rnd, { font: '600 36px ' + SANS, color: tone[0], cols: 4, shadow: "rgba(255,255,255,0.6)", shadowBlur: 8 });
      textAt(c, "@" + t.name, W - 40, H - 48, { font: '400 24px ' + SANS, color: tone[1], align: "right", shadow: "rgba(0,0,0,0.4)", shadowBlur: 6 });
    },

    // ---- silk: a magazine spread, lace band across the top, a pink column of tiny text, script title over the photo
    silk: function (c, img, t, p, rnd) {
      var col = clamp(Math.round(W * between(rnd, 0.3, 0.36) * (2 - state.photo.frame)), 260, 560), pink = pick(rnd, ["#f3c9d8", "#f6d3e0", p.accent2]);
      c.drawImage(process(img, W - col, H, { gray: 1, contrast: 1.1, grain: 22, tint: "#f0b8cc", tintAmt: 0.2, seed: rnd() * 1e6 }, 0.5, 0.4), 0, 0);
      c.fillStyle = pink; c.fillRect(W - col, 0, col, H);
      lace(c, 0, 150, W - col, "rgba(255,255,255,0.9)", rnd);
      textAt(c, t.name.toUpperCase() + "   " + t.date + "   SERIES", W - 24, 40, { font: '400 16px ' + SANS, color: "#5a3b4a", align: "right" });
      var px = fit(c, t.word, 'italic 400 {px}px ' + SCRIPT, (W - col) * 0.95, 300, 140);
      textAt(c, t.word, 30, H * between(rnd, 0.56, 0.64), { font: c.font, color: pink, stroke: 1.5, strokeColor: "#ffffff" });
      textAt(c, t.line, 40, H - 150, { font: '400 54px ' + SERIF, color: "#ffffff", shadow: "rgba(0,0,0,0.4)", shadowBlur: 14 });
      paragraph(c, t.sentence, 40, H - 96, (W - col) * 0.85, { font: 'italic 400 26px ' + SERIF, color: "#ffffff", lh: 32, alpha: 0.9 });
      // the column
      var cx = W - col + 28, cw = col - 56;
      textAt(c, t.word, W - col + col / 2, 130, { font: 'italic 400 72px ' + SCRIPT, color: "#7a4a60", align: "center" });
      c.strokeStyle = "rgba(90,59,74,0.5)"; c.lineWidth = 1; c.beginPath(); c.moveTo(cx, 160); c.lineTo(cx + cw, 160); c.stroke();
      var body = (t.sentence + ". " + t.line + ". ").repeat(6);
      var used = paragraph(c, body, cx, 200, cw, { font: '400 14px ' + SERIF, color: "#4a3140", lh: 19 });
      var y2 = 200 + Math.min(used, H * 0.42);
      c.fillStyle = "rgba(255,255,255,0.5)"; c.fillRect(cx, y2 + 10, cw, 10);
      textAt(c, "track list", W - col + col / 2, y2 + 70, { font: '400 24px ' + SILK_CAPS(), color: "#7a4a60", align: "center" });
      var items = t.sentence.split(/\s+/); var n = Math.min(4, items.length);
      for (var i = 0; i < n; i++) textAt(c, "0" + (i + 1) + "   " + items.slice(i * 2, i * 2 + 2).join(" "), cx + 10, y2 + 112 + i * 30, { font: '400 20px ' + SERIF, color: "#4a3140" });
      c.strokeStyle = "rgba(90,59,74,0.5)"; c.beginPath(); c.moveTo(cx, H - 60); c.lineTo(cx + cw, H - 60); c.stroke();
      textAt(c, t.name + " · " + t.date, W - col + col / 2, H - 34, { font: '400 12px ' + SANS, color: "#5a3b4a", align: "center" });
    }
  };
  function SILK_CAPS() { return SERIF; }

  // ---------- render ----------
  var pending = false;
  function render() {
    if (!state.img) { ctx.fillStyle = "#faf8f5"; ctx.fillRect(0, 0, W, H); return; }
    var rnd = mulberry(state.seed);
    var recipe = state.recipe === "random" ? pick(rnd, Object.keys(RECIPES)) : state.recipe;
    var palName = state.palette === "random" ? pick(rnd, Object.keys(PALETTES)) : state.palette;
    state.resolved = { recipe: recipe, palette: palName };
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    RECIPES[recipe](ctx, state.img, texts(), PALETTES[palName], rnd);
    status.textContent = recipe + " · " + palName + " · #" + state.seed;
  }
  function renderSoon() { if (pending) return; pending = true; requestAnimationFrame(function () { pending = false; render(); }); }

  // ---------- inputs ----------
  function loadFile(file) {
    if (!file || !file.type.match(/^image\//)) { status.textContent = "that is not an image file."; return; }
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () { state.img = img; URL.revokeObjectURL(url); fontsReady().then(render); };
    img.onerror = function () { status.textContent = "could not read that image."; };
    img.src = url;
  }
  $("photo").addEventListener("change", function () { loadFile(this.files[0]); });
  var drop = $("drop");
  ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
  ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); }); });
  drop.addEventListener("drop", function (e) { loadFile(e.dataTransfer.files[0]); });

  $("shuffle").addEventListener("click", function () { state.seed = Math.floor(Math.random() * 1e6); render(); });
  ["recipe", "palette"].forEach(function (id) { $(id).addEventListener("change", function () { state[id] = this.value; render(); }); });
  ["word", "line", "sentence", "name", "date"].forEach(function (id) { $(id).addEventListener("input", renderSoon); });

  // photo controls: sliders, drag, wheel
  var sliders = { zoom: "zoom", panx: "px", pany: "py", frame: "frame" };
  Object.keys(sliders).forEach(function (id) { $(id).addEventListener("input", function () { state.photo[sliders[id]] = parseFloat(this.value); renderSoon(); }); });
  function syncSliders() { $("zoom").value = state.photo.zoom; $("panx").value = state.photo.px; $("pany").value = state.photo.py; $("frame").value = state.photo.frame; }
  $("reset").addEventListener("click", function () { state.photo = { zoom: 1, px: 0, py: 0, frame: 1 }; syncSliders(); render(); });
  var drag = null;
  canvas.addEventListener("pointerdown", function (e) { if (!state.img) return; drag = { x: e.clientX, y: e.clientY, px: state.photo.px, py: state.photo.py }; canvas.setPointerCapture(e.pointerId); canvas.classList.add("dragging"); });
  canvas.addEventListener("pointermove", function (e) {
    if (!drag) return; var r = canvas.getBoundingClientRect();
    state.photo.px = clamp(drag.px + (e.clientX - drag.x) / r.width * 2.2, -1, 1);
    state.photo.py = clamp(drag.py + (e.clientY - drag.y) / r.height * 2.2, -1, 1);
    syncSliders(); renderSoon();
  });
  ["pointerup", "pointercancel"].forEach(function (ev) { canvas.addEventListener(ev, function () { drag = null; canvas.classList.remove("dragging"); }); });
  canvas.addEventListener("wheel", function (e) { if (!state.img) return; e.preventDefault(); state.photo.zoom = clamp(state.photo.zoom * (e.deltaY < 0 ? 1.05 : 0.95), 0.6, 2.4); syncSliders(); renderSoon(); }, { passive: false });

  $("download").addEventListener("click", function () {
    if (!state.img) { status.textContent = "add a photo first."; return; }
    canvas.toBlob(function (blob) {
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = "poster-" + state.resolved.recipe + "-" + state.seed + ".png"; a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    }, "image/png");
  });

  var fl = new Image(); fl.onload = function () { state.flowers = fl; }; fl.src = "../img/pixel-flowers.svg";
  var demo = new URLSearchParams(location.search).get("photo");
  if (demo && /^\.\.\/[\w\/.-]+$/.test(demo)) { var di = new Image(); di.onload = function () { state.img = di; fontsReady().then(render); }; di.src = demo; }
  render();
})();
