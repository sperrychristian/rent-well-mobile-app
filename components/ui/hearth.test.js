import { render, screen, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import Button from './Button';
import ListRow from './ListRow';
import StatusLabel from './StatusLabel';
import StatusPill from './StatusPill';
import SummaryBlock from './SummaryBlock';
import ProgressLine from './ProgressLine';
import { lineIcon } from './lineIcon';
import { COLORS, TYPE, RADIUS, SIZES, BORDER } from '../../theme';
import { contrastRatio, meetsAA } from '../../utils/contrast';

// the Hearth pieces: what they draw and that every new text and background pair is readable

function flat(node) {
  return StyleSheet.flatten(node.props.style);
}

describe('Button variants', () => {
  test('primary is a full green pill with white words', () => {
    render(<Button title="Save" variant="primary" onPress={() => {}} />);
    const button = screen.getByRole('button', { name: 'Save' });
    const style = flat(button);
    expect(style.backgroundColor).toBe(COLORS.cta);
    expect(style.borderRadius).toBe(RADIUS.button);
    expect(style.minHeight).toBe(SIZES.button_medium);
  });

  test('secondary is see-through with a warm outline, destructive is terracotta words in a terracotta outline', () => {
    const { rerender } = render(<Button title="More" variant="secondary" onPress={() => {}} />);
    let style = flat(screen.getByRole('button', { name: 'More' }));
    expect(style.backgroundColor).toBe('transparent');
    expect(style.borderColor).toBe(COLORS.border_strong);
    rerender(<Button title="Void" variant="destructive" onPress={() => {}} />);
    style = flat(screen.getByRole('button', { name: 'Void' }));
    expect(style.backgroundColor).toBe('transparent');
    expect(style.borderColor).toBe(COLORS.danger_text);
  });

  test('a tertiary button presses and has no outline', () => {
    const press = jest.fn();
    render(<Button title="Show all" variant="tertiary" onPress={press} />);
    fireEvent.press(screen.getByRole('button', { name: 'Show all' }));
    expect(press).toHaveBeenCalled();
    expect(flat(screen.getByRole('button', { name: 'Show all' })).borderColor).toBe('transparent');
  });
});

describe('Row', () => {
  test('a tappable row is 64 tall with a hairline on top, a line icon, and a chevron', () => {
    render(<ListRow title="Payments" subtitle="1 overdue" icon="card" onPress={() => {}} />);
    const row = screen.getByRole('button', { name: 'Payments, 1 overdue' });
    const style = flat(row);
    expect(style.minHeight).toBe(SIZES.row_min_height);
    expect(style.borderTopWidth).toBe(BORDER.hairline);
    // the last row (no divider) closes the list with a line under it too
    expect(style.borderBottomWidth).toBe(BORDER.hairline);
    expect(screen.getByText('card-outline', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('chevron-forward')).toBeTruthy();
  });

  test('subtitle_tone danger makes the subtitle terracotta', () => {
    render(<ListRow title="Sam" subtitle="$2,000.00 overdue" subtitle_tone="danger" />);
    expect(flat(screen.getByText('$2,000.00 overdue')).color).toBe(COLORS.danger_text);
  });
});

describe('StatusLabel', () => {
  test('an icon and colored words, no pill behind them', () => {
    render(<StatusLabel label="Overdue" tone="danger" icon="alert-circle" />);
    const words = screen.getByText('Overdue');
    expect(flat(words).color).toBe(COLORS.danger_text);
    expect(screen.getByText('alert-circle-outline')).toBeTruthy();
    expect(flat(words.parent.parent).backgroundColor).toBeUndefined();
  });

  test('statuses keep their meaning, an emergency reads terracotta, and StatusPill draws the same thing', () => {
    render(<StatusLabel label="Resolved" />);
    expect(flat(screen.getByText('Resolved')).color).toBe(COLORS.success_text);
    render(<StatusPill label="Emergency" />);
    expect(flat(screen.getByText('Emergency')).color).toBe(COLORS.danger_text);
  });
});

describe('hero amount block', () => {
  test('a muted label, a big Fraunces number, a muted caption, and a progress line', () => {
    render(
      <SummaryBlock label="Collected in October" value="$3,105.00" caption="of $5,060.00 expected">
        <ProgressLine share={0.61} label="61 percent collected" />
      </SummaryBlock>,
    );
    const value = flat(screen.getByText('$3,105.00'));
    expect(value.fontFamily).toBe(TYPE.hero.fontFamily);
    expect(value.fontSize).toBeGreaterThanOrEqual(56);
    expect(flat(screen.getByText('Collected in October')).color).toBe(COLORS.text_muted);
    const bar = screen.getByLabelText('61 percent collected');
    expect(bar.props.accessibilityValue.now).toBe(61);
    expect(flat(bar).height).toBe(SIZES.progress);
  });
});

describe('line icons', () => {
  test('filled names become their outline twin, outline and unknown names stay', () => {
    expect(lineIcon('alert-circle')).toBe('alert-circle-outline');
    expect(lineIcon('home-outline')).toBe('home-outline');
    expect(lineIcon('not-a-real-icon')).toBe('not-a-real-icon');
    expect(lineIcon(undefined)).toBeUndefined();
  });
});

describe('Hearth contrast pairs', () => {
  // every text and background pair the Hearth pieces add
  const pairs = [
    ['text', 'background'],
    ['text_muted', 'background'],
    ['cta', 'background'],
    ['danger_text', 'background'],
    ['warning_text', 'background'],
    ['on_cta', 'cta'],
    ['text_light', 'toast_background'],
    ['text', 'surface'],
    ['text_muted', 'surface'],
    ['danger_text', 'surface'],
    ['text_muted', 'surface_raised'],
    ['text', 'surface_raised'],
    ['warning_text', 'warning_tint'],
    ['danger_text', 'danger_tint'],
  ];
  test.each(pairs)('%s on %s is AA', (text, background) => {
    expect({
      ratio: contrastRatio(COLORS[text], COLORS[background]),
      ok: meetsAA(COLORS[text], COLORS[background]),
    }).toMatchObject({ ok: true });
  });
});
