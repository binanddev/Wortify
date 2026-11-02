import base from './playwright.config.mjs';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: '**/clean-start.spec.mjs',
  retries: 0,
  timeout: 120000,
  webServer: {
    ...base.webServer,
    env: { E2E_CLEAN_START: '1' },
  },
});
