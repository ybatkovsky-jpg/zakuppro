---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T02: Create llm_provider.py with provider-agnostic wrapper

Create backend/llm_provider.py with LLMProvider class supporting OpenAI, Gemini, Claude. Configuration-driven primary/secondary from .env. Fallback logic on rate limit/timeout errors. parse_invoice() method accepting file content and schema.

## Inputs

- `Existing ai_agent.py pattern`
- `Environment variables for API keys`

## Expected Output

- `llm_provider.py module`
- `LLMProvider class with call() method`
- `Fallback logic with retry`
- `Pydantic models for InvoiceItem`

## Verification

pytest backend/tests/test_llm_provider.py -v
