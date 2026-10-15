import { Text } from 'react-native';
import { formatCurrency, isNegativeAmount } from '../../utils/formatCurrency';
import { COLORS, NUMBERS } from '../../theme';

// an amount of money drawn the same way everywhere: formatCurrency, tabular digits, and red when it's negative
// props: value, signed (a + on positive amounts, and green for them), cents (false drops the .00), style
function MoneyText(props) {
  const negative = isNegativeAmount(props.value);
  const positive_change = props.signed && !negative && Number(props.value) > 0;
  return (
    <Text
      style={[
        NUMBERS,
        props.style,
        negative && { color: COLORS.danger_text },
        positive_change && { color: COLORS.success_text },
      ]}
      numberOfLines={props.numberOfLines}
    >
      {formatCurrency(props.value, { signed: props.signed, cents: props.cents })}
    </Text>
  );
}

export default MoneyText;
