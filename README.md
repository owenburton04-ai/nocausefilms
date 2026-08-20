# No Cause Films

Website for No Cause Films (Mckay Meacham), wedding filmmaker. Plain static
HTML, CSS, and vanilla JS. No build step, no framework, no third-party embeds.

## Why it is built this way

The previous site was on Pixieset, which meant the films had to be YouTube
embeds. Every video here is self-hosted so playback is seamless: no YouTube
branding, no "Watch on YouTube", no external requests of any kind.

## Pages

| Path | Page |
| --- | --- |
| `/` | Home: hero film, four films, about, investment |
| `/wedding-deck/` | Pricing and packages. Unlinked from the nav, reachable by URL |
| `/faqs/` | FAQs |
| `/contact/` | Inquire. Only linked from the buttons at the end of a page |

The nav is deliberately down to FAQs and the wordmark: Mckay wants someone to
read the whole homepage before the Inquire button appears.

## Video setup

Three layers, picked by job:

- **Hero** is a muted progressive loop (`.webm` with an `.mp4` fallback for
  Safari) behind a poster image, so the first paint is instant. It autoplays
  immediately and is the only video on the page that does.
- **Films section** shows four silent ~30s loops (`loop-*.mp4`), all
  normalised to 4:3 960x720, in a four-across grid. Nothing autoplays: a
  preview runs while the pointer is over its tile, and on a touch screen the
  first tap plays it while a second tap on the same tile opens the full film.
  The scroll observer only preloads what is coming up and pauses what has
  left, so the first hover is never a dead frame.
  Each tile's cover is a separate `loop-*-poster.webp` layered over the video
  that fades out on the first `playing` event. Covers are hand-picked frames
  from the full films, deliberately NOT the loops' first frames, and the fade
  is what keeps that from reading as a glitch when playback starts.
  Loop windows were picked deliberately: both full-length films
  carry burned-in subtitles and title cards through most of their runtime, so
  the loops come from the stretches that do not (the reception in *Feel So
  Young*, the exit and golden hour in *Chanson d'automne*).
- **Full films** open in a lightbox with sound. The two 6.5-minute films are
  **HLS**: ffmpeg splits them into 6-second segments so a viewer only streams
  the part they actually watch instead of pulling ~60MB up front. Safari plays
  HLS natively; every other browser loads `hls.js`, fetched on demand the
  first time someone opens a film.

Nothing downloads until it is needed (`preload="none"` plus deferred sources).

### Two things that will bite if you touch the CSS

- `img` needs `height: auto`. The markup carries `width`/`height` attributes,
  so `max-width: 100%` alone shrinks the width but keeps the attribute height.
  That is what made the 2500x3750 portrait render thousands of pixels tall.
- `.reveal` is hidden only under a `.js` class, set by an inline script before
  paint. Without that gate, a script error or a browser with no
  IntersectionObserver leaves the page permanently blank.

### Re-encoding a video

Sources are downloaded with `yt-dlp` into `assets-src/` (gitignored). YouTube
serves VP9 and AV1 with Opus audio, which Safari does not reliably play, so an
H.264/AAC mp4 is always produced.

Short clip (mp4 + webm + poster):

```bash
ffmpeg -i assets-src/INPUT.mp4 -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 128k assets/video/NAME.mp4
```

Full-length film (HLS ladder):

```bash
ffmpeg -i assets-src/INPUT.mp4 -vf scale=-2:720 -c:v libx264 -crf 27 -maxrate 1600k -bufsize 3200k -preset slow -pix_fmt yuv420p -force_key_frames "expr:gte(t,n_forced*6)" -c:a aac -b:a 128k -f hls -hls_time 6 -hls_playlist_type vod -hls_segment_filename "assets/video/NAME/seg_%03d.ts" assets/video/NAME/index.m3u8
```

Then point the `<figure data-film data-hls="/assets/video/NAME/index.m3u8">` at
the new playlist.

## Local preview

```bash
python3 -m http.server 4321
```

## Deploy

Vercel, static. `vercel.json` sets clean URLs and the cache and content-type
headers the HLS segments need.

## Notes

- Fonts: Geist, self-hosted in `assets/fonts/` (no Google Fonts request).
- The homepage plays a short wordmark splash once per browser session
  (`sessionStorage` key `ncf-intro`), skipped for `prefers-reduced-motion`.
- `/contact/` embeds Mckay's own **HoneyBook** contact form (placement
  `6a2ed9c8455fab2ae55f2ff7`), the same one his live site runs, so inquiries
  land in HoneyBook and nothing here needs a backend. The widget sets the
  iframe height over postMessage starting from 0; `main.js` falls back to the
  height on the element if that handshake never lands, so a failed resize
  cannot leave the page looking empty.
- Video quality is limited by what YouTube re-encodes. Swapping in Mckay's
  original exports will look noticeably better.
