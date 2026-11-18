import fs from 'fs';
import path from 'path';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import SummaryBlock from '../components/ui/SummaryBlock';
import KpiTile from '../components/ui/KpiTile';
import { TYPE } from '../constants/theme';
import { estimateTextWidth, fitFontSize, hero_steps, number_steps } from './fitFontSize';

// the hero number fix: the size comes from the measured width and a short list of steps,
// never from iOS shrink to fit (which drew Sam's balance as a speck)

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 })),
}));

function setFontScale(font_scale) {
  useWindowDimensions.mockImplementation(() => ({
    width: 390,
    height: 844,
    scale: 3,
    fontScale: font_scale,
  }));
}

beforeEach(() => setFontScale(1));

// the biggest step that fits, worked out the slow way, to check fitFontSize against
function biggestThatFits(text, width, steps, scale) {
  const fits = steps.filter((step) => estimateTextWidth(text, step * scale) <= width);
  return fits.length ? Math.max(...fits) : steps[steps.length - 1];
}

const amounts = ['$0', '$1,250', '$12,345.67', '$1,234,567.89'];

describe('fitFontSize', () => {
  test('digits are equal width, and "$", "," and "." are narrower', () => {
    expect(estimateTextWidth('1', 10)).toBe(estimateTextWidth('8', 10));
    expect(estimateTextWidth('$', 10)).toBeLessThan(estimateTextWidth('0', 10));
    expect(estimateTextWidth(',', 10)).toBeLessThan(estimateTextWidth('$', 10));
    expect(estimateTextWidth('.', 10)).toBeLessThan(estimateTextWidth('$', 10));
  });

  test.each(amounts)('%s gets the biggest step that fits a 312 wide phone line', (text) => {
    const size = fitFontSize(text, 312, hero_steps, 1);
    expect(size).toBe(biggestThatFits(text, 312, hero_steps, 1));
    expect(size).toBeGreaterThanOrEqual(30);
  });

  test('short amounts stay at the full 58, long ones step down, never under 30', () => {
    expect(fitFontSize('$0', 312, hero_steps, 1)).toBe(58);
    expect(fitFontSize('$1,250', 312, hero_steps, 1)).toBe(58);
    expect(fitFontSize('$12,345.67', 312, hero_steps, 1)).toBe(52);
    expect(fitFontSize('$1,234,567.89', 312, hero_steps, 1)).toBe(40);
    expect(fitFontSize('$1,234,567.89', 120, hero_steps, 1)).toBe(30);
  });

  test('a width of 0 or one not measured yet keeps the normal size', () => {
    expect(fitFontSize('$1,234,567.89', 0, hero_steps, 1)).toBe(58);
    expect(fitFontSize('$1,234,567.89', undefined, hero_steps, 1)).toBe(58);
    expect(fitFontSize('$1,234,567.89', 0, number_steps, 1)).toBe(30);
  });

  test('a bigger system text size picks a smaller step, and the drawn size never goes under 30', () => {
    const size = fitFontSize('$2,000.00', 312, hero_steps, 1.2);
    expect(size).toBe(46);
    expect(estimateTextWidth('$2,000.00', size * 1.2)).toBeLessThanOrEqual(312);
    // a smaller system text size would shrink the 30 step, so it's bumped back up to draw at 30
    expect(fitFontSize('$1,234,567.89', 100, hero_steps, 0.8) * 0.8).toBeCloseTo(30);
  });
});

function heroStyle() {
  return StyleSheet.flatten(screen.getByText(/^\$/).props.style);
}

function layout(node, width) {
  fireEvent(node, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: width, height: 80 } } });
}

describe('SummaryBlock', () => {
  test('before the width is known it draws at the normal 58, never tiny', () => {
    render(<SummaryBlock label="Due now" value="$1,234,567.89" />);
    expect(heroStyle().fontSize).toBe(58);
    expect(heroStyle().lineHeight).toBe(TYPE.hero.lineHeight);
  });

  test('a balance that arrives after mount ($0.00 to $2,000.00) ends at the right size', () => {
    const view = render(<SummaryBlock label="Due now" value="$0.00" />);
    layout(screen.getByLabelText('Due now, $0.00'), 250);
    expect(heroStyle().fontSize).toBe(fitFontSize('$0.00', 250, hero_steps, 1.0));
    view.rerender(<SummaryBlock label="Due now" value="$2,000.00" />);
    const size = fitFontSize('$2,000.00', 250, hero_steps, 1.0);
    expect(size).toBe(46);
    expect(heroStyle().fontSize).toBe(size);
    // the line height follows the size instead of staying at 66
    expect(heroStyle().lineHeight).toBe(Math.round((size * 66) / 58));
  });

  test('the largest text size is capped at 1.2 times, and it still fits', () => {
    setFontScale(3);
    render(<SummaryBlock label="Due now" value="$2,000.00" />);
    layout(screen.getByLabelText('Due now, $2,000.00'), 312);
    expect(heroStyle().fontSize).toBe(46);
    expect(screen.getByText('$2,000.00').props.maxFontSizeMultiplier).toBe(1.2);
    expect(screen.getByText('$2,000.00').props.numberOfLines).toBe(1);
  });

  test('the label and the screen reader text are the same as before', () => {
    const view = render(
      <SummaryBlock label="Due now" value="$2,000.00" caption="Rent for 2026-11" />,
    );
    expect(screen.getByText('Due now')).toBeTruthy();
    expect(screen.getByLabelText('Due now, $2,000.00, Rent for 2026-11')).toBeTruthy();
    expect(view.toJSON().props.accessibilityRole).toBe('summary');
  });

  test('size small starts at 30 and steps down from there', () => {
    render(<SummaryBlock label="Deposit" value="$1,234,567.89" size="small" />);
    expect(heroStyle().fontSize).toBe(30);
    layout(screen.getByLabelText('Deposit, $1,234,567.89'), 150);
    expect(heroStyle().fontSize).toBe(fitFontSize('$1,234,567.89', 150, number_steps, 1));
    expect(heroStyle().fontSize).toBeLessThan(30);
  });
});

describe('KpiTile', () => {
  test('the number fits the measured tile and keeps its label', () => {
    render(<KpiTile label="Collected" value="$12,345.67" caption="of $14,000.00" />);
    expect(heroStyle().fontSize).toBe(30);
    layout(screen.getByLabelText('Collected, $12,345.67, of $14,000.00'), 140);
    expect(heroStyle().fontSize).toBe(fitFontSize('$12,345.67', 140, number_steps, 1));
  });

  test('a tappable tile measures too', () => {
    render(<KpiTile label="Overdue" value="$1,234,567.89" onPress={() => {}} />);
    layout(screen.getByRole('button'), 120);
    expect(heroStyle().fontSize).toBe(fitFontSize('$1,234,567.89', 120, number_steps, 1));
  });
});

test('no shrink to fit is left in the number components', () => {
  for (const file of [
    'components/ui/SummaryBlock.js',
    'components/ui/KpiTile.js',
    'features/payments/screens/TenantLedgerScreen.js',
  ]) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    expect(source).not.toMatch(/adjustsFontSizeToFit/);
    expect(source).toMatch(/useFitFontSize/);
  }
});
