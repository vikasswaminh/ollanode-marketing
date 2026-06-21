# ollanode-marketing

Marketing site for **Ollanode** — self-hosted video infrastructure & CDN.
Astro + Tailwind, static, deployed to **Cloudflare Pages** at `ollanode.com` + `www`.

Sibling repos: dashboard `video-dashboard` (login.ollanode.com), backend `video-api-cdn`.

## Develop
```bash
npm install
npm run dev
```

## Build / deploy
```bash
npm run build          # → ./dist
```
Cloudflare Pages: build `npm run build`, output `dist`. Custom domains
`ollanode.com` and `www.ollanode.com`.

## Pages
- `/` landing (hero, features, how-it-works, CTA)
- `/pricing`

CTAs point to the dashboard at https://login.ollanode.com.
