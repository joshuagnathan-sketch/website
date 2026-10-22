/* Renders every page from the files in /content (edited through /admin). */
(function () {
  var page = document.body.getAttribute('data-page');
  var portfolio = document.body.classList.contains('portfolio');
  var PHOTO_SITE = 'https://jgnphotography.com';

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
  // An <img> that fades in once it has loaded.
  function photo(src, alt, attrs) {
    var img = el('img', Object.assign({ src: imgSrc(src), alt: alt || '', loading: 'lazy', decoding: 'async', class: 'fade', draggable: 'false' }, attrs || {}));
    function done() { img.classList.add('loaded'); }
    if (img.complete && img.naturalWidth) done(); else { img.addEventListener('load', done); img.addEventListener('error', done); }
    return img;
  }
  function empty(msg) { return el('p', { class: 'empty', text: msg }); }
  function cap(s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); }

  // Each entry can hold one photo ("image") or a batch ("images"); flatten to single photos.
  // "captions" holds one caption per line, in the same order as the photos.
  function flat(entries) {
    var out = [];
    (entries || []).forEach(function (e) {
      if (!e) return;
      var imgs = [].concat(e.images || [], e.image || []);
      var caps = String(e.captions || '').split('\n');
      imgs.forEach(function (src, i) {
        var c = (caps[i] || '').trim();
        if (src) out.push({ image: src, caption: c || e.caption || '', category: String(e.category || '').trim().toLowerCase() });
      });
    });
    return out;
  }

  // ---------- header: nav highlight, shadow on scroll, year ----------
  var path = location.pathname.replace(/\/index(\.html)?$/, '/').replace(/\.html$/, '');
  document.querySelectorAll('.nav a').forEach(function (a) {
    if (a.getAttribute('href').replace(/\.html$/, '') === path) a.setAttribute('aria-current', 'page');
  });
  var header = $('.site-header');
  function onScroll() { if (header) header.classList.toggle('scrolled', window.scrollY > 24); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  document.querySelectorAll('.year').forEach(function (n) { n.textContent = new Date().getFullYear(); });

  // Light deterrent against saving photos (the watermark is the real protection).
  if (portfolio) document.addEventListener('contextmenu', function (e) { if (e.target.tagName === 'IMG') e.preventDefault(); });

  // ---------- lightbox ----------
  var list = [], idx = 0, lastFocus = null;
  var lbImg = el('img', { alt: '', draggable: 'false' });
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
    lbCount.textContent = list.length > 1 ? (idx + 1) + ' / ' + list.length : '';
    stage.querySelectorAll('.lb-prev,.lb-next').forEach(function (b) { b.hidden = list.length < 2; });
    // Preload the neighbours so swiping feels instant.
    [1, -1].forEach(function (d) { var n = list[(idx + d + list.length) % list.length]; if (n) new Image().src = imgSrc(n.image); });
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
  // A button that opens photo i of items in the viewer.
  function opener(cls, items, i, child) {
    var p = items[i];
    return el('button', { class: cls, type: 'button', 'aria-label': 'Open ' + (p.caption || 'photo ' + (i + 1)), onclick: function () { open(items, i); } }, child);
  }

  // ---------- gallery ----------
  function gallery(items) {
    var g = el('div', { class: 'gallery' });
    items.forEach(function (p, i) {
      var fig = el('figure', { class: 'tile' });
      var img = photo(p.image, p.caption || 'Photo ' + (i + 1));
      img.addEventListener('load', function () { if (img.naturalHeight) fig.style.setProperty('--ar', (img.naturalWidth / img.naturalHeight).toFixed(4)); });
      var btn = opener('', items, i, img);
      if (p.caption) btn.append(el('span', { class: 'cap', text: p.caption }));
      fig.append(btn);
      g.append(fig);
    });
    return g;
  }

  // ---------- shared site info ----------
  var siteInfo = load('site');
  siteInfo.then(function (site) {
    if (site.name && !portfolio) {
      document.querySelectorAll('[data-site-name]').forEach(function (n) { n.textContent = site.name; });
    }
    document.querySelectorAll('.social').forEach(function (social) {
      if (site.instagram) social.append(el('a', { href: 'https://instagram.com/' + String(site.instagram).replace(/^@/, ''), text: 'Instagram', rel: 'noopener' }));
      if (site.email) social.append(el('a', { href: 'mailto:' + site.email, text: 'Email' }));
    });
    if (page === 'home' && site.tagline) $('#tagline').textContent = site.tagline;
    if (page === 'about' || portfolio) {
      var body = $('#about-body');
      if (body) body.replaceChildren(paragraphs(portfolio ? (site.photo_about || site.about) : site.about));
      var gear = $('#gear'), gearList = site.gear || [];
      if (gear && gearList.length) {
        gearList.forEach(function (g) { var t = typeof g === 'string' ? g : g.item; if (t) gear.append(el('li', { text: t })); });
      } else if ($('#gear-block')) $('#gear-block').hidden = true;
    }
    if (portfolio && site.photo_tagline) $('#pf-tagline').textContent = site.photo_tagline;
  });

  // ---------- pages ----------
  if (page === 'home' || page === 'photos') {
    Promise.all([load('photos'), siteInfo]).then(function (r) {
      var photos = flat(r[0].photos), site = r[1];

      if (page === 'home') {
        // Big photo next to your name
        var cover = site.cover || (photos[0] && photos[0].image);
        var fig = $('#hero-photo');
        if (cover) {
          var coverItem = photos.filter(function (p) { return p.image === cover; })[0] || { image: cover, caption: '' };
          fig.append(opener('frame', [coverItem], 0, photo(cover, coverItem.caption || 'Photo by ' + (site.name || 'Joshua G. Nathan'), { loading: 'eager', fetchpriority: 'high' })));
          if (coverItem.caption) fig.append(el('figcaption', { text: coverItem.caption }));
        } else fig.hidden = true;
        // Latest photos
        if (!photos.length) { $('#latest').hidden = true; $('#band').hidden = true; return; }
        $('#latest-gallery').append(gallery(photos.slice(0, 6)));
        // JGN Photography band: three photos that aren't already the cover
        var picks = photos.filter(function (p) { return p.image !== cover; }).slice(6, 9);
        if (picks.length < 3) picks = photos.slice(0, 3);
        var holder = $('#band-photos');
        picks.forEach(function (p) { holder.append(el('a', { href: PHOTO_SITE, 'aria-label': 'JGN Photography', tabindex: '-1' }, photo(p.image, p.caption))); });
        return;
      }

      // JGN Photography (and the fallback /photos page)
      if (portfolio) {
        var bgSrc = site.photo_cover || (photos[0] && photos[0].image);
        if (bgSrc) {
          var bg = el('img', { class: 'bg', src: imgSrc(bgSrc), alt: '', fetchpriority: 'high', draggable: 'false' });
          bg.addEventListener('load', function () { bg.classList.add('loaded'); });
          $('.pf-hero').prepend(bg);
        }
      }
      var holderG = $('#photo-gallery'), bar = $('#filters'), count = $('#pf-count');
      if (!photos.length) { holderG.append(empty('Photos are on their way. Check back soon.')); return; }
      var cats = [];
      photos.forEach(function (p) { if (p.category && cats.indexOf(p.category) < 0) cats.push(p.category); });
      function draw(c) {
        var shown = photos.filter(function (p) { return c === 'all' || p.category === c; });
        holderG.replaceChildren(gallery(shown));
        if (count) count.textContent = shown.length + (shown.length === 1 ? ' photo' : ' photos');
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

  // Main photo + small thumbnails, used by projects.
  function media(pics, title) {
    var box = el('div', { class: 'project-media' });
    box.append(opener('frame', pics, 0, photo(pics[0].image, pics[0].caption || title)));
    if (pics.length > 1) {
      var thumbs = el('div', { class: 'thumbs' });
      pics.slice(1, 5).forEach(function (p, i) { thumbs.append(opener('', pics, i + 1, photo(p.image, p.caption || title))); });
      box.append(thumbs);
    }
    return box;
  }

  if (page === 'projects') {
    load('projects').then(function (data) {
      var holder = $('#project-list'), items = data.projects || [];
      if (!items.length) { holder.append(empty('Projects coming soon.')); return; }
      items.forEach(function (p) {
        var text = el('div', null);
        if (p.status) text.append(el('span', { class: 'status', text: p.status }));
        text.append(el('h2', { text: p.title || 'Untitled project' }));
        if (p.summary) text.append(el('p', { class: 'summary', text: p.summary }));
        text.append(el('div', { class: 'prose' }, paragraphs(p.description)));
        if (p.link) text.append(el('a', { class: 'link', href: p.link, rel: 'noopener', text: 'Learn more ↗' }));
        var pics = flat([{ images: p.images, image: p.image, captions: p.captions, caption: p.title }]);
        var art = el('article', { class: 'project' + (pics.length ? '' : ' no-media') });
        if (pics.length) art.append(media(pics, p.title));
        art.append(text);
        holder.append(art);
      });
    });
  }

  if (page === 'trips') {
    load('trips').then(function (data) {
      var holder = $('#trip-list'), items = data.trips || [];
      if (!items.length) { holder.append(empty('Trips coming soon.')); return; }
      items.forEach(function (t) {
        var pics = flat([{ images: t.images, captions: t.captions }].concat(t.photos || []));
        var art = el('article', { class: 'trip' });
        if (pics.length) art.append(opener('trip-cover', pics, 0, photo(pics[0].image, pics[0].caption || t.title)));
        var left = el('div', null, el('h2', { text: t.title || 'Untitled trip' }));
        if (t.place || t.when) {
          var meta = el('p', { class: 'trip-meta' });
          [t.place, t.when].filter(Boolean).forEach(function (m) { meta.append(el('span', { text: m })); });
          left.append(meta);
        }
        art.append(el('div', { class: 'trip-head' }, left, el('div', { class: 'prose' }, paragraphs(t.description))));
        if (pics.length > 1) art.append(gallery(pics.slice(1)));
        holder.append(art);
      });
    });
  }
})();
