import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { PencilSquare, Trash } from '@medusajs/icons'
import { Badge, Button, Checkbox, Container, FocusModal, IconButton, Input, Label, Select, Table, Text, toast } from '@medusajs/ui'
import { sdk } from '../../lib/sdk'
import { ErrorState, Field, LoadingState, type MetadataField, type MetadataFieldMutationBody } from './shared'

export function MetadataFieldsTab() {
  const queryClient = useQueryClient()
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

  const { data, isLoading } = useQuery({
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

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this field template? This also removes saved values for this field across products.')) {
      deleteMutation.mutate(id)
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
            Field Templates
          </Text>
          <Text size="small" className="text-ui-fg-subtle">
            Define reusable product fields that should appear consistently across products, locales, or storefront channels.
          </Text>
        </div>
        <Button size="small" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'New Field Template'}
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
                  {['string', 'text', 'number', 'boolean', 'select', 'multiselect', 'json', 'url'].map(
                    (type) => (
                      <Select.Item key={type} value={type}>
                        {type}
                      </Select.Item>
                    )
                  )}
                </Select.Content>
              </Select>
            </Field>
            <Field label="Where this field appears">
              <Select
                size="small"
                value={newField.scope}
                onValueChange={(value) => setNewField({ ...newField, scope: value })}
              >
                <Select.Trigger aria-label="Where this field appears">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {['product', 'variant', 'content'].map((scope) => (
                    <Select.Item key={scope} value={scope}>
                      {scope}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </Field>

            <Field label="Choices for select fields">
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-ui-bg-base border rounded-lg">
            <div className="flex items-center gap-2">
              <Checkbox
                id="req"
                checked={newField.required}
                onCheckedChange={(checked) => setNewField({ ...newField, required: Boolean(checked) })}
              />
              <Label htmlFor="req">Required for editors</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="loc"
                checked={newField.localized}
                onCheckedChange={(checked) => setNewField({ ...newField, localized: Boolean(checked) })}
              />
              <Label htmlFor="loc">Different per language</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="ch"
                checked={newField.channel_specific}
                onCheckedChange={(checked) =>
                  setNewField({ ...newField, channel_specific: Boolean(checked) })
                }
              />
              <Label htmlFor="ch">Different per channel</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="store"
                checked={newField.visible_in_storefront}
                onCheckedChange={(checked) =>
                  setNewField({ ...newField, visible_in_storefront: Boolean(checked) })
                }
              />
              <Label htmlFor="store">Available to storefront</Label>
            </div>
          </div>

          <Button
            size="small"
            isLoading={createMutation.isPending}
            disabled={createMutation.isPending || !newField.key || !newField.label}
            onClick={handleCreate}
          >
            Save Field Template
          </Button>
        </div>
      )}

      {isLoading ? (
        <LoadingState />
      ) : data === undefined ? (
        <ErrorState message="Unable to load metadata field definitions." />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Internal Key</Table.HeaderCell>
                <Table.HeaderCell>Name</Table.HeaderCell>
                <Table.HeaderCell>Data Type</Table.HeaderCell>
                <Table.HeaderCell>Used For</Table.HeaderCell>
                <Table.HeaderCell>Rules</Table.HeaderCell>
                <Table.HeaderCell>Storefront</Table.HeaderCell>
                <Table.HeaderCell className="w-[180px]"></Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {data?.metadata_fields?.map((field) => (
                <Table.Row key={field.id}>
                  <Table.Cell className="font-mono text-xs">{field.key}</Table.Cell>
                  <Table.Cell>{field.label}</Table.Cell>
                  <Table.Cell>{field.type}</Table.Cell>
                  <Table.Cell>{field.scope}</Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-wrap gap-1">
                      {field.required && <Badge size="2xsmall" color="red">Required</Badge>}
                      {field.localized && <Badge size="2xsmall" color="blue">Locale</Badge>}
                      {field.channel_specific && <Badge size="2xsmall" color="orange">Channel</Badge>}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={field.visible_in_storefront ? 'green' : 'grey'} size="2xsmall">
                      {field.visible_in_storefront ? 'available' : 'admin only'}
                    </Badge>
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
                        onClick={() => handleDelete(field.id)}
                      >
                        <Trash className="text-ui-fg-danger" />
                      </IconButton>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
              {!data.metadata_fields.length && (
                <Table.Row>
                  <td colSpan={7} className="py-8 text-center text-ui-fg-subtle">
                    No field templates yet. Product specifications can still be edited directly in Product Content.
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
                <Text size="base" weight="plus">
                  Edit Field Template
                </Text>
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
                        channel_specific: editField.channel_specific,
                        visible_in_storefront: editField.visible_in_storefront,
                      })
                    }
                  >
                    Save Changes
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
              <Field label="Choices for select fields">
                <Input value={optionsText} onChange={(e) => setOptionsText(e.target.value)} />
              </Field>

              <div className="space-y-3 p-4 bg-ui-bg-subtle border rounded-lg">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-req"
                    checked={editField.required}
                    onCheckedChange={(checked) =>
                      setEditField({ ...editField, required: Boolean(checked) })
                    }
                  />
                  <Label htmlFor="edit-req">Required for editors</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-loc"
                    checked={editField.localized}
                    onCheckedChange={(checked) =>
                      setEditField({ ...editField, localized: Boolean(checked) })
                    }
                  />
                  <Label htmlFor="edit-loc">Different per language</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-ch"
                    checked={editField.channel_specific}
                    onCheckedChange={(checked) =>
                      setEditField({ ...editField, channel_specific: Boolean(checked) })
                    }
                  />
                  <Label htmlFor="edit-ch">Different per channel</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-store"
                    checked={editField.visible_in_storefront}
                    onCheckedChange={(checked) =>
                      setEditField({ ...editField, visible_in_storefront: Boolean(checked) })
                    }
                  />
                  <Label htmlFor="edit-store">Available to storefront</Label>
                </div>
              </div>
            </FocusModal.Body>
          </FocusModal.Content>
        </FocusModal>
      )}
    </Container>
  )
}
