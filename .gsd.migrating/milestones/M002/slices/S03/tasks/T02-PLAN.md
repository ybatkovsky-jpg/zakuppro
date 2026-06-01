---
estimated_steps: 47
estimated_files: 1
skills_used: []
---

# T02: Create AI Agent Module with OpenAI Integration

## Why
OpenAI GPT-4o recognizes dirty table structure and maps Russian column names to standard English fields (sku, name, qty, supplier). JSON schema guarantees 100% valid output format.

## Do
1. Create `backend/ai_agent.py` with:
   - `ExtractedBOM` and `BOMItem` Pydantic models for validation
   - `extract_bom_structure(table_markdown: str) -> dict` main function
   - OpenAI client initialized from OPENAI_API_KEY env var
   - JSON schema for structured output
   - Retry logic with exponential backoff (1s, 2s, 4s) for RateLimitError and APITimeoutError

2. JSON schema defines:
   ```json
   {
     "type": "object",
     "properties": {
       "items": {
         "type": "array",
         "items": {
           "sku": {"type": "string"},
           "name": {"type": "string"},
           "qty": {"type": "integer"},
           "supplier": {"type": "string", "nullable": true}
         }
       },
       "metadata": {
         "type": "object",
         "properties": {
           "project_name": {"type": "string"},
           "client": {"type": "string"}
         }
       }
     },
     "required": ["items"]
   }
   ```

3. System prompt handles Russian column mapping:
   - "Артикул" / "SKU" → sku
   - "Наименование" / "Название" → name
   - "Кол" / "Количество" → qty
   - "Поставщик" → supplier

4. Error handling:
   - RateLimitError: retry with backoff
   - APITimeoutError: retry with backoff
   - APIError / JSONDecodeError: raise immediately (non-retryable)

## Constraints
- Use openai==1.54.0 (already in requirements.txt)
- Model: gpt-4o with response_format={"type": "json_schema", "json_schema": {...}}
- Timeout: 30 seconds for API calls

## Inputs

- `backend/requirements.txt`

## Expected Output

- `backend/ai_agent.py`

## Verification

python -c "from backend.ai_agent import extract_bom_structure, ExtractedBOM; print('AI agent module loads')"
