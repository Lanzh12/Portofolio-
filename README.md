# LAMZ® — Personal Portfolio

A monochrome, editorial-style personal portfolio built with semantic HTML, plain CSS and vanilla JavaScript. The visual direction is intentionally typographic and graphic-led: no generated portrait, fake client work, invented credentials or fabricated experience.

## Project structure

```text
LAMZ-PORTFOLIO/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── script.js
├── assets/
│   ├── images/
│   │   ├── showcase-01.svg
│   │   ├── showcase-02.svg
│   │   ├── showcase-03.svg
│   │   ├── video-poster.svg
│   │   └── og-cover.svg
│   ├── icons/
│   │   └── favicon.svg
│   └── media/
├── worker/
│   └── index.js
├── wrangler.toml
├── .assetsignore
├── .gitignore
└── README.md
```

## Run the static portfolio

You can open `index.html` directly, or serve the project locally from its root:

```bash
python -m http.server 8080
```

Then visit `http://localhost:8080`.

The portfolio, navigation, work-detail dialog, video fallback, social links and responsive layout run as a static site. The AI interface also opens in static preview mode, but model requests need the Cloudflare Worker described below.

## Enable LAMZ AI (Cloudflare Workers AI)

The chat uses the exact model IDs requested:

- Text: `@cf/qwen/qwen2.5-coder-32b-instruct`
- Vision: `@cf/llava-hf/llava-1.5-7b-hf`

The model calls happen inside `worker/index.js`, never in the browser. This keeps Cloudflare account credentials out of the public frontend. The worker includes a portfolio-specific system prompt, input limits, same-origin request checks, and image validation (JPG/PNG/WebP, up to 3 MB). For a public production deployment, add Cloudflare rate limiting or Turnstile protection to reduce automated abuse; origin checks alone are not a complete rate limiter.

1. Install Node.js and authenticate Wrangler with your Cloudflare account:

   ```bash
   npx wrangler login
   ```

2. From the project root, deploy the site and Worker together:

   ```bash
   npx wrangler deploy
   ```

3. Ensure Workers AI is enabled for your Cloudflare account. The included `wrangler.toml` declares the `AI` binding and static asset routing. The chat endpoint is `/api/chat` on the same origin as the portfolio.

4. Open the deployed site and test both a text prompt and an attached image.

Cloudflare Workers AI usage may be billable under your account's plan and usage. Do not add an API token, account secret or password to `js/script.js` or any other public asset.

### Vision model lifecycle note

As of 6 November 2026, Cloudflare's official model documentation marks `@cf/llava-hf/llava-1.5-7b-hf` as planned for deprecation on **15 November 2026**. It is retained here because it was explicitly requested. Before or after that date, check Cloudflare's current model catalogue and update `VISION_MODEL` in `worker/index.js` to a supported vision model if Cloudflare retires it.

## Replace the showcase placeholders

The three SVGs in `assets/images/` are clearly marked placeholder frames, not portfolio samples. To add original work:

1. Add your own optimized image (prefer WebP or AVIF) to `assets/images/`.
2. Update the matching `<img src="...">` and `alt` text in `index.html`.
3. Update the card's `data-title` and `data-description` attributes.
4. Keep image dimensions/aspect ratios flexible; the gallery uses `object-fit: cover` and responsive CSS.

You can duplicate a `.work-card` block to add more entries.

## Gift video

The gift section references the exact MP4 URL supplied for this project. It attempts muted autoplay with `playsinline` and `loop`; the in-design play/pause button is the fallback when autoplay is blocked. If the source host blocks embedding, is offline or changes the file, replace the `<source>` URL with a video you are permitted to use. No video is bundled or downloaded into this project.

## Music player

The player embeds the supplied track through Apple's official Music embed and also links to the exact Apple Music page. The embedded player owns its playback controls. A parent webpage cannot reliably operate an Apple Music iframe's play state, progress or volume from custom JavaScript because it is cross-origin; the project therefore does not show fake custom transport controls. Playback is user-initiated according to browser and Apple Music rules.

## External assets and privacy

- Fonts: Google Fonts (`Space Grotesk`, `DM Mono`).
- Brand and interface icons: Font Awesome CDN.
- Track playback: Apple Music official embed.
- Gift video: the supplied third-party MP4 URL.
- AI: Cloudflare Workers AI through the included Worker.

The site does not include analytics, trackers, a database, sign-in, or a collection of personal visitor data. The chat sends messages (and an optional attached image) to the included Cloudflare Worker for inference. Avoid sending sensitive information.

## Final checks

- Check all social links and the Apple Music destination after deployment.
- Verify the supplied video source loads on the target host; external media availability cannot be guaranteed by a static project.
- Deploy the Worker before expecting live AI answers. Text and vision requests consume Workers AI usage.
- Test keyboard navigation, reduced-motion settings and mobile layouts on actual devices.

© 2026 Lamz. All rights reserved.
