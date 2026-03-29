# TEST - Resume Functionality Canary
# Version: 2.0
# Part of: AIDLC Dashboard AIDLC
# Updated: March 2026

## What this unit delivers
A test spec that intentionally fails at SP-02 and SP-04 to validate the
resume-from-failed-SP functionality. No real code is written or modified.
Failure is triggered by writing broken TypeScript inside src/__tests__/scratch/
which IS covered by tsconfig. Safe to delete after testing.

## Context
- B5 must be complete (Retry button on run page)
- No prior units required
- All test files go in src/__tests__/scratch/ (safe to delete after)

## Context files
  src/types/index.ts

## Architecture principles
- All files written to src/__tests__/scratch/ only
- SP-01 and SP-03 pass — write valid TypeScript
- SP-02 and SP-04 fail — write invalid TypeScript that typecheck catches
- SP-05 passes and writes a completion marker
- Clean up with: rm -rf src/__tests__/scratch/

## Sub-prompts (execute in order, validate each before next)

### SP-01: Write passing canary file 1
Write a valid TypeScript file. This SP always passes.

Files to create:
  src/__tests__/scratch/canary-1.ts

Content:
  // Canary 1 — SP-01 always passes
  export const canary1 = "SP-01 passed"

Acceptance:
  SP01-01  src/__tests__/scratch/canary-1.ts exists
  SP01-02  npm run typecheck returns zero errors

### SP-02: Write intentionally broken TypeScript file
Write invalid TypeScript so typecheck fails. This SP always fails — intentional.

Files to create:
  src/__tests__/scratch/canary-broken-1.ts

Content (deliberately invalid — do not fix):
  // INTENTIONAL TYPE ERROR — do not fix this file
  // This SP is designed to fail to test resume functionality
  const x: string = 12345
  const y: number = "not a number"
  export { x, y }

Acceptance:
  SP02-01  src/__tests__/scratch/canary-broken-1.ts exists
  SP02-02  npm run typecheck FAILS with type errors (expected and intentional)

### SP-03: Write passing canary file 2
Write another valid TypeScript file. Only reachable via Resume from SP-03.

Files to create:
  src/__tests__/scratch/canary-2.ts

Content:
  // Canary 2 — SP-03 always passes
  // If you see this file, resume from SP-03 worked correctly
  export const canary2 = "SP-03 passed — retry flow works"

Acceptance:
  SP03-01  src/__tests__/scratch/canary-2.ts exists
  SP03-02  npm run typecheck returns zero errors

### SP-04: Write second intentionally broken TypeScript file
Write more invalid TypeScript. This SP always fails — intentional.

Files to create:
  src/__tests__/scratch/canary-broken-2.ts

Content (deliberately invalid — do not fix):
  // SECOND INTENTIONAL TYPE ERROR — do not fix this file
  const a: boolean = "not a boolean"
  const b: string[] = 999
  export { a, b }

Acceptance:
  SP04-01  src/__tests__/scratch/canary-broken-2.ts exists
  SP04-02  npm run typecheck FAILS with type errors (expected and intentional)

### SP-05: Write completion marker
Write the final valid TypeScript marker. Only reachable via Resume from SP-05.

Files to create:
  src/__tests__/scratch/canary-complete.ts

Content:
  // Canary complete — all SPs finished with intentional failures at SP-02 and SP-04
  // Resume functionality is working correctly
  // Clean up: rm -rf src/__tests__/scratch/
  export const canaryComplete = true

Acceptance:
  SP05-01  src/__tests__/scratch/canary-complete.ts exists
  SP05-02  npm run typecheck returns zero errors

## How to use this spec for testing

1. Run live — fails at SP-02 (intentional type error)
2. Retry button appears next to SP-02 — click it
3. Execution resumes — SP-02 still fails (file still broken)
4. Delete the broken file: rm src/__tests__/scratch/canary-broken-1.ts
5. Click Retry again — SP-02 passes (file gone), SP-03 passes, SP-04 fails
6. Retry SP-04 — still fails
7. Delete: rm src/__tests__/scratch/canary-broken-2.ts
8. Click Retry SP-04 — passes, SP-05 passes
9. Clean up: rm -rf src/__tests__/scratch/

## Done when
All 5 SPs complete (with manual retries at SP-02 and SP-04).
src/__tests__/scratch/canary-complete.ts exists.

## Files produced by this unit
  src/__tests__/scratch/canary-1.ts
  src/__tests__/scratch/canary-2.ts
  src/__tests__/scratch/canary-complete.ts
  src/__tests__/scratch/canary-broken-1.ts  (intentionally broken)
  src/__tests__/scratch/canary-broken-2.ts  (intentionally broken)

## Next unit
(none — test spec only)
