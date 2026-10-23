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
      'LOCATION:Москва',
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
