export type { ClosedLabelStrategySpec, SchemaExtractionStrategySpec, StrategySpec } from './strategy/types.js'

export type { ApprovalRecord } from './strategy/hash.js'
export { hashDeclaredShape, hashFixtureSuite } from './strategy/hash.js'

export { assertApproved, StrategyRegistry } from './strategy/registry.js'

export { classifyOnce, parseLabel, runClosedLabelStrategy } from './strategy/classifyOnce.js'

export type { ModelCaller, ModelCallerParams, ModelCallerMessage, ModelCallerEvent } from './adapters/modelCaller.js'
export type { Pseudonymizer } from './adapters/pseudonymizer.js'
export type { StrategyStorage } from './adapters/storage.js'
