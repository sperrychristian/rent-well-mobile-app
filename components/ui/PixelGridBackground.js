import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { COLORS } from '../../theme';

// a faint square grid behind the Welcome hero, like graph paper for the pixel house, with a few filled squares
// it's decoration only, so screen readers skip it and taps go straight through
// props: cell (the size of one square, default 24), style
const lit_cells = [
  [2, 1],
  [3, 1],
  [9, 3],
  [1, 6],
  [12, 2],
  [13, 7],
  [6, 9],
  [11, 10],
];

function PixelGridBackground(props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const cell = props.cell || 24;

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, props.style]}
      onLayout={(event) => setSize(event.nativeEvent.layout)}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {size.width > 0 && (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <Pattern id="pixel_grid" width={cell} height={cell} patternUnits="userSpaceOnUse">
              <Rect
                x={0}
                y={0}
                width={cell}
                height={cell}
                fill="none"
                stroke={COLORS.grid_line}
                strokeWidth={1}
              />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width={size.width} height={size.height} fill="url(#pixel_grid)" />
          {lit_cells.map(([column, row]) => (
            <Rect
              key={column + '-' + row}
              x={column * cell}
              y={row * cell}
              width={cell}
              height={cell}
              fill={COLORS.grid_line}
            />
          ))}
        </Svg>
      )}
    </View>
  );
}

export default PixelGridBackground;
