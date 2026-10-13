// builds the app icon, Android adaptive icon, splash image, and favicon from the pixel house in
// components/ui/pixel/pixelDrawings.js, so the icons can't drift from the logo the app draws
// run it with: npm run assets
// it writes new files next to the old ones in assets/ (the old ones stay), then points app.json at them,
// and every color (app.json's too) comes from theme.js so no hex gets typed by hand

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { drawings } from '../components/ui/pixel/pixelDrawings.js';
import { buildGrid, gridToRuns, gridSize } from '../components/ui/pixel/pixelHelpers.js';
import { COLORS } from '../theme.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const assets = path.join(root, 'assets');
const work = path.join(assets, '.build');

// the pixel squares of one drawing as svg rects, placed at x, y with each square `pixel` big
function drawingRects(name, x, y, pixel, solid_color) {
  const { grid, palette } = buildGrid(drawings[name]);
  return gridToRuns(grid)
    .map(
      (run) =>
        '<rect x="' +
        (x + run.x * pixel) +
        '" y="' +
        (y + run.y * pixel) +
        '" width="' +
        run.width * pixel +
        '" height="' +
        pixel +
        '" fill="' +
        (solid_color || COLORS[palette[run.index]]) +
        '"/>',
    )
    .join('');
}

// a drawing centered on a square canvas, pixel is picked so it fills `fraction` of the width
function centered(name, size, fraction, solid_color) {
  const { columns, rows } = gridSize(buildGrid(drawings[name]).grid);
  const pixel = Math.floor((size * fraction) / columns);
  const x = Math.round((size - columns * pixel) / 2);
  const y = Math.round((size - rows * pixel) / 2);
  return drawingRects(name, x, y, pixel, solid_color);
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
    '" shape-rendering="crispEdges">' +
    (background ? '<rect width="100%" height="100%" fill="' + background + '"/>' : '') +
    body +
    '</svg>'
  );
}

// the fintech pass: the house is a small logomark on the soft indigo tint, no grid, and the splash sits on white
const outputs = [
  {
    file: 'pixel-icon.png',
    size: 1024,
    svg: svg(1024, centered('house_mark', 1024, 0.62), COLORS.brand_tint),
  },
  {
    file: 'pixel-adaptive-foreground.png',
    size: 1024,
    // Android crops adaptive icons to a circle or squircle, so the house stays inside the middle 60%
    svg: svg(1024, centered('house_mark', 1024, 0.56)),
    transparent: true,
  },
  {
    file: 'pixel-adaptive-background.png',
    size: 1024,
    svg: svg(1024, '', COLORS.brand_tint),
  },
  {
    file: 'pixel-adaptive-monochrome.png',
    size: 1024,
    svg: svg(1024, centered('house_mark', 1024, 0.56, COLORS.text_light)),
    transparent: true,
  },
  {
    file: 'pixel-splash.png',
    size: 1024,
    svg: svg(1024, centered('house_mark', 1024, 0.9)),
    transparent: true,
  },
  {
    file: 'pixel-favicon.png',
    size: 48,
    svg: svg(48, centered('house_mark', 48, 0.84), COLORS.brand_tint),
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
expo.icon = './assets/pixel-icon.png';
expo.backgroundColor = COLORS.background;
expo.android = expo.android || {};
expo.android.adaptiveIcon = {
  backgroundColor: COLORS.brand_tint,
  foregroundImage: './assets/pixel-adaptive-foreground.png',
  backgroundImage: './assets/pixel-adaptive-background.png',
  monochromeImage: './assets/pixel-adaptive-monochrome.png',
};
expo.web = expo.web || {};
expo.web.favicon = './assets/pixel-favicon.png';
const splash = [
  'expo-splash-screen',
  {
    image: './assets/pixel-splash.png',
    imageWidth: 220,
    resizeMode: 'contain',
    backgroundColor: COLORS.surface,
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
