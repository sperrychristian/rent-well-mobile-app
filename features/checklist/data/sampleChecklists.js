import { checklist_templates } from './checklistTemplates';
import { copyTemplate, buildMoveOutRooms } from '../utils/checklistHelpers';

// demo only sample checklists, a signed move-in and the move-out started from it, so the worse flags have something to show
// real data starts empty, these never get saved

function daysFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return date.getFullYear() + '-' + month + '-' + day;
}

// fixed ids so the demo looks the same every time
function seedIds(prefix) {
  let count = 0;
  return () => {
    count++;
    return prefix + '-' + count;
  };
}

// fills in every item, with a few rooms tweaked by name
function fillRooms(rooms, answers) {
  return rooms.map((room) => ({
    ...room,
    items: room.items.map((item) => {
      const answer = answers[room.name + ': ' + item.name] || {};
      return { ...item, done: true, condition: 'Good', ...answer };
    }),
  }));
}

const move_in_rooms = fillRooms(copyTemplate(checklist_templates['Move-In'], seedIds('seed-in')), {
  'Kitchen: Countertops': { condition: 'Fair', note: 'Small chip by the sink' },
  'Bedroom: Floor or carpet': { note: 'Carpet cleaned before move-in' },
  'Living Areas: Walls and ceiling': { condition: 'Fair', note: 'Scuff on the hallway wall' },
  'Meter Readings: Electric meter': { condition: null, note: '48213' },
  'Meter Readings: Gas meter': { condition: null, note: '1022' },
  'Meter Readings: Water meter': { condition: null, note: '5530' },
  'Keys Handed Over: Door keys': { condition: null, note: '2 keys' },
  'Keys Handed Over: Mailbox key': { condition: null, note: '1 key' },
});

const move_in_checklist = {
  id: 'seed-checklist-1',
  property: '123 Maple St, Unit 2',
  type: 'Move-In',
  tenant: 'Sam Rivera',
  created_at: daysFromToday(-380),
  move_in_id: null,
  completed: true,
  signed_by: 'Sam Rivera',
  signed_on: daysFromToday(-380),
  rooms: move_in_rooms,
};

// about half done, with a couple of items that got worse
const move_out_rooms = buildMoveOutRooms(
  move_in_rooms,
  checklist_templates['Move-Out'],
  seedIds('seed-out'),
).map((room) => {
  if (room.name === 'Kitchen') {
    return fillRooms([room], {
      'Kitchen: Countertops': { condition: 'Poor', note: 'Burn mark next to the stove' },
      'Kitchen: Refrigerator': { condition: 'Fair', note: 'Crisper drawer cracked' },
    })[0];
  }
  if (room.name === 'Bathroom' || room.name === 'Bedroom') {
    return fillRooms([room], {})[0];
  }
  return room;
});

const move_out_checklist = {
  id: 'seed-checklist-2',
  property: '123 Maple St, Unit 2',
  type: 'Move-Out',
  tenant: 'Sam Rivera',
  created_at: daysFromToday(-2),
  move_in_id: 'seed-checklist-1',
  completed: false,
  signed_by: '',
  signed_on: null,
  rooms: move_out_rooms,
};

export const sample_checklists = [move_in_checklist, move_out_checklist];
