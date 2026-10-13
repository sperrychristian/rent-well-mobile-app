import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { sparklinePoints } from './uiHelpers';
import { COLORS } from '../../theme';

// a tiny trend line with a dot on the newest value, no axes or grid, just the shape of the numbers
// it fills its parent's width, the label says the numbers out loud since the line itself can't
// props: values (oldest first), height (default 40), color (a theme color, default the brand), label, style
function Sparkline(props) {
  const [width, setWidth] = useState(0);
  const height = props.height || 40;
  const color = props.color || COLORS.cta;
  const points = sparklinePoints(props.values, width, height, 3);
  const last = points[points.length - 1];

  return (
    <View
      style={[{ height: height }, props.style]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessible={!!props.label}
      accessibilityRole={props.label ? 'image' : undefined}
      accessibilityLabel={props.label}
    >
      {width > 0 && points.length > 1 ? (
        <Svg width={width} height={height}>
          <Polyline
            points={points.map((point) => point.x + ',' + point.y).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Circle cx={last.x} cy={last.y} r={3} fill={color} />
        </Svg>
      ) : null}
    </View>
  );
}

export default Sparkline;
