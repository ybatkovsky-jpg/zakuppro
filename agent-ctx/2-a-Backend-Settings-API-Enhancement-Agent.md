# Task 2-a: Backend Settings API Enhancement Agent

## Task
Implement real SMTP, IMAP, and AI provider connection tests in the settings API routes.

## Work Completed

### Files Modified
1. `/home/z/my-project/src/app/api/settings/email/route.ts`
2. `/home/z/my-project/src/app/api/settings/ai/route.ts`

### Packages Installed
- `nodemailer` (v8.0.9) — SMTP connection testing
- `@types/nodemailer` (v8.0.0) — TypeScript types
- `imapflow` (v1.3.3) — IMAP connection testing

### SMTP Test (POST /api/settings/email, testType='smtp')
- Uses `nodemailer.createTransport()` → `transport.verify()` for real connection test
- Resolves masked passwords from DB
- On success: updates EmailSettings.isConfigured and lastCheckedAt
- Russian error messages for: EAUTH, ECONNREFUSED, ENOTFOUND, ETIMEDOUT, TLS/SSL errors

### IMAP Test (POST /api/settings/email, testType='imap')
- Uses `ImapFlow` client → `client.connect()` + `client.logout()` for real connection test
- Resolves masked passwords from DB
- Russian error messages for: AUTHENTICATIONFAILED, ECONNREFUSED, ENOTFOUND, ETIMEDOUT, SSL/TLS errors

### AI Test (POST /api/settings/ai)
- Uses `z-ai-web-dev-sdk` → `ZAI.create()` + `chat.completions.create()` for real LLM test
- Non-Z-AI providers: returns informative message that test only works with Z-AI
- On success: updates AiSettings.lastTestedAt and testResult='success'
- On error: updates AiSettings.lastTestedAt and testResult with error
- Russian error messages for: API key, rate limit, timeout, network, model not found

### Verification
- `bun run lint`: Clean pass
- Dev server: Running with no errors
