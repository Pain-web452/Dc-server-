#!/usr/bin/env bash
# exit on error
set -o errexit

# Dependencies install करें
npm install

# Render के होम डायरेक्टरी में क्रोम इंस्टॉल करें (ताकि Absolute Path का एरर न आए)
echo "...Downloading Chrome to Absolute Path..."
PUPPETEER_CACHE_DIR=$HOME/.cache/puppeteer npx puppeteer browsers install chrome
