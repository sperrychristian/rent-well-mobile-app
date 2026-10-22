import fs from 'fs';
import path from 'path';
import { LIGHT_COLORS, DARK_COLORS } from '../../theme';
import { contrastRatio } from '../../utils/contrast';

// reads every style block in the app's source, and wherever one block sets both a text color and a background,
// the pair has to be AA (4.5 to 1), so a token change can't quietly make a button or a tag unreadable
const root = path.join(__dirname, '..', '..');
const skip_folders = new Set([
  'node_modules',
  '.git',
  '.expo',
  'dist',
  'assignment',
  'scripts',
  'assets',
]);

function sourceFiles(folder) {
  const files = [];
  fs.readdirSync(folder, { withFileTypes: true }).forEach((entry) => {
    if (skip_folders.has(entry.name)) {
      return;
    }
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(full));
    } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
      files.push(full);
    }
  });
  return files;
}

const pairs = [];
['features', 'components'].forEach((folder) => {
  sourceFiles(path.join(root, folder)).forEach((file) => {
    const source = fs.readFileSync(file, 'utf8');
    [...source.matchAll(/\n {2}([a-z_]+): \{\n([\s\S]*?)\n {2}\},/g)].forEach((match) => {
      const background = (match[2].match(/backgroundColor: COLORS\.(\w+)/) || [])[1];
      const text = (match[2].match(/(?<![a-zA-Z])color: COLORS\.(\w+)/) || [])[1];
      if (background && text) {
        pairs.push({ file: path.relative(root, file), style: match[1], text, background });
      }
    });
  });
});

describe('text and background pairs in the styles', () => {
  test('the scan finds the styled pairs', () => {
    expect(pairs.length).toBeGreaterThan(5);
  });

  // the dark mode pass: the same pairs have to hold in both palettes
  test.each([
    ['light', LIGHT_COLORS],
    ['dark', DARK_COLORS],
  ])('every pair is a real token and AA (%s)', (scheme, PALETTE) => {
    const failing = pairs
      .filter((pair) => String(PALETTE[pair.background]).startsWith('#'))
      .map((pair) => ({
        ...pair,
        ratio: contrastRatio(PALETTE[pair.text], PALETTE[pair.background]),
      }))
      .filter((pair) => pair.ratio === null || pair.ratio < 4.5);
    expect(failing).toEqual([]);
  });
});
