import { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import ProgressBar from '../components/ProgressBar';
import ChecklistItemModal from '../components/ChecklistItemModal';
import SignOffModal from '../components/SignOffModal';
import NameModal from '../components/NameModal';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import {
  checklistProgress,
  roomProgress,
  itemGotWorse,
  worseCount,
  checklist_disclaimer,
} from '../utils/checklistHelpers';
import { shareChecklistText } from '../utils/exportChecklist';
import { COLORS, SPACING, TYPE, RADIUS, BORDER, SIZES, OPACITY } from '../../../theme';
import { list_styles } from '../../../components/ui/listStyles';
import StatusPill from '../../../components/ui/StatusPill';

function ChecklistDetailScreen(props) {
  // need the insets so the title clears the notch and status bar
  const insets = useSafeAreaInsets();
  const {
    checklists,
    demo_mode,
    addChecklist,
    updateChecklistItem,
    addChecklistItem,
    deleteChecklistItem,
    addChecklistRoom,
    deleteChecklistRoom,
    signChecklist,
    deleteChecklist,
  } = useWorkOrders();

  const checklist_id = props.route.params.checklistId;
  const checklist = checklists.find((current) => current.id === checklist_id);

  // the ids stay set while the item modal slides away, item_open is what shows or hides it
  const [item_ids, setItemIds] = useState(null);
  const [item_open, setItemOpen] = useState(false);
  const [sign_open, setSignOpen] = useState(false);
  // null when closed, otherwise says whether a room or an item (and which room) is being added
  const [name_target, setNameTarget] = useState(null);
  // goes up every time one of the modals opens, the new key gives that form a fresh start
  const [form_key, setFormKey] = useState(0);

  // it can be gone for a moment right after it's deleted, before the screen goes back
  if (!checklist) {
    return <View style={styles.container} />;
  }

  const locked = checklist.completed;
  const progress = checklistProgress(checklist);
  const worse = worseCount(checklist);

  const item_room = item_ids ? checklist.rooms.find((room) => room.id === item_ids.room_id) : null;
  const open_item = item_room ? item_room.items.find((item) => item.id === item_ids.item_id) : null;

  function openItem(room_id, item_id) {
    setFormKey((current) => current + 1);
    setItemIds({ room_id: room_id, item_id: item_id });
    setItemOpen(true);
  }

  function toggleDone(room_id, item) {
    updateChecklistItem(checklist.id, room_id, item.id, { done: !item.done });
  }

  function saveItem(changes) {
    updateChecklistItem(checklist.id, item_ids.room_id, item_ids.item_id, changes);
    setItemOpen(false);
  }

  function deleteItem() {
    setItemOpen(false);
    deleteChecklistItem(checklist.id, item_ids.room_id, item_ids.item_id);
  }

  function openSign() {
    setFormKey((current) => current + 1);
    setSignOpen(true);
  }

  // target is { kind: 'room' } or { kind: 'item', room_id }
  function openName(target) {
    setFormKey((current) => current + 1);
    setNameTarget(target);
  }

  function saveName(name) {
    if (name_target.kind === 'room') {
      addChecklistRoom(checklist.id, name);
    } else {
      addChecklistItem(checklist.id, name_target.room_id, name);
    }
    setNameTarget(null);
  }

  function confirmDeleteRoom(room) {
    Alert.alert('Delete room?', 'This removes ' + room.name + ', its items, and their photos.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteChecklistRoom(checklist.id, room.id),
      },
    ]);
  }

  function handleSign(signed_by, signed_on) {
    signChecklist(checklist.id, signed_by, signed_on);
    setSignOpen(false);
  }

  async function handleExport() {
    try {
      await shareChecklistText(checklist);
    } catch (error) {
      console.log('Could not export checklist', error);
      Alert.alert('Could not export', 'The checklist could not be shared.');
    }
  }

  // push instead of navigate so back comes here to the move-in
  function startMoveOut() {
    const new_id = addChecklist({
      property: checklist.property,
      type: 'Move-Out',
      tenant: checklist.tenant,
      move_in_id: checklist.id,
    });
    props.navigation.push('ChecklistDetail', { checklistId: new_id });
  }

  function confirmDelete() {
    Alert.alert(
      'Delete checklist?',
      'This removes the checklist and all of its photos. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            props.navigation.goBack();
            deleteChecklist(checklist.id);
          },
        },
      ],
    );
  }

  return (
    <View style={[styles.container, { paddingTop: SPACING.md }]}>
      <Text style={styles.name_line}>{checklist.type}</Text>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.lg }}>
        <Card>
          <Text style={styles.info_name}>{checklist.property}</Text>
          {checklist.tenant ? <Text style={styles.detail}>{checklist.tenant}</Text> : null}
          <Text style={styles.detail}>Started {checklist.created_at}</Text>
          {checklist.move_in_id && (
            <Text style={styles.detail}>Compared against the signed move-in</Text>
          )}
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
              label={locked ? 'Complete' : 'In progress'}
              tone={locked ? 'Signed' : 'In progress'}
            />
            {worse > 0 && (
              <StatusPill
                label={worse + (worse === 1 ? ' item' : ' items') + ' worse since move-in'}
                tone="Late"
              />
            )}
          </View>
        </Card>

        {/* once it's signed everything is read only, so I say why up top */}
        {locked && (
          <Card>
            <View style={styles.signed_row}>
              <Ionicons name="lock-closed" size={18} color={COLORS.success_text} />
              <Text style={styles.signed_text}>
                Signed by {checklist.signed_by} on {checklist.signed_on}
              </Text>
            </View>
            <Text style={styles.disclaimer}>{checklist_disclaimer}</Text>
          </Card>
        )}

        {checklist.rooms.map((room) => {
          const room_progress = roomProgress(room);
          return (
            <View key={room.id} style={styles.room}>
              <View style={styles.room_header}>
                <Text style={styles.room_name}>{room.name}</Text>
                <Text style={styles.progress_text}>
                  {room_progress.done} of {room_progress.total}
                </Text>
                {!locked && (
                  <Pressable
                    onPress={() => confirmDeleteRoom(room)}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel={'Delete ' + room.name}
                    style={styles.room_delete}
                  >
                    <Ionicons name="trash-outline" size={18} color={COLORS.danger_text} />
                  </Pressable>
                )}
              </View>
              <ProgressBar done={room_progress.done} total={room_progress.total} />

              {room.items.map((item) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [styles.item_row, pressed && styles.pressed]}
                  onPress={() => openItem(room.id, item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={item.name + (item.condition ? ', ' + item.condition : '')}
                  accessibilityHint="Opens the item's condition, note, and photos"
                >
                  <Pressable
                    onPress={() => toggleDone(room.id, item)}
                    disabled={locked}
                    hitSlop={8}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: item.done, disabled: locked }}
                    accessibilityLabel={item.name}
                  >
                    <Ionicons
                      name={item.done ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={item.done ? COLORS.success_text : COLORS.text_muted}
                    />
                  </Pressable>
                  <View style={styles.item_text}>
                    <Text style={styles.item_name}>{item.name}</Text>
                    {item.note ? (
                      <Text style={styles.item_note} numberOfLines={1}>
                        {item.note}
                      </Text>
                    ) : null}
                    {(item.condition || item.move_in_condition || item.photos.length > 0) && (
                      <View style={styles.tag_row}>
                        {/* the pill uses the same condition colors as the item form */}
                        {item.condition && <StatusPill label={item.condition} />}
                        {item.move_in_condition && (
                          <Text style={styles.item_note}>Move-in: {item.move_in_condition}</Text>
                        )}
                        {itemGotWorse(item) && (
                          <StatusPill label="Changed since move-in" tone="Late" />
                        )}
                        {item.photos.length > 0 && (
                          <View style={styles.photo_count}>
                            <Ionicons name="camera-outline" size={14} color={COLORS.text_muted} />
                            <Text style={styles.item_note}>{item.photos.length}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.text_muted} />
                </Pressable>
              ))}

              {room.items.length === 0 && <Text style={styles.empty_text}>No items yet</Text>}
              {!locked && (
                <Pressable
                  onPress={() => openName({ kind: 'item', room_id: room.id })}
                  hitSlop={{ top: 8, bottom: 8 }}
                  style={styles.add_item}
                  accessibilityRole="button"
                  accessibilityLabel={'Add an item to ' + room.name}
                >
                  <Ionicons name="add" size={18} color={COLORS.info_text} />
                  <Text style={styles.add_item_text}>Add item</Text>
                </Pressable>
              )}
            </View>
          );
        })}

        <View style={styles.actions}>
          {!locked && (
            <PrimaryButton
              title="Add Room"
              icon="add-circle-outline"
              variant="secondary"
              onPress={() => openName({ kind: 'room' })}
              style={styles.action_button}
            />
          )}
          {!locked && (
            <PrimaryButton
              title="Sign Off"
              icon="create-outline"
              variant="primary"
              onPress={openSign}
              style={[styles.action_button, styles.sign_button]}
            />
          )}
          {locked && (
            <PrimaryButton
              title="Export Summary"
              icon="share-outline"
              variant="secondary"
              onPress={handleExport}
              style={[styles.action_button, styles.export_button]}
            />
          )}
          {locked && checklist.type === 'Move-In' && (
            <PrimaryButton
              title="Start Move-Out"
              icon="log-out-outline"
              variant="secondary"
              onPress={startMoveOut}
              style={[styles.action_button, styles.move_out_button]}
            />
          )}
          <PrimaryButton
            title="Delete Checklist"
            icon="trash-outline"
            variant="destructive"
            onPress={confirmDelete}
            style={[styles.action_button, styles.delete_button]}
          />
        </View>
      </ScrollView>

      <ChecklistItemModal
        key={'item-' + form_key}
        visible={item_open}
        item={open_item}
        locked={locked}
        in_demo={demo_mode}
        onSave={saveItem}
        onDelete={deleteItem}
        onClose={() => setItemOpen(false)}
      />
      <SignOffModal
        key={'sign-' + form_key}
        visible={sign_open}
        default_name={checklist.tenant}
        not_done={progress.total - progress.done}
        onSign={handleSign}
        onClose={() => setSignOpen(false)}
      />
      <NameModal
        key={'name-' + form_key}
        visible={name_target !== null}
        title={name_target && name_target.kind === 'room' ? 'Add Room' : 'Add Item'}
        placeholder={
          name_target && name_target.kind === 'room' ? 'e.g. Bedroom 2' : 'e.g. Ceiling fan'
        }
        onSave={saveName}
        onClose={() => setNameTarget(null)}
      />
    </View>
  );
}

export default ChecklistDetailScreen;

const styles = StyleSheet.create({
  // the header has the screen's title now, so the name gets its own plain line instead of the big card
  name_line: {
    ...TYPE.title,
    color: COLORS.title,
    textAlign: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    // the fintech pass: capped and centered on a tablet so lines stay a readable length
    width: '100%',
    maxWidth: SIZES.content_max_width + 160,
    alignSelf: 'center',
  },
  info_name: {
    ...TYPE.heading,
    color: COLORS.text,
    marginBottom: SPACING.xxs,
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
    fontFamily: TYPE.label.fontFamily,
    color: COLORS.text_muted,
  },
  tag_row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  signed_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  signed_text: {
    ...TYPE.body_small,
    fontFamily: TYPE.label.fontFamily,
    color: COLORS.text,
    flex: 1,
  },
  disclaimer: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    marginTop: SPACING.sm,
  },
  room: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  room_header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  room_name: {
    ...TYPE.heading,
    color: COLORS.text,
    flex: 1,
  },
  room_delete: {
    marginLeft: SPACING.xs,
    width: SIZES.touch,
    height: SIZES.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  item_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + SPACING.xs,
    minHeight: SIZES.touch + SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: BORDER.hairline,
    borderBottomColor: COLORS.border,
  },
  item_text: {
    flex: 1,
  },
  item_name: {
    ...TYPE.subheading,
    color: COLORS.text,
  },
  item_note: {
    ...TYPE.caption,
    color: COLORS.text_muted,
  },
  photo_count: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
  },
  empty_text: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
    marginTop: SPACING.sm,
  },
  add_item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    minHeight: SIZES.touch,
    marginTop: SPACING.xs,
    alignSelf: 'flex-start',
  },
  add_item_text: {
    ...TYPE.label,
    fontSize: TYPE.body_small.fontSize,
    color: COLORS.info_text,
  },
  actions: {
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  action_button: {
    marginHorizontal: 0,
  },
  sign_button: {
    marginHorizontal: 0,
  },
  export_button: {
    marginHorizontal: 0,
  },
  move_out_button: {
    marginHorizontal: 0,
  },
  delete_button: {
    marginHorizontal: 0,
  },
  pressed: {
    opacity: OPACITY.pressed,
  },
});
