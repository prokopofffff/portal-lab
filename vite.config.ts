import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    coverage: { include: ['src/**'], exclude: ['src/**/*.test.*', 'src/main.tsx'] },
    projects: [
      {
        extends: true,
        test: {
          name: 'domain',
          environment: 'node',
          include: ['src/domain/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['src/{app,ui}/**/*.test.{ts,tsx}'],
          setupFiles: ['src/test/setup.ts'],
        },
      },
    ],
  },
})
