import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://blog.giraffe.ai.kr',
  output: 'static',
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});
