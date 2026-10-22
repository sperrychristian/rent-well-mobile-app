import { Image } from 'react-native';
import RemoteImage from './RemoteImage';
import { isReceiptKey } from '../features/expenses/utils/expenseApi';

// a receipt is a file on the phone (the demo and old phone expenses) or an upload key on the server (real mode)
// this draws either one, so the expense screens don't have to care which
// props: value (the uri or key), style, resizeMode, accessibilityLabel
function ReceiptImage(props) {
  if (isReceiptKey(props.value)) {
    return <RemoteImage attachment_key={props.value} style={props.style} />;
  }
  return (
    <Image
      source={{ uri: props.value }}
      style={props.style}
      resizeMode={props.resizeMode}
      accessibilityLabel={props.accessibilityLabel}
    />
  );
}

export default ReceiptImage;
