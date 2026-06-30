import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Badge, Button, Container, FocusModal, Input, Table, Text, Textarea, toast } from '@medusajs/ui'
import { sdk } from '../../lib/sdk'
import {
  DEFAULT_CHANNELS,
  ErrorState,
  Field,
  LoadingState,
  type BulletPoint,
  type PimAdminConfig,
  type PimJob,
  type ProductContentMutationBody,
  type ProductContentResponse,
  type Specification,
  type VariantTitle,
} from './shared'

type ApproveJobInput = {
  productId: string
  body: ProductContentMutationBody
}

type ReviewForm = {
  title: string
  short_description: string
  description: string
  seo_title: string
  seo_description: string
  seo_keywords: string
  bullets_json: BulletPoint[]
  variant_titles_json: VariantTitle[]
  specifications_json: Specification[]
}

const JOBS_PAGE_SIZE = 50
const JOB_TYPE_LABELS: Record<PimJob['type'], string> = {
  translate: 'Translate copy',
  rewrite: 'Rewrite copy',
  extract_specs: 'Extract specs',
  seo: 'Write SEO',
  full: 'Full product draft',
}
const JOB_STATUS_LABELS: Record<PimJob['status'], string> = {
  running: 'Running',
  completed: 'Ready to review',
  failed: 'Needs attention',
}

export function JobsTab() {
  const queryClient = useQueryClient()
  const [reviewJob, setReviewJob] = useState<PimJob | null>(null)
  const [jobsPage, setJobsPage] = useState(0)
  const [reviewForm, setReviewForm] = useState<ReviewForm>({
    title: '',
    short_description: '',
    description: '',
    seo_title: '',
    seo_description: '',
    seo_keywords: '',
    bullets_json: [] as BulletPoint[],
    variant_titles_json: [] as VariantTitle[],
    specifications_json: [] as Specification[],
  })

  const { data, isLoading } = useQuery({
    queryKey: ['pim-jobs', jobsPage],
    queryFn: () => {
      const query = new URLSearchParams({
        limit: String(JOBS_PAGE_SIZE),
        offset: String(jobsPage * JOBS_PAGE_SIZE),
      })
      return sdk.client.fetch<{ jobs: PimJob[]; count: number }>(
        `/admin/pim/jobs?${query.toString()}`,
      )
    },
  })
  const configQuery = useQuery({
    queryKey: ['pim-admin-config'],
    queryFn: () => sdk.client.fetch<{ config: PimAdminConfig }>('/admin/pim/config'),
  })

  // Load selected product content to show original content on split view
  const productId = reviewJob?.product_id ?? ''
  const reviewLocale = reviewJob?.locale ?? ''
  const sourceLocale = reviewJob?.input_json?.source_locale ?? reviewLocale
  const reviewChannel = configQuery.data?.config.default_channel ?? DEFAULT_CHANNELS[0]
  const sourceProductQuery = useQuery({
    queryKey: ['pim-review-source-product', productId, sourceLocale, reviewChannel],
    queryFn: () => {
      const query = new URLSearchParams({ locale: sourceLocale, channel: reviewChannel })
      return sdk.client.fetch<ProductContentResponse>(
        `/admin/pim/products/${productId}/content?${query.toString()}`,
      )
    },
    enabled: Boolean(productId && sourceLocale),
  })

  const jobs = data?.jobs ?? []
  const jobCount = data?.count ?? 0
  const firstJobIndex = jobsPage * JOBS_PAGE_SIZE + 1
  const lastJobIndex = jobsPage * JOBS_PAGE_SIZE + jobs.length
  const hasPreviousJobsPage = jobsPage > 0
  const hasNextJobsPage = lastJobIndex < jobCount

  const handleReviewClick = (job: PimJob) => {
    const result = job.result_json
    const seo = result?.seo_json
    setReviewJob(job)
    setReviewForm({
      title: result?.title ?? '',
      short_description: result?.short_description ?? '',
      description: result?.description ?? '',
      seo_title: seo?.title ?? '',
      seo_description: seo?.description ?? '',
      seo_keywords: Array.isArray(seo?.keywords)
        ? seo.keywords.join(', ')
        : '',
      bullets_json: result?.bullets_json ?? [],
      variant_titles_json: result?.variant_titles_json ?? [],
      specifications_json: result?.specifications_json ?? [],
    })
  }

  const approveMutation = useMutation({
    mutationFn: ({ productId, body }: ApproveJobInput) =>
      sdk.client.fetch(`/admin/pim/products/${productId}/content`, {
        method: 'POST',
        body,
      }),
    onSuccess: () => {
      toast.success('AI draft saved to Product Content')
      setReviewJob(null)
      queryClient.invalidateQueries({ queryKey: ['pim-product-content'] })
      queryClient.invalidateQueries({ queryKey: ['pim-product-content-all'] })
      queryClient.invalidateQueries({ queryKey: ['pim-jobs'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const handleApprove = () => {
    if (!reviewJob) return
    if (!reviewJob.product_id) {
      toast.error('Review job is missing a product id.')
      return
    }
    if (!reviewJob.locale) {
      toast.error('Review job is missing a target locale.')
      return
    }

    approveMutation.mutate({
      productId: reviewJob.product_id,
      body: buildReviewApprovalBody(reviewJob, reviewChannel, reviewForm),
    })
  }

  const updateReviewBullet = (index: number, text: string) => {
    setReviewForm((current) => {
      const bullets = [...current.bullets_json]
      bullets[index] = { ...bullets[index], text }
      return { ...current, bullets_json: bullets }
    })
  }

  const updateReviewVariantTitle = (index: number, title: string) => {
    setReviewForm((current) => {
      const variantTitles = [...current.variant_titles_json]
      variantTitles[index] = { ...variantTitles[index], title }
      return { ...current, variant_titles_json: variantTitles }
    })
  }

  const updateReviewSpecification = (index: number, fields: Partial<Specification>) => {
    setReviewForm((current) => {
      const specifications = [...current.specifications_json]
      specifications[index] = { ...specifications[index], ...fields }
      return { ...current, specifications_json: specifications }
    })
  }

  return (
    <Container className="mt-4">
      <div className="border-b border-ui-border-base px-4 py-3 sm:px-6 sm:py-4">
        <Text size="small" weight="plus">
          AI Review Queue
        </Text>
        <Text size="small" className="text-ui-fg-subtle">
          Track AI draft requests from Product Content. Review completed drafts here before saving them to a product.
        </Text>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : data === undefined ? (
        <ErrorState message="Unable to load AI generation jobs." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Draft ID</Table.HeaderCell>
                  <Table.HeaderCell>Task</Table.HeaderCell>
                  <Table.HeaderCell>Locale</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>Created</Table.HeaderCell>
                  <Table.HeaderCell className="w-[120px]"></Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {jobs.map((job) => (
                  <Table.Row key={job.id}>
                    <Table.Cell className="font-mono text-xs">{job.id}</Table.Cell>
                    <Table.Cell>
                      <Badge color="blue" size="2xsmall">
                        {JOB_TYPE_LABELS[job.type]}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>{job.locale?.toUpperCase()}</Table.Cell>
                    <Table.Cell>
                      {job.status === 'running' ? (
                        <Badge color="orange" className="animate-pulse">
                          {JOB_STATUS_LABELS[job.status]}
                        </Badge>
                      ) : job.status === 'completed' ? (
                        <Badge color="green">{JOB_STATUS_LABELS[job.status]}</Badge>
                      ) : job.status === 'failed' ? (
                        <Badge color="red">{JOB_STATUS_LABELS[job.status]}</Badge>
                      ) : (
                        <Badge color="grey">{JOB_STATUS_LABELS[job.status]}</Badge>
                      )}
                    </Table.Cell>
                    <Table.Cell className="text-ui-fg-subtle text-xs">
                      {new Date(job.created_at).toLocaleString()}
                    </Table.Cell>
                    <Table.Cell>
                      {job.status === 'completed' && job.product_id && (
                        <Button size="small" variant="secondary" onClick={() => handleReviewClick(job)}>
                          Review Draft
                        </Button>
                      )}
                      {job.status === 'failed' && (
                        <Text size="xsmall" className="text-ui-fg-danger truncate max-w-[200px]" title={job.error_message || ''}>
                          {job.error_message || 'Unknown error'}
                        </Text>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
                {!jobs.length && (
                  <Table.Row>
                    <td colSpan={6} className="text-center py-8 text-ui-fg-subtle">
                      No AI drafts yet. Use Create AI Draft in Product Content when you want help with copy, SEO, translation, or specs.
                    </td>
                  </Table.Row>
                )}
              </Table.Body>
            </Table>
          </div>
          {jobCount > JOBS_PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-ui-border-base px-6 py-4">
              <Text size="small" className="text-ui-fg-subtle">
                Showing {firstJobIndex}-{lastJobIndex} of {jobCount}
              </Text>
              <div className="flex items-center gap-2">
                <Button
                  size="small"
                  variant="secondary"
                  disabled={!hasPreviousJobsPage}
                  onClick={() => setJobsPage((page) => page - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={!hasNextJobsPage}
                  onClick={() => setJobsPage((page) => page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Side-by-side split screen review modal */}
      {reviewJob && (
        <FocusModal open={true} onOpenChange={() => setReviewJob(null)}>
          <FocusModal.Content>
            <FocusModal.Header>
              <div className="flex w-full flex-col gap-3 pr-10 sm:flex-row sm:items-center sm:justify-between">
                <Text size="base" weight="plus">
                  Review AI Draft - {reviewJob.locale?.toUpperCase()}
                </Text>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                  <Button size="small" variant="secondary" onClick={() => setReviewJob(null)}>
                    Close
                  </Button>
                  <Button size="small" isLoading={approveMutation.isPending} onClick={handleApprove}>
                    Save to Product Content
                  </Button>
                </div>
              </div>
            </FocusModal.Header>
            <FocusModal.Body className="p-0 overflow-hidden">
              <div className="grid h-full grid-cols-1 divide-y divide-ui-border-base md:grid-cols-2 md:divide-x md:divide-y-0">
                {/* Left side: Current source content */}
                <div className="space-y-6 overflow-y-auto bg-ui-bg-subtle p-4 sm:p-8">
                  <Text size="large" weight="plus" className="border-b pb-2">
                    Current Product Content
                  </Text>
                  <div className="space-y-4">
                    <div>
                      <Text size="small" className="text-ui-fg-subtle">
                        Current Title
                      </Text>
                      <Text className="mt-1 font-semibold">{sourceProductQuery.data?.product?.title}</Text>
                    </div>
                    <div>
                      <Text size="small" className="text-ui-fg-subtle">
                        Current Description
                      </Text>
                      <Text className="mt-1 whitespace-pre-wrap leading-relaxed">
                        {sourceProductQuery.data?.product?.description || 'No description provided.'}
                      </Text>
                    </div>
                  </div>
                </div>

                {/* Right side: AI draft editor */}
                <div className="space-y-6 overflow-y-auto bg-ui-bg-base p-4 sm:p-8">
                  <Text size="large" weight="plus" className="border-b pb-2 text-ui-fg-interactive">
                    Editable AI Draft ({reviewJob.locale?.toUpperCase()})
                  </Text>
                  <div className="space-y-4">
                    <Field label="Draft title">
                      <Input
                        value={reviewForm.title}
                        onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                      />
                    </Field>
                    <Field label="Draft short description">
                      <Input
                        value={reviewForm.short_description}
                        onChange={(e) => setReviewForm({ ...reviewForm, short_description: e.target.value })}
                      />
                    </Field>
                    <Field label="Draft full description">
                      <Textarea
                        rows={8}
                        value={reviewForm.description}
                        onChange={(e) => setReviewForm({ ...reviewForm, description: e.target.value })}
                      />
                    </Field>
                    <Field label="Draft SEO title">
                      <Input
                        value={reviewForm.seo_title}
                        onChange={(e) => setReviewForm({ ...reviewForm, seo_title: e.target.value })}
                      />
                    </Field>
                    <Field label="Draft SEO keywords">
                      <Input
                        value={reviewForm.seo_keywords}
                        onChange={(e) => setReviewForm({ ...reviewForm, seo_keywords: e.target.value })}
                      />
                    </Field>
                    <Field label="Draft SEO description">
                      <Textarea
                        rows={3}
                        value={reviewForm.seo_description}
                        onChange={(e) => setReviewForm({ ...reviewForm, seo_description: e.target.value })}
                      />
                    </Field>
                    <div className="space-y-3 border-t border-ui-border-base pt-4">
                      <Text size="small" weight="plus">
                        Generated bullet highlights
                      </Text>
                      {reviewForm.bullets_json.map((bullet, index) => (
                        <Input
                          key={index}
                          value={bullet.text}
                          aria-label={`Generated bullet ${index + 1}`}
                          onChange={(event) => updateReviewBullet(index, event.target.value)}
                        />
                      ))}
                      {!reviewForm.bullets_json.length && (
                        <Text size="small" className="text-ui-fg-subtle">
                          No bullet highlights generated.
                        </Text>
                      )}
                    </div>
                    <div className="space-y-3 border-t border-ui-border-base pt-4">
                      <Text size="small" weight="plus">
                        Generated variant names
                      </Text>
                      {reviewForm.variant_titles_json.map((variantTitle, index) => (
                        <div
                          key={`${variantTitle.variant_id}-${index}`}
                          className="grid grid-cols-1 gap-2 rounded-md border border-ui-border-base bg-ui-bg-subtle p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]"
                        >
                          <Text size="xsmall" className="break-all text-ui-fg-subtle">
                            {variantTitle.variant_id}
                          </Text>
                          <Input
                            value={variantTitle.title}
                            aria-label={`Generated name for variant ${variantTitle.variant_id}`}
                            onChange={(event) =>
                              updateReviewVariantTitle(index, event.target.value)
                            }
                          />
                        </div>
                      ))}
                      {!reviewForm.variant_titles_json.length && (
                        <Text size="small" className="text-ui-fg-subtle">
                          No variant names generated.
                        </Text>
                      )}
                    </div>
                    <div className="space-y-3 border-t border-ui-border-base pt-4">
                      <Text size="small" weight="plus">
                        Generated specifications
                      </Text>
                      {reviewForm.specifications_json.map((specification, index) => (
                        <div
                          key={`${specification.key}-${index}`}
                          className="grid grid-cols-1 gap-2 rounded-md border border-ui-border-base bg-ui-bg-subtle p-3 md:grid-cols-3"
                        >
                          <Input
                            value={specification.label ?? specification.key}
                            aria-label={`Generated specification ${index + 1} label`}
                            onChange={(event) =>
                              updateReviewSpecification(index, {
                                label: event.target.value,
                              })
                            }
                          />
                          <Input
                            value={specification.value}
                            aria-label={`Generated specification ${index + 1} value`}
                            onChange={(event) =>
                              updateReviewSpecification(index, {
                                value: event.target.value,
                              })
                            }
                          />
                          <Input
                            value={specification.unit ?? ''}
                            aria-label={`Generated specification ${index + 1} unit`}
                            placeholder="Unit"
                            onChange={(event) =>
                              updateReviewSpecification(index, {
                                unit: event.target.value,
                              })
                            }
                          />
                        </div>
                      ))}
                      {!reviewForm.specifications_json.length && (
                        <Text size="small" className="text-ui-fg-subtle">
                          No specifications generated.
                        </Text>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </FocusModal.Body>
          </FocusModal.Content>
        </FocusModal>
      )}
    </Container>
  )
}

function buildReviewApprovalBody(
  job: PimJob,
  channel: string,
  form: ReviewForm,
): ProductContentMutationBody {
  const result = job.result_json ?? {}
  const body: ProductContentMutationBody = {
    locale: job.locale ?? '',
    channel,
    change_reason: 'Saved reviewed AI draft',
  }

  if ('title' in result || form.title) body.title = form.title || null
  if ('short_description' in result || form.short_description) {
    body.short_description = form.short_description || null
  }
  if ('description' in result || form.description) body.description = form.description || null
  if ('bullets_json' in result || form.bullets_json.length) {
    body.bullets_json = form.bullets_json.length ? form.bullets_json : null
  }
  if ('variant_titles_json' in result || form.variant_titles_json.length) {
    body.variant_titles_json = form.variant_titles_json.length ? form.variant_titles_json : null
  }
  if ('specifications_json' in result || form.specifications_json.length) {
    body.specifications_json = form.specifications_json.length ? form.specifications_json : null
  }

  const seoKeywords = form.seo_keywords
    .split(',')
    .map((keyword) => keyword.trim())
    .filter((keyword) => Boolean(keyword))
  if ('seo_json' in result || form.seo_title || form.seo_description || seoKeywords.length) {
    body.seo_json = {
      title: form.seo_title || undefined,
      description: form.seo_description || undefined,
      keywords: seoKeywords,
    }
  }
  if ('custom_metadata_json' in result) {
    body.custom_metadata_json = result.custom_metadata_json ?? null
  }

  return body
}
