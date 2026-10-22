import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { month_short } from '../utils/profitMath';
import { formatCents } from '../../../utils/formatCurrency';
import { COLORS, SPACING, TYPE, SIZES, BORDER } from '../../../theme';

// net profit by month as one set of forest green bars on the paper, with hairline gridlines and no card
// a month that lost money draws below the zero line (the same green, the words under it say which)
// the whole chart reads to a screen reader as a sentence, and the month names sit under the bars
// props: months ([{ month, net_cents }], 12 of them), label (what the chart is for, like "All properties")
const chart_height = SIZES.thumb * 3;

function ProfitChart(props) {
  const { width } = useWindowDimensions();
  const chart_width = Math.min(width, SIZES.content_max_width) - SIZES.screen_padding * 2;
  const values = props.months.map((month) => month.net_cents);
  const top = Math.max(0, ...values);
  const bottom = Math.min(0, ...values);
  const span = top - bottom || 1;
  // where zero sits, so losses hang under it
  const zero_y = (top / span) * chart_height;
  const slot = chart_width / 12;
  const bar_width = Math.max(slot * 0.56, BORDER.thick);

  const best = props.months.reduce(
    (found, month) => (!found || month.net_cents > found.net_cents ? month : found),
    null,
  );
  const spoken =
    props.label +
    ', net by month. ' +
    (best && best.net_cents !== 0
      ? 'Best month ' +
        month_short[Number(best.month.slice(5)) - 1] +
        ' at ' +
        formatCents(best.net_cents) +
        '.'
      : 'No rent or expenses yet.');

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={spoken} style={styles.wrap}>
      <Svg width={chart_width} height={chart_height}>
        {/* three hairlines: the top, the middle, and zero */}
        {[0, chart_height / 2].map((y) => (
          <Line
            key={y}
            x1={0}
            x2={chart_width}
            y1={y + BORDER.hairline / 2}
            y2={y + BORDER.hairline / 2}
            stroke={COLORS.hairline}
            strokeWidth={BORDER.hairline}
          />
        ))}
        <Line
          x1={0}
          x2={chart_width}
          y1={zero_y}
          y2={zero_y}
          stroke={COLORS.border_strong}
          strokeWidth={BORDER.hairline}
        />
        {props.months.map((month, index) => {
          const size = (Math.abs(month.net_cents) / span) * chart_height;
          const y = month.net_cents >= 0 ? zero_y - size : zero_y;
          return (
            <Rect
              key={month.month}
              x={index * slot + (slot - bar_width) / 2}
              y={y}
              width={bar_width}
              height={Math.max(size, month.net_cents === 0 ? 0 : BORDER.thin)}
              rx={BORDER.thin}
              fill={COLORS.cta}
            />
          );
        })}
      </Svg>
      <View style={[styles.months, { width: chart_width }]}>
        {props.months.map((month, index) => (
          <Text key={month.month} style={styles.month_text} numberOfLines={1}>
            {month_short[index].slice(0, 1)}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default ProfitChart;

const styles = StyleSheet.create({
  wrap: {
    marginTop: SPACING.lg,
    alignSelf: 'center',
  },
  months: {
    flexDirection: 'row',
    marginTop: SPACING.xs,
  },
  month_text: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    flex: 1,
    textAlign: 'center',
  },
});
