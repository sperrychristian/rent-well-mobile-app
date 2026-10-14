import StatusLabel from './StatusLabel';

// a small colored pill for a status or tag, it always shows the words (and an icon) so it's never color only
// props: label (the status text, like Open or Resolved), tone (optional, a status name to borrow colors from),
//   show_icon (default true), style
// the fintech pass: tone can also be a plain tone name (danger, warning, info, neutral...) with icon picking the icon,
// for tags that aren't statuses, like an expiring lease
// the Hearth pass dropped the pill: this hands everything to StatusLabel (an icon and colored words),
// so old screens keep working while they move over to StatusLabel
function StatusPill(props) {
  return <StatusLabel {...props} />;
}

export default StatusPill;
