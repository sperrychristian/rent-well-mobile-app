import { LIGHT_COLORS, DARK_COLORS } from '../../../constants/theme';
import { contrastRatio } from '../../../util/contrast';

// the work order form's own text and background pairs, in both themes, all AA for normal text (4.5)
// (the read-only box, the counter warning, errors on the page, placeholders and values in the box, chips on paper)
const pairs = [
  ['text_muted', 'surface_raised'],
  ['text_muted', 'surface_sunken'],
  ['text', 'surface_sunken'],
  ['warning_text', 'background'],
  ['danger_text', 'background'],
  ['text_muted', 'background'],
  ['text', 'surface'],
  ['cta', 'background'],
  ['on_cta', 'cta'],
];

describe.each([
  ['light', LIGHT_COLORS],
  ['dark', DARK_COLORS],
])('%s', (scheme, palette) => {
  test.each(pairs)('%s on %s is at least 4.5', (text, background) => {
    expect(contrastRatio(palette[text], palette[background])).toBeGreaterThanOrEqual(4.5);
  });
});
