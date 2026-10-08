import { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenTitle from '../components/ScreenTitle';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';
import { useWorkOrders } from '../context/WorkOrdersContext';
import { formatDate } from '../utils/formatDate';
import { buildYearEndData, formatMoney } from '../utils/expenseStats';
import { shareYearEndCsv } from '../utils/exportExpenses';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../theme';

function YearEndReportScreen(props) {
  // need the insets so the title clears the notch and status bar
  const insets = useSafeAreaInsets();
  const { expenses, trips, mileage_rate } = useWorkOrders();

  const current_year = String(new Date().getFullYear());
  // the Expenses screen passes its selected year in, and this falls back to the current year
  const starting_year = props.route.params && props.route.params.year ? props.route.params.year : current_year;
  const [year, setYear] = useState(starting_year);

  const years = [
    ...new Set([
      ...expenses.map((expense) => expense.date.slice(0, 4)),
      ...trips.map((trip) => trip.date.slice(0, 4)),
      current_year,
    ]),
  ].sort((a, b) => b.localeCompare(a));

  // worked out again every render so it always matches the saved expenses and trips
  const data = buildYearEndData(year, expenses, trips, mileage_rate);

  async function exportReport() {
    if (data.expense_count === 0 && data.miles === 0) {
      Alert.alert('Nothing to export', 'There are no expenses or trips for ' + year + '.');
      return;
    }
    try {
      await shareYearEndCsv(year, data, mileage_rate);
    } catch (error) {
      console.log('Could not export the year-end summary', error);
      Alert.alert('Export failed', 'The file could not be created or shared.');
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + SPACING.md }]}>
      <ScreenTitle>Year-End</ScreenTitle>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.lg }}>
        <PrimaryButton
          title="Export Year-End CSV"
          icon="share-outline"
          style={styles.export_button}
          onPress={exportReport}
        />

        <Text style={styles.section_label}>Year</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chip_row}>
          {years.map((option) => (
            <Pressable
              key={option}
              onPress={() => setYear(option)}
              style={[styles.chip, year === option && styles.chip_active]}
            >
              <Text style={styles.chip_text}>{option}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Card>
          <Text style={styles.summary_label}>Deductible expenses in {year}</Text>
          <Text style={styles.summary_total}>{formatMoney(data.deductible)}</Text>
          <Text style={styles.detail}>
            Capital improvements (depreciated): {formatMoney(data.capital)}
          </Text>
          <Text style={styles.detail}>
            Mileage: {data.miles.toFixed(1)} miles, {formatMoney(data.mileage_deduction)}
          </Text>
        </Card>

        <Card>
          <Text style={styles.heading}>Receipts</Text>
          <Text style={styles.detail}>
            {data.with_receipts} of {data.expense_count} expenses have a receipt attached
          </Text>
          {data.missing_receipts.slice(0, 5).map((expense) => (
            <Text key={expense.id} style={styles.missing_text}>
              {formatDate(expense.date)} · {formatMoney(expense.amount)} · {expense.vendor || expense.category}
            </Text>
          ))}
          {data.missing_receipts.length > 5 && (
            <Text style={styles.detail}>and {data.missing_receipts.length - 5} more without a receipt</Text>
          )}
        </Card>

        {data.per_property.map((item) => (
          <Card key={item.property}>
            <Text style={styles.heading}>{item.property}</Text>
            {item.categories.map((row) => (
              <View key={row.category} style={styles.line_row}>
                <Text style={styles.line_name}>{row.category}</Text>
                <Text style={styles.line_amount}>{formatMoney(row.total)}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.line_row}>
              <Text style={styles.line_name}>Total deductible</Text>
              <Text style={styles.line_amount}>{formatMoney(item.deductible)}</Text>
            </View>
            <View style={styles.line_row}>
              <Text style={styles.line_name}>Capital improvements</Text>
              <Text style={styles.line_amount}>{formatMoney(item.capital)}</Text>
            </View>
            <View style={styles.line_row}>
              <Text style={styles.line_name}>Mileage ({item.miles.toFixed(1)} mi)</Text>
              <Text style={styles.line_amount}>{formatMoney(item.mileage_deduction)}</Text>
            </View>
          </Card>
        ))}

        <Card>
          <Text style={styles.heading}>Paid by vendor</Text>
          <Text style={styles.helper}>
            Paying one vendor over the IRS reporting limit can mean filing a 1099. Check the current rules.
          </Text>
          {data.vendors.length === 0 && <Text style={styles.detail}>No vendors recorded for {year}</Text>}
          {data.vendors.map((row) => (
            <View key={row.vendor} style={styles.line_row}>
              <Text style={styles.line_name}>{row.vendor}</Text>
              <Text style={styles.line_amount}>{formatMoney(row.total)}</Text>
            </View>
          ))}
        </Card>

        <Text style={styles.footer_note}>
          This is a recordkeeping summary, not tax advice. Have an accountant confirm categories and tax treatment.
        </Text>
      </ScrollView>
    </View>
  );
}

export default YearEndReportScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.md,
  },
  export_button: {
    backgroundColor: '#2F6FED',
    marginHorizontal: 0,
    marginBottom: SPACING.md,
  },
  section_label: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 13,
    marginBottom: 6,
  },
  chip_row: {
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    borderRadius: 16,
    backgroundColor: COLORS.muted,
  },
  chip_active: {
    backgroundColor: COLORS.primary,
  },
  chip_text: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 13,
  },
  heading: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
    marginBottom: SPACING.sm,
  },
  detail: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    opacity: 0.8,
  },
  helper: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 12,
    opacity: 0.7,
    marginBottom: SPACING.sm,
  },
  missing_text: {
    color: '#F0A530',
    fontFamily: FONTS.body,
    fontSize: 13,
    marginTop: 4,
  },
  summary_label: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    opacity: 0.8,
  },
  summary_total: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 32,
    marginVertical: 4,
  },
  line_row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  line_name: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    marginRight: SPACING.sm,
  },
  line_amount: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.background,
    marginVertical: SPACING.sm,
  },
  footer_note: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 12,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
});