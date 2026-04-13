import { defineConfig } from 'vite'
import webExtension from 'vite-plugin-web-extension'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  plugins: [
    webExtension(),
    viteStaticCopy({
      targets: [
        { src: 'icons', dest: '.' },
        { src: 'videos', dest: '.' },
      ],
    }),
  ],
})
