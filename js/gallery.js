// Collage gallery + zoom-in reader. Client-side only.
// Reads window.ARTICLES (articles/manifest.js). The only network activity is
// fetching the article's own HTML from this origin when a card is opened.
(function () {
  "use strict";

  var articles = (window.ARTICLES || []).slice();
  var galleries = document.querySelectorAll("[data-gallery]");
  if (!galleries.length) return;

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function humanDate(iso) {
    var d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return iso;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }

  function articleUrl(base, a) { return base + a.slug + "/"; }

  // Deterministic pseudo-random per article so the board looks scattered but never jumps around.
  function seeded(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () { h += 0x6D2B79F5; var t = Math.imul(h ^ (h >>> 15), 1 | h); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function buildTile(base, a, i) {
    var rnd = seeded(a.slug + i);
    var li = el("li", "tile");
    li.dataset.slug = a.slug;
    li.dataset.tags = (a.tags || []).join(" ");
    var c = 3 + Math.floor(rnd() * 3);           // 3..5 columns of 12
    var r = c + Math.floor(rnd() * 3);           // roughly portrait
    li.style.setProperty("--c", c);
    li.style.setProperty("--r", Math.max(3, r));
    li.style.setProperty("--tilt", ((rnd() - 0.5) * 6).toFixed(1) + "deg");
    li.style.setProperty("--dx", ((rnd() - 0.5) * 14).toFixed(0) + "%");
    li.style.setProperty("--dy", ((rnd() - 0.5) * 14).toFixed(0) + "%");

    var link = el("a", "tile-link");
    link.href = articleUrl(base, a);
    link.setAttribute("aria-label", a.title);

    var fig = el("figure", "tile-img");
    if (a.cover) {
      var img = el("img");
      img.src = articleUrl(base, a) + a.cover;
      img.alt = "";
      img.decoding = "async";
      fig.appendChild(img);
    } else {
      fig.classList.add("no-cover");
      fig.appendChild(el("span", "tile-img-title display", a.title));
    }
    var peek = el("span", "tile-peek");
    peek.appendChild(el("span", "tile-peek-title display", a.title));
    var when = el("span", "meta", humanDate(a.date) + ((a.tags || []).length ? " · " + a.tags.join(", ") : "") + ((a.videos || []).length ? " · ▶ video" : ""));
    peek.appendChild(when);
    fig.appendChild(peek);
    link.appendChild(fig);

    li.appendChild(link);

    link.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      open(base, a, li, true, true);
    });
    return li;
  }

  // ---------- reader overlay (zoom in from the card) ----------
  var reader, panel, body, closeBtn, isOpen = false, lastCard = null, lastBase = "";

  function buildReader() {
    if (reader) return;
    reader = el("div", "reader");
    reader.setAttribute("role", "dialog");
    reader.setAttribute("aria-modal", "true");
    reader.setAttribute("aria-label", "Article");
    reader.hidden = true;
    panel = el("div", "reader-panel");
    closeBtn = el("button", "reader-close", "Close");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close article");
    body = el("div", "reader-body");
    panel.appendChild(closeBtn);
    panel.appendChild(body);
    reader.appendChild(panel);
    document.body.appendChild(reader);

    closeBtn.addEventListener("click", function () { requestClose(); });
    reader.addEventListener("click", function (e) { if (e.target === reader) requestClose(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && isOpen) requestClose(); });
  }

  function resolveUrls(root, baseUrl) {
    ["src", "href"].forEach(function (attr) {
      root.querySelectorAll("[" + attr + "]").forEach(function (n) {
        var v = n.getAttribute(attr);
        if (!v || /^(#|[a-z]+:|\/\/)/i.test(v)) return;
        n.setAttribute(attr, new URL(v, baseUrl).href);
      });
    });
  }

  function load(base, a) {
    body.innerHTML = "";
    var url = new URL(articleUrl(base, a), location.href).href;
    var loading = el("p", "meta reader-loading", "opening… ");
    var direct = el("a", null, "or open the page directly");
    direct.href = url;
    loading.appendChild(direct);
    body.appendChild(loading);
    // If the page has not arrived within a few seconds, just go there.
    var timer = setTimeout(function () { location.href = url; }, 6000);
    return fetch(url, { credentials: "same-origin", cache: "no-cache" })
      .then(function (r) { clearTimeout(timer); if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var post = doc.querySelector("article.post");
        if (!post) throw new Error("no article");
        resolveUrls(post, url);
        body.innerHTML = "";
        body.appendChild(document.importNode(post, true));
        var perma = el("a", "reader-permalink", "Open as its own page →");
        perma.href = url;
        body.appendChild(perma);
        body.scrollTop = 0;
        closeBtn.focus();
      })
      .catch(function () { clearTimeout(timer); location.href = url; });
  }

  function flipFrom(card) {
    if (!card || reduceMotion) return;
    var r = card.getBoundingClientRect();
    var p = panel.getBoundingClientRect();
    panel.style.transition = "none";
    panel.style.transformOrigin = "top left";
    panel.style.transform = "translate(" + (r.left - p.left) + "px," + (r.top - p.top) + "px) scale(" + (r.width / p.width) + "," + (r.height / p.height) + ")";
    panel.style.opacity = "0.4";
    panel.getBoundingClientRect(); // flush
    requestAnimationFrame(function () {
      panel.style.transition = "";
      panel.style.transform = "";
      panel.style.opacity = "";
    });
  }

  function open(base, a, card, animate, push) {
    buildReader();
    lastCard = card; lastBase = base;
    reader.hidden = false;
    document.body.classList.add("reader-open");
    isOpen = true;
    if (push) history.pushState({ slug: a.slug }, "", "#/" + a.slug);
    load(base, a);
    if (animate) flipFrom(card);
  }

  function closeNow() {
    if (!isOpen) return;
    isOpen = false;
    var done = function () {
      reader.hidden = true;
      body.innerHTML = "";
      document.body.classList.remove("reader-open");
      panel.style.transition = ""; panel.style.transform = ""; panel.style.opacity = "";
      if (lastCard) lastCard.querySelector("a").focus({ preventScroll: true });
    };
    if (lastCard && !reduceMotion) {
      var r = lastCard.getBoundingClientRect();
      var p = panel.getBoundingClientRect();
      panel.style.transformOrigin = "top left";
      panel.style.transform = "translate(" + (r.left - p.left) + "px," + (r.top - p.top) + "px) scale(" + (r.width / p.width) + "," + (r.height / p.height) + ")";
      panel.style.opacity = "0";
      setTimeout(done, 320);
    } else {
      done();
    }
  }

  function requestClose() {
    if (history.state && history.state.slug) history.back();
    else { history.replaceState(null, "", location.pathname + location.search); closeNow(); }
  }

  window.addEventListener("popstate", function () {
    var slug = (location.hash.match(/^#\/(.+)$/) || [])[1];
    if (!slug && isOpen) closeNow();
    else if (slug && !isOpen) openBySlug(slug, false);
  });

  function openBySlug(slug, push) {
    var a = articles.filter(function (x) { return x.slug === slug; })[0];
    if (!a) return;
    var card = document.querySelector('.tile[data-slug="' + slug + '"]');
    open(galleries[0].dataset.base || "articles/", a, card, false, push);
  }

  // ---------- render ----------
  var params = new URLSearchParams(location.search);
  var activeTag = params.get("tag") || "";

  galleries.forEach(function (ul) {
    var base = ul.dataset.base || "articles/";
    var limit = parseInt(ul.dataset.limit || "0", 10);
    var kind = ul.dataset.kind || "";
    var list = articles.filter(function (a) { return !kind || (a.kind || "article") === kind; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    if (limit) list = list.slice(0, limit);
    var emptyNote = ul.parentNode.querySelector("[data-empty]");
    if (emptyNote && !document.querySelector("[data-tag-filter]")) emptyNote.hidden = list.length > 0;
    list.forEach(function (a, i) { ul.appendChild(buildTile(base, a, i)); });
  });

  // ---------- tag filter ----------
  var filterHost = document.querySelector("[data-tag-filter]");
  var emptyMsg = document.querySelector("[data-empty]");
  if (filterHost) {
    var pageKind = (galleries[0].dataset.kind || "");
    var tags = {};
    articles.filter(function (a) { return !pageKind || (a.kind || "article") === pageKind; })
      .forEach(function (a) { (a.tags || []).forEach(function (t) { tags[t] = (tags[t] || 0) + 1; }); });
    var names = Object.keys(tags).sort();
    function applyFilter(tag) {
      activeTag = tag;
      var shown = 0;
      document.querySelectorAll(".tile").forEach(function (c) {
        var ok = !tag || (" " + c.dataset.tags + " ").indexOf(" " + tag + " ") !== -1;
        c.hidden = !ok; if (ok) shown++;
      });
      filterHost.querySelectorAll("button").forEach(function (b) {
        b.setAttribute("aria-pressed", String((b.dataset.tag || "") === tag));
      });
      if (emptyMsg) emptyMsg.hidden = shown > 0;
      var u = new URL(location.href);
      if (tag) u.searchParams.set("tag", tag); else u.searchParams.delete("tag");
      history.replaceState(history.state, "", u.pathname + u.search + u.hash);
    }
    var all = el("button", "pill", "All"); all.type = "button"; all.dataset.tag = "";
    all.addEventListener("click", function () { applyFilter(""); });
    filterHost.appendChild(all);
    names.forEach(function (t) {
      var b = el("button", "pill", t + " · " + tags[t]); b.type = "button"; b.dataset.tag = t;
      b.addEventListener("click", function () { applyFilter(t); });
      filterHost.appendChild(b);
    });
    applyFilter(activeTag);
  }

  // Deep link: #/slug opens the reader straight away.
  var initial = (location.hash.match(/^#\/(.+)$/) || [])[1];
  if (initial) {
    history.replaceState({ slug: initial }, "", location.href);
    openBySlug(initial, false);
  }
})();
