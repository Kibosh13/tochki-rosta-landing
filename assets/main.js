(function () {
  'use strict';

  var CONFIG = {
    endpoint: 'send.php',                       // обработчик формы
    eventStart: '2026-11-26T15:00:00+03:00',    // МСК
    eventEnd:   '2026-11-26T20:00:00+03:00'
  };

  /* ---------- header on scroll ---------- */
  var header = document.querySelector('.header');
  function onScroll() { header.classList.toggle('is-scrolled', window.scrollY > 20); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- countdown ---------- */
  var cd = document.getElementById('countdown');
  var start = new Date(CONFIG.eventStart).getTime();
  function pad(n) { return String(n).padStart(2, '0'); }
  function tick() {
    var diff = start - Date.now();
    if (diff <= 0) { cd.style.display = 'none'; return; }
    var d = Math.floor(diff / 864e5), h = Math.floor(diff / 36e5) % 24, m = Math.floor(diff / 6e4) % 60;
    cd.querySelector('[data-cd="d"]').textContent = pad(d);
    cd.querySelector('[data-cd="h"]').textContent = pad(h);
    cd.querySelector('[data-cd="m"]').textContent = pad(m);
  }
  tick(); setInterval(tick, 30000);

  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE_POINTER = window.matchMedia && window.matchMedia('(pointer: fine)').matches;

  /* ---------- hero: заголовок по словам ---------- */
  (function splitTitle() {
    var title = document.querySelector('.hero__title');
    if (!title) return;
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var w = document.createElement('span');
            w.className = 'w'; w.style.setProperty('--i', i++); w.textContent = part;
            frag.appendChild(w);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') { walk(n); }
      });
    })(title);
  })();

  /* ---------- hero: живая сетка точек ---------- */
  (function heroDots() {
    var hero = document.querySelector('.hero');
    if (!hero || !window.HTMLCanvasElement) return;
    var canvas = document.createElement('canvas');
    canvas.className = 'hero__canvas';
    canvas.setAttribute('aria-hidden', 'true');
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    hero.insertBefore(canvas, hero.firstChild);
    hero.classList.add('has-canvas');

    var GAP = 28, R = 1.2, MOUSE_R = 150;
    var W = 0, H = 0, dpr = 1, dots = [], sparks = [];
    var mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, active: false };
    var running = false, visible = true, raf = 0, lastSpark = 0;

    function resize() {
      var r = hero.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = [];
      var cols = Math.ceil(W / GAP) + 1, rows = Math.ceil(H / GAP) + 1;
      for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
        var px = x * GAP + GAP / 2, py = y * GAP + GAP / 2;
        // маска-эллипс, как у прежнего фона: ярче справа сверху
        var ex = (px / W - .7) / .8, ey = (py / H - .4) / .7;
        var m = 1 - Math.min(1, Math.sqrt(ex * ex + ey * ey));
        m = Math.max(.08, Math.min(1, m * 1.6));
        dots.push({ x: px, y: py, m: m, glow: 0 });
      }
      if (!running) draw(performance.now());
    }

    function spark(t) {
      // случайная «точка роста» вспыхивает синим
      var d = dots[(Math.random() * dots.length) | 0];
      if (d && d.m > .35) sparks.push({ d: d, born: t });
    }

    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      mouse.x += (mouse.tx - mouse.x) * .15;
      mouse.y += (mouse.ty - mouse.y) * .15;
      var time = t / 1000;
      if (!REDUCED && t - lastSpark > 260) { spark(t); lastSpark = t; }

      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        var wave = REDUCED ? .5 : (Math.sin(time * 1.2 + d.x * .012 + d.y * .018) + 1) / 2;
        var a = (.07 + wave * .12) * d.m;
        var r = R, x = d.x, y = d.y, blue = 0;
        if (mouse.active) {
          var dx = d.x - mouse.x, dy = d.y - mouse.y, dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MOUSE_R) {
            var k = 1 - dist / MOUSE_R; k = k * k;
            var push = k * 10;
            x += dx / (dist || 1) * push; y += dy / (dist || 1) * push;
            a = Math.max(a, .2 + k * .75);
            r = R + k * 1.8;
            blue = k;
          }
        }
        if (blue > .02) {
          ctx.fillStyle = 'rgba(' + Math.round(255 - 190 * blue) + ',' + Math.round(255 - 100 * blue) + ',255,' + a.toFixed(3) + ')';
        } else {
          ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
        }
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
      }

      // вспышки
      for (var s = sparks.length - 1; s >= 0; s--) {
        var sp = sparks[s], life = (t - sp.born) / 2200;
        if (life >= 1) { sparks.splice(s, 1); continue; }
        var e = Math.sin(life * Math.PI);
        var rise = life * 14;
        ctx.fillStyle = 'rgba(65,155,255,' + (e * .9 * sp.d.m + .1).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(sp.d.x, sp.d.y - rise, 1.6 + e * 2.2, 0, 6.2832); ctx.fill();
        ctx.fillStyle = 'rgba(65,155,255,' + (e * .18).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(sp.d.x, sp.d.y - rise, 4 + e * 6, 0, 6.2832); ctx.fill();
      }

      if (running) raf = requestAnimationFrame(draw);
    }

    function start() { if (REDUCED || running || !visible || document.hidden) return; running = true; raf = requestAnimationFrame(draw); }
    function stop() { running = false; cancelAnimationFrame(raf); }

    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      mouse.tx = e.clientX - r.left; mouse.ty = e.clientY - r.top;
      if (!mouse.active) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
      mouse.active = true;
    });
    hero.addEventListener('pointerleave', function () { mouse.active = false; });

    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 120); });
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; visible ? start() : stop(); }).observe(hero);
    }
    resize(); start();
  })();

  /* ---------- hero: параллакс композиции ---------- */
  (function heroParallax() {
    var hero = document.querySelector('.hero'), art = document.querySelector('.art');
    if (!hero || !art || REDUCED || !FINE_POINTER) return;
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
      art.style.setProperty('--px', px.toFixed(3)); art.style.setProperty('--py', py.toFixed(3));
      art.style.setProperty('--rx', (px * 10).toFixed(2) + 'deg'); art.style.setProperty('--ry', (-py * 8).toFixed(2) + 'deg');
    });
    hero.addEventListener('pointerleave', function () {
      ['--px', '--py', '--rx', '--ry'].forEach(function (k) { art.style.removeProperty(k); });
    });
  })();

  /* ---------- bento: подсветка за курсором ---------- */
  if (FINE_POINTER) {
    document.querySelectorAll('.bento__item').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* ---------- таймлайн: прогресс при скролле ---------- */
  (function timelineProgress() {
    var tl = document.querySelector('.timeline');
    if (!tl) return;
    var items = tl.querySelectorAll('.tl');
    var ticking = false;
    function update() {
      ticking = false;
      var line = window.innerHeight * .6;
      var r = tl.getBoundingClientRect();
      var p = Math.max(0, Math.min(1, (line - r.top - 20) / (r.height - 40)));
      tl.style.setProperty('--p', p.toFixed(4));
      items.forEach(function (it) {
        var n = it.querySelector('.tl__node').getBoundingClientRect();
        it.classList.toggle('is-passed', n.top + n.height / 2 < line);
      });
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  })();

  /* ---------- reveal on scroll ---------- */
  var revealEls = document.querySelectorAll('.section__head, .about__intro, .topics li, .card, .bento__item, .tl, .reg__info, .form, .contact');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: .12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el, i) {
      el.classList.add('reveal');
      el.style.transitionDelay = ((i % 4) * 70) + 'ms';
      io.observe(el);
    });
  }

  /* ---------- phone mask +7 (XXX) XXX-XX-XX ---------- */
  var phone = document.getElementById('f-phone');
  function digitsOf(v) {
    var d = v.replace(/\D/g, '');
    if (/^\s*\+7/.test(v)) d = d.slice(1);                        // уже есть префикс +7
    else if (d[0] === '8' || d[0] === '7') d = d.slice(1);        // ввод/вставка с 8 или 7
    if (d.length > 10 && (d[0] === '8' || d[0] === '7')) d = d.slice(1); // набрали «+7 (8916…» — лишняя 8
    return d.slice(0, 10);
  }
  function formatPhone(d) {
    if (!d.length) return '';
    var out = '+7 (' + d.slice(0, 3);
    if (d.length >= 3) out += ') ' + d.slice(3, 6);
    if (d.length >= 6) out += '-' + d.slice(6, 8);
    if (d.length >= 8) out += '-' + d.slice(8, 10);
    return out;
  }
  phone.addEventListener('input', function () { phone.value = formatPhone(digitsOf(phone.value)); });
  phone.addEventListener('focus', function () { if (!phone.value) phone.value = '+7 ('; });
  phone.addEventListener('blur', function () { if (digitsOf(phone.value).length === 0) phone.value = ''; });
  phone.addEventListener('keydown', function (e) {
    // Backspace по служебным символам маски
    if (e.key === 'Backspace' && /[\s()\-]$/.test(phone.value) && phone.selectionStart === phone.value.length) {
      e.preventDefault();
      var d = digitsOf(phone.value);
      phone.value = formatPhone(d.slice(0, -1)) || '+7 (';
    }
  });

  /* ---------- validation ---------- */
  var form = document.getElementById('regForm');
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var rules = {
    first_name: function (v) { return v.trim().length > 0; },
    last_name:  function (v) { return v.trim().length > 0; },
    email:      function (v) { return EMAIL_RE.test(v.trim()); },
    phone:      function (v) { return digitsOf(v).length === 10; }
  };
  function validateField(input) {
    var rule = rules[input.name];
    if (!rule) return true;
    var ok = rule(input.value);
    input.closest('.field').classList.toggle('is-invalid', !ok);
    input.setAttribute('aria-invalid', String(!ok));
    return ok;
  }
  var agree = document.getElementById('f-agree');
  function validateAgree() {
    var ok = agree.checked;
    agree.closest('.check').classList.toggle('is-invalid', !ok);
    return ok;
  }
  Object.keys(rules).forEach(function (name) {
    var input = form.elements[name];
    input.addEventListener('blur', function () { if (input.value) validateField(input); });
    input.addEventListener('input', function () {
      if (input.closest('.field').classList.contains('is-invalid')) validateField(input);
    });
  });
  agree.addEventListener('change', validateAgree);

  /* ---------- submit ---------- */
  var btn = document.getElementById('submitBtn');
  var status = document.getElementById('formStatus');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.textContent = '';
    var ok = true, firstBad = null;
    Object.keys(rules).forEach(function (name) {
      var input = form.elements[name];
      if (!validateField(input)) { ok = false; firstBad = firstBad || input; }
    });
    if (!validateAgree()) { ok = false; firstBad = firstBad || agree; }
    if (!ok) { firstBad.focus({ preventScroll: false }); return; }

    var data = new FormData(form);
    data.set('agree', '1');
    data.set('page', location.href);

    btn.classList.add('is-loading');

    // Демо-режим (локально или на GitHub Pages, где нет PHP) — сразу показываем модалку
    if (location.protocol === 'file:' || /\.github\.io$/.test(location.hostname)) {
      setTimeout(function () { done(data.get('email')); }, 600);
      return;
    }

    fetch(CONFIG.endpoint, { method: 'POST', body: data, headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
      .then(function (res) {
        if (res && res.ok) done(data.get('email'));
        else fail(res && res.error);
      })
      .catch(function () { fail(); });
  });

  function done(email) {
    btn.classList.remove('is-loading');
    form.reset();
    phone.value = '';
    document.getElementById('modalEmail').textContent = email;
    openModal();
    if (window.ym && window.YM_ID) { try { window.ym(window.YM_ID, 'reachGoal', 'registration'); } catch (e) {} }
  }
  function fail(msg) {
    btn.classList.remove('is-loading');
    status.textContent = msg || 'Не удалось отправить заявку. Попробуйте ещё раз или напишите на welcome@digitali.ru';
  }

  /* ---------- modal ---------- */
  var modal = document.getElementById('successModal');
  var lastFocus = null;
  function openModal() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modal.querySelector('#addCalendar').focus();
  }
  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  modal.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  /* ---------- add to calendar (.ics) ---------- */
  document.getElementById('addCalendar').addEventListener('click', function () {
    function stamp(iso) { return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
    var ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DIGITALI//Digital Meetup//RU', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:tochki-rosta-2026@digitali.ru',
      'DTSTAMP:' + stamp(new Date().toISOString()),
      'DTSTART:' + stamp(CONFIG.eventStart),
      'DTEND:' + stamp(CONFIG.eventEnd),
      'SUMMARY:Точки роста: Digital Meetup',
      'DESCRIPTION:Как находить новые возможности для роста в performance и digital-рекламе — на реальных кейсах бизнеса. DIGITALI × Hybrid.',
      'LOCATION:Москва\\, Усачёва ул.\\, 11Б (офис Hybrid)',
      'URL:' + location.origin + location.pathname,
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tochki-rosta-digital-meetup.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
})();
