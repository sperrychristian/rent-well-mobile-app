import { conditions } from '../data/checklistTemplates';

// pure helpers for checklists, nothing in here touches state, files, or the clock, so they're easy to test
// makeId gets passed in so the tests can use ids they know ahead of time

// shown on sign-off, on a signed checklist, and at the end of the export
export const checklist_disclaimer =
  'This checklist is a record of the unit condition, not legal advice. Check your local rules on inspections and deposits.';

export function makeItem(name, makeId) {
  return {
    id: makeId(),
    name: name,
    done: false,
    condition: null,
    note: '',
    photos: [],
    move_in_condition: null,
    move_in_note: '',
  };
}

export function makeRoom(name, item_names, makeId) {
  return {
    id: makeId(),
    name: name,
    items: item_names.map((item_name) => makeItem(item_name, makeId)),
  };
}

// a fresh copy of the template with new ids, so nothing on the checklist points back at the template
export function copyTemplate(template, makeId) {
  return template.rooms.map((room) => makeRoom(room.name, room.items, makeId));
}

function sameName(a, b) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// starts from the move-in rooms, custom ones too, and keeps each move-in condition and note to compare against
// then anything in the move-out template that the move-in didn't have gets added at the end of its room
export function buildMoveOutRooms(move_in_rooms, move_out_template, makeId) {
  const rooms = move_in_rooms.map((room) => ({
    id: makeId(),
    name: room.name,
    items: room.items.map((item) => ({
      ...makeItem(item.name, makeId),
      move_in_condition: item.condition,
      move_in_note: item.note || '',
    })),
  }));

  move_out_template.rooms.forEach((template_room) => {
    const match = rooms.find((room) => sameName(room.name, template_room.name));
    if (!match) {
      rooms.push(makeRoom(template_room.name, template_room.items, makeId));
      return;
    }
    template_room.items.forEach((item_name) => {
      if (!match.items.some((item) => sameName(item.name, item_name))) {
        match.items.push(makeItem(item_name, makeId));
      }
    });
  });

  return rooms;
}

export function roomProgress(room) {
  return {
    done: room.items.filter((item) => item.done).length,
    total: room.items.length,
  };
}

export function checklistProgress(checklist) {
  return checklist.rooms.reduce(
    (sum, room) => {
      const progress = roomProgress(room);
      return { done: sum.done + progress.done, total: sum.total + progress.total };
    },
    { done: 0, total: 0 },
  );
}

// Good is 0, Fair is 1, Poor is 2, so a bigger number is a worse condition
export function conditionGotWorse(before, after) {
  const before_rank = conditions.indexOf(before);
  const after_rank = conditions.indexOf(after);
  if (before_rank === -1 || after_rank === -1) {
    return false;
  }
  return after_rank > before_rank;
}

export function itemGotWorse(item) {
  return conditionGotWorse(item.move_in_condition, item.condition);
}

export function worseCount(checklist) {
  let count = 0;
  checklist.rooms.forEach((room) => {
    count += room.items.filter(itemGotWorse).length;
  });
  return count;
}

export function filterChecklists(checklists, filter) {
  if (filter === 'In progress') {
    return checklists.filter((checklist) => !checklist.completed);
  }
  if (filter === 'Complete') {
    return checklists.filter((checklist) => checklist.completed);
  }
  return checklists;
}

// every stored photo name on these rooms, so the files can be deleted along with them
export function photoNames(rooms) {
  const names = [];
  rooms.forEach((room) => {
    room.items.forEach((item) => {
      names.push(...(item.photos || []));
    });
  });
  return names;
}

// these swap out only the matching room or item and leave everything else as it was
export function updateItemIn(rooms, room_id, item_id, changes) {
  return rooms.map((room) =>
    room.id !== room_id
      ? room
      : {
          ...room,
          items: room.items.map((item) => (item.id === item_id ? { ...item, ...changes } : item)),
        },
  );
}

export function addItemTo(rooms, room_id, item) {
  return rooms.map((room) =>
    room.id === room_id ? { ...room, items: [...room.items, item] } : room,
  );
}

export function removeItemFrom(rooms, room_id, item_id) {
  return rooms.map((room) =>
    room.id === room_id
      ? { ...room, items: room.items.filter((item) => item.id !== item_id) }
      : room,
  );
}

// the plain text summary that gets shared, one block per room
export function buildChecklistText(checklist) {
  const progress = checklistProgress(checklist);
  const lines = [
    'Rent Well ' + checklist.type + ' checklist',
    'Property: ' + checklist.property,
    'Tenant: ' + (checklist.tenant || 'Not set'),
    'Started: ' + checklist.created_at,
  ];
  if (checklist.completed) {
    lines.push('Signed by: ' + checklist.signed_by + ' on ' + checklist.signed_on);
  } else {
    lines.push('Status: In progress, not signed');
  }
  lines.push('Done: ' + progress.done + ' of ' + progress.total);
  const worse = worseCount(checklist);
  if (worse > 0) {
    lines.push('Worse since move-in: ' + worse);
  }

  checklist.rooms.forEach((room) => {
    const room_progress = roomProgress(room);
    lines.push('');
    lines.push(room.name + ' (' + room_progress.done + ' of ' + room_progress.total + ')');
    room.items.forEach((item) => {
      let line = (item.done ? '[x] ' : '[ ] ') + item.name;
      if (item.condition) {
        line += ': ' + item.condition;
      }
      if (item.move_in_condition) {
        line += ' (move-in: ' + item.move_in_condition + ')';
      }
      if (itemGotWorse(item)) {
        line += ' WORSE SINCE MOVE-IN';
      }
      lines.push(line);
      if (item.note) {
        lines.push('    Note: ' + item.note);
      }
      if (item.move_in_note) {
        lines.push('    Move-in note: ' + item.move_in_note);
      }
      if (item.photos && item.photos.length > 0) {
        lines.push('    Photos: ' + item.photos.length + ' (kept in the app)');
      }
    });
  });

  lines.push('');
  lines.push(checklist_disclaimer);
  return lines.join('\n');
}
