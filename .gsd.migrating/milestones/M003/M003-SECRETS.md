# M003 — Secrets Manifest

External API keys and credentials required for M003 Email + Invoice Processing.

## IMAP Server Credentials

**Service:** IMAP email server (e.g., Gmail, Outlook, custom mail server)

**Dashboard:** Provider-specific (Google Admin, Microsoft 365, or mail server admin panel)

**Format hint:** Full email address and app-specific password

**Status:** pending

**Destination:** .env (IMAP_USER, IMAP_PASS, IMAP_HOST, IMAP_PORT, INVOICE_EMAIL_ADDRESS)

**Obtain key steps:**
1. Create dedicated email address: `invoices@yourcompany.com`
2. For Gmail: Enable 2FA → Generate App Password → Copy 16-character password
3. For Outlook: Enable 2FA → Generate App Password → Copy password
4. For custom IMAP: Create email account → Set strong password
5. Test IMAP connection: `telnet imap.gmail.com 993` (SSL) or `telnet imap.gmail.com 143` (STARTTLS)

---

## SMTP Server Credentials

**Service:** SMTP email server (e.g., Gmail, Outlook, SendGrid)

**Dashboard:** Provider-specific (Google Admin, Microsoft 365, SendGrid dashboard)

**Format hint:** SMTP host, port (587 for STARTTLS, 465 for SSL), email, app password

**Status:** pending

**Destination:** .env (SMTP_HOST, SMTP_PORT, SMTP_EMAIL, SMTP_PASSWORD)

**Obtain key steps:**
1. For Gmail: Reuse IMAP app password or generate separate for SMTP
2. For Outlook: Reuse IMAP app password
3. For SendGrid: Create API key → Select "Mail Send" → restricted to sender address
4. Test SMTP: `telnet smtp.gmail.com 587`

---

## OpenAI API Key

**Service:** OpenAI API (GPT-4o, GPT-4o-mini)

**Dashboard:** https://platform.openai.com/api-keys

**Format hint:** `sk-...` (starts with `sk-proj-` for project keys)

**Status:** pending

**Destination:** .env (OPENAI_API_KEY)

**Obtain key steps:**
1. Log in to https://platform.openai.com
2. Navigate to API keys section
3. Click "Create new secret key"
4. Copy key immediately (only shown once)
5. Set billing limits to control costs

---

## Gemini API Key

**Service:** Google Gemini API (Gemini 2.5 Flash)

**Dashboard:** https://aistudio.google.com/app/apikey

**Format hint:** `AIza...` (starts with `AIza`)

**Status:** pending

**Destination:** .env (GEMINI_API_KEY)

**Obtain key steps:**
1. Log in to https://aistudio.google.com
2. Navigate to API keys section
3. Click "Create API key"
4. Copy key
5. Enable Gemini API in Google Cloud Console if needed

---

## Anthropic API Key

**Service:** Anthropic Claude API (Claude Sonnet 4.5)

**Dashboard:** https://console.anthropic.com/settings/keys

**Format hint:** `sk-ant-...` (starts with `sk-ant-api03-`)

**Status:** pending

**Destination:** .env (ANTHROPIC_API_KEY)

**Obtain key steps:**
1. Log in to https://console.anthropic.com
2. Navigate to API Keys section
3. Click "Create Key"
4. Copy key immediately
5. Set usage limits to control costs
