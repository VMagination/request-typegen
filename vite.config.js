import path from 'path';
import {defineConfig} from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      outputDir: 'for',
      beforeWriteFile: (fp, content) => ({ filePath: fp.replace('src/', ''), content })
    })
  ],
  build: {
    outDir: 'for',
    sourcemap: false,
    emptyOutDir: false,
    lib: {
      entry: [
        path.resolve(__dirname, './src/index.ts'),
        path.resolve(__dirname, './src/node.ts'),
        path.resolve(__dirname, './src/vite.ts'),
        path.resolve(__dirname, './src/mock.ts'),
        path.resolve(__dirname, './src/react-native.ts'),
      ],
      formats: ['cjs', 'es'],
    },
    rollupOptions: {
      treeshake: 'recommended',
      external: ['virtual:fs', 'fs'],
    }
  }
})
