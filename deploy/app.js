/* ============================================================================
 * Oyako Hotel — page logic.
 *
 * Classic script (no modules) so index.html opens straight from the filesystem.
 * Everything it renders comes from site.config.js; this file holds no content.
 * ==========================================================================*/
(function () {
  'use strict';

  var C = window.OYAKO;
  if (!C) {
    throw new Error('site.config.js must be loaded before app.js');
  }

  /* ======================================================================
   * Pure helpers — also exposed on window.OYAKO_CORE so they can be tested
   * from a headless browser without touching the DOM.
   * ==================================================================== */

  /** FNV-1a, 32-bit. Deterministic across reloads and machines. */
  function hash32(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  /** 'YYYY-MM-DD' -> local midnight Date, so no timezone drift. */
  function parseDate(iso) {
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
    if (!p) return null;
    return new Date(Number(p[1]), Number(p[2]) - 1, Number(p[3]));
  }

  function toISO(date) {
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '-' + m + '-' + d;
  }

  function addDays(date, n) {
    var d = new Date(date.getTime());
    d.setDate(d.getDate() + n);
    return d;
  }

  function nightsBetween(a, b) {
    var ms = parseDate(b) - parseDate(a);
    return Math.round(ms / 86400000);
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function prettyDate(iso) {
    var d = parseDate(iso);
    if (!d) return '';
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  function prettyRange(ci, co) {
    var a = parseDate(ci), b = parseDate(co);
    if (!a || !b) return '';
    if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
      return a.getDate() + ' – ' + b.getDate() + ' ' + MONTHS[b.getMonth()] +
        ' ' + b.getFullYear();
    }
    return prettyDate(ci) + ' – ' + prettyDate(co);
  }

  function money(amount) {
    return '$' + Number(amount).toLocaleString('en-US');
  }

  function nightsWord(n) {
    return n === 1 ? '1 night' : n + ' nights';
  }

  /**
   * Fake availability. Deterministic: the same room, dates and party always give
   * the same answer, so the page never changes under a reload. Pressure rises
   * with how rare the room is, how long the stay is, how big the party is and
   * whether it starts on a weekend.
   */
  function availability(room, checkIn, checkOut, guests) {
    if (guests > room.maxGuests) {
      return { state: 'small', left: 0 };
    }
    var nights = Math.max(1, nightsBetween(checkIn, checkOut));
    var pressure = room.rarity;
    pressure += Math.min(nights, 14) * 0.012;
    if (guests >= 3) pressure += 0.07;
    if (guests >= 5) pressure += 0.06;
    var dow = parseDate(checkIn) ? parseDate(checkIn).getDay() : 1;
    if (dow === 5 || dow === 6) pressure += 0.1;
    pressure = Math.max(0, Math.min(0.92, pressure));

    var key = room.id + '|' + checkIn + '|' + checkOut + '|' + guests;
    var r1 = hash32(key) / 4294967296;
    var r2 = hash32(key + '~left') / 4294967296;

    if (r1 < pressure) return { state: 'soldout', left: 0 };

    var headroom = Math.max(1, Math.round(room.inventory * (1 - pressure)));
    var left = Math.max(1, Math.round(1 + r2 * (headroom - 1)));
    if (left <= 2) return { state: 'low', left: left };
    return { state: 'available', left: left };
  }

  /** Total for the stay, so the panel can show what a booking would come to. */
  function stayTotal(room, checkIn, checkOut) {
    return room.pricePerNight * Math.max(1, nightsBetween(checkIn, checkOut));
  }

  function whatsappNumber() {
    return String(C.contact.whatsapp).replace(/[^\d]/g, '');
  }

  function waLink(message) {
    return 'https://wa.me/' + whatsappNumber() + '?text=' + encodeURIComponent(message);
  }

  window.OYAKO_CORE = {
    hash32: hash32,
    parseDate: parseDate,
    toISO: toISO,
    addDays: addDays,
    nightsBetween: nightsBetween,
    prettyDate: prettyDate,
    prettyRange: prettyRange,
    money: money,
    availability: availability,
    stayTotal: stayTotal,
    waLink: waLink,
  };

  /* ======================================================================
   * State
   * ==================================================================== */

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  function resolveDefaults() {
    var ci = parseDate(C.booking.defaultCheckIn);
    var co = parseDate(C.booking.defaultCheckOut);
    // A stale config should not open on dates in the past.
    if (!ci || !co || ci < today) {
      ci = addDays(today, C.booking.leadDays);
      co = addDays(ci, 3);
    }
    return { checkIn: toISO(ci), checkOut: toISO(co), guests: C.booking.defaultGuests };
  }

  var state = resolveDefaults();

  /* ======================================================================
   * Small DOM helpers
   * ==================================================================== */

  function el(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  function icon(name) {
    var paths = {
      pin: '<path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
      phone: '<path d="M6.5 3.5h3l1.5 4-2 1.5a13 13 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.1 2A17 17 0 0 1 4.5 5.6a2 2 0 0 1 2-2.1Z"/>',
      mail: '<rect x="3" y="5.5" width="18" height="13" rx="1.6"/><path d="m3.8 7 8.2 6 8.2-6"/>',
      clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3.2 2"/>',
      chat: '<path d="M20.5 11.6c0 4-3.8 7.2-8.5 7.2a10 10 0 0 1-2.7-.35L4.5 20l1.3-3.6A6.9 6.9 0 0 1 3.5 11.6c0-4 3.8-7.2 8.5-7.2s8.5 3.2 8.5 7.2Z"/>',
      star: '<path d="m12 3.6 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.8l5.9-.8Z"/>',
      arrow: '<path d="M5 12h13m-5-5.5L18.5 12 13 17.5"/>',
      close: '<path d="m6 6 12 12M18 6 6 18"/>',
      chevron: '<path d="m9 5 7 7-7 7"/>',
    };
    return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (paths[name] || '') + '</svg>';
  }

  /* ======================================================================
   * Responsive images
   * Every photograph ships twice: the full-size file and a 900-px variant in
   * assets/img/small/ beside it. srcset lets a phone take the small one
   * instead of downloading a 1600-2000 px picture; `sizes` tells the browser
   * how wide the slot really is so it picks the right one (and still takes the
   * full file on a retina desktop, where the slot needs more pixels).
   *
   * The single-file export inlines every photograph as a data URI and sets
   * window.OYAKO_INLINED, where a srcset of separate files is meaningless (and
   * would double the file), so it is skipped there.
   * ==================================================================== */

  var RESPONSIVE = !window.OYAKO_INLINED;

  var IMG_SIZES = {
    full: '(max-width: 900px) 100vw, 52vw',                       // hero
    wide: '(max-width: 900px) 92vw, 48vw',                        // venue / wellness / location
    card: '(max-width: 760px) 92vw, (max-width: 1100px) 46vw, 32vw',
    third: '(max-width: 420px) 92vw, (max-width: 760px) 46vw, 32vw',
    half: '(max-width: 900px) 46vw, 24vw',                        // facility / venue strip
    dialog: '(max-width: 900px) 100vw, 50vw',
  };

  function smallVariant(src) {
    if (!RESPONSIVE) return '';
    return String(src).replace(/^(assets\/img\/)([^/]+)$/, '$1small/$2');
  }

  /** Build an <img>. opts: { cls, eager, w, h, sizes, alt } */
  function imgTag(src, alt, opts) {
    opts = opts || {};
    var small = smallVariant(src);
    var out = '<img';
    if (opts.cls) out += ' class="' + esc(opts.cls) + '"';
    out += ' src="' + esc(src) + '"';
    if (small) {
      out += ' srcset="' + esc(small) + ' 900w, ' + esc(src) + ' ' + (opts.w || 1600) + 'w"';
      out += ' sizes="' + esc(opts.sizes || IMG_SIZES.card) + '"';
    }
    out += ' alt="' + esc(alt) + '"';
    out += ' loading="' + (opts.eager ? 'eager' : 'lazy') + '" decoding="async"';
    if (opts.eager) out += ' fetchpriority="high"';
    if (opts.w) out += ' width="' + opts.w + '" height="' + opts.h + '"';
    return out + '>';
  }

  /* A re-badged hotel may not have generated the 900-px variants. If one is
   * missing the browser reports the error; drop the srcset once and let it use
   * the full-size file, so the site never shows a broken photograph. */
  function initImageFallback() {
    document.addEventListener('error', function (ev) {
      var t = ev.target;
      if (!t || t.tagName !== 'IMG' || !t.hasAttribute('srcset')) return;
      t.removeAttribute('srcset');
      t.removeAttribute('sizes');
      var src = t.getAttribute('src');
      if (src) t.src = src;
    }, true);
  }

  /* ======================================================================
   * Theme — colours and fonts come from the settings file too
   * ==================================================================== */

  function applyTheme() {
    var t = C.theme;
    var root = document.documentElement;
    ['paper', 'paperAlt', 'ink', 'inkSoft', 'inkMuted', 'accent', 'rule',
      'ok', 'okBg', 'okBd', 'low', 'lowBg', 'lowBd', 'out', 'outBg', 'outBd']
      .forEach(function (k) {
        root.style.setProperty('--' + k.replace(/[A-Z]/g, function (m) {
          return '-' + m.toLowerCase();
        }), t[k]);
      });
    root.style.setProperty('--font-display', t.fontDisplay);
    root.style.setProperty('--font-sans', t.fontSans);
    document.title = C.meta.title;

    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', C.meta.description);
  }

  /* ======================================================================
   * Badge copy
   * ==================================================================== */

  function badgeFor(room, avail) {
    if (avail.state === 'soldout') {
      return { cls: 'out', text: 'Sold out' };
    }
    if (avail.state === 'small') {
      return { cls: 'small', text: 'Sleeps ' + room.maxGuests };
    }
    if (avail.state === 'low') {
      return { cls: 'low', text: 'Only ' + avail.left + ' left' };
    }
    return { cls: 'ok', text: 'Available' };
  }

  /* ======================================================================
   * Render
   * ==================================================================== */

  function renderHeader() {
    var b = C.brand;
    el('brand').innerHTML =
      '<a class="brand-link" href="#stay" aria-label="' + esc(b.name) + ' home">' +
      '<span class="mark">' + b.markSvg + '</span>' +
      '<span class="wordmark">' + esc(b.wordmark) +
      '<span class="wordmark-sub">' + esc(b.wordmarkSub) + '</span></span>' +
      '</a>';
    el('nav').innerHTML = [
      ['#rooms', 'Rooms &amp; Suites'],
      ['#dining', 'Dining'],
      ['#wellness', 'Spa'],
      ['#gallery', 'Gallery'],
      ['#reviews', 'Reviews'],
      ['#location', 'Location'],
    ].map(function (x) {
      return '<a href="' + x[0] + '">' + x[1] + '</a>';
    }).join('');
    el('header-cta').innerHTML =
      '<a class="btn-cta" href="' + esc(waLink(C.contact.whatsappMessage)) + '" ' +
      'target="_blank" rel="noopener">' + icon('chat') + esc(C.contact.whatsappLabel) + '</a>';
  }

  function renderHero() {
    var h = C.hero;
    el('hero-copy').innerHTML =
      '<p class="eyebrow">' + esc(h.eyebrow) + '</p>' +
      '<h1>' + h.headline + '</h1>' +
      '<p class="lede">' + esc(h.lede) + '</p>' +
      '<div class="rule"></div>' +
      bookingBarMarkup();
    el('hero-media').innerHTML = imgTag(h.image, h.imageAlt,
      { eager: true, w: 1600, h: 1067, sizes: IMG_SIZES.full });
  }

  function bookingBarMarkup() {
    var opts = C.booking.guestOptions.map(function (o) {
      return '<option value="' + o.value + '"' +
        (o.value === state.guests ? ' selected' : '') + '>' + esc(o.label) + '</option>';
    }).join('');
    return '' +
      '<form class="bookbar" id="bookform" novalidate>' +
      '  <div class="bookbar-fields">' +
      '    <label><span>Check in</span>' +
      '      <input type="date" id="checkin" value="' + state.checkIn + '" ' +
      'aria-describedby="bookerr"></label>' +
      '    <label><span>Check out</span>' +
      '      <input type="date" id="checkout" value="' + state.checkOut + '" ' +
      'aria-describedby="bookerr"></label>' +
      '    <label><span>Guests</span>' +
      '      <select id="guests">' + opts + '</select></label>' +
      '  </div>' +
      '  <button type="submit" class="bookbar-go">Check availability</button>' +
      '  <p class="bookbar-msg" id="bookerr" role="status" aria-live="polite"></p>' +
      '</form>';
  }

  function renderRooms() {
    var sec = C.roomsIntro;
    el('rooms').innerHTML =
      '<div class="wrap">' +
      '  <header class="sec-head">' +
      '    <p class="eyebrow">' + esc(sec.eyebrow) + '</p>' +
      '    <h2>' + sec.heading + '</h2>' +
      '    <p class="lede">' + esc(sec.lede) + '</p>' +
      '    <p class="stay-line" id="stay-line"></p>' +
      '  </header>' +
      '  <div class="room-grid" id="room-grid"></div>' +
      '  <p class="rooms-footnote" id="rooms-footnote">' + esc(C.booking.footnote) + '</p>' +
      '</div>';
    paintRooms();
  }

  /** Fills the odd half-row after the five room tiers, and repeats the
   *  WhatsApp call to action at the point of decision. */
  function bookingPanelMarkup() {
    var prices = C.rooms.map(function (r) { return r.pricePerNight; });
    return '' +
      '<aside class="booking-panel">' +
      '  <p class="eyebrow">Not sure which room</p>' +
      '  <h3>Tell us who is coming and we will suggest one.</h3>' +
      '  <p class="panel-copy">Five room types from ' + money(Math.min.apply(null, prices)) +
      ' to ' + money(Math.max.apply(null, prices)) +
      ' a night. Reservations answer on WhatsApp, usually within the hour.</p>' +
      '  <p class="panel-dates">' + esc(prettyRange(state.checkIn, state.checkOut)) +
      ' · ' + nightsWord(nightsBetween(state.checkIn, state.checkOut)) + '</p>' +
      '  <a class="btn primary" href="' + esc(waLink(C.contact.whatsappMessage)) + '" ' +
      'target="_blank" rel="noopener">' + icon('chat') + esc(C.contact.whatsappLabel) + '</a>' +
      '</aside>';
  }

  function paintRooms() {
    var grid = el('room-grid');
    if (!grid) return;

    var nights = nightsBetween(state.checkIn, state.checkOut);
    var guestLabel = (C.booking.guestOptions.filter(function (o) {
      return o.value === state.guests;
    })[0] || { label: state.guests + ' guests' }).label;

    el('stay-line').textContent =
      prettyRange(state.checkIn, state.checkOut) + ' · ' + nightsWord(nights) +
      ' · ' + guestLabel;

    // Keep the inputs in step when the state is changed from a room card.
    if (el('checkin')) el('checkin').value = state.checkIn;
    if (el('checkout')) el('checkout').value = state.checkOut;
    if (el('guests')) el('guests').value = String(state.guests);

    grid.innerHTML = C.rooms.map(function (room) {
      var avail = availability(room, state.checkIn, state.checkOut, state.guests);
      var badge = badgeFor(room, avail);
      var soldOut = avail.state === 'soldout';
      var sleeps = avail.state === 'small';
      var action = soldOut
        ? '<a class="btn ghost waitlist" href="' + esc(waLink(
            'Hello ' + C.brand.name + '. Please add me to the waiting list for the ' +
            room.name + ' for ' + prettyRange(state.checkIn, state.checkOut) + '.')) +
          '" target="_blank" rel="noopener">Join waitlist</a>'
        : sleeps
          ? '<span class="btn ghost disabled" aria-disabled="true">Too small for ' +
            state.guests + ' guests</span>'
          : '<a class="btn primary" href="' + esc(waLink(bookMessage(room))) +
            '" target="_blank" rel="noopener">Book</a>';

      return '' +
        '<article class="card' + (soldOut ? ' soldout' : '') + '" data-room="' + esc(room.id) + '">' +
        '  <figure>' +
        '    ' + imgTag(room.image, room.imageAlt, { w: 1200, h: 800, sizes: IMG_SIZES.card }) +
        '  </figure>' +
        '  <h3>' + esc(room.name) + '</h3>' +
        '  <p class="spec">' + esc(room.size) + ' &nbsp;·&nbsp; ' + esc(room.bed) +
        ' &nbsp;·&nbsp; Up to ' + room.maxGuests + ' guests</p>' +
        '  <p class="card-copy">' + esc(room.description) + '</p>' +
        '  <div class="rule2"></div>' +
        '  <span class="badge ' + badge.cls + '">' + esc(badge.text) + '</span>' +
        '  <div class="card-foot">' +
        '    <p class="amt">' + money(room.pricePerNight) +
        '      <small>per night</small></p>' +
        '    <div class="acts">' +
        '      <button type="button" class="btn ghost details" data-details="' +
        esc(room.id) + '">Details</button>' +
        action +
        '    </div>' +
        '  </div>' +
        '</article>';
    }).join('') + bookingPanelMarkup();
  }

  function bookMessage(room) {
    var guestLabel = (C.booking.guestOptions.filter(function (o) {
      return o.value === state.guests;
    })[0] || { label: state.guests + ' guests' }).label;
    return 'Hello ' + C.brand.name + '. I would like to book the ' + room.name + '.\n\n' +
      'Check in: ' + prettyDate(state.checkIn) + '\n' +
      'Check out: ' + prettyDate(state.checkOut) + '\n' +
      'Guests: ' + guestLabel + '\n' +
      'Price shown: ' + money(room.pricePerNight) + ' per night\n\n' +
      '(Sent from the ' + C.brand.name + ' website)';
  }

  function renderDining() {
    var d = C.dining;
    el('dining').innerHTML =
      '<div class="wrap">' +
      '  <header class="sec-head">' +
      '    <p class="eyebrow">' + esc(d.eyebrow) + '</p>' +
      '    <h2>' + esc(d.heading) + '</h2>' +
      '    <p class="lede">' + esc(d.lede) + '</p>' +
      '  </header>' +
      d.venues.map(function (v, i) {
        var gallery = v.gallery.map(function (g) {
          return imgTag(g.image, g.alt, { w: 1600, h: 1067, sizes: IMG_SIZES.half });
        }).join('');
        return '' +
          '<article class="venue' + (i % 2 ? ' flip' : '') + '">' +
          '  <div class="venue-media">' +
          '    ' + imgTag(v.image, v.imageAlt,
            { cls: 'venue-hero', w: 1600, h: 1067, sizes: IMG_SIZES.wide }) +
          (gallery ? '<div class="venue-strip">' + gallery + '</div>' : '') +
          '  </div>' +
          '  <div class="venue-copy">' +
          '    <p class="eyebrow">' + esc(v.kind) + '</p>' +
          '    <h3>' + esc(v.name) + '</h3>' +
          '    <p class="hours">' + icon('clock') + esc(v.hours) + '</p>' +
          '    <p>' + esc(v.description) + '</p>' +
          '  </div>' +
          '</article>';
      }).join('') +
      '</div>';
  }

  function renderWellness() {
    var w = C.wellness;
    el('wellness').innerHTML =
      '<div class="wrap">' +
      '  <header class="sec-head">' +
      '    <p class="eyebrow">' + esc(w.eyebrow) + '</p>' +
      '    <h2>' + esc(w.heading) + '</h2>' +
      '    <p class="lede">' + esc(w.lede) + '</p>' +
      '  </header>' +
      '  <figure class="wellness-lead">' +
      '    ' + imgTag(w.image, w.imageAlt, { w: 1600, h: 1067, sizes: IMG_SIZES.wide }) +
      '  </figure>' +
      '  <div class="facility-grid">' +
      w.facilities.map(function (f) {
        return '' +
          '<article class="facility">' +
          '  ' + imgTag(f.image, f.alt, { w: 1200, h: 800, sizes: IMG_SIZES.half }) +
          '  <h3>' + esc(f.name) + '</h3>' +
          '  <p class="spec">' + esc(f.meta) + '</p>' +
          '  <p class="facility-copy">' + esc(f.description) + '</p>' +
          '</article>';
      }).join('') +
      '  </div>' +
      '</div>';
  }

  function renderGallery() {
    var g = C.gallery;
    el('gallery').innerHTML =
      '<div class="wrap">' +
      '  <header class="sec-head">' +
      '    <p class="eyebrow">' + esc(g.eyebrow) + '</p>' +
      '    <h2>' + esc(g.heading) + '</h2>' +
      '    <p class="lede">' + esc(g.lede) + '</p>' +
      '  </header>' +
      '  <div class="gallery-grid" id="gallery-grid">' +
      g.images.map(function (im, i) {
        return '' +
          '<button type="button" class="shot" data-shot="' + i + '" ' +
          'aria-label="Open image: ' + esc(im.caption) + '">' +
          '  ' + imgTag(im.image, im.alt, { w: 1600, h: 1067, sizes: IMG_SIZES.third }) +
          '  <span class="shot-cap">' + esc(im.caption) + '</span>' +
          '</button>';
      }).join('') +
      '  </div>' +
      '</div>' +
      '<dialog class="lightbox" id="lightbox" aria-label="Gallery viewer">' +
      '  <button type="button" class="lb-close" id="lb-close" aria-label="Close gallery">' +
      icon('close') + '</button>' +
      '  <button type="button" class="lb-prev" id="lb-prev" aria-label="Previous image">' +
      icon('chevron') + '</button>' +
      '  <img id="lb-img" src="" alt="">' +
      '  <button type="button" class="lb-next" id="lb-next" aria-label="Next image">' +
      icon('chevron') + '</button>' +
      '  <p class="lb-cap" id="lb-cap"></p>' +
      '</dialog>';
  }

  function renderReviews() {
    var r = C.reviews;
    el('reviews').innerHTML =
      '<div class="wrap">' +
      '  <header class="sec-head">' +
      '    <p class="eyebrow">' + esc(r.eyebrow) + '</p>' +
      '    <h2>' + esc(r.heading) + '</h2>' +
      '    <p class="lede">' + esc(r.lede) + '</p>' +
      '  </header>' +
      '  <div class="review-grid">' +
      r.items.map(function (v) {
        var stars = '';
        for (var i = 0; i < 5; i++) {
          stars += '<span class="star' + (i < v.rating ? ' on' : '') + '">' +
            icon('star') + '</span>';
        }
        return '' +
          '<figure class="review">' +
          '  <div class="stars" role="img" aria-label="' + v.rating + ' out of 5">' +
          stars + '</div>' +
          '  <blockquote>' + esc(v.quote) + '</blockquote>' +
          '  <figcaption>' +
          '    <span class="who">' + esc(v.name) + '</span>' +
          '    <span class="where">' + esc(v.origin) + ' · ' + esc(v.stay) + '</span>' +
          '  </figcaption>' +
          '</figure>';
      }).join('') +
      '  </div>' +
      '</div>';
  }

  /**
   * A stylised locator diagram rather than a tile map. Third-party map tiles
   * cannot be bundled into an offline file (OpenStreetMap's servers refuse the
   * request outright), so the districts are drawn here with every label inside
   * its own shape, and the whole thing is labelled as stylised.
   */
  function locatorDiagram() {
    var W = 'fill="var(--paper)" stroke="var(--rule)"';
    return '' +
      '<svg class="locator" viewBox="0 0 640 420" role="img" ' +
      'aria-label="Stylised diagram of Abuja: Maitama, Wuse, Asokoro, the Central ' +
      'Business District, Aso Rock and Jabi Lake, with Oyako Hotel marked in Maitama">' +
      '  <defs>' +
      '    <linearGradient id="lag" x1="0" y1="0" x2="0.2" y2="1">' +
      '      <stop offset="0" stop-color="#D6DDCE"/>' +
      '      <stop offset="1" stop-color="#E8EADF"/>' +
      '    </linearGradient>' +
      '  </defs>' +
      '  <rect width="640" height="420" fill="url(#lag)"/>' +

      /* Jabi Lake keeps a water idea for an inland, landlocked capital */
      '  <rect x="20" y="46" width="172" height="74" rx="20" fill="#AEC4CC" stroke="#9DB4BD"/>' +
      '  <text x="40" y="90" class="map-lbl sm water">Jabi Lake</text>' +

      /* Aso Rock drawn as a landmark mass, not a district */
      '  <ellipse cx="520" cy="90" rx="92" ry="48" fill="#CBC5B8" stroke="var(--rule)"/>' +
      '  <text x="484" y="95" class="map-lbl">Aso Rock</text>' +

      /* districts */
      '  <rect x="20" y="150" width="150" height="156" rx="16" ' + W + '/>' +
      '  <text x="70" y="232" class="map-lbl">Wuse</text>' +

      '  <rect x="196" y="150" width="158" height="156" rx="16" ' +
      '    fill="#fff" stroke="var(--accent)" stroke-width="1.4"/>' +
      '  <text x="216" y="180" class="map-lbl strong">Maitama</text>' +

      '  <rect x="376" y="150" width="150" height="156" rx="16" ' + W + '/>' +
      '  <text x="398" y="232" class="map-lbl">Asokoro</text>' +

      '  <rect x="196" y="326" width="220" height="70" rx="16" ' + W + '/>' +
      '  <text x="214" y="367" class="map-lbl sm">Central Business District</text>' +

      /* avenues */
      '  <path d="M170 224 H196" class="map-road"/>' +
      '  <path d="M354 224 H376" class="map-road"/>' +
      '  <path d="M275 306 V326" class="map-road"/>' +
      '  <path d="M354 180 C410 150 462 120 470 112" class="map-road"/>' +
      '  <text x="28" y="140" class="map-lbl sm muted">Independence Avenue</text>' +
      '  <text x="360" y="150" class="map-lbl sm muted">Shehu Shagari Way</text>' +

      /* the hotel, self-contained inside the Maitama block */
      '  <g class="map-pin">' +
      '    <circle cx="262" cy="226" r="14" class="pin-ring"/>' +
      '    <circle cx="262" cy="226" r="5.5" class="pin-dot"/>' +
      '  </g>' +
      '  <text x="210" y="290" class="map-lbl strong accent">Oyako Hotel</text>' +
      '  <text x="430" y="408" class="map-lbl sm muted">Stylised diagram · not to scale</text>' +
      '</svg>';
  }

  function renderLocation() {
    var l = C.location;
    el('location').innerHTML =
      '<div class="wrap">' +
      '  <header class="sec-head">' +
      '    <p class="eyebrow">' + esc(l.eyebrow) + '</p>' +
      '    <h2>' + esc(l.heading) + '</h2>' +
      '    <p class="lede">' + esc(l.lede) + '</p>' +
      '  </header>' +
      '  <div class="loc-grid">' +
      '    <div class="loc-left">' +
      '      <figure class="loc-map">' + locatorDiagram() + '</figure>' +
      '      <dl class="distances">' +
      l.distances.map(function (d) {
        return '<div><dt>' + esc(d.label) + '</dt><dd>' + esc(d.value) + '</dd></div>';
      }).join('') +
      '      </dl>' +
      '    </div>' +
      '    <div class="loc-side">' +
      '      ' + imgTag(l.image, l.imageAlt,
        { cls: 'loc-photo', w: 1600, h: 1067, sizes: IMG_SIZES.wide }) +
      '      <div class="loc-card" id="contact">' +
      '        <h3>' + esc(C.brand.name) + '</h3>' +
      '        <ul class="loc-list">' +
      '          <li>' + icon('pin') + '<span>' +
      C.contact.addressLines.map(esc).join('<br>') + '</span></li>' +
      '          <li>' + icon('phone') + '<span><a href="tel:' +
      esc(String(C.contact.phone).replace(/[^\d+]/g, '')) + '">' +
      esc(C.contact.phone) + '</a></span></li>' +
      '          <li>' + icon('mail') + '<span><a href="mailto:' + esc(C.contact.email) +
      '">' + esc(C.contact.email) + '</a></span></li>' +
      '          <li>' + icon('clock') + '<span>' + esc(C.contact.reception) + '</span></li>' +
      '        </ul>' +
      '        <a class="btn ghost dir" href="' + esc(C.contact.directionsUrl) + '" ' +
      'target="_blank" rel="noopener">Get directions' + icon('arrow') + '</a>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>';
  }

  function renderFooter() {
    var f = C.footer;
    el('site-footer').innerHTML =
      '<div class="wrap">' +
      '  <div class="foot-grid">' +
      '    <div class="foot-brand">' +
      '      <span class="mark">' + C.brand.markSvg + '</span>' +
      '      <p class="foot-name">' + esc(C.brand.name) + '</p>' +
      '      <p class="foot-blurb">' + esc(f.blurb) + '</p>' +
      '      <p class="foot-city">' + esc(C.brand.cityLine) + '</p>' +
      '    </div>' +
      f.columns.map(function (col) {
        return '<nav class="foot-col" aria-label="' + esc(col.heading) + '">' +
          '<h2>' + esc(col.heading) + '</h2>' +
          '<ul>' + col.links.map(function (lk) {
            return '<li><a href="' + esc(lk.href) + '">' + esc(lk.label) + '</a></li>';
          }).join('') + '</ul></nav>';
      }).join('') +
      '    <div class="foot-col">' +
      '      <h2>Contact</h2>' +
      '      <ul>' +
      '        <li><a href="tel:' + esc(String(C.contact.phone).replace(/[^\d+]/g, '')) + '">' +
      esc(C.contact.phone) + '</a></li>' +
      '        <li><a href="mailto:' + esc(C.contact.email) + '">' +
      esc(C.contact.email) + '</a></li>' +
      '        <li><a href="' + esc(waLink(C.contact.whatsappMessage)) + '" ' +
      'target="_blank" rel="noopener">' + esc(C.contact.whatsappLabel) + '</a></li>' +
      '        <li class="plain">' + C.contact.addressLines.map(esc).join('<br>') + '</li>' +
      '      </ul>' +
      '    </div>' +
      '  </div>' +
      '  <div class="foot-legal">' +
      '    <p>' + f.legal + '</p>' +
      '    <p class="demo">' + esc(C.meta.demoNotice) + '</p>' +
      '  </div>' +
      '</div>';
  }

  function renderWhatsApp() {
    el('wa-fab').innerHTML =
      '<a class="wa-link" href="' + esc(waLink(C.contact.whatsappMessage)) + '" ' +
      'target="_blank" rel="noopener">' + icon('chat') +
      '<span>' + esc(C.contact.whatsappLabel) + '</span></a>';
  }

  function renderAll() {
    renderHeader();
    renderHero();
    renderRooms();
    renderDining();
    renderWellness();
    renderGallery();
    renderReviews();
    renderLocation();
    renderFooter();
    renderWhatsApp();
  }

  /* ======================================================================
   * Interaction
   * ==================================================================== */

  function readForm() {
    var ci = el('checkin').value;
    var co = el('checkout').value;
    var guests = Number(el('guests').value);
    var msg = el('bookerr');
    var a = parseDate(ci), b = parseDate(co);

    if (!a || !b) { msg.textContent = 'Please choose both dates.'; msg.className = 'bookbar-msg bad'; return null; }
    var nights = nightsBetween(ci, co);
    if (nights < 1) { msg.textContent = 'Check-out must be after check-in.'; msg.className = 'bookbar-msg bad'; return null; }
    if (nights > C.booking.maxNights) {
      msg.textContent = 'Stays of up to ' + C.booking.maxNights + ' nights — please call us for longer.';
      msg.className = 'bookbar-msg bad'; return null;
    }
    msg.textContent = '';
    msg.className = 'bookbar-msg';
    return { checkIn: ci, checkOut: co, guests: guests, nights: nights };
  }

  function onBookingSubmit(ev) {
    ev.preventDefault();
    var next = readForm();
    if (!next) return;
    state.checkIn = next.checkIn;
    state.checkOut = next.checkOut;
    state.guests = next.guests;
    paintRooms();

    var msg = el('bookerr');
    var fits = C.rooms.filter(function (r) {
      return state.guests <= r.maxGuests;
    });
    var open = fits.filter(function (r) {
      return availability(r, state.checkIn, state.checkOut, state.guests).state !== 'soldout';
    });
    var range = prettyRange(state.checkIn, state.checkOut);

    if (open.length) {
      msg.textContent = open.length + ' of ' + C.rooms.length +
        ' room types are open for ' + range + '.';
      msg.className = 'bookbar-msg good';
    } else if (!fits.length) {
      // A party larger than any single room should be offered a way forward
      // rather than a dead end.
      msg.innerHTML = 'No single room sleeps ' + state.guests +
        ' guests. <a href="' + esc(waLink('Hello ' + C.brand.name +
          '. We are ' + state.guests + ' guests for ' + range +
          ' and no single room fits us. Can you suggest two rooms?')) +
        '" target="_blank" rel="noopener">Chat to book</a> and we will pair two rooms.';
      msg.className = 'bookbar-msg note';
    } else {
      msg.textContent = 'Everything is taken for ' + range +
        '. Try other dates, or ask us to find you something.';
      msg.className = 'bookbar-msg note';
    }

    var target = el('rooms');
    if (target && !target.dataset.seen) {
      target.dataset.seen = '1';
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function openRoomDetails(id) {
    var room = C.rooms.filter(function (r) { return r.id === id; })[0];
    if (!room) return;
    var avail = availability(room, state.checkIn, state.checkOut, state.guests);
    var badge = badgeFor(room, avail);
    var nights = Math.max(1, nightsBetween(state.checkIn, state.checkOut));
    var dlg = el('room-dialog');

    dlg.innerHTML =
      '<button type="button" class="dlg-close" id="dlg-close" aria-label="Close">' +
      icon('close') + '</button>' +
      '<div class="dlg-grid">' +
      '  ' + imgTag(room.image, room.imageAlt, { w: 1200, h: 800, sizes: IMG_SIZES.dialog }) +
      '  <div class="dlg-copy">' +
      '    <p class="eyebrow">' + esc(room.size) + ' · ' + esc(room.bed) + '</p>' +
      '    <h2>' + esc(room.name) + '</h2>' +
      '    <p>' + esc(room.description) + '</p>' +
      '    <dl class="dlg-specs">' +
      '      <div><dt>Size</dt><dd>' + esc(room.size) + '</dd></div>' +
      '      <div><dt>Bed</dt><dd>' + esc(room.bed) + '</dd></div>' +
      '      <div><dt>Sleeps</dt><dd>Up to ' + room.maxGuests + ' guests</dd></div>' +
      '      <div><dt>Rooms of this type</dt><dd>' + room.inventory + '</dd></div>' +
      '    </dl>' +
      '    <p class="dlg-stay">' + esc(prettyRange(state.checkIn, state.checkOut)) +
      ' · ' + nightsWord(nights) + '</p>' +
      '    <span class="badge ' + badge.cls + '">' + esc(badge.text) + '</span>' +
      '    <p class="dlg-price">' + money(room.pricePerNight) +
      '      <small>per night</small></p>' +
      '    <p class="dlg-total">' + money(stayTotal(room, state.checkIn, state.checkOut)) +
      '      <small>total for ' + nightsWord(nights) + ', before any extras</small></p>' +
      '    <div class="dlg-acts">' +
      (avail.state === 'soldout'
        ? '<a class="btn primary" href="' + esc(waLink(
            'Hello ' + C.brand.name + '. Please add me to the waiting list for the ' +
            room.name + ' for ' + prettyRange(state.checkIn, state.checkOut) + '.')) +
          '" target="_blank" rel="noopener">Join the waitlist</a>'
        : avail.state === 'small'
          ? '<span class="btn ghost disabled" aria-disabled="true">Sleeps up to ' +
            room.maxGuests + ' guests</span>'
          : '<a class="btn primary" href="' + esc(waLink(bookMessage(room))) +
            '" target="_blank" rel="noopener">Book this room</a>') +
      '      <a class="btn ghost" href="' + esc(waLink(
            'Hello ' + C.brand.name + '. I have a question about the ' + room.name + '.')) +
      '" target="_blank" rel="noopener">Ask a question</a>' +
      '    </div>' +
      '    <p class="dlg-note">' + esc(C.meta.demoNotice) + '</p>' +
      '  </div>' +
      '</div>';

    dlg.showModal();
    el('dlg-close').addEventListener('click', function () { dlg.close(); });
  }

  function initGallery() {
    var images = C.gallery.images;
    var dlg = el('lightbox');
    if (!dlg) return;
    var index = 0;

    function show(i) {
      index = (i + images.length) % images.length;
      el('lb-img').src = images[index].image;
      el('lb-img').alt = images[index].alt;
      el('lb-cap').textContent = images[index].caption +
        '  ·  ' + (index + 1) + ' / ' + images.length;
    }

    el('gallery-grid').addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-shot]');
      if (!btn) return;
      show(Number(btn.dataset.shot));
      dlg.showModal();
    });
    el('lb-close').addEventListener('click', function () { dlg.close(); });
    el('lb-prev').addEventListener('click', function () { show(index - 1); });
    el('lb-next').addEventListener('click', function () { show(index + 1); });
    dlg.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); show(index - 1); }
      if (ev.key === 'ArrowRight') { ev.preventDefault(); show(index + 1); }
    });
    // clicking the backdrop closes
    dlg.addEventListener('click', function (ev) {
      var r = dlg.getBoundingClientRect();
      var outside = ev.clientX < r.left || ev.clientX > r.right ||
        ev.clientY < r.top || ev.clientY > r.bottom;
      if (outside) dlg.close();
    });
  }

  function initDelegates() {
    document.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-details]');
      if (btn) openRoomDetails(btn.dataset.details);
    });

    document.addEventListener('submit', function (ev) {
      if (ev.target && ev.target.id === 'bookform') onBookingSubmit(ev);
    });

    var ci = el('checkin'), co = el('checkout');
    if (ci && co) {
      var sync = function () { co.min = ci.value; };
      ci.addEventListener('change', sync);
      sync();
    }
  }

  /* The header wraps differently at each width (the phone nav takes two rows),
   * and section anchors use --header-h as their scroll offset. Measure the real
   * height and keep the variable in step, so a jump to #rooms never lands under
   * the sticky header. */
  function initHeaderHeight() {
    var header = document.querySelector('.site-header');
    if (!header) return;
    var root = document.documentElement;
    var last = '';
    function sync() {
      var h = Math.round(header.getBoundingClientRect().height);
      if (!h) return;
      var next = h + 'px';
      if (next === last) return;
      last = next;
      root.style.setProperty('--header-h', next);
    }
    sync();
    window.addEventListener('resize', sync);
    window.addEventListener('load', sync);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sync).catch(function () {});
  }

  function initActiveNav() {
    if (!('IntersectionObserver' in window)) return;
    var links = Array.prototype.slice.call(document.querySelectorAll('#nav a'));
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove('on'); });
        var a = byId[e.target.id];
        if (a) a.classList.add('on');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['rooms', 'dining', 'wellness', 'gallery', 'reviews', 'location'].forEach(function (id) {
      var s = el(id);
      if (s) obs.observe(s);
    });
  }

  function initReveal() {
    var reduce = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) {
      document.documentElement.classList.add('no-reveal');
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    var targets = document.querySelectorAll(
      '.sec-head, .card, .venue, .facility, .shot, .review, .loc-map, .loc-side, ' +
      '.wellness-lead, .wellness-foot, .rooms-footnote, .stay-line'
    );
    Array.prototype.forEach.call(targets, function (n) {
      n.classList.add('reveal');
      obs.observe(n);
    });
  }

  /* ======================================================================
   * Boot
   * ==================================================================== */

  function boot() {
    applyTheme();
    renderAll();
    initDelegates();
    initGallery();
    initActiveNav();
    initHeaderHeight();
    initReveal();
    initImageFallback();
    document.documentElement.classList.add('ready');
    // When this page is shown inside the presentation showcase's frames, tell it
    // we are up. The showcase dims its loading overlay on this message as well as
    // on the frame's load event, because some browsers can lose that load event.
    if (window !== window.top) {
      try { parent.postMessage({ oyako: 'ready' }, '*'); } catch (e) { /* not framed */ }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
