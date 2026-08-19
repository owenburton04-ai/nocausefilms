// NO CAUSE FILMS — shared behavior

// ---------------------------------------------------------------------------
// Intro splash. The `intro-armed` class is set by an inline script in <head>
// before first paint; this only runs the exit animation and unlocks scroll.
// ---------------------------------------------------------------------------
(function () {
  var root = document.documentElement;
  var intro = document.getElementById('intro');
  if (!intro) return;

  if (!root.classList.contains('intro-armed')) {
    intro.remove();
    return;
  }

  var done = false;
  var finish = function () {
    if (done) return;
    done = true;
    try { sessionStorage.setItem('ncf-intro', '1'); } catch (e) {}
    intro.classList.add('is-leaving');
    root.classList.remove('intro-armed');
    setTimeout(function () { intro.remove(); }, 700);
  };

  var timer = setTimeout(finish, 2000);
  // let an impatient visitor skip it
  intro.addEventListener('click', function () {
    clearTimeout(timer);
    finish();
  });
})();

// ---------------------------------------------------------------------------
// Hero ambient video: sources are deferred via data-src so the poster
// paints first; swap them in once the page is interactive.
// ---------------------------------------------------------------------------
(function () {
  var hero = document.querySelector('[data-hero-video]');
  if (!hero) return;
  var load = function () {
    hero.querySelectorAll('source[data-src]').forEach(function (s) {
      s.src = s.dataset.src;
    });
    hero.load();
    hero.play().catch(function () {});
  };
  if (document.readyState === 'complete') load();
  else window.addEventListener('load', load);
})();

// ---------------------------------------------------------------------------
// Films: each row shows a short silent loop that starts when it scrolls into
// view and pauses when it leaves, so four autoplaying clips never cost four
// simultaneous downloads. Clicking one opens the full film with sound.
// ---------------------------------------------------------------------------
(function () {
  var rows = [].slice.call(document.querySelectorAll('[data-film]'));
  if (!rows.length) return;

  var lightbox = document.getElementById('lightbox');
  var lbVideo = lightbox ? lightbox.querySelector('.lightbox-video') : null;
  var lbClose = lightbox ? lightbox.querySelector('.lightbox-close') : null;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- loops -------------------------------------------------------------
  var primed = function (video) {
    if (video.dataset.primed) return;
    video.dataset.primed = '1';
    video.querySelectorAll('source[data-src]').forEach(function (s) {
      s.src = s.dataset.src;
    });
    video.load();
  };

  var loops = rows.map(function (r) { return r.querySelector('.film-loop'); });

  if (reduced) {
    // leave the posters showing rather than autoplaying anything
    loops.forEach(function (v) { v.setAttribute('poster', v.getAttribute('poster')); });
  } else if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          primed(v);
          if (!document.body.classList.contains('lightbox-open')) {
            v.play().catch(function () {});
          }
        } else {
          v.pause();
        }
      });
      // threshold 0 rather than a fraction: a row taller than the viewport can
      // never reach a high ratio, so a fractional threshold risks never firing.
    }, { rootMargin: '200px 0px', threshold: 0 });
    loops.forEach(function (v) { io.observe(v); });
  } else {
    loops.forEach(function (v) { primed(v); v.play().catch(function () {}); });
  }

  // --- lightbox ----------------------------------------------------------
  if (!lightbox || !lbVideo) return;

  var hlsLibPromise = null;
  var loadHlsLib = function () {
    if (hlsLibPromise) return hlsLibPromise;
    hlsLibPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = '/assets/js/hls.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return hlsLibPromise;
  };

  var hlsInstance = null;

  var useHlsJs = function (video, src) {
    return loadHlsLib().then(function () {
      if (window.Hls && window.Hls.isSupported()) {
        hlsInstance = new window.Hls({ capLevelToPlayerSize: true });
        hlsInstance.loadSource(src);
        hlsInstance.attachMedia(video);
      } else {
        video.src = src;
      }
    });
  };

  // Only WebKit really plays HLS natively. Chrome reports "maybe" for the
  // playlist MIME type and then fails, so the native path is gated on the
  // engine rather than on canPlayType alone.
  var attachHls = function (video, src) {
    var ua = navigator.userAgent;
    var isWebKit = /safari/i.test(ua) && !/chrome|chromium|crios|android|edg|fxios/i.test(ua);
    if (isWebKit && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener('error', function () { useHlsJs(video, src); }, { once: true });
      return Promise.resolve();
    }
    return useHlsJs(video, src);
  };

  var teardown = function () {
    lbVideo.pause();
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
    lbVideo.removeAttribute('src');
    while (lbVideo.firstChild) lbVideo.removeChild(lbVideo.firstChild);
    lbVideo.load();
  };

  var close = function () {
    lightbox.classList.add('is-closing');
    document.body.classList.remove('lightbox-open');
    teardown();
    setTimeout(function () {
      lightbox.hidden = true;
      lightbox.classList.remove('is-closing');
    }, 250);
    // resume whichever loops are back on screen
    if (!reduced) {
      loops.forEach(function (v) {
        var b = v.getBoundingClientRect();
        if (b.top < window.innerHeight && b.bottom > 0) v.play().catch(function () {});
      });
    }
  };

  var open = function (row) {
    loops.forEach(function (v) { v.pause(); });
    lightbox.classList.remove('is-closing');
    lightbox.hidden = false;
    document.body.classList.add('lightbox-open');

    lbVideo.setAttribute('aria-label', row.dataset.title || 'Film');

    var ready;
    if (row.dataset.fullHls) {
      ready = attachHls(lbVideo, row.dataset.fullHls);
    } else {
      // progressive teaser: webm first, mp4 fallback for Safari
      if (row.dataset.fullWebm) {
        var w = document.createElement('source');
        w.src = row.dataset.fullWebm;
        w.type = 'video/webm';
        lbVideo.appendChild(w);
      }
      var m = document.createElement('source');
      m.src = row.dataset.fullMp4;
      m.type = 'video/mp4';
      lbVideo.appendChild(m);
      lbVideo.load();
      ready = Promise.resolve();
    }

    ready.then(function () { return lbVideo.play(); }).catch(function () {});
  };

  rows.forEach(function (row) {
    var btn = row.querySelector('.film-open');
    if (btn) btn.addEventListener('click', function () { open(row); });
  });

  if (lbClose) lbClose.addEventListener('click', close);
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox || e.target.classList.contains('lightbox-stage')) close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !lightbox.hidden) close();
  });
})();

// ---------------------------------------------------------------------------
// Scroll reveal
// ---------------------------------------------------------------------------
(function () {
  var els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    els.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }
  var anyRevealed = false;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        anyRevealed = true;
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(function (el) { io.observe(el); });

  // Failsafe: content starts at opacity 0, so if the observer is present but
  // never delivers (it needs a render, which some embedded/background views
  // never do) the page would stay blank for good. Show everything instead.
  setTimeout(function () {
    if (!anyRevealed) {
      els.forEach(function (el) { el.classList.add('is-visible'); });
    }
  }, 3000);
})();

// ---------------------------------------------------------------------------
// Inquiry form. Not wired to a backend yet: this validates and shows the
// success state so the flow can be reviewed. Replace the marked block with a
// POST (Formspree / a Vercel route / Resend) when we route it for real.
// ---------------------------------------------------------------------------
(function () {
  var form = document.getElementById('inquiry-form');
  if (!form) return;
  var success = document.getElementById('inquiry-success');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.reportValidity()) return;

    // --- TODO: send the submission here -------------------------------
    // var data = new FormData(form);
    // fetch('<endpoint>', { method: 'POST', body: data })
    // -------------------------------------------------------------------

    form.hidden = true;
    if (success) {
      success.hidden = false;
      success.setAttribute('tabindex', '-1');
      success.focus();
    }
  });
})();
