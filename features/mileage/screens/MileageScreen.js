import { useState } from 'react';
import { StyleSheet, View, Text, FlatList, Pressable, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import TripModal from '../components/TripModal';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import { formatDate } from '../../../utils/formatDate';
import { sumMiles } from '../../expenses/utils/expenseStats';
import { COLORS, SPACING, TYPE, OPACITY, NUMBERS, SIZES } from '../../../theme';
import { list_styles } from '../../../components/ui/listStyles';
import EmptyState from '../../../components/ui/EmptyState';
import { formatCurrency } from '../../../utils/formatCurrency';
import IconCircle from '../../../components/ui/IconCircle';
import CurrencyInput from '../../../components/ui/CurrencyInput';

function MileageScreen(props) {
  // need the insets so the title clears the notch and status bar
  const insets = useSafeAreaInsets();
  const { trips, addTrip, updateTrip, deleteTrip, mileage_rate, setMileageRate, properties } =
    useWorkOrders();

  const current_year = String(new Date().getFullYear());
  const [year, setYear] = useState(current_year);
  // the rate box keeps its own text until I tap save so typing doesn't change totals on every key
  const [rate_text, setRateText] = useState(String(mileage_rate));
  const [form_open, setFormOpen] = useState(false);
  const [editing_id, setEditingId] = useState(null);

  const years = [...new Set([...trips.map((trip) => trip.date.slice(0, 4)), current_year])].sort(
    (a, b) => b.localeCompare(a),
  );

  const year_trips = trips
    .filter((trip) => trip.date.slice(0, 4) === year)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  const total_miles = sumMiles(year_trips);
  const editing_trip = trips.find((trip) => trip.id === editing_id);

  function saveRate() {
    const parsed_rate = parseFloat(rate_text);
    if (isNaN(parsed_rate) || parsed_rate <= 0) {
      Alert.alert('Check the rate', 'Type a dollar amount per mile, like 0.70.');
      return;
    }
    setMileageRate(parsed_rate);
    Alert.alert('Saved', 'Mileage rate updated.');
  }

  function openNewForm() {
    setEditingId(null);
    setFormOpen(true);
  }

  function openEditForm(trip_id) {
    setEditingId(trip_id);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  // new trips get added, edited ones get updated, and I jump to the trip's year so it doesn't vanish
  function handleSave(trip) {
    if (editing_trip) {
      updateTrip(editing_trip.id, trip);
    } else {
      addTrip(trip);
    }
    setYear(trip.date.slice(0, 4));
    closeForm();
  }

  // ask first so a stray tap doesn't delete a trip
  function confirmDelete() {
    Alert.alert('Delete trip', 'This removes the trip from your log.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteTrip(editing_id);
          closeForm();
        },
      },
    ]);
  }

  const list_header = (
    <View>
      <PrimaryButton
        title="Add Trip"
        icon="add-circle-outline"
        variant="primary"
        style={styles.add_button}
        onPress={openNewForm}
      />

      <Text style={styles.section_label}>Year</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chip_row}
      >
        {years.map((option) => (
          <Pressable
            key={option}
            onPress={() => setYear(option)}
            style={[styles.chip, year === option && styles.chip_active]}
            hitSlop={{ top: 8, bottom: 8 }}
            accessibilityRole="button"
            accessibilityState={{ selected: year === option }}
          >
            <Text style={styles.chip_text}>{option}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Card>
        <Text style={styles.summary_label}>Mileage deduction in {year}</Text>
        <Text style={styles.summary_total}>{formatCurrency(total_miles * mileage_rate)}</Text>
        <Text style={styles.detail}>
          {total_miles.toFixed(1)} miles over {year_trips.length} trips
        </Text>
      </Card>

      <Card>
        <Text style={styles.heading}>Rate per mile</Text>
        <Text style={styles.helper}>
          Set this to the current IRS standard mileage rate. It changes every year, so check the IRS
          site. The rate applies to every year in this log.
        </Text>
        <View style={styles.rate_row}>
          <CurrencyInput
            style={styles.rate_input}
            accessibilityLabel="Rate per mile"
            placeholder="0.70"
            value={rate_text}
            onChangeText={setRateText}
          />
          <PrimaryButton
            title="Save Rate"
            variant="secondary"
            onPress={saveRate}
            style={styles.rate_button}
          />
        </View>
      </Card>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: SPACING.md }]}>
      <FlatList
        data={year_trips}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.lg }}
        ListHeaderComponent={list_header}
        ListEmptyComponent={
          <EmptyState
            illustration="empty_mileage"
            title={'No trips logged for ' + year}
            message="Log each drive to a property, the deduction adds itself up for tax time."
            action_label="Add Trip"
            action_icon="add-circle-outline"
            onAction={openNewForm}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => openEditForm(item.id)}
            accessibilityRole="button"
            accessibilityLabel={item.miles.toFixed(1) + ' miles on ' + item.date + ', edit trip'}
          >
            {/* the fintech pass: a tinted car on the left, miles and the deduction on one line */}
            <IconCircle icon="car-outline" tone="info" />
            <View style={styles.row_body}>
              <View style={styles.row_top}>
                <Text style={styles.row_miles}>{item.miles.toFixed(1)} miles</Text>
                <Text style={styles.row_money}>{formatCurrency(item.miles * mileage_rate)}</Text>
              </View>
              <View style={styles.row_top}>
                <Text style={styles.detail}>{formatDate(item.date)}</Text>
                <Text style={styles.detail}>deduction</Text>
              </View>
              <Text style={styles.detail}>{item.property}</Text>
              {item.purpose ? <Text style={styles.detail}>{item.purpose}</Text> : null}
            </View>
          </Pressable>
        )}
      />
      <TripModal
        visible={form_open}
        trip={editing_trip}
        property_names={properties}
        onSave={handleSave}
        onClose={closeForm}
        onDelete={confirmDelete}
      />
    </View>
  );
}

export default MileageScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingVertical: SPACING.md,
    paddingHorizontal: SIZES.screen_padding,
    // the fintech pass: capped and centered on a tablet so lines stay a readable length
    width: '100%',
    maxWidth: SIZES.content_max_width + 160,
    alignSelf: 'center',
  },
  add_button: {
    marginHorizontal: 0,
    marginBottom: SPACING.md,
  },
  section_label: {
    ...TYPE.label,
    color: COLORS.text_muted,
    marginBottom: SPACING.xs + SPACING.xxs,
  },
  chip_row: {
    ...list_styles.chip_row,
  },
  chip: {
    ...list_styles.chip,
  },
  chip_active: {
    ...list_styles.chip_active,
  },
  chip_text: {
    ...list_styles.chip_text,
  },
  heading: {
    ...list_styles.heading,
  },
  detail: {
    ...list_styles.detail,
  },
  helper: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    marginBottom: SPACING.sm,
  },
  summary_label: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
  },
  summary_total: {
    ...TYPE.display,
    ...NUMBERS,
    color: COLORS.text,
    marginVertical: SPACING.xs,
  },
  rate_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  rate_input: {
    ...list_styles.field_input,
    flex: 1,
    marginBottom: 0,
  },
  rate_button: {
    marginHorizontal: 0,
  },
  row: {
    ...list_styles.row,
    flexDirection: 'row',
    gap: SPACING.sm + SPACING.xs,
  },
  row_top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: SPACING.sm,
  },
  row_miles: {
    ...TYPE.subheading,
    ...NUMBERS,
    color: COLORS.text,
  },
  empty_text: {
    ...list_styles.empty_text,
  },
  pressed: {
    opacity: OPACITY.pressed,
  },
  row_body: {
    flex: 1,
  },
  row_money: {
    ...TYPE.subheading,
    ...NUMBERS,
    color: COLORS.text,
    textAlign: 'right',
  },
});
