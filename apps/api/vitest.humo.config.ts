import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/humo/**/*.test.ts'],
    environment: 'node',
  },
});
