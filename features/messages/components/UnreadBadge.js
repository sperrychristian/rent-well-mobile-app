import Badge from '../../../components/ui/Badge';

// a red circle with the unread count, it hides itself at zero
// props: count, style (to position it)
// the design pass moved the look into components/ui/Badge.js, this keeps the message wording
function UnreadBadge(props) {
  if (!props.count) {
    return null;
  }
  return (
    <Badge
      count={props.count}
      style={props.style}
      label={props.count + (props.count === 1 ? ' unread message' : ' unread messages')}
    />
  );
}

export default UnreadBadge;
