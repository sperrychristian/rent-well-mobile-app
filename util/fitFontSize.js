import { useState } from 'react';
import { useWindowDimensions } from 'react-native';

// the big numbers used to lean on iOS adjustsFontSizeToFit, which sometimes measured wrong when the amount
// showed up after the first layout (or with a big system text size) and drew the number as a tiny speck.
// so now I pick the size myself: measure the width with onLayout, then take the biggest step that fits

// the size steps, biggest first. the hero starts at 58 and never goes under 30,
// the 30pt number (KpiTile, the small SummaryBlock) gets its own shorter list
export const hero_steps = [58, 52, 46, 40, 34, 30];
export const number_steps = [30, 27, 24, 22, 20];

// how wide each character is as a share of the font size, measured from Fraunces 400 and rounded up a bit.
// the digits are tabular (all the same width), "$" is a little narrower, "," and "." are thin
const digit_ratio = 0.66;
const char_ratios = {
  $: 0.6,
  ',': 0.26,
  '.': 0.26,
  ' ': 0.26,
  '-': 0.56,
  '−': 0.56,
  '+': 0.56,
};
// anything else (a letter, a %) gets a safe wide guess
const other_ratio = 0.66;

// how wide the text should be at a font size, in points
export function estimateTextWidth(text, font_size) {
  let ems = 0;
  for (const character of String(text === undefined || text === null ? '' : text)) {
    if (character >= '0' && character <= '9') {
      ems += digit_ratio;
    } else if (char_ratios[character] !== undefined) {
      ems += char_ratios[character];
    } else {
      ems += other_ratio;
    }
  }
  return ems * font_size;
}

// the font size to give the Text. steps is biggest first. width is the room the line has (0 or missing means
// not measured yet, so it stays at the normal size). font_scale is the system text size, already capped at the
// Text's maxFontSizeMultiplier, because iOS multiplies the size I pick by it.
// the rule: the biggest step whose scaled width fits, else the smallest step, and the drawn size never ends up
// under the smallest step even when the system text is set smaller than normal
export function fitFontSize(text, width, steps, font_scale) {
  const scale = font_scale > 0 ? font_scale : 1;
  const smallest = steps[steps.length - 1];
  let picked = steps[0];
  if (width > 0) {
    picked = smallest;
    for (const step of steps) {
      if (estimateTextWidth(text, step * scale) <= width) {
        picked = step;
        break;
      }
    }
  }
  if (picked * scale < smallest) {
    picked = smallest / scale;
  }
  return picked;
}

// the hook both number components use: give it the text, the base type style (TYPE.hero or TYPE.number),
// its steps, and the Text's maxFontSizeMultiplier. it hands back onLayout for the box around the Text,
// and the fontSize plus lineHeight to put last in the Text's style
export function useFitFontSize(text, base_style, steps, max_multiplier) {
  const [width, setWidth] = useState(0);
  const { fontScale } = useWindowDimensions();
  const font_scale = Math.min(fontScale > 0 ? fontScale : 1, max_multiplier || 1);

  function onLayout(event) {
    const next_width = Math.floor(event.nativeEvent.layout.width);
    if (next_width !== width) {
      setWidth(next_width);
    }
  }

  const font_size = fitFontSize(text, width, steps, font_scale);
  // the line height keeps the type style's proportion, so a smaller number never gets its line squashed
  const line_ratio = base_style.lineHeight / base_style.fontSize;
  const fit_style = { fontSize: font_size, lineHeight: Math.round(font_size * line_ratio) };
  return { onLayout, fit_style, font_size, width };
}
