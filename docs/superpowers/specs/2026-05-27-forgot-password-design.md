# Forgot Password — Design Spec

Date: 2026-05-27

---

## Goal

Allow users who forget their password to reset it via a time-limited email link. The sign-in page already has a "Forgot password?" anchor with `href="#"` — this spec wires it up.

---

## Flow

1. User clicks "Forgot password?" on `/signin`
2. Redirected to `/forgot-password` — enters email, submits
3. Page shows "If that email is registered, you'll receive a reset link shortly" — **always**, regardless of whether the email exists (prevents account enumeration)
4. Email arrives with a reset link: `/reset-password?token=<rawToken>`
5. User clicks link → `/reset-password` page — enters new password + confirm
6. On success → redirected to `/signin` with a success message
7. On expired/invalid token → error message with link back to `/forgot-password`

---

## Token Storage

Reuse the existing `VerificationToken` model (NextAuth already owns this table):

```prisma
model VerificationToken {
  identifier String   // user's email
  token      String   @unique  // sha256 of raw token
  expires    DateTime
  @@unique([identifier, token])
}
```

- Raw token: `crypto.randomBytes(32).toString("hex")` — sent in email link only
- Stored token: `crypto.createHash("sha256").update(rawToken).digest("hex")`
- Expiry: 1 hour from creation
- Single-use: deleted immediately on successful reset
- If a reset is already pending for this email, delete the old token and create a new one (re-request)

---

## tRPC

New router: `server/routers/auth.ts` — public procedures (no session required).

### `auth.forgotPassword`

Input: `{ email: z.string().email() }`

Steps:
1. Look up user by email
2. If not found → return `{ success: true }` silently (no error)
3. Delete any existing VerificationToken for this email
4. Generate raw token, compute sha256 hash
5. Create `VerificationToken { identifier: email, token: hash, expires: now+1hr }`
6. Call `sendPasswordResetEmail(email, { username, token: rawToken })`
7. Return `{ success: true }`

### `auth.resetPassword`

Input: `{ token: z.string(), password: z.string().min(8).max(128) }`

Steps:
1. Hash the incoming token
2. Find `VerificationToken` where `token === hash`
3. If not found → throw `NOT_FOUND`: "Reset link is invalid or has expired."
4. If `expires < now` → delete token, throw `BAD_REQUEST`: "Reset link has expired. Please request a new one."
5. Look up user by `identifier` (email)
6. Hash new password with bcrypt (same as signup)
7. `user.update({ password: hashed })`
8. Delete the VerificationToken
9. Return `{ success: true }`

---

## Email

Add to `lib/email.ts`:

```ts
export async function sendPasswordResetEmail(to: string, opts: {
  username: string
  token: string   // raw token
})
```

Subject: "Reset your Gallery password"
Body: branded layout, button linking to `${GALLERY_URL}/reset-password?token=${opts.token}`, expires-in-1-hour note.

---

## Pages

### `/forgot-password`

- Email input + Submit button
- On submit: calls `auth.forgotPassword`, shows success message regardless of result
- "Back to sign in" link
- Already-sent state: disables button for 60s to prevent spam

### `/reset-password`

- Reads `token` from URL query param on mount
- If no token → redirect to `/forgot-password`
- Two fields: New password, Confirm password (client-side match validation)
- On submit: calls `auth.resetPassword`
- On success: redirect to `/signin?reset=success`
- On error: show error message + link back to `/forgot-password`

### `/signin` update

- "Forgot password?" `href="#"` → `href="/forgot-password"`
- Add `?reset=success` handling: show "Password reset — please sign in" banner

---

## Files

**Create:**
- `server/routers/auth.ts` — `forgotPassword`, `resetPassword`
- `app/forgot-password/page.tsx`
- `app/reset-password/page.tsx`

**Modify:**
- `server/routers/_app.ts` — add `auth: authRouter`
- `lib/email.ts` — add `sendPasswordResetEmail`
- `app/(auth)/signin/page.tsx` — wire the link + handle `?reset=success` banner

---

## Error Handling

| Scenario | Response |
|---|---|
| Email not registered | Silent success (no enumeration) |
| Token not found | "Reset link is invalid or has expired." |
| Token expired | "Reset link has expired. Please request a new one." |
| Passwords don't match | Client-side validation before submit |
| Password too short | `z.string().min(8)` on server |

---

## Out of Scope

- Rate limiting (can add later)
- "Remember me" / session invalidation on other devices after reset
