/* global process */
import { chromium } from 'playwright';
export const EXE =
  process.env.HOME +
  '/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
export const launch = () => chromium.launch({ executablePath: EXE });
