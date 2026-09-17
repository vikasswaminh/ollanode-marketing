import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

// Static marketing site → Cloudflare Pages (ollanode.com + www).
export default defineConfig({
  site: 'https://ollanode.com',
  integrations: [tailwind(), sitemap()],
  output: 'static',
});
