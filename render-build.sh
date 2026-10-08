#!/usr/bin/env bash
# exit on error
set -o errexit

# 1. पहले सारे पैकेजेस इंस्टॉल करें
npm install

# 2. Puppeteer के लिए सही तरीके से Chrome/Chromium ब्राउज़र डाउनलोड करें
npx puppeteer browsers install chrome
