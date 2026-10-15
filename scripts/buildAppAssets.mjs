// builds the app icon, Android adaptive icon, splash image, and favicon from the pixel house in
// components/ui/pixel/pixelDrawings.js, so the icons can't drift from the logo the app draws
// run it with: npm run assets
// it writes new files next to the old ones in assets/ (the old ones stay), then points app.json at them,
// and every color (app.json's too) comes from theme.js so no hex gets typed by hand
// the Hearth pass: the pixel house is retired, the mark is a forest green line house (the same shape as the
// Ionicons home-outline the wordmark uses) on the warm paper, and the files are named hearth-*.png

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { COLORS } from '../theme.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const assets = path.join(root, 'assets');
const work = path.join(assets, '.build');

// the line house drawn in a 512 box (Ionicons home-outline), scaled to `fraction` of the canvas and centered
// stroke 32 of 512 is about 1.6 at 24, the same weight as the icons in the app
function lineHouse(size, fraction, color) {
  const scale = (size * fraction) / 512;
  const offset = (size - 512 * scale) / 2;
  const stroke =
    'fill="none" stroke="' +
    color +
    '" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"';
  return (
    '<g transform="translate(' +
    offset +
    ' ' +
    offset +
    ') scale(' +
    scale +
    ')">' +
    '<path d="M80 212v236a16 16 0 0016 16h96V328a24 24 0 0124-24h80a24 24 0 0124 24v136h96a16 16 0 0016-16V212" ' +
    stroke +
    '/>' +
    '<path d="M480 256L266.89 52c-5-5.28-16.69-5.34-21.78 0L32 256M400 179V64h-48v69" ' +
    stroke +
    '/>' +
    '</g>'
  );
}

function svg(size, body, background) {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    size +
    '" height="' +
    size +
    '" viewBox="0 0 ' +
    size +
    ' ' +
    size +
    '">' +
    (background ? '<rect width="100%" height="100%" fill="' + background + '"/>' : '') +
    body +
    '</svg>'
  );
}

// the fintech pass: the house is a small logomark on the soft indigo tint, no grid, and the splash sits on white
// the Hearth pass: the green line house on the paper for the icon, and on its own for the splash and Android layers
const outputs = [
  {
    file: 'hearth-icon.png',
    size: 1024,
    svg: svg(1024, lineHouse(1024, 0.56, COLORS.cta), COLORS.background),
  },
  {
    file: 'hearth-adaptive-foreground.png',
    size: 1024,
    // Android crops adaptive icons to a circle or squircle, so the house stays inside the middle 60%
    svg: svg(1024, lineHouse(1024, 0.5, COLORS.cta)),
    transparent: true,
  },
  {
    file: 'hearth-adaptive-background.png',
    size: 1024,
    svg: svg(1024, '', COLORS.background),
  },
  {
    file: 'hearth-adaptive-monochrome.png',
    size: 1024,
    svg: svg(1024, lineHouse(1024, 0.5, COLORS.text_light)),
    transparent: true,
  },
  {
    file: 'hearth-splash.png',
    size: 1024,
    svg: svg(1024, lineHouse(1024, 0.8, COLORS.cta)),
    transparent: true,
  },
  {
    file: 'hearth-favicon.png',
    size: 48,
    svg: svg(48, lineHouse(48, 0.72, COLORS.cta), COLORS.background),
  },
];

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

const chrome = findChrome();
if (!chrome) {
  console.log('Chrome was not found, set CHROME_PATH to build the icons.');
  process.exit(1);
}

fs.mkdirSync(work, { recursive: true });
outputs.forEach((output) => {
  const svg_path = path.join(work, output.file.replace('.png', '.svg'));
  fs.writeFileSync(svg_path, output.svg);
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--screenshot=' + path.join(assets, output.file),
    '--window-size=' + output.size + ',' + output.size,
  ];
  // a see-through background for the layers Android and the splash put on their own color
  if (output.transparent) {
    args.push('--default-background-color=00000000');
  }
  args.push('file://' + svg_path);
  execFileSync(chrome, args, { stdio: 'ignore' });
  console.log('Wrote assets/' + output.file);
});
fs.rmSync(work, { recursive: true, force: true });

// point app.json at the new files, the colors come from the theme
const app_json_path = path.join(root, 'app.json');
const app_json = JSON.parse(fs.readFileSync(app_json_path, 'utf8'));
const expo = app_json.expo;
expo.icon = './assets/hearth-icon.png';
expo.backgroundColor = COLORS.background;
expo.android = expo.android || {};
expo.android.adaptiveIcon = {
  backgroundColor: COLORS.background,
  foregroundImage: './assets/hearth-adaptive-foreground.png',
  backgroundImage: './assets/hearth-adaptive-background.png',
  monochromeImage: './assets/hearth-adaptive-monochrome.png',
};
expo.web = expo.web || {};
expo.web.favicon = './assets/hearth-favicon.png';
const splash = [
  'expo-splash-screen',
  {
    image: './assets/hearth-splash.png',
    imageWidth: 160,
    resizeMode: 'contain',
    backgroundColor: COLORS.background,
  },
];
expo.plugins = (expo.plugins || []).filter(
  (plugin) =>
    plugin !== 'expo-splash-screen' &&
    !(Array.isArray(plugin) && plugin[0] === 'expo-splash-screen'),
);
expo.plugins.push(splash);
fs.writeFileSync(app_json_path, JSON.stringify(app_json, null, 2) + '\n');
console.log('Updated app.json');
