import { relativeLuminance } from '../../../utils/contrast';

// redraws a drawing in two quiet tones, so the empty-state art reads as an accent and not as a picture
// each color becomes the light tone or the dark tone by how bright it is, which keeps the shapes readable
// gives back a new palette of token names (index 0 stays see-through)
export function duotonePalette(palette, color_tokens, light_token, dark_token, threshold) {
  const cut = threshold === undefined ? 0.4 : threshold;
  return palette.map((token, index) => {
    if (index === 0 || !token) {
      return token;
    }
    const luminance = relativeLuminance(color_tokens[token]);
    return luminance !== null && luminance >= cut ? light_token : dark_token;
  });
}
