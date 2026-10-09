/* Renders every page from the files in /content (edited through /admin). */
(function () {
  var page = document.body.getAttribute('data-page');

  // ---------- helpers ----------
  function el(tag, attrs) {
    var n = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'text') n.textContent = v;
      else if (k === 'class') n.className = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (var i = 2; i < arguments.length; i++) if (arguments[i]) n.append(arguments[i]);
    return n;
  }
  function paragraphs(text, cls) {
    var frag = document.createDocumentFragment();
    String(text || '').split(/\n\s*\n/).forEach(function (t) {
      t = t.trim(); if (t) frag.append(el('p', { class: cls, text: t }));
    });
    return frag;
  }
  function load(name) {
    return fetch('/content/' + name + '.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; });
  }
  function $(sel) { return document.querySelector(sel); }
  function imgSrc(p) { return p ? encodeURI(p) : ''; }

  // nav highlight + year
  var path = location.pathname.replace(/\/index(\.html)?$/, '/').replace(/\.html$/, '');
  document.querySelectorAll('.nav a').forEach(function (a) {
    if (a.getAttribute('href').replace(/\.html$/, '') === path) a.setAttribute('aria-current', 'page');
  });
  var yr = $('#year'); if (yr) yr.textContent = new Date().getFullYear();

  // ---------- lightbox ----------
  var list = [], idx = 0, lastFocus = null;
  var lbImg = el('img', { alt: '' });
  var lbCap = el('p', { class: 'lb-cap' });
  var lbCount = el('span', { class: 'lb-count' });
  var lbClose = el('button', { class: 'lb-btn', type: 'button', 'aria-label': 'Close', text: '×', onclick: close });
  var stage = el('div', { class: 'lb-stage' }, lbImg,
    el('button', { class: 'lb-btn lb-prev', type: 'button', 'aria-label': 'Previous photo', text: '‹', onclick: function (e) { e.stopPropagation(); step(-1); } }),
    el('button', { class: 'lb-btn lb-next', type: 'button', 'aria-label': 'Next photo', text: '›', onclick: function (e) { e.stopPropagation(); step(1); } }));
  var lb = el('div', { class: 'lb', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Photo viewer', hidden: '' },
    el('div', { class: 'lb-top' }, lbCount, lbClose), stage, lbCap);
  document.body.append(lb);
  stage.addEventListener('click', function (e) { if (e.target === stage) close(); });
  function show() {
    var p = list[idx]; if (!p) return;
    lbImg.src = imgSrc(p.image); lbImg.alt = p.caption || 'Photo';
    lbCap.textContent = p.caption || '';
    lbCount.textContent = (idx + 1) + ' of ' + list.length;
  }
  function open(items, i) { list = items; idx = i; lastFocus = document.activeElement; show(); lb.hidden = false; document.body.style.overflow = 'hidden'; lbClose.focus(); }
  function close() { lb.hidden = true; document.body.style.overflow = ''; if (lastFocus) lastFocus.focus(); }
  function step(d) { idx = (idx + d + list.length) % list.length; show(); }
  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1);
  });
  var tx = null, ty = null;
  stage.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener('touchend', function (e) {
    if (tx === null) return;
    var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty; tx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1); else if (dy > 90) close();
  });

  // ---------- gallery ----------
  function gallery(items) {
    var g = el('div', { class: 'gallery' });
    items.forEach(function (p, i) {
      var fig = el('figure', { class: 'tile' });
      var img = el('img', { src: imgSrc(p.image), alt: p.caption || 'Photo ' + (i + 1), loading: 'lazy', decoding: 'async' });
      img.addEventListener('load', function () { if (img.naturalHeight) fig.style.setProperty('--ar', (img.naturalWidth / img.naturalHeight).toFixed(4)); });
      fig.append(el('button', { type: 'button', 'aria-label': 'Open ' + (p.caption || 'photo ' + (i + 1)), onclick: function () { open(items, i); } }, img));
      g.append(fig);
    });
    return g;
  }
  function empty(msg) { return el('p', { class: 'empty', text: msg }); }
  // Each entry can hold one photo ("image") or a batch ("images"); flatten to single photos.
  function flat(entries) {
    var out = [];
    (entries || []).forEach(function (e) {
      if (!e) return;
      var imgs = [].concat(e.images || [], e.image || []);
      // "captions" holds one caption per line, in the same order as the photos.
      var caps = String(e.captions || '').split('\n');
      imgs.forEach(function (src, i) {
        var c = (caps[i] || '').trim();
        if (src) out.push({ image: src, caption: c || e.caption || '', category: e.category || '' });
      });
    });
    return out;
  }
  function cap(s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); }

  // ---------- shared site info ----------
  load('site').then(function (site) {
    if (site.name) {
      document.querySelectorAll('[data-site-name]').forEach(function (n) { n.textContent = site.name; });
    }
    var social = $('#social');
    if (social) {
      if (site.email) social.append(el('a', { href: 'mailto:' + site.email, text: 'Email' }));
      if (site.instagram) social.append(el('a', { href: 'https://instagram.com/' + String(site.instagram).replace(/^@/, ''), text: 'Instagram', rel: 'noopener' }));
    }
    if (page === 'home') {
      if (site.tagline) $('#tagline').textContent = site.tagline;
    }
    if (page === 'about') {
      var body = $('#about-body'); body.replaceChildren(paragraphs(site.about));
      var gear = $('#gear'), gearList = site.gear || [];
      if (gearList.length) {
        gearList.forEach(function (g) { var t = typeof g === 'string' ? g : g.item; if (t) gear.append(el('li', { text: t })); });
      } else $('#gear-block').hidden = true;
    }
  });

  // ---------- pages ----------
  if (page === 'home' || page === 'photos') {
    load('photos').then(function (data) {
      var photos = flat(data.photos);
      if (page === 'home') {
        var sec = $('#latest');
        if (!photos.length) { sec.hidden = true; return; }
        $('#latest-gallery').append(gallery(photos.slice(0, 6)));
        return;
      }
      var holder = $('#photo-gallery'), bar = $('#filters');
      if (!photos.length) { holder.append(empty('Photos are on their way. Check back soon.')); return; }
      var cats = [];
      photos.forEach(function (p) { if (p.category && cats.indexOf(p.category) < 0) cats.push(p.category); });
      function draw(c) {
        holder.replaceChildren(gallery(photos.filter(function (p) { return c === 'all' || p.category === c; })));
      }
      if (cats.length > 1) {
        ['all'].concat(cats).forEach(function (c) {
          var b = el('button', { class: 'chip', type: 'button', 'aria-pressed': c === 'all' ? 'true' : 'false', text: c === 'all' ? 'All' : cap(c) });
          b.addEventListener('click', function () {
            bar.querySelectorAll('.chip').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
            draw(c);
          });
          bar.append(b);
        });
      } else bar.hidden = true;
      draw('all');
    });
  }

  if (page === 'projects') {
    load('projects').then(function (data) {
      var holder = $('#project-list'), items = data.projects || [];
      if (!items.length) { holder.append(empty('Projects coming soon.')); return; }
      items.forEach(function (p) {
        var left = el('div', null, el('h2', { text: p.title || 'Untitled project' }));
        if (p.status) left.append(el('span', { class: 'status', text: p.status }));
        var right = el('div', { class: 'prose' });
        if (p.summary) right.append(el('p', { class: 'lede', style: 'margin:0 0 16px', text: p.summary }));
        right.append(paragraphs(p.description));
        var art = el('article', { class: 'project' }, left, right);
        var pics = flat([{ images: p.images, image: p.image, caption: p.title }]);
        if (pics.length === 1) right.append(el('figure', null, el('img', { src: imgSrc(pics[0].image), alt: p.title || '', loading: 'lazy' })));
        else if (pics.length) right.append(el('figure', null, gallery(pics)));
        holder.append(art);
      });
    });
  }

  if (page === 'trips') {
    load('trips').then(function (data) {
      var holder = $('#trip-list'), items = data.trips || [];
      if (!items.length) { holder.append(empty('Trips coming soon.')); return; }
      items.forEach(function (t) {
        var left = el('div', null, el('h2', { text: t.title || 'Untitled trip' }));
        var meta = [t.place, t.when].filter(Boolean).join(', ');
        if (meta) left.append(el('p', { class: 'trip-meta', text: meta }));
        var right = el('div', { class: 'prose' }, paragraphs(t.description));
        var art = el('article', { class: 'trip' }, el('div', { class: 'trip-head' }, left, right));
        var pics = flat([{ images: t.images, captions: t.captions }].concat(t.photos || []));
        if (pics.length) art.append(gallery(pics));
        holder.append(art);
      });
    });
  }
})();
