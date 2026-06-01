---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T04: Write unit tests for LLM provider with fallback

Create backend/tests/test_llm_provider.py with tests for successful call, primary failure with fallback, all providers fail, retry logic with exponential backoff. Mock external APIs.

## Inputs

- `llm_provider.py module`

## Expected Output

- `Test class for LLMProvider`
- `Test cases for fallback scenarios`
- `Coverage >80% for llm_provider`

## Verification

pytest backend/tests/test_llm_provider.py -v --cov=backend/llm_provider
