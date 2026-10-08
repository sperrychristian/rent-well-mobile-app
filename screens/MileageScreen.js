import { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenTitle from '../components/ScreenTitle';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';
import TripModal from '../components/TripModal';
import { useWorkOrders } from '../context/WorkOrdersContext';
import { formatDate } from '../utils/formatDate';
import { sumMiles, formatMoney } from '../utils/expenseStats';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../theme';

function MileageScreen(props) {
  // need the insets so the title clears the notch and status bar
  const insets = useSafeAreaInsets();
  const { trips, addTrip, updateTrip, deleteTrip, mileage_rate, setMileageRate, properties } = useWorkOrders();

  const current_year = String(new Date().getFullYear());
  const [year, setYear] = useState(current_year);
  // the rate box keeps its own text until I tap save so typing doesn't change totals on every key
  const [rate_text, setRateText] = useState(String(mileage_rate));
  const [form_open, setFormOpen] = useState(false);
  const [editing_id, setEditingId] = useState(null);

  const years = [
    ...new Set([...trips.map((trip) => trip.date.slice(0, 4)), current_year]),
  ].sort((a, b) => b.localeCompare(a));

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
        style={styles.add_button}
        onPress={openNewForm}
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
        <Text style={styles.summary_label}>Mileage deduction in {year}</Text>
        <Text style={styles.summary_total}>{formatMoney(total_miles * mileage_rate)}</Text>
        <Text style={styles.detail}>
          {total_miles.toFixed(1)} miles over {year_trips.length} trips
        </Text>
      </Card>

      <Card>
        <Text style={styles.heading}>Rate per mile</Text>
        <Text style={styles.helper}>
          Set this to the current IRS standard mileage rate. It changes every year, so check the IRS site. The rate applies to every year in this log.
        </Text>
        <View style={styles.rate_row}>
          <TextInput
            style={styles.rate_input}
            placeholder="0.70"
            placeholderTextColor={COLORS.text}
            keyboardType="decimal-pad"
            value={rate_text}
            onChangeText={setRateText}
          />
          <PrimaryButton title="Save Rate" onPress={saveRate} style={styles.rate_button} />
        </View>
      </Card>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + SPACING.md }]}>
      <ScreenTitle>Mileage</ScreenTitle>
      <FlatList
        data={year_trips}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.lg }}
        ListHeaderComponent={list_header}
        ListEmptyComponent={<Text style={styles.empty_text}>No trips logged for {year}</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => openEditForm(item.id)}>
            <View style={styles.row_top}>
              <Text style={styles.row_miles}>{item.miles.toFixed(1)} miles</Text>
              <Text style={styles.detail}>{formatDate(item.date)}</Text>
            </View>
            <Text style={styles.detail}>{formatMoney(item.miles * mileage_rate)} deduction</Text>
            <Text style={styles.detail}>{item.property}</Text>
            {item.purpose ? <Text style={styles.detail}>{item.purpose}</Text> : null}
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
    padding: SPACING.md,
  },
  add_button: {
    backgroundColor: '#2E9E5B',
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
  rate_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  rate_input: {
    flex: 1,
    backgroundColor: COLORS.background,
    color: COLORS.text,
    fontFamily: FONTS.body,
    borderRadius: 8,
    padding: SPACING.sm,
  },
  rate_button: {
    backgroundColor: '#2E9E5B',
    marginHorizontal: 0,
  },
  row: {
    backgroundColor: COLORS.muted,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  row_top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row_miles: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
  },
  empty_text: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    textAlign: 'center',
    marginTop: SPACING.lg,
    opacity: 0.7,
  },
});