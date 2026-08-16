export type { ClosedLabelStrategySpec, SchemaExtractionStrategySpec, StrategySpec } from './strategy/types.js'

export type { ApprovalRecord } from './strategy/hash.js'
export { hashDeclaredShape, hashFixtureSuite } from './strategy/hash.js'

export { assertApproved, StrategyRegistry } from './strategy/registry.js'

export { classifyOnce, parseLabel, runClosedLabelStrategy } from './strategy/classifyOnce.js'

export type { ModelCaller, ModelCallerParams, ModelCallerMessage, ModelCallerEvent } from './adapters/modelCaller.js'
export type { Pseudonymizer } from './adapters/pseudonymizer.js'
export type { StrategyStorage } from './adapters/storage.js'

export type {
  FixtureCase,
  FixtureSuite,
  ClosedLabelFixtureSuite,
  FixedComparisonRun,
  FixedComparisonCaseResult,
  ConfusionMatrix,
  MajorityWrongCase,
  FixedComparisonResult,
} from './scoring/types.js'

export { FixedComparisonBackend, toApprovalRecord } from './scoring/fixedComparison.js'
export type { FixedComparisonOptions } from './scoring/fixedComparison.js'

export { defineFixtureSuite, fixtureSuiteHash } from './scoring/fixtureSuite.js'

export type { JudgeBackend } from './scoring/judge.js'

export type { CaptureRecord, CaptureStorage } from './capture/types.js'
export { captureIfGrounded } from './capture/capture.js'
export { pseudonymizeCapture } from './capture/pseudonymize.js'
