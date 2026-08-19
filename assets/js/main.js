// NO CAUSE FILMS — shared behavior

// Hero ambient video: sources are deferred via data-src so the poster
// paints first; swap them in once the page is interactive.
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

// Film players: poster cover with a play button; nothing downloads until
// clicked. Short teasers are plain progressive files. The two full-length
// films are HLS, so viewers only stream the part they actually watch.
// Playing one film pauses the others.
(function () {
  var films = document.querySelectorAll('[data-film]');

  // hls.js is ~400KB, so it is only fetched if someone actually opens a
  // full-length film. Safari never needs it.
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

  var useHlsJs = function (video, src) {
    return loadHlsLib().then(function () {
      if (window.Hls && window.Hls.isSupported()) {
        var hls = new window.Hls({ capLevelToPlayerSize: true });
        hls.loadSource(src);
        hls.attachMedia(video);
      } else {
        video.src = src; // last resort
      }
    });
  };

  var attachHls = function (video, src) {
    // Only WebKit really plays HLS natively. Chrome reports "maybe" for the
    // playlist MIME type and then fails, so the native path is gated on the
    // engine rather than on canPlayType alone, with hls.js as the fallback
    // if native playback errors anyway.
    var ua = navigator.userAgent;
    var isWebKit = /safari/i.test(ua) && !/chrome|chromium|crios|android|edg|fxios/i.test(ua);
    if (isWebKit && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener('error', function () { useHlsJs(video, src); }, { once: true });
      return Promise.resolve();
    }
    return useHlsJs(video, src);
  };

  films.forEach(function (film) {
    var cover = film.querySelector('.film-cover');
    var video = film.querySelector('video');
    if (!cover || !video) return;
    var hlsSrc = film.dataset.hls;
    var started = false;

    cover.addEventListener('click', function () {
      var ready = Promise.resolve();
      if (!started) {
        started = true;
        if (hlsSrc) {
          ready = attachHls(video, hlsSrc);
        } else {
          video.querySelectorAll('source[data-src]').forEach(function (s) {
            s.src = s.dataset.src;
          });
          video.load();
        }
      }
      cover.classList.add('is-hidden');
      video.setAttribute('controls', '');
      films.forEach(function (other) {
        var v = other.querySelector('video');
        if (v && v !== video) v.pause();
      });
      ready.then(function () {
        return video.play();
      }).catch(function () {});
    });
  });
})();

// Scroll reveal
(function () {
  var els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    els.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(function (el) { io.observe(el); });
})();
