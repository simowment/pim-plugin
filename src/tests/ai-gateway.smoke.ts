/**
 * ai-gateway.smoke.ts
 *
 * Smoke test for the AI gateway integration.
 * Skips gracefully when PIM_AI_API_KEY is not configured.
 *
 * Run with:
 *   PIM_AI_API_KEY=<key> npx tsx src/tests/ai-gateway.smoke.ts
 *
 * Or from the pim plugin root:
 *   pnpm exec tsx src/tests/ai-gateway.smoke.ts
 */

const AI_BASE_URL = process.env.PIM_AI_BASE_URL ?? 'https://openrouter.ai/api/v1'
const AI_API_KEY = process.env.PIM_AI_API_KEY ?? ''
const AI_MODEL = process.env.PIM_AI_MODEL ?? 'openai/gpt-4o-mini'

async function runSmoke() {
  if (!AI_API_KEY) {
    console.log('[ai-gateway.smoke] SKIP: PIM_AI_API_KEY is not set.')
    console.log('Set PIM_AI_API_KEY to run the real integration test.')
    process.exit(0)
  }

  console.log(`[ai-gateway.smoke] Testing AI gateway at ${AI_BASE_URL} with model ${AI_MODEL}`)

  const payload = {
    model: AI_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are a product content generator. Respond with a JSON object containing "title" and "description" for a sample product.',
      },
      {
        role: 'user',
        content: 'Generate content for a wooden dining chair.',
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 200,
  }

  let response: Response
  try {
    response = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error('[ai-gateway.smoke] FAIL: Network error reaching AI gateway:', err)
    process.exit(1)
  }

  if (!response.ok) {
    const text = await response.text()
    console.error(`[ai-gateway.smoke] FAIL: Gateway returned ${response.status}: ${text}`)
    process.exit(1)
  }

  const data = (await response.json()) as { choices: Array<{ message: { content: string } }> }
  const raw = data.choices?.[0]?.message?.content

  if (!raw) {
    console.error('[ai-gateway.smoke] FAIL: Empty response from gateway')
    process.exit(1)
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error('[ai-gateway.smoke] FAIL: Response is not valid JSON:', raw)
    process.exit(1)
  }

  if (!parsed.title || !parsed.description) {
    console.error('[ai-gateway.smoke] FAIL: Missing expected fields in response:', parsed)
    process.exit(1)
  }

  console.log('[ai-gateway.smoke] PASS ✓')
  console.log('  title:', parsed.title)
  console.log('  description:', String(parsed.description).slice(0, 80) + '...')
  process.exit(0)
}

runSmoke().catch((err) => {
  console.error('[ai-gateway.smoke] Unexpected error:', err)
  process.exit(1)
})
