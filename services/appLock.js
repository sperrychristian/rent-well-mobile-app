// the app lock's small shared pieces that live outside React: a pause while a system dialog is up,
// and the push tap that has to wait until the app is unlocked
// a permission prompt, the photo picker, or the camera can send the app to the background for a moment,
// and coming back from one of those should never ask for Face ID

let open_dialogs = 0;
// when the last dialog closed, the lock ignores a background trip that started before then
let last_dialog_closed_at = 0;

// runs a system dialog (a permission prompt, a picker) with the lock paused until it closes
export async function whileSystemDialog(run) {
  open_dialogs++;
  try {
    return await run();
  } finally {
    open_dialogs = Math.max(0, open_dialogs - 1);
    last_dialog_closed_at = Date.now();
  }
}

// true while a system dialog is open, or for a moment right after one closes
// (the app turns active again a beat before the promise above finishes)
export function systemDialogActive(now) {
  const time = now === undefined ? Date.now() : now;
  return open_dialogs > 0 || time - last_dialog_closed_at < 1500;
}

// the tests start each run with nothing open
export function resetSystemDialogs() {
  open_dialogs = 0;
  last_dialog_closed_at = 0;
}
