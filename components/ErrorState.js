import ScreenState from './ui/ScreenState';

// shown instead of a blank screen when something couldn't load, like being offline or the server being down
// props: message, onRetry
// milestone 2: it's the shared ScreenState now, so every screen's error looks and reads the same
function ErrorState(props) {
  return (
    <ScreenState
      status="error"
      title="Something went wrong"
      message={props.message}
      onRetry={props.onRetry}
    />
  );
}

export default ErrorState;
