---
status: diagnosed
trigger: "When logging in with admin@demo.com / password123, the first submit shows 'Incorrect password'. Pressing login a second time with the same credentials succeeds."
created: 2026-04-10T00:00:00Z
updated: 2026-04-10T00:01:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED — Demo credential buttons use setState (async) to populate email/password; clicking a demo button then immediately submitting the form captures the stale pre-update state values (empty strings) and sends them to the backend, which rejects them as wrong credentials.
test: traced onClick → setEmail/setPassword → handleSubmit captures closure values
expecting: root cause confirmed
next_action: return diagnosis

## Symptoms

expected: First login attempt with correct credentials succeeds
actual: First login attempt returns "Incorrect password"; second attempt with same credentials succeeds
errors: "Incorrect password" on first submit (backend returns 401)
reproduction: Click a demo credential button, then immediately click "Iniciar sesión"
started: unknown

## Eliminated

- hypothesis: Backend rate limiting blocks first request
  evidence: rateLimiter only rejects at maxAttempts (10 for login, 100 global); first request always passes through
  timestamp: 2026-04-10T00:01:00Z

- hypothesis: Async DB pool warmup / migration causes first query to fail
  evidence: migrate() runs in bootstrap() before app.listen(); pool is a standard pg.Pool, first query waits for connection normally and does not throw 401
  timestamp: 2026-04-10T00:01:00Z

- hypothesis: JWT secret not loaded on first request
  evidence: env.ts parses process.env at module load time (synchronous, via zod); secret is available before any request arrives
  timestamp: 2026-04-10T00:01:00Z

- hypothesis: client.ts response interceptor retries the login request on 401
  evidence: interceptor explicitly guards isAuthEndpoint (url.includes("/auth/login")) and skips retry for login; the 401 is propagated to the caller as-is
  timestamp: 2026-04-10T00:01:00Z

## Evidence

- timestamp: 2026-04-10T00:01:00Z
  checked: LoginForm.tsx lines 127-128 — demo credential onClick handler
  found: onClick={() => { setEmail(cred.email); setPassword(cred.password); }}
  implication: React setState is async/batched. The state update is enqueued but NOT yet applied when the user clicks the submit button immediately after.

- timestamp: 2026-04-10T00:01:00Z
  checked: LoginForm.tsx lines 27-38 — handleSubmit
  found: calls onLogin(email, password) where email and password are the current closure values from useState
  implication: If the user clicks the submit button in the same event-loop tick (or before React re-renders and the form is re-submitted), email and password still hold the previous values (empty strings on first page load, or whatever was typed before).

- timestamp: 2026-04-10T00:01:00Z
  checked: auth.service.ts lines 44-54 — backend login path for restaurant users
  found: const passwordHash = user?.passwordHash ?? DUMMY_HASH; const valid = await verifyPassword(input.password, passwordHash);
  implication: When email is "" the DB query returns no user, DUMMY_HASH is used, bcrypt.compare("", DUMMY_HASH) returns false → UnauthorizedError("Invalid email or password") → 401. This is exactly what the frontend surfaces as "Correo o contraseña incorrectos".

- timestamp: 2026-04-10T00:01:00Z
  checked: auth.service.ts lines 20-25 — superadmin path
  found: SELECT from superadmins WHERE email = "" → no match, falls through to restaurant user path
  implication: confirms the empty-email path hits the DUMMY_HASH branch

- timestamp: 2026-04-10T00:01:00Z
  checked: Second submit reproduces correctly
  found: After the first failed submit the component re-renders with the state values that setEmail/setPassword applied. The form fields now show the demo credentials AND the React state holds them. Submitting a second time sends the correct values.
  implication: The second submit works because React state was already committed during the first render cycle triggered by the failed attempt (setError, setLoading(false)).

## Resolution

root_cause: >
  LoginForm.tsx lines 127-128: the demo credential button calls setEmail() and setPassword() (React setState, enqueued, not synchronous).
  If the user (or a test/automation) clicks Login before the next render commits those state updates, handleSubmit captures the stale email/password values (empty strings on first load).
  The backend receives email="" / password="" which matches no user, runs bcrypt against DUMMY_HASH, fails, and returns 401.
  On the second attempt the component has already re-rendered with the correct state, so the real credentials are sent and the login succeeds.

fix: (not applied — diagnosis only)
  In the demo credential onClick, instead of calling setEmail/setPassword, read the ref values directly
  OR submit the form programmatically after state is flushed
  OR pass the credentials directly to onLogin from the onClick without relying on state round-trip.
  The simplest fix: make onClick call onLogin(cred.email, cred.password) directly (bypassing the form state entirely),
  OR use a controlled approach: store a pendingCredentials ref and read it in handleSubmit.
  Most idiomatic React fix: in the demo button onClick, call onLogin directly rather than populating state and relying on a separate submit.

verification:
files_changed: []
