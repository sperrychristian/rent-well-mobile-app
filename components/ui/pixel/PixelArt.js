import { useMemo } from 'react';
import Svg, { Rect } from 'react-native-svg';
import { buildGrid, validateGrid, gridToRuns, gridSize } from './pixelHelpers';
import { drawings } from './pixelDrawings';
import { COLORS } from '../../../theme';

// draws one of the pixel drawings as crisp squares, every color comes from the theme's pixel_ tokens
// props: name (a drawing in pixelDrawings.js), or grid and palette (rows of indexes and the token names),
//   pixel (how big one square is, default 6), label (what a screen reader says, leave it out for decoration), style
function PixelArt(props) {
  const built = useMemo(() => {
    if (props.grid) {
      return { grid: props.grid, palette: props.palette };
    }
    const drawing = drawings[props.name];
    return drawing ? buildGrid(drawing) : null;
  }, [props.name, props.grid, props.palette]);

  // a broken drawing draws nothing instead of crashing the screen, and says why in the log
  const problems = built ? validateGrid(built.grid, built.palette, COLORS) : ['no drawing'];
  if (problems.length > 0) {
    console.log('PixelArt could not draw ' + (props.name || 'the grid'), problems);
    return null;
  }

  const { columns, rows } = gridSize(built.grid);
  const pixel = props.pixel || 6;
  const runs = gridToRuns(built.grid);

  return (
    <Svg
      width={columns * pixel}
      height={rows * pixel}
      viewBox={'0 0 ' + columns + ' ' + rows}
      // crispEdges keeps the squares sharp instead of blurring where they meet
      shapeRendering="crispEdges"
      style={props.style}
      accessible={!!props.label}
      accessibilityRole={props.label ? 'image' : undefined}
      accessibilityLabel={props.label}
      importantForAccessibility={props.label ? 'yes' : 'no-hide-descendants'}
    >
      {runs.map((run) => (
        <Rect
          key={run.x + '-' + run.y}
          x={run.x}
          y={run.y}
          width={run.width}
          height={1}
          fill={COLORS[built.palette[run.index]]}
        />
      ))}
    </Svg>
  );
}

export default PixelArt;
