// pure helpers for the pixel art, nothing here draws anything so the tests can check them
// a drawing is written as rows of characters (easy to see the picture in the code), with a legend that says
// which theme color each character is, and '.' is see-through
// buildGrid turns that into what PixelArt draws: grid (rows of palette indexes, 0 is see-through) and palette (token names)

export function buildGrid(drawing) {
  const palette = [null];
  const index_of = { '.': 0 };
  Object.keys(drawing.legend).forEach((character) => {
    index_of[character] = palette.length;
    palette.push(drawing.legend[character]);
  });
  const grid = drawing.rows.map((row) =>
    row.split('').map((character) => (character in index_of ? index_of[character] : -1)),
  );
  return { grid, palette };
}

// checks a grid before it's drawn: every row the same width, and every index in the palette
// gives back a list of problems, empty when it's fine
export function validateGrid(grid, palette, color_tokens) {
  const problems = [];
  if (!Array.isArray(grid) || grid.length === 0) {
    return ['the grid is empty'];
  }
  if (!Array.isArray(palette) || palette.length === 0) {
    return ['the palette is empty'];
  }
  const width = Array.isArray(grid[0]) ? grid[0].length : 0;
  if (width === 0) {
    problems.push('the first row is empty');
  }
  grid.forEach((row, row_index) => {
    if (!Array.isArray(row) || row.length !== width) {
      problems.push('row ' + row_index + ' is not ' + width + ' wide');
      return;
    }
    row.forEach((value, column) => {
      if (!Number.isInteger(value) || value < 0 || value >= palette.length) {
        problems.push('row ' + row_index + ' column ' + column + ' has no color');
      }
    });
  });
  // index 0 is always see-through, every other one has to be a real theme color
  palette.slice(1).forEach((token) => {
    if (color_tokens && !(token in color_tokens)) {
      problems.push(token + ' is not a theme color');
    }
  });
  return problems;
}

// side by side pixels of the same color become one wide rectangle, so a 20 by 17 drawing is a few dozen shapes
// instead of a few hundred, gives back [{ x, y, width, index }]
export function gridToRuns(grid) {
  const runs = [];
  grid.forEach((row, y) => {
    let start = 0;
    while (start < row.length) {
      const index = row[start];
      let end = start + 1;
      while (end < row.length && row[end] === index) {
        end++;
      }
      if (index > 0) {
        runs.push({ x: start, y, width: end - start, index });
      }
      start = end;
    }
  });
  return runs;
}

// the drawing's width and height in pixels
export function gridSize(grid) {
  return { columns: grid.length > 0 ? grid[0].length : 0, rows: grid.length };
}
