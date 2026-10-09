import { useEffect, useRef } from 'react'

export default function ModalSheet({
  titleId,
  descriptionId,
  initialFocusRef,
  onDismiss,
  className = '',
  children,
}) {
  const dialogRef = useRef(null)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previousFocus = document.activeElement

    function dismiss(event) {
      event.preventDefault()
      onDismissRef.current()
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') dismiss(event)
    }

    dialog.addEventListener('cancel', dismiss)
    dialog.addEventListener('keydown', handleKeyDown)
    dialog.showModal()
    initialFocusRef?.current?.focus()

    return () => {
      dialog.removeEventListener('cancel', dismiss)
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
      className={`sheet ${className}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss()
      }}
    >
      {children}
    </dialog>
  )
}