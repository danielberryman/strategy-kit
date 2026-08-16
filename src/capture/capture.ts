import { randomUUID } from 'node:crypto'
import type { Pseudonymizer } from '../adapters/pseudonymizer.js'
import type { SchemaExtractionStrategySpec } from '../strategy/types.js'
import type { CaptureRecord, CaptureStorage } from './types.js'
import { pseudonymizeCapture } from './pseudonymize.js'

// The capture hook: called with a schema-extraction strategy's own
// input/output pair, right at "groundingCheck succeeded" -- never on an
// ungrounded result, since an ungrounded pair isn't trustworthy fixture
// material. Pure composition of the strategy's own groundingCheck,
// pseudonymizeCapture, and the storage adapter; no I/O beyond storage.put.
export async function captureIfGrounded<Input, Output>(
  spec: SchemaExtractionStrategySpec<Input, Output>,
  input: Input,
  output: Output,
  pseudonymizer: Pseudonymizer,
  storage: CaptureStorage
): Promise<CaptureRecord | undefined> {
  if (!spec.groundingCheck(input, output)) return undefined

  const pseudonymized = pseudonymizeCapture(input, output, pseudonymizer)
  const record: CaptureRecord = {
    id: randomUUID(),
    strategyId: spec.strategyId,
    capturedAt: Date.now(),
    input: pseudonymized.input,
    output: pseudonymized.output,
  }
  await storage.put(record)
  return record
}
