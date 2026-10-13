// the pixel art drawings, each one is rows of characters plus a legend of theme color tokens ('.' is see-through)
// they all share the pixel_ palette in theme.js so they look like one set, and pixelDrawings.test.js checks
// that every row is the same width and every color is a real token

// the logo mark, redrawn from assets/images/pixel_art_house.png one square at a time (20 by 17)
// sun, a stepped two-tone roof with a chimney, two windows with a glint, a door with a knob, a path, and grass
export const house = {
  legend: {
    s: 'pixel_sun',
    R: 'pixel_roof',
    D: 'pixel_roof_dark',
    c: 'pixel_chimney',
    C: 'pixel_chimney_dark',
    W: 'pixel_wall',
    S: 'pixel_wall_shade',
    F: 'pixel_frame',
    G: 'pixel_glass',
    L: 'pixel_glass_light',
    O: 'pixel_door',
    N: 'pixel_door_dark',
    K: 'pixel_sun',
    g: 'pixel_grass',
    E: 'pixel_grass_dark',
    P: 'pixel_path',
  },
  rows: [
    '.ss.................',
    'ssss.....RR..CC.....',
    'ssss....DDDD.cc.....',
    '.ss....RRRRRRcc.....',
    '......DDDDDDDDc.....',
    '.....RRRRRRRRRR.....',
    '....DDDDDDDDDDDD....',
    '...RRRRRRRRRRRRRR...',
    '..DDDDDDDDDDDDDDDD..',
    '...WWWWWWWWWWWWWW...',
    '...WFFFFWWWWFFFFW...',
    '...WFLGFWNNWFLGFW...',
    '...WFGGFWOOWFGGFW...',
    '...WFFFFWOKWFFFFW...',
    '...SSSSSSOOSSSSSS...',
    'ggEgggggPPPPggggEggg',
    'gEgggEgggEggggEgggEg',
  ],
};

// a smaller house with no sun and no grass, for tight spots like the app icon's safe zone (16 by 14)
export const house_mark = {
  legend: house.legend,
  rows: [
    '.......RR..CC...',
    '......DDDD.cc...',
    '.....RRRRRRcc...',
    '....DDDDDDDDc...',
    '...RRRRRRRRRR...',
    '..DDDDDDDDDDDD..',
    '.RRRRRRRRRRRRRR.',
    'DDDDDDDDDDDDDDDD',
    '.WWWWWWWWWWWWWW.',
    '.WFFFFWWWWFFFFW.',
    '.WFLGFWNNWFLGFW.',
    '.WFGGFWOOWFGGFW.',
    '.WFFFFWOKWFFFFW.',
    '.SSSSSSOOSSSSSS.',
  ],
};

// ----- empty states, each 16 wide by 14 tall so they line up the same -----

// no work orders: a red toolbox with a steel handle and a gold latch
export const empty_work_orders = {
  legend: {
    h: 'pixel_steel',
    r: 'pixel_roof',
    d: 'pixel_roof_dark',
    k: 'pixel_sun',
    g: 'pixel_grass',
  },
  rows: [
    '................',
    '................',
    '.....hhhhhh.....',
    '.....h....h.....',
    '.....h....h.....',
    '.rrrrrrrrrrrrrr.',
    '.rrrrrrrrrrrrrr.',
    '.dddddddkkddddd.',
    '.rrrrrrrkkrrrrr.',
    '.rrrrrrrrrrrrrr.',
    '.rrrrrrrrrrrrrr.',
    '.dddddddddddddd.',
    '................',
    '..gggggggggggg..',
  ],
};

// no messages: a blue speech bubble with three dots
export const empty_messages = {
  legend: {
    b: 'pixel_bubble',
    w: 'pixel_paper',
    i: 'pixel_ink',
  },
  rows: [
    '................',
    '..bbbbbbbbbbbb..',
    '.bbbbbbbbbbbbbb.',
    '.bbbbbbbbbbbbbb.',
    '.bbbbbbbbbbbbbb.',
    '.bbbwwbbwwbbwwb.',
    '.bbbwwbbwwbbwwb.',
    '.bbbbbbbbbbbbbb.',
    '.bbbbbbbbbbbbbb.',
    '..bbbbbbbbbbbb..',
    '...bbb..........',
    '...bb...........',
    '...b............',
    '................',
  ],
};

// no tenants: a gold key next to a little door
export const empty_tenants = {
  legend: {
    k: 'pixel_coin',
    K: 'pixel_coin_dark',
    o: 'pixel_door',
    n: 'pixel_door_dark',
    w: 'pixel_wall',
    s: 'pixel_sun',
  },
  rows: [
    '..........wwww..',
    '..........wnnw..',
    '..........wnnw..',
    '..........wono..',
    '..kkkk....wooo..',
    '.kKKKKk...wosow.',
    '.kK..Kkkkkwooow.',
    '.kK..KkKKKwooow.',
    '.kKKKKk.K.wooow.',
    '..kkkk..K.wooow.',
    '..........wooow.',
    '..........wwwww.',
    '................',
    '................',
  ],
};

// no documents: a sheet of paper with a folded corner and lines of writing
export const empty_documents = {
  legend: {
    p: 'pixel_paper',
    f: 'pixel_steel',
    i: 'pixel_ink',
  },
  rows: [
    '...ppppppppf....',
    '...pppppppppf...',
    '...ppppppppppf..',
    '...ppppppppfff..',
    '...pp.iiiiiipp..',
    '...pppppppppppp.',
    '...pp.iiiiiiipp.',
    '...pppppppppppp.',
    '...pp.iiiiipppp.',
    '...pppppppppppp.',
    '...pp.iiiiiiipp.',
    '...pppppppppppp.',
    '...pppppppppppp.',
    '................',
  ],
};

// no checklists: a clipboard with two ticked boxes and one empty
export const empty_checklists = {
  legend: {
    o: 'pixel_door',
    s: 'pixel_steel',
    p: 'pixel_paper',
    g: 'pixel_grass',
    i: 'pixel_ink',
  },
  rows: [
    '......ssss......',
    '..ooooossooooo..',
    '..oppppppppppo..',
    '..opgpp.iiiipo..',
    '..opggpppppppo..',
    '..oppppppppppo..',
    '..opgpp.iiiipo..',
    '..opggpppppppo..',
    '..oppppppppppo..',
    '..opiiipiiiipo..',
    '..opipippppppo..',
    '..opiiippppppo..',
    '..oppppppppppo..',
    '..oooooooooooo..',
  ],
};

// no expenses or trips: a stack of gold coins
export const empty_expenses = {
  legend: {
    c: 'pixel_coin',
    d: 'pixel_coin_dark',
    s: 'pixel_sun',
  },
  rows: [
    '................',
    '......cccc......',
    '....ccsscccc....',
    '....cccccccc....',
    '....dddddddd....',
    '....cccccccc....',
    '....dddddddd....',
    '..cccccccccccc..',
    '..ccsscccccccc..',
    '..dddddddddddd..',
    '..cccccccccccc..',
    '..dddddddddddd..',
    '..cccccccccccc..',
    '..dddddddddddd..',
  ],
};

// no payments: a blue card with a gold chip and a stripe
export const empty_payments = {
  legend: {
    b: 'pixel_bubble',
    i: 'pixel_ink',
    k: 'pixel_coin',
    w: 'pixel_paper',
  },
  rows: [
    '................',
    '................',
    '.bbbbbbbbbbbbbb.',
    '.bbbbbbbbbbbbbb.',
    '.iiiiiiiiiiiiii.',
    '.iiiiiiiiiiiiii.',
    '.bbbbbbbbbbbbbb.',
    '.bkkkbbbbbbbbbb.',
    '.bkkkbbbbbbbbbb.',
    '.bbbbbbbbbbbbbb.',
    '.bwwwbwwwbwwbbb.',
    '.bbbbbbbbbbbbbb.',
    '................',
    '................',
  ],
};

// every drawing by name, EmptyState and the tests look them up here
export const drawings = {
  house,
  house_mark,
  empty_work_orders,
  empty_messages,
  empty_tenants,
  empty_documents,
  empty_checklists,
  empty_expenses,
  empty_payments,
};
