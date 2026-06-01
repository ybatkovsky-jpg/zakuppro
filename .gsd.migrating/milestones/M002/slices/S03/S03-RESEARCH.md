# Research: Excel Parsing + AI-Agent (S03)

## Executive Summary

This research covers the implementation of Excel parsing with AI-powered structure recognition for dirty invoice tables. The stack combines pandas for Excel reading and OpenAI GPT-4o for intelligent table structure extraction, integrated via Celery tasks with retry logic and DLQ persistence.

---

## 1. Existing Codebase Structure

### 1.1 Celery App (`D:/CLAUDE/Project/zakuppro/zakuppro/backend/celery_app.py`)

**Current Configuration:**
- Broker: RabbitMQ (`pyamqp://guest:guest@rabbitmq:5672//`)
- Result Backend: Redis (`redis://redis:6379/0`)
- Task serialization: JSON
- Timezone: Europe/Moscow
- Task time limits: 25 min soft, 30 min hard
- Result expiration: 24 hours

**DLQ Configuration:**
```python
dlq_exchange = Exchange('dlq', type='direct', durable=True)
dlq_queue = Queue('dlq', exchange=dlq_exchange, routing_key='dlq', durable=True)

default_queue = Queue(
    'default',
    exchange=default_exchange,
    routing_key='default',
    durable=True,
    queue_arguments={
        'x-dead-letter-exchange': 'dlq',
        'x-dead-letter-routing-key': 'dlq',
        'x-message-ttl': 86400000,  # 24 hours
    }
)
```

### 1.2 Existing Tasks (`D:/CLAUDE/Project/zakuppro/zakuppro/backend/tasks.py`)

**Pattern observed:**
```python
@app.task(name='tasks.dummy_health_check', bind=True)
def dummy_health_check(self):
    logger.info(f"Health check task {self.request.id} executing")
    return {'status': 'ok', 'task_id': self.request.id}

@app.task(name='tasks.failing_task', bind=True, max_retries=3)
def failing_task(self, should_fail=True):
    # Can raise exceptions to trigger retry
    raise ValueError("Task failed")
```

### 1.3 Database Models (`D:/CLAUDE/Project/zakuppro/zakuppro/backend/models.py`)

**Invoice model with file_url and raw_text fields:**
```python
class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True, index=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False)
    file_url = Column(String(500), nullable=True)  # Path to invoice file (PDF/Excel)
    raw_text = Column(Text, nullable=True)  # Extracted text from invoice
    status = Column(String(50), nullable=False, default="Ожидает сверки")
```

### 1.4 Dependencies (`backend/requirements.txt`)

**Already installed:**
- `pandas==2.2.3` - Excel reading
- `openpyxl==3.1.5` - .xlsx format support
- `xlsxwriter==3.2.0` - Excel writing
- `openai==1.54.0` - AI API client
- `celery==5.4.0` - Task queue

---

## 2. Pandas Patterns for Excel Reading

### 2.1 Basic Excel Reading

```python
import pandas as pd

# Basic read
df = pd.read_excel('file.xlsx', sheet_name='Sheet1', engine='openpyxl')
```

### 2.2 Handling Dirty Tables with Multiple Headers

**Resources:**
- [Read excel file with multiple headers in different row positions](https://stackoverflow.com/questions/76310958/read-excel-file-with-multiple-headers-in-different-row-positions-to-pandas-dataf)
- [DataScientYst: How to Read Excel or CSV With Multiple Line Headers](https://datascientyst.com/read-excel-csv-multiple-line-headers-using-pandas/)

**Techniques:**

1. **Skip rows to find header:**
```python
# Skip first 3 rows, use row 4 as header
df = pd.read_excel('dirty.xlsx', header=3, engine='openpyxl')
```

2. **Read multiple header levels:**
```python
# Read with multi-index header
df = pd.read_excel('dirty.xlsx', header=[0, 1], engine='openpyxl')
```

3. **Use specific range:**
```python
# Read specific cell range (usecols, skiprows)
df = pd.read_excel(
    'dirty.xlsx',
    sheet_name='Sheet1',
    usecols='B:F',
    skiprows=5,
    engine='openpyxl'
)
```

### 2.3 Data Cleanup Patterns

**From research:**
- [Parsing Bad Excel Files with Pandas](https://medium.com/@connect.hashblock/parsing-bad-excel-files-with-pandas-my-survival-playbook-5652050942f2)
- [Reading Poorly Structured Excel Files](https://pbpython.com/pandas-excel-range.html)

```python
# Drop empty rows/columns
df = df.dropna(how='all').dropna(axis=1, how='all')

# Fill missing values
df = df.fillna('')

# Strip whitespace from strings
df = df.apply(lambda x: x.str.strip() if x.dtype == 'object' else x)

# Rename columns to standard format
df.columns = df.columns.str.strip().str.lower()
```

### 2.4 Convert to Markdown for AI

```python
def dataframe_to_markdown(df: pd.DataFrame) -> str:
    """Convert DataFrame to markdown table format for AI processing."""
    return df.to_markdown(index=False)

# Alternative: CSV format (often more reliable for dirty data)
def dataframe_to_csv(df: pd.DataFrame) -> str:
    return df.to_csv(index=False)
```

---

## 3. OpenAI API Integration for Structure Recognition

### 3.1 Structured Outputs with JSON Schema

**Official Documentation:**
- [Structured model outputs | OpenAI API](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI Structured Output Samples (GitHub)](https://github.com/openai/openai-structured-outputs-samples)

**Key concepts:**
- GPT-4o supports structured outputs via JSON Schema
- Guarantees 100% schema adherence
- Uses constrained decoding during generation

### 3.2 Prompt Construction for Dirty Tables

```python
from openai import OpenAI
import json

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def extract_table_structure(table_csv: str) -> dict:
    """
    Extract clean table structure from dirty invoice table.
    
    Args:
        table_csv: CSV representation of dirty table
        
    Returns:
        Structured data with columns, data rows, and metadata
    """
    
    prompt = f"""
You are an expert invoice parser. Analyze this dirty invoice table and extract clean structure.

DIRTY TABLE (CSV format):
{table_csv}

Extract:
1. Column names (map Russian variations to standard English)
2. Data rows (align to columns)
3. Line items (description, quantity, unit, price, total)
4. Invoice metadata (number, date, supplier, totals)

Common Russian invoice columns:
- "Наименование" → description
- "Кол" / "Количество" → quantity
- "Ед. изм" → unit
- "Цена" → price
- "Сумма" → total
"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are an expert invoice parser. Output valid JSON only."},
            {"role": "user", "content": prompt}
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "invoice_table",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "columns": {
                            "type": "array",
                            "items": {"type": "string"}
                        },
                        "rows": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "description": {"type": "string"},
                                    "quantity": {"type": "number"},
                                    "unit": {"type": "string"},
                                    "price": {"type": "number"},
                                    "total": {"type": "number"}
                                }
                            }
                        },
                        "metadata": {
                            "type": "object",
                            "properties": {
                                "invoice_number": {"type": "string"},
                                "invoice_date": {"type": "string"},
                                "supplier": {"type": "string"},
                                "subtotal": {"type": "number"},
                                "vat": {"type": "number"},
                                "total": {"type": "number"}
                            }
                        }
                    },
                    "required": ["columns", "rows"]
                }
            }
        }
    )
    
    return json.loads(response.choices[0].message.content)
```

### 3.3 Error Handling Patterns

```python
from openai import APIError, RateLimitError, APITimeoutError

def safe_extract_with_retry(table_csv: str, max_retries: int = 2) -> dict:
    """
    Extract table structure with retry logic.
    
    Implements exponential backoff: 1s, 2s, 4s
    """
    import time
    
    for attempt in range(max_retries + 1):
        try:
            return extract_table_structure(table_csv)
            
        except RateLimitError:
            if attempt < max_retries:
                wait_time = 2 ** attempt  # 1, 2, 4 seconds
                logger.warning(f"Rate limited, waiting {wait_time}s before retry {attempt + 1}")
                time.sleep(wait_time)
            else:
                raise
                
        except APITimeoutError:
            if attempt < max_retries:
                wait_time = 2 ** attempt
                logger.warning(f"Timeout, retrying in {wait_time}s")
                time.sleep(wait_time)
            else:
                raise
                
        except APIError as e:
            logger.error(f"OpenAI API error: {e}")
            raise  # Non-retryable
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            raise  # Non-retryable
```

### 3.4 Response Validation

```python
from pydantic import BaseModel, Field, validator

class InvoiceLineItem(BaseModel):
    description: str
    quantity: float = Field(ge=0)
    unit: str
    price: float = Field(ge=0)
    total: float = Field(ge=0)
    
    @validator('total')
    def validate_total(cls, v, values):
        if 'quantity' in values and 'price' in values:
            expected = values['quantity'] * values['price']
            if abs(v - expected) > 0.01:  # Allow small rounding errors
                raise ValueError(f"Total {v} doesn't match quantity*price")
        return v

class ExtractedInvoice(BaseModel):
    columns: list[str]
    rows: list[InvoiceLineItem]
    metadata: dict | None = None
    
    @classmethod
    def from_openai_response(cls, data: dict) -> 'ExtractedInvoice':
        """Validate and parse OpenAI response."""
        return cls(**data)
```

---

## 4. Celery Task Patterns

### 4.1 Task Definition with Retry Configuration

```python
from celery import shared_task
import logging

logger = logging.getLogger(__name__)

@shared_task(
    name='tasks.parse_invoice_excel',
    bind=True,
    max_retries=2,
    default_retry_delay=60  # Base delay in seconds
)
def parse_invoice_excel(self, invoice_id: int, file_path: str):
    """
    Parse Excel invoice file using AI-agent.
    
    Workflow:
    1. Read Excel with pandas (handle dirty tables)
    2. Convert to CSV/markdown for AI
    3. Call OpenAI GPT-4o for structure extraction
    4. Validate and save results to database
    5. Update invoice status
    
    On failure: Moves to DLQ after max_retries
    """
    import time
    from openai import RateLimitError, APITimeoutError
    
    try:
        logger.info(f"Processing invoice {invoice_id} from {file_path}")
        
        # Step 1: Read Excel
        df = pd.read_excel(file_path, engine='openpyxl')
        
        # Step 2: Clean and convert
        df = df.dropna(how='all').fillna('')
        table_csv = df.to_csv(index=False)
        
        # Step 3: AI extraction with retry
        extracted = safe_extract_with_retry(table_csv)
        
        # Step 4: Validate
        invoice_data = ExtractedInvoice.from_openai_response(extracted)
        
        # Step 5: Save to DB
        # TODO: Update invoice record with parsed data
        
        return {
            'status': 'success',
            'invoice_id': invoice_id,
            'items_count': len(invoice_data.rows)
        }
        
    except RateLimitError as e:
        # Exponential backoff for rate limits
        retry_count = self.request.retries
        wait_time = 2 ** retry_count  # 1, 2, 4 seconds
        
        logger.warning(f"Rate limited on invoice {invoice_id}, retry {retry_count + 1}/{self.max_retries}")
        
        raise self.retry(
            exc=e,
            countdown=wait_time,
            max_retries=2
        )
        
    except APITimeoutError as e:
        # Retry timeouts with backoff
        retry_count = self.request.retries
        wait_time = 2 ** retry_count
        
        logger.warning(f"Timeout on invoice {invoice_id}, retry {retry_count + 1}")
        raise self.retry(exc=e, countdown=wait_time, max_retries=2)
        
    except ValueError as e:
        # Validation errors - don't retry, move to DLQ
        logger.error(f"Validation failed for invoice {invoice_id}: {e}")
        raise  # This will move task to DLQ after max_retries
        
    except Exception as e:
        logger.error(f"Unexpected error processing invoice {invoice_id}: {e}")
        raise  # Moves to DLQ
```

### 4.2 DLQ Task Recovery

**For monitoring and reprocessing DLQ tasks:**

```python
@shared_task(name='tasks.reprocess_dlq_invoices')
def reprocess_dlq_invoices():
    """
    Scan DLQ for failed invoice parsing tasks.
    
    This task should be run periodically to:
    1. Check for stuck tasks in DLQ
    2. Attempt recovery for transient failures
    3. Alert for permanent failures
    """
    from kombu import Connection
    
    # Connect to RabbitMQ and inspect DLQ
    # Implementation depends on Celery/RabbitMQ monitoring approach
    pass
```

### 4.3 Retry Patterns Reference

**From research:**
- [Celery Masterclass - Exponential Backoff](https://medium.com/@anas-issath/celery-masterclass-django-66a37ec88e99)
- [Stack Overflow - Retry with Exponential Backoff](https://stackoverflow.com/questions/9731435/retry-celery-tasks-with-exponential-back-off)
- [Queue-Based Exponential Backoff Pattern](https://dev.to/andreparis/queue-based-exponential-backoff-a-resilient-retry-pattern-for-distributed-systems-37f3)

**Pattern:**
```python
# Exponential backoff calculation
def get_backoff(retry_count: int, base: int = 2) -> int:
    return base ** retry_count  # 1, 2, 4, 8, 16...

# In task
retry_count = self.request.retries
countdown = get_backoff(retry_count)
raise self.retry(exc=e, countdown=countdown)
```

---

## 5. DLQ Persistence Requirements

### 5.1 DLQ Table in Database

**New model needed:**
```python
class DeadLetterTask(Base):
    """Dead Letter Queue persistence for failed Celery tasks."""
    __tablename__ = "dead_letter_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(255), unique=True, nullable=False)  # Celery task UUID
    task_name = Column(String(255), nullable=False)
    args_json = Column(Text, nullable=True)  # Task args serialized
    kwargs_json = Column(Text, nullable=True)  # Task kwargs serialized
    exception = Column(Text, nullable=True)  # Exception message
    traceback = Column(Text, nullable=True)  # Full traceback
    retry_count = Column(Integer, default=0)
    status = Column(String(50), default="pending")  # pending, processing, resolved, failed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
```

### 5.2 DLQ Monitoring Endpoint

**FastAPI router for DLQ management:**
```python
@router.get("/dlq/tasks")
def list_dlq_tasks(db: Session = Depends(get_db)):
    """List all tasks in DLQ."""
    return db.query(DeadLetterTask).order_by(DeadLetterTask.created_at.desc()).all()

@router.post("/dlq/tasks/{task_id}/retry")
def retry_dlq_task(task_id: str, db: Session = Depends(get_db)):
    """Retry a failed task from DLQ."""
    task = db.query(DeadLetterTask).filter_by(task_id=task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    
    # Re-queue the task to Celery
    from backend.tasks import parse_invoice_excel
    result = parse_invoice_excel.apply_async(
        args=json.loads(task.args_json),
        kwargs=json.loads(task.kwargs_json)
    )
    
    task.status = "processing"
    db.commit()
    
    return {"message": "Task re-queued", "celery_task_id": result.id}
```

---

## 6. Implementation Checklist

### Task 1: Excel Reading Module
- [ ] Create `backend/excel_parser.py` module
- [ ] Implement `read_dirty_excel()` function with header detection
- [ ] Add data cleanup functions (drop empty rows, strip whitespace)
- [ ] Implement `dataframe_to_csv()` for AI input

### Task 2: AI Agent Module  
- [ ] Create `backend/ai_agent.py` module
- [ ] Implement OpenAI client with GPT-4o
- [ ] Define JSON schema for invoice structure
- [ ] Implement `extract_invoice_structure()` with prompt
- [ ] Add Pydantic models for response validation
- [ ] Implement retry with exponential backoff (1s, 2s, 4s)

### Task 3: Celery Task Integration
- [ ] Create `parse_invoice_excel()` task in `backend/tasks.py`
- [ ] Configure max_retries=2 with exponential backoff
- [ ] Implement DLQ error handling (raise non-retryable errors)
- [ ] Update Invoice model with parsed data

### Task 4: DLQ Persistence
- [ ] Create `DeadLetterTask` model in `backend/models.py`
- [ ] Add Alembic migration for DLQ table
- [ ] Implement DLQ logging on task failure
- [ ] Create DLQ monitoring router

---

## 7. Key Decisions Reference

- **D006**: pandas + OpenAI GPT-4o for dirty table recognition
- **D003**: Retry 2x with exponential backoff (1s, 2s, 4s) -> DLQ
- **D005**: DLQ persistence in RabbitMQ + DB table

---

## 8. Resources

### Pandas Excel Reading
- [Read excel file with multiple headers - Stack Overflow](https://stackoverflow.com/questions/76310958/read-excel-file-with-multiple-headers-in-different-row-positions-to-pandas-dataf)
- [DataScientYst: Read Excel with Multiple Line Headers](https://datascientyst.com/read-excel-csv-multiple-line-headers-using-pandas/)
- [Parsing Bad Excel Files with Pandas](https://medium.com/@connect.hashblock/parsing-bad-excel-files-with-pandas-my-survival-playbook-5652050942f2)
- [Reading Poorly Structured Excel Files - PB Python](https://pbpython.com/pandas-excel-range.html)

### OpenAI Structured Outputs
- [Structured model outputs | OpenAI API](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI Structured Output Samples (GitHub)](https://github.com/openai/openai-structured-outputs-samples)
- [LLM Structured Outputs: Schema Validation 2026](https://collinwilkins.com/articles/structured-output)
- [AI Structured JSON Output Guide 2026](https://devtk.ai/en/blog/ai-structured-output-guide-2026/)

### Celery Retry & DLQ
- [Celery Masterclass - Exponential Backoff](https://medium.com/@anas-issath/celery-masterclass-django-66a37ec88e99)
- [Retry Celery Tasks with Exponential Backoff - Stack Overflow](https://stackoverflow.com/questions/9731435/retry-celery-tasks-with-exponential-back-off)
- [Queue-Based Exponential Backoff Pattern](https://dev.to/andreparis/queue-based-exponential-backoff-a-resilient-retry-pattern-for-distributed-systems-37f3)
- [django-celery-outbox (PyPI)](https://pypi.org/project/django-celery-outbox/0.4.0/)