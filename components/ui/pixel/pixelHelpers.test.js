import { buildGrid, validateGrid, gridToRuns, gridSize } from './pixelHelpers';
import { duotonePalette } from './pixelDuotone';
import { drawings } from './pixelDrawings';
import { COLORS } from '../../../theme';

describe('buildGrid', () => {
  test('turns rows of characters into rows of palette indexes, with 0 see-through', () => {
    const { grid, palette } = buildGrid({
      legend: { a: 'pixel_sun', b: 'pixel_roof' },
      rows: ['.ab', 'ba.'],
    });
    expect(palette).toEqual([null, 'pixel_sun', 'pixel_roof']);
    expect(grid).toEqual([
      [0, 1, 2],
      [2, 1, 0],
    ]);
  });

  test('a character missing from the legend becomes -1 so validation catches it', () => {
    const { grid } = buildGrid({ legend: { a: 'pixel_sun' }, rows: ['az'] });
    expect(grid).toEqual([[1, -1]]);
  });
});

describe('validateGrid', () => {
  const palette = [null, 'pixel_sun'];

  test('a good grid has no problems', () => {
    expect(
      validateGrid(
        [
          [0, 1],
          [1, 0],
        ],
        palette,
        COLORS,
      ),
    ).toEqual([]);
  });

  test('catches empty grids and palettes', () => {
    expect(validateGrid([], palette, COLORS)).toEqual(['the grid is empty']);
    expect(validateGrid(null, palette, COLORS)).toEqual(['the grid is empty']);
    expect(validateGrid([[1]], [], COLORS)).toEqual(['the palette is empty']);
    expect(validateGrid([[]], palette, COLORS)).toContain('the first row is empty');
  });

  test('catches a short row and an index with no color', () => {
    expect(validateGrid([[0, 1], [1]], palette, COLORS)).toEqual(['row 1 is not 2 wide']);
    expect(validateGrid([[0, 5]], palette, COLORS)).toEqual(['row 0 column 1 has no color']);
    expect(validateGrid([[0, -1]], palette, COLORS)).toEqual(['row 0 column 1 has no color']);
    expect(validateGrid([[0, 1.5]], palette, COLORS)).toEqual(['row 0 column 1 has no color']);
  });

  test('every palette color has to be a theme token, so no hex can sneak in', () => {
    expect(validateGrid([[1]], [null, '#ff0000'], COLORS)).toEqual([
      '#ff0000 is not a theme color',
    ]);
  });
});

describe('gridToRuns', () => {
  test('joins same-color neighbors into one rectangle and skips see-through', () => {
    expect(
      gridToRuns([
        [1, 1, 0, 2],
        [0, 0, 0, 0],
        [3, 3, 3, 3],
      ]),
    ).toEqual([
      { x: 0, y: 0, width: 2, index: 1 },
      { x: 3, y: 0, width: 1, index: 2 },
      { x: 0, y: 2, width: 4, index: 3 },
    ]);
  });

  test('the runs cover exactly the colored squares', () => {
    const { grid } = buildGrid(drawings.house);
    const colored = grid.flat().filter((value) => value > 0).length;
    const covered = gridToRuns(grid).reduce((sum, run) => sum + run.width, 0);
    expect(covered).toBe(colored);
  });
});

describe('the drawings', () => {
  test('every drawing is valid and uses only theme colors', () => {
    Object.entries(drawings).forEach(([name, drawing]) => {
      const { grid, palette } = buildGrid(drawing);
      expect({ name, problems: validateGrid(grid, palette, COLORS) }).toEqual({
        name,
        problems: [],
      });
    });
  });

  test('the house is the 20 by 17 grid from the original art, and the empty states are all 16 by 14', () => {
    expect(gridSize(buildGrid(drawings.house).grid)).toEqual({ columns: 20, rows: 17 });
    Object.keys(drawings)
      .filter((name) => name.startsWith('empty_'))
      .forEach((name) => {
        expect({ name, size: gridSize(buildGrid(drawings[name]).grid) }).toEqual({
          name,
          size: { columns: 16, rows: 14 },
        });
      });
  });

  test('there is an empty state for every list the brief names', () => {
    [
      'empty_work_orders',
      'empty_messages',
      'empty_tenants',
      'empty_documents',
      'empty_checklists',
      'empty_expenses',
      'empty_payments',
    ].forEach((name) => expect(drawings[name]).toBeDefined());
  });
});

describe('duotonePalette', () => {
  test('bright colors become the light tone and dark ones the dark tone, see-through stays', () => {
    const palette = [null, 'pixel_paper', 'pixel_door_dark', 'pixel_frame'];
    expect(duotonePalette(palette, COLORS, 'pixel_duo_light', 'pixel_duo_dark')).toEqual([
      null,
      'pixel_duo_light',
      'pixel_duo_dark',
      'pixel_duo_light',
    ]);
  });

  test('every empty state in duotone is still a valid drawing with both tones', () => {
    Object.keys(drawings)
      .filter((name) => name.startsWith('empty_'))
      .forEach((name) => {
        const { grid, palette } = buildGrid(drawings[name]);
        const duo = duotonePalette(palette, COLORS, 'pixel_duo_light', 'pixel_duo_dark');
        expect({ name, problems: validateGrid(grid, duo, COLORS) }).toEqual({ name, problems: [] });
        expect(duo.slice(1).every((token) => token.startsWith('pixel_duo_'))).toBe(true);
      });
  });
});
