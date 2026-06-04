---
estimated_steps: 15
estimated_files: 2
skills_used: []
---

# T02: Wire retry_async into email_notifier.py send_clarification_email and send_test_email

Why: SMTP connections are inherently transient — connection refused, TLS negotiation failure, temporary server errors. Currently these are silently swallowed with return False. Adding retry means a brief SMTP outage doesn't lose the clarification email to the supplier.

Do:
1. In send_clarification_email() and send_test_email():
   - Add @retry_async(retryable_exceptions=(aiosmtplib.SMTPException,)) decorator
   - Restructure internal try/except: remove the SMTPException catch (decorator handles it now). Keep the broad Exception catch for truly unexpected errors.
   - SMTPException in the SMTP send path will propagate to decorator for retry
   - Non-retryable exceptions (e.g. TypeError from malformed email) still caught by inner handler → return False immediately
2. In backend/tests/test_email_notifier.py, add TestEmailRetry class with:
   - test_retry_on_smtpexception_then_succeed: mock fails with SMTPException twice, succeeds on 3rd
   - test_retry_on_smtpexception_all_exhausted: mock always fails with SMTPException, returns False after 3 attempts
   - test_no_retry_on_non_smtp_exception: mock raises ValueError (non-retryable) → no retry, returns False immediately
   - test_retry_attempt_count: verify send_message called exactly 3 times when first 2 fail
   - test_success_no_retry: normal success path still works (no retries triggered)
   - test_retry_respects_config: verify SMTP config check still short-circuits before retry

Done when: `pytest backend/tests/test_email_notifier.py -v` passes all existing + new retry tests

## Inputs

- `backend/retry_utils.py`
- `backend/email_notifier.py`
- `backend/tests/test_email_notifier.py`

## Expected Output

- `backend/email_notifier.py`
- `backend/tests/test_email_notifier.py`

## Verification

pytest backend/tests/test_email_notifier.py -v
