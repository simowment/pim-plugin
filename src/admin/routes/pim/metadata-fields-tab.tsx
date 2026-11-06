import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { PencilSquare, Trash } from '@medusajs/icons'
import {
  Badge,
  Button,
  Checkbox,
  Container,
  FocusModal,
  IconButton,
  Input,
  Label,
  Select,
  Table,
  Text,
  toast,
  usePrompt,
} from '@medusajs/ui'
import { sdk } from '../../lib/sdk'
import { ErrorState, Field, LoadingState, type MetadataField, type MetadataFieldMutationBody } from './shared'

const FIELD_TYPE_LABELS: Record<string, string> = {
  string: 'Short text',
  text: 'Long text',
  number: 'Number',
  boolean: 'Yes / no',
  select: 'One choice from a list',
  multiselect: 'Several choices from a list',
  url: 'Link (URL)',
  json: 'Structured data (JSON)',
}

// `localized` follows the scope on the server: content = per language, product = shared.
const FIELD_SCOPE_LABELS: Record<string, string> = {
  content: 'Different per language',
  product: 'Same in every language',
  variant: 'Per variant (not edited on this page)',
}
const SELECTABLE_SCOPES = ['content', 'product']

function typeLabel(type: string) {
  return FIELD_TYPE_LABELS[type] ?? type
}

function scopeLabel(scope: string) {
  return FIELD_SCOPE_LABELS[scope] ?? scope
}

export function MetadataFieldsTab() {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [showForm, setShowForm] = useState(false)
  const [editField, setEditField] = useState<MetadataField | null>(null)

  // Options builder state
  const [optionsText, setOptionsText] = useState('')
  
  const [newField, setNewField] = useState({
    key: '',
    label: '',
    description: '',
    type: 'string',
    scope: 'content',
    group: '',
    required: false,
    localized: true,
    channel_specific: false,
    visible_in_admin: true,
    visible_in_storefront: false,
  })

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['pim-metadata-fields'],
    queryFn: () =>
      sdk.client.fetch<{ metadata_fields: MetadataField[] }>('/admin/pim/metadata-fields'),
  })

  const createMutation = useMutation({
    mutationFn: (body: MetadataFieldMutationBody) =>
      sdk.client.fetch('/admin/pim/metadata-fields', {
        method: 'POST',
        body,
    }),
    onSuccess: () => {
      toast.success('Field template created')
      queryClient.invalidateQueries({ queryKey: ['pim-metadata-fields'] })
      setShowForm(false)
      setNewField({
        key: '',
        label: '',
        description: '',
        type: 'string',
        scope: 'content',
        group: '',
        required: false,
        localized: true,
        channel_specific: false,
        visible_in_admin: true,
        visible_in_storefront: false,
      })
      setOptionsText('')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: (body: MetadataFieldMutationBody) =>
      sdk.client.fetch(`/admin/pim/metadata-fields/${editField?.id}`, {
        method: 'POST',
        body,
    }),
    onSuccess: () => {
      toast.success('Field template updated')
      queryClient.invalidateQueries({ queryKey: ['pim-metadata-fields'] })
      setEditField(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/pim/metadata-fields/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Field template deleted')
      queryClient.invalidateQueries({ queryKey: ['pim-metadata-fields'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const handleCreate = () => {
    // Parse options label/value pairs from e.g. "Solid:solid, Laminate:laminate"
    const parsedOptions = optionsText
      .split(',')
      .map((opt) => {
        const parts = opt.split(':')
        if (parts.length === 2) {
          return { label: parts[0].trim(), value: parts[1].trim() }
        }
        return null
      })
      .filter((option): option is { label: string; value: string } => option !== null)

    createMutation.mutate({
      ...newField,
      options_json: parsedOptions.length > 0 ? parsedOptions : null,
    })
  }

  const handleDelete = async (field: MetadataField) => {
    const confirmed = await prompt({
      title: `Delete "${field.label}"?`,
      description: 'This also removes the values saved for this field on every product.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
    })
    if (confirmed) {
      deleteMutation.mutate(field.id)
    }
  }

  const handleEditClick = (field: MetadataField) => {
    setEditField(field)
    setOptionsText(
      field.options_json?.map((o) => `${o.label}:${o.value}`).join(', ') ?? ''
    )
  }

  return (
    <Container className="mt-4 overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-ui-border-base px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
        <div className="flex flex-col gap-y-1">
          <Text size="small" weight="plus">
            Field templates
          </Text>
          <Text size="small" className="text-ui-fg-subtle">
            Extra fields every product gets on the Specifications tab, such as material or care
            instructions. Values are saved with the product content.
          </Text>
        </div>
        <Button size="small" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'New field template'}
        </Button>
      </div>

      {/* Field Creator Card */}
      {showForm && (
        <div className="space-y-4 border-b border-ui-border-base bg-ui-bg-subtle px-6 py-4">
          <div className="flex flex-col gap-y-1">
            <Text size="small" weight="plus">
              Create a reusable field
            </Text>
            <Text size="small" className="text-ui-fg-subtle">
              Use templates for repeatable details like material, care instructions, size guide notes, warranty, or badges.
            </Text>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Internal key">
              <Input
                placeholder="care_instructions"
                value={newField.key}
                onChange={(e) => setNewField({ ...newField, key: e.target.value })}
              />
            </Field>
            <Field label="Display name">
              <Input
                placeholder="Care instructions"
                value={newField.label}
                onChange={(e) => setNewField({ ...newField, label: e.target.value })}
              />
            </Field>
            <Field label="Data type">
              <Select
                size="small"
                value={newField.type}
                onValueChange={(value) => setNewField({ ...newField, type: value })}
              >
                <Select.Trigger aria-label="Data type">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {Object.keys(FIELD_TYPE_LABELS).map((type) => (
                    <Select.Item key={type} value={type}>
                      {typeLabel(type)}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </Field>
            <Field label="Languages">
              <Select
                size="small"
                value={newField.scope}
                onValueChange={(value) =>
                  setNewField({ ...newField, scope: value, localized: value === 'content' })
                }
              >
                <Select.Trigger aria-label="Languages">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {SELECTABLE_SCOPES.map((scope) => (
                    <Select.Item key={scope} value={scope}>
                      {scopeLabel(scope)}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </Field>

            <Field label="Choices (list types only), as Label:value, comma separated">
              <Input
                placeholder="Machine wash:machine_wash, Dry clean:dry_clean"
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
              />
            </Field>

            <Field label="Editor help text">
              <Input
                placeholder="Tell editors what belongs in this field"
                value={newField.description}
                onChange={(e) => setNewField({ ...newField, description: e.target.value })}
              />
            </Field>
          </div>

          <div className="flex items-center gap-2 rounded-lg border bg-ui-bg-base p-3">
            <Checkbox
              id="req"
              checked={newField.required}
              onCheckedChange={(checked) => setNewField({ ...newField, required: Boolean(checked) })}
            />
            <Label htmlFor="req">Required: a product cannot be saved without it</Label>
          </div>

          <Button
            size="small"
            isLoading={createMutation.isPending}
            disabled={createMutation.isPending || !newField.key || !newField.label}
            onClick={handleCreate}
          >
            Save field template
          </Button>
        </div>
      )}

      {isLoading ? (
        <LoadingState />
      ) : isError || data === undefined ? (
        <ErrorState
          message={`Could not load the field templates: ${(error as Error | null)?.message ?? 'unknown error'}`}
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Name</Table.HeaderCell>
                <Table.HeaderCell>Key</Table.HeaderCell>
                <Table.HeaderCell>Type</Table.HeaderCell>
                <Table.HeaderCell>Languages</Table.HeaderCell>
                <Table.HeaderCell>Required</Table.HeaderCell>
                <Table.HeaderCell className="w-[120px]"></Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {data?.metadata_fields?.map((field) => (
                <Table.Row key={field.id}>
                  <Table.Cell>{field.label}</Table.Cell>
                  <Table.Cell className="font-mono text-xs">{field.key}</Table.Cell>
                  <Table.Cell>{typeLabel(field.type)}</Table.Cell>
                  <Table.Cell>{scopeLabel(field.scope)}</Table.Cell>
                  <Table.Cell>
                    {field.required ? (
                      <Badge size="2xsmall" color="orange">
                        Required
                      </Badge>
                    ) : (
                      <Text size="small" className="text-ui-fg-subtle">
                        Optional
                      </Text>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-2 justify-end">
                      <IconButton
                        size="small"
                        variant="transparent"
                        aria-label={`Edit field template ${field.label}`}
                        onClick={() => handleEditClick(field)}
                      >
                        <PencilSquare />
                      </IconButton>
                      <IconButton
                        size="small"
                        variant="transparent"
                        aria-label={`Delete field template ${field.label}`}
                        onClick={() => void handleDelete(field)}
                      >
                        <Trash className="text-ui-fg-danger" />
                      </IconButton>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
              {!data.metadata_fields.length && (
                <Table.Row>
                  <td colSpan={6} className="py-8 text-center text-ui-fg-subtle">
                    No field templates yet. Specifications can still be typed per product on the
                    Content tab.
                  </td>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </div>
      )}

      {/* Edit drawer FocusModal */}
      {editField && (
        <FocusModal open={true} onOpenChange={() => setEditField(null)}>
          <FocusModal.Content>
            <FocusModal.Header>
              <div className="flex items-center justify-between w-full pr-10">
                <FocusModal.Title asChild>
                  <Text size="base" weight="plus">
                    Edit field template
                  </Text>
                </FocusModal.Title>
                <FocusModal.Description className="sr-only">
                  Change the name, help text, choices or required rule of this field template.
                </FocusModal.Description>
                <div className="flex items-center gap-2">
                  <Button size="small" variant="secondary" onClick={() => setEditField(null)}>
                    Cancel
                  </Button>
                  <Button
                    size="small"
                    isLoading={updateMutation.isPending}
                    onClick={() =>
                      updateMutation.mutate({
                        label: editField.label,
                        description: editField.description,
                        options_json: optionsText
                          .split(',')
                          .map((opt) => {
                            const parts = opt.split(':')
                            if (parts.length === 2) {
                              return { label: parts[0].trim(), value: parts[1].trim() }
                            }
                            return null
                          })
                          .filter((option): option is { label: string; value: string } => option !== null),
                        required: editField.required,
                        localized: editField.localized,
                        channel_specific: false,
                        visible_in_storefront: editField.visible_in_storefront,
                      })
                    }
                  >
                    Save changes
                  </Button>
                </div>
              </div>
            </FocusModal.Header>
            <FocusModal.Body className="p-8 space-y-6 max-w-xl mx-auto">
              <Field label="Display name">
                <Input
                  value={editField.label}
                  onChange={(e) => setEditField({ ...editField, label: e.target.value })}
                />
              </Field>
              <Field label="Editor help text">
                <Input
                  value={editField.description ?? ''}
                  onChange={(e) => setEditField({ ...editField, description: e.target.value })}
                />
              </Field>
              <Field label="Choices (list types only), as Label:value, comma separated">
                <Input value={optionsText} onChange={(e) => setOptionsText(e.target.value)} />
              </Field>

              <Text size="small" className="text-ui-fg-subtle">
                Key <code>{editField.key}</code> · {typeLabel(editField.type)} ·{' '}
                {scopeLabel(editField.scope)}. Key, type and languages cannot be changed.
              </Text>
              <div className="flex items-center gap-2 rounded-lg border bg-ui-bg-subtle p-4">
                <Checkbox
                  id="edit-req"
                  checked={editField.required}
                  onCheckedChange={(checked) =>
                    setEditField({ ...editField, required: Boolean(checked) })
                  }
                />
                <Label htmlFor="edit-req">Required: a product cannot be saved without it</Label>
              </div>
            </FocusModal.Body>
          </FocusModal.Content>
        </FocusModal>
      )}
    </Container>
  )
}
