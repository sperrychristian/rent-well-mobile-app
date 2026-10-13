import { useState } from 'react';
import { StyleSheet, View, Text, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PrimaryButton from '../../../components/PrimaryButton';
import ProgressBar from '../components/ProgressBar';
import NewChecklistModal from '../components/NewChecklistModal';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import { checklistProgress, filterChecklists, worseCount } from '../utils/checklistHelpers';
import { COLORS, SPACING, TYPE, RADIUS, SIZES, OPACITY } from '../../../theme';
import { list_styles } from '../../../components/ui/listStyles';
import EmptyState from '../../../components/ui/EmptyState';
import StatusPill from '../../../components/ui/StatusPill';
import SegmentedControl from '../../../components/ui/SegmentedControl';

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
        variant="primary"
        style={styles.new_button}
        onPress={openNewForm}
      />
      {/* the status filter acts like tabs, so it's the shared segmented control now */}
      <SegmentedControl
        label="Show checklists"
        value={status_filter}
        onChange={setStatusFilter}
        options={status_filters.map((option) => ({ value: option, label: option }))}
        style={styles.segment}
      />
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: SPACING.md }]}>
      <FlatList
        data={list_checklists}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.lg }}
        ListHeaderComponent={list_header}
        ListEmptyComponent={
          <EmptyState
            illustration="empty_checklists"
            title={
              checklists.length === 0
                ? 'No checklists yet, tap New Checklist to start one'
                : 'No checklists match'
            }
          />
        }
        renderItem={({ item }) => {
          const progress = checklistProgress(item);
          const worse = worseCount(item);
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => props.navigation.navigate('ChecklistDetail', { checklistId: item.id })}
              accessibilityRole="button"
              accessibilityLabel={
                item.type +
                ' checklist, ' +
                item.property +
                ', ' +
                progress.done +
                ' of ' +
                progress.total +
                ' done'
              }
            >
              <View style={styles.row_icon}>
                <Ionicons
                  name={item.type === 'Move-In' ? 'log-in-outline' : 'log-out-outline'}
                  size={24}
                  color={item.type === 'Move-In' ? COLORS.info_text : COLORS.accent_text}
                />
              </View>
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
                  <StatusPill
                    label={item.completed ? 'Complete' : 'In progress'}
                    tone={item.completed ? 'Signed' : 'In progress'}
                  />
                  {worse > 0 && (
                    <StatusPill
                      label={worse + (worse === 1 ? ' item' : ' items') + ' worse since move-in'}
                      tone="Late"
                    />
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
    marginHorizontal: 0,
    marginBottom: SPACING.sm,
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
  row: {
    ...list_styles.row,
    flexDirection: 'row',
    gap: SPACING.sm + SPACING.xs,
  },
  row_icon: {
    backgroundColor: COLORS.brand_tint,
    borderRadius: RADIUS.pill,
    width: SIZES.avatar,
    height: SIZES.avatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row_text: {
    flex: 1,
  },
  row_name: {
    ...TYPE.subheading,
    fontFamily: TYPE.heading.fontFamily,
    color: COLORS.text,
  },
  row_type: {
    ...TYPE.label,
    color: COLORS.info_text,
    marginTop: SPACING.xxs,
  },
  detail: {
    ...list_styles.detail,
  },
  progress_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  progress_bar: {
    flex: 1,
  },
  progress_text: {
    ...TYPE.caption,
    color: COLORS.text_muted,
  },
  tag_row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  empty_text: {
    ...list_styles.empty_text,
  },
  pressed: {
    opacity: OPACITY.pressed,
  },
  segment: {
    marginBottom: SPACING.sm + SPACING.xs,
  },
});
