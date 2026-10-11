// the two built-in templates, a new checklist copies one of these so editing a checklist never changes them
// meter readings and keys use the note for the reading or the key count

export const checklist_types = ['Move-In', 'Move-Out'];

export const conditions = ['Good', 'Fair', 'Poor'];

// the rooms both templates share
const shared_rooms = [
  {
    name: 'Kitchen',
    items: [
      'Walls and ceiling',
      'Floor',
      'Cabinets and drawers',
      'Countertops',
      'Sink and faucet',
      'Stove and oven',
      'Refrigerator',
      'Dishwasher',
      'Lights and outlets',
    ],
  },
  {
    name: 'Bathroom',
    items: [
      'Walls and ceiling',
      'Floor',
      'Toilet',
      'Sink and faucet',
      'Tub and shower',
      'Mirror and cabinet',
      'Exhaust fan',
      'Lights and outlets',
    ],
  },
  {
    name: 'Bedroom',
    items: [
      'Walls and ceiling',
      'Floor or carpet',
      'Closet and doors',
      'Windows and screens',
      'Blinds or curtains',
      'Lights and outlets',
    ],
  },
  {
    name: 'Living Areas',
    items: [
      'Walls and ceiling',
      'Floor or carpet',
      'Windows and screens',
      'Blinds or curtains',
      'Lights and outlets',
      'Smoke and CO detectors',
      'Heating and AC',
    ],
  },
  {
    name: 'Exterior',
    items: ['Front door and lock', 'Porch or patio', 'Yard', 'Garage or parking', 'Trash bins'],
  },
  {
    name: 'Meter Readings',
    items: ['Electric meter', 'Gas meter', 'Water meter'],
  },
  // same item names on both so a move-out made from a move-in lines up item for item
  {
    name: 'Keys Handed Over',
    items: ['Door keys', 'Mailbox key', 'Garage remote or key', 'Gate or fob'],
  },
];

export const checklist_templates = {
  'Move-In': {
    rooms: shared_rooms,
  },
  'Move-Out': {
    rooms: [
      ...shared_rooms,
      {
        name: 'Move-Out Wrap Up',
        items: ['Personal items removed', 'Unit cleaned', 'Forwarding address collected'],
      },
    ],
  },
};
