/**
 * The app's own confirm and message dialogs, on the HTML <dialog> element. `window.confirm`
 * and `window.alert` can be blocked silently (some embedded browsers answer "cancel"
 * without showing anything), so the app doesn't use them.
 *
 * Render <DialogHost /> once per page, then `await askConfirm(…)` from anywhere.
 */
import { useEffect, useRef } from 'react';
import { create } from 'zustand';

interface Request {
  title: string;
  message: string;
  /** Label of the button that goes ahead; no cancel button when this is a message. */
  confirmLabel: string;
  cancel: boolean;
  resolve: (ok: boolean) => void;
}

const useDialog = create<{ request: Request | null }>()(() => ({ request: null }));

function open(request: Omit<Request, 'resolve'>): Promise<boolean> {
  // A new question answers the one still open with "no".
  useDialog.getState().request?.resolve(false);
  return new Promise((resolve) => useDialog.setState({ request: { ...request, resolve } }));
}

/** Resolves true when the person confirms, false on Cancel or Esc. */
export function askConfirm(options: {
  title: string;
  message: string;
  confirmLabel: string;
}): Promise<boolean> {
  return open({ ...options, cancel: true });
}

/** A message with one OK button. */
export function showMessage(options: { title: string; message: string }): Promise<void> {
  return open({ ...options, confirmLabel: 'OK', cancel: false }).then(() => undefined);
}

export function DialogHost() {
  const request = useDialog((s) => s.request);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (request && dialog && !dialog.open) dialog.showModal();
  }, [request]);

  const answer = (ok: boolean) => {
    request?.resolve(ok);
    useDialog.setState({ request: null });
    ref.current?.close();
  };

  return (
    <dialog
      ref={ref}
      className="app-dialog"
      aria-labelledby="app-dialog-title"
      // Esc closes the dialog: that's a cancel.
      onCancel={(e) => {
        e.preventDefault();
        answer(false);
      }}
    >
      {request && (
        <form
          method="dialog"
          onSubmit={(e) => {
            e.preventDefault();
            answer(true);
          }}
        >
          <h2 id="app-dialog-title">{request.title}</h2>
          <p>{request.message}</p>
          <div className="app-dialog-buttons">
            {request.cancel && (
              <button type="button" className="button" onClick={() => answer(false)}>
                Cancel
              </button>
            )}
            <button type="submit" className="button is-primary" autoFocus={!request.cancel}>
              {request.confirmLabel}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
