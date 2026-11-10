/**
 * "Share link": makes a link to the open animation and shows it, ready to copy. The link
 * holds the whole animation, so there's nothing to upload and nothing to expire.
 */
import { SHARE_LINK_WARN_LENGTH } from '@icontween/core';
import { useEffect, useRef, useState } from 'react';
import { makeShareLink } from './share';

export function ShareButton() {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLInputElement>(null);

  /** Selects the whole link for ⌘C, but keeps its start (the site) in view. */
  const selectLink = () => {
    field.current?.select();
    if (field.current) field.current.scrollLeft = 0;
  };

  useEffect(() => {
    if (link && dialog.current && !dialog.current.open) {
      dialog.current.showModal();
      selectLink();
    }
  }, [link]);

  const share = async () => {
    setCopied(null);
    setLink(await makeShareLink());
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied('yes');
    } catch {
      // Some embedded browsers block the clipboard; the link is selected for ⌘C instead.
      selectLink();
      setCopied('failed');
    }
  };

  const close = () => {
    dialog.current?.close();
    setLink(null);
  };

  return (
    <>
      <button
        type="button"
        className="button title-button"
        onClick={() => void share()}
        title="Make a link that opens this animation in IconTween"
      >
        Share link
      </button>
      <dialog
        ref={dialog}
        className="app-dialog share-dialog"
        aria-labelledby="share-dialog-title"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        {link && (
          <form
            method="dialog"
            onSubmit={(e) => {
              e.preventDefault();
              void copy();
            }}
          >
            <h2 id="share-dialog-title">Share link</h2>
            <p>
              Anyone with this link can open the animation in IconTween. The animation is in the
              link itself, so nothing is uploaded.
            </p>
            <input
              ref={field}
              className="share-link-field"
              readOnly
              value={link}
              aria-label="Share link"
              onFocus={selectLink}
            />
            <p className="share-link-size">
              {link.length.toLocaleString()} characters
              {link.length > SHARE_LINK_WARN_LENGTH &&
                '. That’s long: some chat and mail apps cut links this size. ' +
                  'If it doesn’t open, send the project file (Export) instead.'}
            </p>
            <div className="app-dialog-buttons">
              <span className="share-copied" role="status">
                {copied === 'yes' && 'Copied'}
                {copied === 'failed' && `Press ${isMac ? '⌘' : 'Ctrl+'}C to copy`}
              </span>
              <button type="button" className="button" onClick={close}>
                Done
              </button>
              <button type="submit" className="button is-primary">
                Copy link
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}

const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform);
