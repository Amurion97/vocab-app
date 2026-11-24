---
status: accepted
---

# Dependency injection for external services and test isolation

External services (Gemini, Groq, LanguageTool, Prisma database queries, Next.js cache revalidations) introduce network latency, authentication requirements, rate limits, and failure modes. We adopt explicit, parameter-based Dependency Injection (`deps`) for business logic and service wrappers rather than relying on module-level monkey-patching or making live network calls in unit tests.

## Why

Unit tests must be fast, deterministic, runnable offline, and free of side effects. Directly calling third-party SDKs or databases inside core functions leads to:
1. **Flaky and slow test suites**: Network delays and transient API errors cause false negatives.
2. **Quota consumption and cost**: Every test run burns live tokens or hits rate limits.
3. **Hard-to-test edge cases**: Forcing third-party APIs to emit 429 rate limits, 500 internal errors, malformed JSON, or out-of-order responses is difficult without a controllable test double.

In JavaScript and TypeScript, teams often reach for module-level mocking (`jest.mock`, `proxyquire`, `sinon`). However, module mocking relies on runtime bundler loader hooks that are fragile under native ECMAScript Modules (ESM) and bind the codebase to specific test runner internals. Parameter-based dependency injection is pure TypeScript, statically typed, and runs identically across `node:test`, Bun, and other runners without magic.

## Considered options

- **Global module mocking (`jest.mock` / bundler loader hooks)**: Intercepts `import` statements at runtime. Rejected because it is brittle with native ESM, couples tests to specific test runners, and often masks missing environment configuration.
- **Socket-level network mocking (MSW / Nock)**: Intercepts HTTP requests at the Node/Bun socket level. Good for integration tests, but rejected for unit tests due to higher setup boilerplate and fragility when SDK internals change their HTTP client or request headers.
- **Calling live services in tests**: Hits real endpoints with live API keys. Rejected due to flakiness, credential management risks in CI, latency, and token costs.

## Implementation pattern

### 1. Function-level parameter injection
Functions that interact with external services expose an optional or required `deps` argument typed with a minimal interface:

```typescript
// lib/groq-grammar.ts
export type CheckGroqDeps = {
  apiKey?: string
  client?: Pick<Groq, "chat">
}

export async function checkGroq(
  text: string,
  deps?: CheckGroqDeps
): Promise<GrammarMatch[]> {
  const key = deps?.apiKey ?? groqApiKey()
  if (!key) {
    throw new Error("Groq is unavailable.")
  }

  const client = deps?.client ?? new Groq({ apiKey: key })
  // ...
}
```

- In **production**, callers omit `deps`, defaulting to the real SDK client and environment variables.
- In **tests**, test fixtures pass an in-memory test double (e.g. `{ client: mockClient }`).

### 2. Pipeline-level dependency aggregation
Complex coordination logic aggregates all infrastructure dependencies into a single interface:

```typescript
// lib/usage-check.ts
export type UsageCheckDeps = {
  checkMeaning: (params: { english: string; vietnamese: string; sentence: string }) => Promise<UsageCheck>
  checkLanguageTool: (sentence: string) => Promise<{ message: string }[]>
  checkGroq: (sentence: string) => Promise<{ message: string }[]>
  findWord: (id: string) => Promise<{ id: string; english: string; vietnamese: string } | null>
  saveAttempt: (input: { wordId: string; sentence: string; passed: boolean; issueUpdate: IssueUpdate }) => Promise<void>
  revalidateHome: () => void
}
```

- The API route handler (`app/api/check-usage/route.ts`) wires the production Prisma client, revalidation functions, and live AI checkers into `deps`.
- Unit tests (`test/check-usage.test.ts`) inject lightweight stubs (`standIns()`), enabling the entire test suite to execute in under 300ms without database or network access.

## Consequences

- Business logic functions remain decoupled from third-party SDK lifecycles and database connections.
- Unit tests remain completely hermetic, deterministic, and fast without requiring live API keys or active internet connections.
- When adding a new external provider or infrastructure dependency, authors must define its interface in the corresponding `deps` type rather than hardcoding singleton imports.
