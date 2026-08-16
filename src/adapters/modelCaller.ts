// Thin, vendor-neutral wrapper a consumer implements against its own real
// streaming model client (hub: ModelClient.streamTurn(), see
// hub/lib/conversationalLane/modelClient.ts -- NOT imported here, per this
// library's standing invariant; only the shape is mirrored).
//
// Deliberately has NO `tools`/`toolChoice` field anywhere in this type: a
// Track-1 strategy literally cannot express a tool call, a compile-time
// fact reinforcing ADR-0155's Phase-0 hotfix (OllamaModelClient.
// streamTurn() hardcoding `tools: []` at runtime) with a second,
// independent layer at the type level. Even a consumer's ModelCaller
// implementation wrapping a tool-capable ModelClient underneath has no way
// to plumb a tool through THIS interface -- the field doesn't exist to
// pass one through.
//
// Also has no `tool_results` message role -- a Track-1 strategy never
// sees a tool result, since it can never have requested a tool call.

export type ModelCallerMessage = { role: 'user'; text: string } | { role: 'assistant'; text: string }

export type ModelCallerEvent = { type: 'text'; text: string } | { type: 'done' }

export interface ModelCallerParams {
  model: string
  system?: string
  messages: ModelCallerMessage[]
  signal?: AbortSignal
}

export interface ModelCaller {
  streamTurn(params: ModelCallerParams): AsyncIterable<ModelCallerEvent>
}
