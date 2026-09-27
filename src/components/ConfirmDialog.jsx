import { useEffect, useRef } from 'react'

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  danger = true,
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null)
  const cancelButtonRef = useRef(null)
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previousFocus = document.activeElement

    function handleCancel(event) {
      event.preventDefault()
      onCancelRef.current()
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancelRef.current()
      }
    }

    dialog.addEventListener('cancel', handleCancel)
    dialog.addEventListener('keydown', handleKeyDown)
    dialog.showModal()
    cancelButtonRef.current?.focus()

    return () => {
      dialog.removeEventListener('cancel', handleCancel)
      dialog.removeEventListener('keydown', handleKeyDown)
      if (dialog.open) dialog.close()
      queueMicrotask(() => {
        if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
          previousFocus.focus()
          return
        }
        document.querySelector('main[tabindex="-1"]')?.focus()
      })
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-description"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <h2 id="confirm-title">{title}</h2>
      <p id="confirm-description">{message}</p>
      <div className="dialog-actions">
        <button ref={cancelButtonRef} type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
