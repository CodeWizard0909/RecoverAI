# Project Development Guidelines

These are the rules to follow when building this project. The goal is a pipeline that runs smoothly and doesn't break repeatedly as features get added. The core loop below is the enforced cycle for every feature; the guardrails after it are standing rules that apply throughout.

## Core loop (repeat for every feature)

1. **Define the spec.** Write a short markdown spec for the feature slice: system bounds, inputs/outputs, API contracts, and edge cases/failure modes. Edge cases must be designed on purpose here — not discovered when the app crashes later. Nothing gets implemented without this.
2. **Load context rules.** Read the project's context/constraints file (rules, conventions, architecture notes — see "Living context doc" below) before writing anything.
3. **Scope to a single slice.** Pick one isolated, incremental unit of work — not "build the whole app." If a request bundles multiple features, split it and do one at a time. When a feature doesn't have an obvious natural boundary, default to slicing by layer and completing the full loop for each before moving to the next:
   - Data layer (schema/models) → review, commit.
   - Logic layer (API routes, error handling) → review, commit.
   - UI layer (components) → review, commit.
   
   This way a flaw found in one layer costs minutes, not days of compounded work.
4. **Write tests first.** Before implementation code, write the test/verification harness for this slice. Tests define what "correct" means before any code tries to satisfy it.
5. **Generate the implementation.** Write code against the spec and the tests — not the other way around.
6. **Run automated guardrails.** Typecheck, lint, and run the test suite. This is a hard pass/fail gate — mechanical, not a judgment call.
   - **Fail:** feed the exact error/log output back as the next prompt and return to step 5. Fix forward with the real error message rather than guessing.
   - **Pass:** continue to step 7.
7. **Review and commit.** Once guardrails pass, review the diff, commit it, and update the context doc if this slice introduced a new decision or constraint. Then return to step 3 for the next slice.

## Surrounding guardrails (apply throughout, not per-slice)

### The "Do Not Do" list
- Maintain an explicit list of forbidden patterns in the context rule file — this is more important than the list of things to do. Examples: no generic/bare exceptions, never mock the database in integration tests, no `any` types, no direct SQL string concatenation.
- A positive spec ("do this") and a negative spec ("never do this") catch different failure modes — an agent can follow every instruction it was given and still reach for a forbidden pattern nobody told it to avoid.
- Update this list whenever a review catches a bad pattern slipping through, so the same mistake doesn't recur in a later slice.

### Dependency and environment guardrails
- Pin exact dependency versions (`requirements.txt` with `==`, exact versions in `package.json`). A passing test suite won't catch a silently upgraded package breaking something downstream later.
- Do not introduce new libraries/frameworks without flagging it first.

### Living context doc
- Keep `PROJECT.md` (or `CONTEXT.md`) separate from the per-feature spec — it holds architecture overview, key decisions and why they were made, and known gotchas.
- Update it whenever a slice's step 7 introduces something future slices need to know. Static rule files (e.g. `.cursorrules`-style constraints) don't capture this; this doc is meant to accumulate.

### Commit discipline
- Commit at the end of every slice that passes guardrails (step 7) — not just at milestones.
- If a later change breaks something the guardrails don't catch, prefer reverting to the last good commit over patching forward blindly.

### Test quality is not automatic
- A passing gate proves internal consistency, not correctness — AI-written tests can encode the same wrong assumption as the code they're checking.
- Periodically spot-check that tests actually assert meaningful behavior, not just that the code runs.

### Error handling and logging
- Every new function/endpoint must include basic input validation, error handling, and meaningful log/error messages as part of its initial implementation — not a later cleanup pass.
- Fail loudly and readably. No silent failures, no bare `except: pass`.

## General rule of thumb
When in doubt: smaller scope, more frequent automated verification, more frequent commits.
