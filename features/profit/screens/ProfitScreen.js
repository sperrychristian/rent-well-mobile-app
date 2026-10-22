import { useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import SegmentedControl from '../../../components/ui/SegmentedControl';
import SummaryBlock from '../../../components/ui/SummaryBlock';
import SectionHeader from '../../../components/ui/SectionHeader';
import ListRow from '../../../components/ui/ListRow';
import Button from '../../../components/ui/Button';
import SkeletonList from '../../../components/ui/Skeleton';
import ErrorState from '../../../components/ErrorState';
import ProfitChart from '../components/ProfitChart';
import TaxSummarySheet from '../components/TaxSummarySheet';
import { useProfitReport } from '../hooks/useProfitReport';
import { formatCents } from '../../../utils/formatCurrency';
import { SPACING, TYPE, SIZES, NUMBERS } from '../../../theme';
import { themedStyles } from '../../../utils/themedStyles';

// a landlord's year in one place: net profit as the big number, rent in and expenses out under it,
// net by month as one green chart, then each property as a plain row (tap one to see its months in the chart)
// real mode reads GET /reports/profit, the demo works out the same numbers from its own rent and expenses
function ProfitScreen() {
  const this_year = new Date().getFullYear();
  const years = [String(this_year), String(this_year - 1), String(this_year - 2)];
  const [year, setYear] = useState(years[0]);
  // the property the chart shows, null for everything
  const [chart_property, setChartProperty] = useState(null);
  const [tax_open, setTaxOpen] = useState(false);
  const profit = useProfitReport(year, null);
  const report = profit.report;

  if (!report && profit.status === 'loading') {
    return (
      <View style={styles.container}>
        <SkeletonList rows={6} style={styles.skeleton} />
      </View>
    );
  }
  if (!report) {
    return (
      <View style={styles.container}>
        <ErrorState message={profit.error} onRetry={profit.reload} />
      </View>
    );
  }

  const total = report.total;
  const chart_row = chart_property
    ? report.properties.find((row) => row.property.id === chart_property)
    : null;
  const chart_months = (chart_row || total).months;
  const chart_label = chart_row
    ? chart_row.property.name || 'A deleted property'
    : 'All properties';
  // general expenses (no property) get their own row when there are any
  const rows = [
    ...report.properties.map((row) => ({ key: row.property.id, name: row.property.name, row })),
    ...(report.general && report.general.expenses_cents !== 0
      ? [{ key: 'general', name: 'General (no property)', row: report.general, general: true }]
      : []),
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={profit.status === 'refreshing'} onRefresh={profit.reload} />
      }
    >
      <SegmentedControl
        label="Year"
        options={years.map((item) => ({ value: item, label: item }))}
        value={year}
        onChange={setYear}
      />

      <SummaryBlock
        label={'Net profit in ' + year}
        value={formatCents(total.net_cents)}
        caption={'Rent collected ' + formatCents(total.rent_collected_cents)}
        style={styles.hero}
      >
        <Text style={[styles.out_line, NUMBERS]}>
          {'Expenses ' + formatCents(total.expenses_cents)}
        </Text>
      </SummaryBlock>

      <ProfitChart months={chart_months} label={chart_label} />
      <Text style={styles.chart_caption}>
        {chart_row ? chart_label + ', net by month' : 'All properties, net by month'}
      </Text>

      <SectionHeader
        title="By property"
        action_label={chart_row ? 'Show all' : undefined}
        onAction={() => setChartProperty(null)}
      />
      {rows.map((item, index) => {
        const selected = chart_property === item.key;
        return (
          <ListRow
            key={item.key}
            icon={item.general ? 'briefcase-outline' : 'business-outline'}
            title={item.name || 'A deleted property'}
            subtitle={
              formatCents(item.row.rent_collected_cents) +
              ' in, ' +
              formatCents(item.row.expenses_cents) +
              ' out'
            }
            trailing={formatCents(item.row.net_cents)}
            chevron={false}
            divider={index < rows.length - 1}
            style={selected ? styles.row_selected : null}
            accessibilityLabel={
              (item.name || 'A deleted property') +
              ', net ' +
              formatCents(item.row.net_cents) +
              (selected ? ', showing in the chart' : '')
            }
            accessibilityHint={item.general ? undefined : 'Shows this property in the chart'}
            onPress={item.general ? undefined : () => setChartProperty(selected ? null : item.key)}
          />
        );
      })}

      <Button
        variant="secondary"
        icon="document-text-outline"
        title="Tax Summary"
        onPress={() => setTaxOpen(true)}
        style={styles.tax_button}
      />
      <Text style={styles.note}>
        Rent collected counts confirmed payments only, the same number Payments shows. Not tax
        advice.
      </Text>

      {tax_open && (
        <TaxSummarySheet visible years={years} year={year} onClose={() => setTaxOpen(false)} />
      )}
    </ScrollView>
  );
}

export default ProfitScreen;

const styles = themedStyles((COLORS) => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingTop: SPACING.md,
    paddingHorizontal: SIZES.screen_padding,
    paddingBottom: SPACING.xl,
    width: '100%',
    maxWidth: SIZES.content_max_width,
    alignSelf: 'center',
  },
  skeleton: {
    paddingHorizontal: SIZES.screen_padding,
    paddingTop: SPACING.md,
  },
  hero: {
    marginTop: SPACING.lg,
  },
  out_line: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
  },
  chart_caption: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  row_selected: {
    backgroundColor: COLORS.surface_raised,
  },
  tax_button: {
    marginTop: SPACING.lg,
    marginHorizontal: 0,
  },
  note: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    marginTop: SPACING.sm,
  },
}));
