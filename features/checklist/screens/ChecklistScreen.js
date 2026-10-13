import { useState } from 'react';
import { StyleSheet, View, Text, FlatList, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenTitle from '../../../components/ScreenTitle';
import PrimaryButton from '../../../components/PrimaryButton';
import ProgressBar from '../components/ProgressBar';
import NewChecklistModal from '../components/NewChecklistModal';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import { checklistProgress, filterChecklists, worseCount } from '../utils/checklistHelpers';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../../../theme';

const status_filters = ['All', 'In progress', 'Complete'];

function ChecklistScreen(props) {
  // need the insets so the title clears the notch and status bar
  const insets = useSafeAreaInsets();
  const { checklists, properties, addChecklist } = useWorkOrders();

  const [status_filter, setStatusFilter] = useState('All');
  const [new_open, setNewOpen] = useState(false);
  // goes up every time the form opens, the new key gives the form a fresh start
  const [form_key, setFormKey] = useState(0);

  // newest first, the id breaks ties for ones made the same day
  // I copy the list first since sort would change the shared one in place
  const list_checklists = [...filterChecklists(checklists, status_filter)].sort(
    (a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
  );

  // the shared property list plus any property that only shows up on a checklist
  const property_names = [
    ...new Set([...properties, ...checklists.map((checklist) => checklist.property)]),
  ]
    .filter(Boolean)
    .sort();

  // only signed move-ins can start a move-out, since they won't change anymore
  const signed_move_ins = checklists.filter(
    (checklist) => checklist.type === 'Move-In' && checklist.completed,
  );

  function openNewForm() {
    setFormKey((current) => current + 1);
    setNewOpen(true);
  }

  function handleCreate(fields) {
    const new_id = addChecklist(fields);
    setNewOpen(false);
    // I clear the filter so the new one is in the list when coming back
    setStatusFilter('All');
    props.navigation.navigate('ChecklistDetail', { checklistId: new_id });
  }

  const list_header = (
    <View>
      <PrimaryButton
        title="New Checklist"
        icon="add-circle-outline"
        style={styles.new_button}
        onPress={openNewForm}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chip_row}
      >
        {status_filters.map((option) => (
          <Pressable
            key={option}
            onPress={() => setStatusFilter(option)}
            hitSlop={{ top: 8, bottom: 8 }}
            style={[styles.chip, status_filter === option && styles.chip_active]}
          >
            <Text style={styles.chip_text}>{option}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: SPACING.md }]}>
      <ScreenTitle>Checklist</ScreenTitle>
      <FlatList
        data={list_checklists}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.lg }}
        ListHeaderComponent={list_header}
        ListEmptyComponent={
          <Text style={styles.empty_text}>
            {checklists.length === 0
              ? 'No checklists yet, tap New Checklist to start one'
              : 'No checklists match'}
          </Text>
        }
        renderItem={({ item }) => {
          const progress = checklistProgress(item);
          const worse = worseCount(item);
          return (
            <Pressable
              style={styles.row}
              onPress={() => props.navigation.navigate('ChecklistDetail', { checklistId: item.id })}
            >
              <Ionicons
                name={item.type === 'Move-In' ? 'log-in-outline' : 'log-out-outline'}
                size={28}
                color={COLORS.text}
                style={styles.row_icon}
              />
              <View style={styles.row_text}>
                <Text style={styles.row_name} numberOfLines={2}>
                  {item.property}
                </Text>
                <Text style={styles.row_type}>{item.type}</Text>
                {item.tenant ? <Text style={styles.detail}>{item.tenant}</Text> : null}
                <Text style={styles.detail}>
                  {item.completed ? 'Signed ' + item.signed_on : 'Started ' + item.created_at}
                </Text>
                <View style={styles.progress_row}>
                  <View style={styles.progress_bar}>
                    <ProgressBar done={progress.done} total={progress.total} />
                  </View>
                  <Text style={styles.progress_text}>
                    {progress.done} of {progress.total} done
                  </Text>
                </View>
                <View style={styles.tag_row}>
                  <View
                    style={[styles.tag, item.completed ? styles.complete_tag : styles.progress_tag]}
                  >
                    <Text style={styles.tag_text}>
                      {item.completed ? 'Complete' : 'In progress'}
                    </Text>
                  </View>
                  {worse > 0 && (
                    <View style={[styles.tag, styles.worse_tag]}>
                      <Text style={styles.tag_text}>
                        {worse + (worse === 1 ? ' item' : ' items') + ' worse since move-in'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      <NewChecklistModal
        key={form_key}
        visible={new_open}
        property_names={property_names}
        move_ins={signed_move_ins}
        onCreate={handleCreate}
        onClose={() => setNewOpen(false)}
      />
    </View>
  );
}

export default ChecklistScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.md,
  },
  new_button: {
    backgroundColor: COLORS.success,
    marginHorizontal: 0,
    marginBottom: SPACING.sm,
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
  row: {
    flexDirection: 'row',
    backgroundColor: COLORS.muted,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  row_icon: {
    marginRight: SPACING.sm,
    marginTop: 2,
  },
  row_text: {
    flex: 1,
  },
  row_name: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
  },
  row_type: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 14,
    marginTop: 2,
  },
  detail: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    opacity: 0.8,
  },
  progress_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: 6,
  },
  progress_bar: {
    flex: 1,
  },
  progress_text: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 12,
  },
  tag_row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  tag: {
    paddingVertical: 3,
    paddingHorizontal: SPACING.sm,
    borderRadius: 10,
  },
  complete_tag: {
    backgroundColor: COLORS.success,
  },
  progress_tag: {
    backgroundColor: COLORS.action,
  },
  worse_tag: {
    backgroundColor: COLORS.danger,
  },
  tag_text: {
    color: COLORS.text_light,
    fontFamily: FONTS.body_bold,
    fontSize: 11,
  },
  empty_text: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    textAlign: 'center',
    marginTop: SPACING.lg,
    opacity: 0.7,
  },
});
