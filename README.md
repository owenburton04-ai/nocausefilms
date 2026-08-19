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
| `/wedding-deck/` | Pricing and packages |
| `/faqs/` | FAQs |
| `/contact/` | Inquire (email and phone) |

## Video setup

Two different strategies, picked by length:

- **Hero loop and short teasers** (under a minute) are plain progressive files,
  `.webm` first with an `.mp4` fallback for Safari. The hero is muted and
  autoplays behind a poster image so the first paint is instant.
- **The two full-length films** (about 6.5 minutes each) are **HLS**. ffmpeg
  splits them into 6-second segments and the browser only streams the part
  someone actually watches, instead of pulling a 60MB file up front. Safari
  plays HLS natively; every other browser loads `hls.js`, which is only
  fetched when a viewer actually opens a film.

Nothing downloads until clicked (`preload="none"` plus deferred sources).

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
- The inquire flow is a `mailto:` link, matching the current site, which has no
  form either. A real form can be added later.
- Video quality is limited by what YouTube re-encodes. Swapping in Mckay's
  original exports will look noticeably better.
