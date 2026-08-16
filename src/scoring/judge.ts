// Track 2 (semantic judge scoring) -- deferred, not built this phase. This
// type only pins the one shape decision already made: a JudgeBackend takes
// the original call and the strategy's output and produces a verdict.
// Generic over Call/Output/Verdict deliberately -- nothing about what a
// "call", an "output", or a "verdict" concretely look like is decided
// here, since Track 2 itself isn't designed yet.
//
// Hard constraint, already decided (ADR-0155): if a JudgeBackend
// implementation makes its own model call to produce a verdict, that call
// MUST itself go through an approved Track-1 strategy
// (StrategyRegistry.use()) -- never a second, ungoverned call path
// bypassing the same trust gate every other model call in this library
// answers to. A judge is still just a narrow, bounded model call under the
// hood; it doesn't get to be the one exception.
export type JudgeBackend<Call, Output, Verdict> = (call: Call, output: Output) => Verdict | Promise<Verdict>
