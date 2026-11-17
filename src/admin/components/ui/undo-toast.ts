import { toast } from '@medusajs/ui'

/**
 * S7. One-click destructive actions (Resolve, Hide, Remove) run at once and offer Undo in
 * the toast. @medusajs/ui 4.x toasts take `action: { label, altText, onClick }`.
 * Critical rows use a `usePrompt()` confirmation instead.
 *
 *   await resolve(id)
 *   toastWithUndo('Marked as resolved', () => reopen(id))
 */
export function toastWithUndo(
  message: string,
  undo: () => unknown | Promise<unknown>,
  options: { description?: string; duration?: number; undoneMessage?: string } = {},
): string | number {
  const id = toast.success(message, {
    description: options.description,
    duration: options.duration ?? 8000,
    action: {
      label: 'Undo',
      altText: `Undo: ${message}`,
      onClick: async () => {
        toast.dismiss(id)
        try {
          await undo()
          toast.info(options.undoneMessage ?? 'Undone')
        } catch (error) {
          toast.error('Could not undo', {
            description: error instanceof Error ? error.message : undefined,
          })
        }
      },
    },
  })
  return id
}

/**
 * S11 for toasts: a success message whose action opens the result,
 * e.g. toastWithResult('Product published', 'View in store', () => openInStore(links, path)).
 */
export function toastWithResult(
  message: string,
  label: string,
  open: () => unknown,
  options: { description?: string; duration?: number } = {},
): string | number {
  return toast.success(message, {
    description: options.description,
    duration: options.duration ?? 8000,
    action: { label, altText: `${label}: ${message}`, onClick: () => void open() },
  })
}
