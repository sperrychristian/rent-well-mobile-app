import {
  copyTemplate,
  buildMoveOutRooms,
  roomProgress,
  checklistProgress,
  conditionGotWorse,
  itemGotWorse,
  worseCount,
  filterChecklists,
  photoNames,
  updateItemIn,
  addItemTo,
  removeItemFrom,
  buildChecklistText,
  makeItem,
} from './checklistHelpers';
import { checklist_templates } from '../data/checklistTemplates';

// counts up so every test gets ids it can predict
function idMaker() {
  let count = 0;
  return () => {
    count++;
    return 'id-' + count;
  };
}

const small_template = {
  rooms: [
    { name: 'Kitchen', items: ['Stove', 'Sink'] },
    { name: 'Keys', items: ['Door keys'] },
  ],
};

describe('copyTemplate', () => {
  test('makes rooms and items with fresh ids and blank answers', () => {
    const rooms = copyTemplate(small_template, idMaker());
    expect(rooms).toHaveLength(2);
    expect(rooms[0].id).toBe('id-1');
    expect(rooms[0].name).toBe('Kitchen');
    expect(rooms[0].items.map((item) => item.id)).toEqual(['id-2', 'id-3']);
    expect(rooms[0].items[0]).toEqual({
      id: 'id-2',
      name: 'Stove',
      done: false,
      condition: null,
      note: '',
      photos: [],
      move_in_condition: null,
      move_in_note: '',
    });
  });

  test('editing the copy never changes the template', () => {
    const rooms = copyTemplate(small_template, idMaker());
    rooms[0].items.push(makeItem('Extra', () => 'x'));
    rooms[0].name = 'Changed';
    expect(small_template.rooms[0].items).toEqual(['Stove', 'Sink']);
    expect(small_template.rooms[0].name).toBe('Kitchen');
  });

  test('two copies share nothing', () => {
    const make_id = idMaker();
    const first = copyTemplate(small_template, make_id);
    const second = copyTemplate(small_template, make_id);
    first[0].items[0].done = true;
    expect(second[0].items[0].done).toBe(false);
    expect(first[0].id).not.toBe(second[0].id);
  });

  test('both built-in templates copy without errors', () => {
    expect(copyTemplate(checklist_templates['Move-In'], idMaker()).length).toBeGreaterThan(5);
    expect(copyTemplate(checklist_templates['Move-Out'], idMaker()).length).toBeGreaterThan(5);
  });
});

describe('buildMoveOutRooms', () => {
  const move_in_rooms = [
    {
      id: 'r1',
      name: 'Kitchen',
      items: [
        { ...makeItem('Stove', () => 'i1'), done: true, condition: 'Good', note: 'Clean' },
        { ...makeItem('Wine rack', () => 'i2'), done: true, condition: 'Fair' },
      ],
    },
  ];
  const move_out_template = {
    rooms: [
      { name: 'kitchen', items: ['Stove', 'Sink'] },
      { name: 'Wrap Up', items: ['Unit cleaned'] },
    ],
  };

  test('keeps move-in items, custom ones too, with their condition and note', () => {
    const rooms = buildMoveOutRooms(move_in_rooms, move_out_template, idMaker());
    const stove = rooms[0].items[0];
    expect(stove.name).toBe('Stove');
    expect(stove.move_in_condition).toBe('Good');
    expect(stove.move_in_note).toBe('Clean');
    expect(stove.done).toBe(false);
    expect(stove.condition).toBeNull();
    expect(rooms[0].items[1].name).toBe('Wine rack');
    expect(rooms[0].items[1].move_in_condition).toBe('Fair');
  });

  test('adds template items and rooms the move-in did not have, matching names loosely', () => {
    const rooms = buildMoveOutRooms(move_in_rooms, move_out_template, idMaker());
    expect(rooms[0].items.map((item) => item.name)).toEqual(['Stove', 'Wine rack', 'Sink']);
    expect(rooms[0].items[2].move_in_condition).toBeNull();
    expect(rooms[1].name).toBe('Wrap Up');
    expect(rooms).toHaveLength(2);
  });

  test('does not change the move-in rooms', () => {
    buildMoveOutRooms(move_in_rooms, move_out_template, idMaker());
    expect(move_in_rooms[0].items).toHaveLength(2);
    expect(move_in_rooms[0].items[0].done).toBe(true);
  });
});

describe('progress', () => {
  const checklist = {
    rooms: [
      {
        id: 'a',
        name: 'A',
        items: [
          { id: '1', done: true },
          { id: '2', done: false },
        ],
      },
      { id: 'b', name: 'B', items: [{ id: '3', done: true }] },
      { id: 'c', name: 'Empty', items: [] },
    ],
  };

  test('counts done items per room', () => {
    expect(roomProgress(checklist.rooms[0])).toEqual({ done: 1, total: 2 });
    expect(roomProgress(checklist.rooms[2])).toEqual({ done: 0, total: 0 });
  });

  test('adds up every room for the whole checklist', () => {
    expect(checklistProgress(checklist)).toEqual({ done: 2, total: 3 });
    expect(checklistProgress({ rooms: [] })).toEqual({ done: 0, total: 0 });
  });
});

describe('condition comparison', () => {
  test('only a move to a worse condition counts', () => {
    expect(conditionGotWorse('Good', 'Fair')).toBe(true);
    expect(conditionGotWorse('Good', 'Poor')).toBe(true);
    expect(conditionGotWorse('Fair', 'Poor')).toBe(true);
    expect(conditionGotWorse('Good', 'Good')).toBe(false);
    expect(conditionGotWorse('Poor', 'Fair')).toBe(false);
  });

  test('a missing condition on either side never counts', () => {
    expect(conditionGotWorse(null, 'Poor')).toBe(false);
    expect(conditionGotWorse('Good', null)).toBe(false);
    expect(conditionGotWorse(undefined, undefined)).toBe(false);
  });

  test('itemGotWorse and worseCount read the move-in condition', () => {
    const worse = { move_in_condition: 'Good', condition: 'Poor' };
    const same = { move_in_condition: 'Fair', condition: 'Fair' };
    expect(itemGotWorse(worse)).toBe(true);
    expect(itemGotWorse(same)).toBe(false);
    expect(worseCount({ rooms: [{ items: [worse, same, worse] }] })).toBe(2);
  });
});

describe('filterChecklists', () => {
  const list = [
    { id: '1', completed: false },
    { id: '2', completed: true },
  ];

  test('splits by status', () => {
    expect(filterChecklists(list, 'All')).toHaveLength(2);
    expect(filterChecklists(list, 'In progress').map((item) => item.id)).toEqual(['1']);
    expect(filterChecklists(list, 'Complete').map((item) => item.id)).toEqual(['2']);
  });
});

describe('room and item edits', () => {
  function sampleRooms() {
    return copyTemplate(small_template, idMaker());
  }

  test('updateItemIn changes only the matching item', () => {
    const rooms = sampleRooms();
    const updated = updateItemIn(rooms, 'id-1', 'id-2', { done: true, condition: 'Fair' });
    expect(updated[0].items[0].done).toBe(true);
    expect(updated[0].items[0].condition).toBe('Fair');
    expect(updated[0].items[1].done).toBe(false);
    expect(updated[1]).toBe(rooms[1]);
    expect(rooms[0].items[0].done).toBe(false);
  });

  test('addItemTo and removeItemFrom', () => {
    const rooms = sampleRooms();
    const added = addItemTo(
      rooms,
      'id-4',
      makeItem('Garage remote', () => 'new'),
    );
    expect(added[1].items.map((item) => item.name)).toEqual(['Door keys', 'Garage remote']);
    const removed = removeItemFrom(added, 'id-4', 'new');
    expect(removed[1].items.map((item) => item.name)).toEqual(['Door keys']);
  });

  test('photoNames collects every photo', () => {
    const rooms = updateItemIn(sampleRooms(), 'id-1', 'id-3', { photos: ['a.jpg', 'b.jpg'] });
    expect(photoNames(rooms)).toEqual(['a.jpg', 'b.jpg']);
  });
});

describe('buildChecklistText', () => {
  test('lists the header, rooms, items, worse flags, and disclaimer', () => {
    const rooms = buildMoveOutRooms(
      [
        {
          id: 'r',
          name: 'Kitchen',
          items: [{ ...makeItem('Stove', () => 's'), condition: 'Good' }],
        },
      ],
      { rooms: [] },
      idMaker(),
    );
    rooms[0].items[0] = {
      ...rooms[0].items[0],
      done: true,
      condition: 'Poor',
      note: 'Burner broken',
      photos: ['p.jpg'],
    };
    const text = buildChecklistText({
      type: 'Move-Out',
      property: '48 Cedar Ave',
      tenant: 'Alex Chen',
      created_at: '2026-10-01',
      completed: true,
      signed_by: 'Alex Chen',
      signed_on: '2026-10-02',
      rooms: rooms,
    });
    expect(text).toContain('Rent Well Move-Out checklist');
    expect(text).toContain('Signed by: Alex Chen on 2026-10-02');
    expect(text).toContain('Done: 1 of 1');
    expect(text).toContain('Worse since move-in: 1');
    expect(text).toContain('Kitchen (1 of 1)');
    expect(text).toContain('[x] Stove: Poor (move-in: Good) WORSE SINCE MOVE-IN');
    expect(text).toContain('    Note: Burner broken');
    expect(text).toContain('    Photos: 1');
    expect(text).toContain('not legal advice');
  });
});
