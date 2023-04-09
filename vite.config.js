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
    sourcemap: true,
    emptyOutDir: false, // important to add otherwise vite will remove the dist folder before run the second build
    lib: {
      entry: [
        path.resolve(__dirname, './src/index.ts'),
        path.resolve(__dirname, './src/node.ts'),
        path.resolve(__dirname, './src/vite.ts'),
        path.resolve(__dirname, './src/react-native.ts'),
      ],
      formats: ['cjs', 'es'],
    },
    rollupOptions: {
      external: ['virtual:fs'],
    }
  }
})
