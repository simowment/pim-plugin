import { defineRouteConfig } from '@medusajs/admin-sdk'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  Container,
  Button,
  Text,
  Badge,
  Tabs,
  Input,
  Label,
  Select,
  toast,
  Table,
} from '@medusajs/ui'
import { sdk } from '../../lib/sdk'

type PimContent = Record<string, unknown>
type MetadataField = {
  id: string
  key: string
  label: string
  type: string
  scope: string
  group: string | null
  visible_in_admin: boolean
  visible_in_storefront: boolean
  required: boolean
}
type ContentJob = Record<string, unknown>

const LoadingState = () => (
  <div className="flex justify-center py-8">
    <Text size="small" className="text-ui-fg-subtle">
      Loading...
    </Text>
  </div>
)

// ─── PIM Dashboard Page ────────────────────────────────────────────────────

const PimPage = () => {
  const [activeTab, setActiveTab] = useState('products')

  return (
    <div className="flex flex-col gap-y-2 p-4">
      <div className="flex items-center justify-between">
        <Text size="xlarge" weight="plus">
          PIM — Product Information Management
        </Text>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Trigger value="products">Products</Tabs.Trigger>
          <Tabs.Trigger value="jobs">Jobs</Tabs.Trigger>
          <Tabs.Trigger value="metadata-fields">Metadata Fields</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="products">
          <ProductsTab />
        </Tabs.Content>
        <Tabs.Content value="jobs">
          <JobsTab />
        </Tabs.Content>
        <Tabs.Content value="metadata-fields">
          <MetadataFieldsTab />
        </Tabs.Content>
      </Tabs>
    </div>
  )
}

// ─── Products Tab ──────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, 'green' | 'blue' | 'orange' | 'grey' | 'red'> = {
  published: 'green',
  reviewed: 'blue',
  ai_generated: 'orange',
  draft: 'grey',
  archived: 'red',
}

function ProductsTab() {
  const [locale, setLocale] = useState('en')

  const { data, isLoading } = useQuery({
    queryKey: ['pim-content-list', locale],
    queryFn: () =>
      sdk.client.fetch<{ content: PimContent[]; count: number }>(
        `/admin/pim/content?locale=${locale}&limit=50`,
      ),
  })

  return (
    <Container className="mt-4">
      <div className="flex items-center justify-between px-6 py-4 border-b border-ui-border-base">
        <Text size="small" weight="plus">
          Content Records
        </Text>
        <Select size="small" value={locale} onValueChange={setLocale}>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {['en', 'fr', 'es', 'de', 'nl'].map((l) => (
              <Select.Item key={l} value={l}>
                {l.toUpperCase()}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>
      {isLoading ? (
        <LoadingState />
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Product ID</Table.HeaderCell>
              <Table.HeaderCell>Locale</Table.HeaderCell>
              <Table.HeaderCell>Channel</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Updated</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {data?.content?.map((c) => (
              <Table.Row key={c.id as string}>
                <Table.Cell>
                  <Text size="small" className="font-mono">
                    {(c.product_id as string)?.slice(0, 16)}…
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="small">{c.locale as string}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="small">{c.channel as string}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Badge color={STATUS_COLORS[c.status as string] ?? 'grey'} size="2xsmall">
                    {c.status as string}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {new Date(c.updated_at as string).toLocaleDateString()}
                  </Text>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
      <div className="px-6 py-3 text-right">
        <Text size="xsmall" className="text-ui-fg-subtle">
          {data?.count ?? 0} records
        </Text>
      </div>
    </Container>
  )
}

// ─── Jobs Tab ──────────────────────────────────────────────────────────────

function JobsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['pim-content-list-jobs'],
    queryFn: () =>
      sdk.client.fetch<{ content: ContentJob[]; count: number }>(
        '/admin/pim/content?limit=50&status=queued,running,failed,completed',
      ),
  })

  return (
    <Container className="mt-4 px-6 py-4">
      {isLoading ? (
        <LoadingState />
      ) : (
        <Text size="small" className="text-ui-fg-subtle">
          Jobs are tracked in the ProductContentJob model.{' '}
          {data?.count ?? 0} recent records found.
        </Text>
      )}
    </Container>
  )
}

// ─── Metadata Fields Tab ───────────────────────────────────────────────────

type NewField = { key: string; label: string; type: string; scope: string }

function MetadataFieldsTab() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [newField, setNewField] = useState<NewField>({
    key: '',
    label: '',
    type: 'string',
    scope: 'content',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['pim-metadata-fields'],
    queryFn: () =>
      sdk.client.fetch<{ metadata_fields: MetadataField[] }>('/admin/pim/metadata-fields'),
  })

  const createMutation = useMutation({
    mutationFn: (field: NewField) =>
      sdk.client.fetch('/admin/pim/metadata-fields', {
        method: 'POST',
        body: field,
      }),
    onSuccess: () => {
      toast.success('Field created')
      queryClient.invalidateQueries({ queryKey: ['pim-metadata-fields'] })
      setShowForm(false)
      setNewField({ key: '', label: '', type: 'string', scope: 'content' })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/pim/metadata-fields/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Field deleted')
      queryClient.invalidateQueries({ queryKey: ['pim-metadata-fields'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Container className="mt-4">
      <div className="flex items-center justify-between px-6 py-4 border-b border-ui-border-base">
        <Text size="small" weight="plus">
          Metadata Field Definitions
        </Text>
        <Button size="small" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add Field'}
        </Button>
      </div>

      {showForm && (
        <div className="px-6 py-4 border-b border-ui-border-base bg-ui-bg-subtle space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Key</Label>
              <Input
                placeholder="e.g. material"
                value={newField.key}
                onChange={(e) => setNewField({ ...newField, key: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Label</Label>
              <Input
                placeholder="e.g. Material"
                value={newField.label}
                onChange={(e) => setNewField({ ...newField, label: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select
                size="small"
                value={newField.type}
                onValueChange={(v) => setNewField({ ...newField, type: v })}
              >
                <Select.Trigger><Select.Value /></Select.Trigger>
                <Select.Content>
                  {['string', 'text', 'number', 'boolean', 'select', 'json', 'url'].map((t) => (
                    <Select.Item key={t} value={t}>{t}</Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Scope</Label>
              <Select
                size="small"
                value={newField.scope}
                onValueChange={(v) => setNewField({ ...newField, scope: v })}
              >
                <Select.Trigger><Select.Value /></Select.Trigger>
                <Select.Content>
                  {['product', 'variant', 'content'].map((s) => (
                    <Select.Item key={s} value={s}>{s}</Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
          </div>
          <Button
            size="small"
            isLoading={createMutation.isPending}
            disabled={createMutation.isPending || !newField.key || !newField.label}
            onClick={() => createMutation.mutate(newField)}
          >
            Save Field
          </Button>
        </div>
      )}

      {isLoading ? (
        <LoadingState />
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Key</Table.HeaderCell>
              <Table.HeaderCell>Label</Table.HeaderCell>
              <Table.HeaderCell>Type</Table.HeaderCell>
              <Table.HeaderCell>Scope</Table.HeaderCell>
              <Table.HeaderCell>Storefront</Table.HeaderCell>
              <Table.HeaderCell></Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {data?.metadata_fields?.map((f) => (
              <Table.Row key={f.id}>
                <Table.Cell>
                  <Text size="small" className="font-mono">
                    {f.key}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="small">{f.label}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="small">{f.type}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="small">{f.scope}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Badge color={f.visible_in_storefront ? 'green' : 'grey'} size="2xsmall">
                    {f.visible_in_storefront ? 'visible' : 'hidden'}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Button
                    size="small"
                    variant="danger"
                    isLoading={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(f.id)}
                  >
                    Delete
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: 'PIM',
})

export default PimPage
