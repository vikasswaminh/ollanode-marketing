import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// Static marketing site → Cloudflare Pages (ollanode.com + www).
export default defineConfig({
  site: 'https://ollanode.com',
  integrations: [tailwind()],
  output: 'static',
});
