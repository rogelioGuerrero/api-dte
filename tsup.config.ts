import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  target: 'node18',
  clean: true,
  outDir: 'dist',
  sourcemap: true,
  noExternal: [/@langchain/, /ansi-styles/],
  external: ['uuid']
});
