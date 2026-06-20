import { Button, Input, Label } from '@medusajs/ui'

const CHANGE_REASON_INPUT_ID = 'pim-change-reason'

interface ProductEditorActionBarProps {
  canPublish: boolean | undefined
  changeReason: string
  hasMetadataErrors: boolean
  isPublishing: boolean
  isSaving: boolean
  locale: string
  selectedProductId: string
  onChangeReasonChange: (value: string) => void
  onPublish: () => void
  onSaveDraft: () => void
}

export function ProductEditorActionBar({
  canPublish,
  changeReason,
  hasMetadataErrors,
  isPublishing,
  isSaving,
  locale,
  selectedProductId,
  onChangeReasonChange,
  onPublish,
  onSaveDraft,
}: ProductEditorActionBarProps) {
  return (
    <div className="border-ui-border-base bg-ui-bg-base sticky bottom-0 z-20 shrink-0 border-t p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor={CHANGE_REASON_INPUT_ID} className="text-ui-fg-subtle text-xs">
            Change note
          </Label>
          <Input
            id={CHANGE_REASON_INPUT_ID}
            placeholder="Describe what changed for the audit log"
            value={changeReason}
            onChange={(event) => onChangeReasonChange(event.target.value)}
            size="small"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 lg:flex lg:items-center">
          <Button
            size="small"
            variant="secondary"
            className="w-full lg:w-auto"
            isLoading={isSaving}
            disabled={!selectedProductId || isSaving || hasMetadataErrors}
            onClick={onSaveDraft}
          >
            Save draft
          </Button>
          <Button
            size="small"
            className="w-full lg:w-auto"
            isLoading={isPublishing}
            disabled={!canPublish || isPublishing}
            onClick={onPublish}
          >
            Publish {locale.toUpperCase()}
          </Button>
        </div>
      </div>
    </div>
  )
}
