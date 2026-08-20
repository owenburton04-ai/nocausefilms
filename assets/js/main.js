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
    // outlives the 1.15s panel fade plus the delayed mark fade
    setTimeout(function () { intro.remove(); }, 1400);
  };

  var timer = setTimeout(finish, 1900);
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
  // Started right away rather than on window load: the intro splash runs for
  // ~2.4s over the top, and the reveal should land on footage that is already
  // moving instead of cutting from a still poster to a video that just began.
  hero.querySelectorAll('source[data-src]').forEach(function (s) {
    s.src = s.dataset.src;
  });
  hero.load();
  hero.play().catch(function () {});
})();

// ---------------------------------------------------------------------------
// Films: each tile holds a short silent preview loop. Nothing plays on its
// own. On a mouse, hovering a tile plays its preview; on a touch screen the
// first tap plays it and a second tap on the same tile opens the full film
// with sound.
// ---------------------------------------------------------------------------
(function () {
  var rows = [].slice.call(document.querySelectorAll('[data-film]'));
  if (!rows.length) return;

  var lightbox = document.getElementById('lightbox');
  var lbVideo = lightbox ? lightbox.querySelector('.lightbox-video') : null;
  var lbClose = lightbox ? lightbox.querySelector('.lightbox-close') : null;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  // On touch, the tile whose preview is currently running. A second tap on it
  // is what opens the full film.
  var activeRow = null;

  // --- previews ----------------------------------------------------------
  var primed = function (video) {
    if (video.dataset.primed) return;
    video.dataset.primed = '1';
    video.querySelectorAll('source[data-src]').forEach(function (s) {
      s.src = s.dataset.src;
    });
    video.load();
  };

  var loops = rows.map(function (r) { return r.querySelector('.film-loop'); });

  // The cover image fades out the first time a preview actually renders
  // frames, so the tile never hard-cuts from the cover to the loop.
  loops.forEach(function (v, i) {
    v.addEventListener('playing', function () {
      rows[i].classList.add('is-playing');
    }, { once: true });
  });

  var playOnly = function (video) {
    loops.forEach(function (v) {
      if (v !== video) {
        v.pause();
        v.currentTime = 0;
      }
    });
    primed(video);
    video.play().catch(function () {});
  };

  // Preload on approach so the first hover or tap is not a dead frame, and
  // stop anything that scrolls away. Playback itself is only ever started by
  // the visitor, so there is no autoplay failsafe to add here.
  if (!reduced && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          primed(e.target);
          return;
        }
        e.target.pause();
        // A tile that scrolls away loses its first tap, so coming back to it
        // starts the preview again rather than jumping straight to the film.
        if (activeRow && activeRow.contains(e.target)) activeRow = null;
      });
      // threshold 0 rather than a fraction: a tile taller than the viewport
      // can never reach a high ratio, so a fractional threshold risks never
      // firing at all.
    }, { rootMargin: '200px 0px', threshold: 0 });
    loops.forEach(function (v) { io.observe(v); });
  }

  if (canHover) {
    rows.forEach(function (row, i) {
      var media = row.querySelector('.film-media');
      if (!media) return;
      media.addEventListener('mouseenter', function () {
        if (document.body.classList.contains('lightbox-open')) return;
        playOnly(loops[i]);
      });
      media.addEventListener('mouseleave', function () {
        loops[i].pause();
      });
    });
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
    // Previews only ever run from a hover or a tap now, so nothing resumes
    // on its own here.
    activeRow = null;
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

  // On a mouse the preview is already running under the cursor, so a click
  // goes straight to the film. On a touch screen the first tap has to stand
  // in for the hover, so it starts the preview and only a second tap on the
  // same tile opens the player.
  rows.forEach(function (row, i) {
    var btn = row.querySelector('.film-open');
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (canHover || activeRow === row) {
        open(row);
        return;
      }
      activeRow = row;
      playOnly(loops[i]);
    });
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
// Mobile menu: the hamburger swaps the nav links for a full-screen list.
// ---------------------------------------------------------------------------
(function () {
  var toggle = document.querySelector('.menu-toggle');
  var menu = document.getElementById('site-menu');
  if (!toggle || !menu) return;
  var closeBtn = menu.querySelector('.menu-close');

  var setOpen = function (open) {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('menu-open', open);
  };

  toggle.addEventListener('click', function () { setOpen(menu.hidden); });
  if (closeBtn) closeBtn.addEventListener('click', function () { setOpen(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !menu.hidden) setOpen(false);
  });
})();

// ---------------------------------------------------------------------------
// HoneyBook embed failsafe. The widget injects an iframe and then drives its
// height over postMessage, starting from 0. If that handshake never lands the
// form is left collapsed and the page looks empty, so fall back to the height
// the widget ships on the element.
// ---------------------------------------------------------------------------
(function () {
  var slot = document.querySelector('[class^="hb-p-"]');
  if (!slot) return;

  setTimeout(function () {
    var frame = slot.querySelector('iframe');
    if (!frame || frame.offsetHeight > 0) return;
    frame.style.height = (parseInt(frame.getAttribute('height'), 10) || 750) + 'px';
  }, 4000);
})();
