import Button from './ui/Button';

// the design pass moved the button into components/ui/Button.js, this keeps every old PrimaryButton working
// with no variant it's the plain steel blue one screens have always recolored with style,
// and new code can pass variant (primary, secondary, tertiary, destructive), size, loading, and disabled
function PrimaryButton(props) {
  return <Button variant="plain" {...props} />;
}

export default PrimaryButton;
