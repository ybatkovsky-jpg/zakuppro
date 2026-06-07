"""
Celery application configuration for ZakupPro.

Configures Celery with RabbitMQ broker, DLQ setup, and task settings.
"""

from celery import Celery
from celery.signals import worker_shutdown
import os
import logging

logger = logging.getLogger(__name__)

# Broker URL - uses pyamqp for RabbitMQ connection
# In Docker, 'rabbitmq' is the service name from docker-compose.yml
broker_url = os.getenv(
    'CELERY_BROKER_URL',
    'pyamqp://guest:guest@rabbitmq:5672//'
)

# Result backend — use RPC (AMQP) for task results.
# This avoids the need for a separate Redis container.
# RPC backend stores results in the same RabbitMQ broker.
result_backend = os.getenv(
    'CELERY_RESULT_BACKEND',
    'rpc://'
)

# Create Celery app instance
app = Celery(
    'zakuppro',
    broker=broker_url,
    backend=result_backend,
)

# Task serialization and security settings
app.conf.update(
    # Use JSON for serialization (fast and secure)
    broker_connection_retry_on_startup=True,
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',

    # Timezone configuration
    timezone='Europe/Moscow',
    enable_utc=True,

    # Task execution time limits
    # Hard limit: task will be killed after 30 minutes
    task_time_limit=30 * 60,  # 30 minutes in seconds
    # Soft limit: raises Exception after 25 minutes (allows cleanup)
    task_soft_time_limit=25 * 60,  # 25 minutes in seconds

    # Task result expiration (1 day)
    result_expires=86400,  # 24 hours in seconds

    # Task routing configuration
    task_routes={
        'tasks.parse_bank_statement': {'queue': 'bank_statement'},
        'tasks.*': {'queue': 'default'},
    },

    # Worker prefetch multiplier (tasks per worker)
    worker_prefetch_multiplier=1,

    # Acknowledgements mode - acknowledge after task execution
    task_acks_late=True,

    # Disable task compression for simplicity
    task_compression=None,
)

# Dead Letter Queue (DLQ) Configuration
# Tasks that fail will be moved to the DLQ for inspection
from kombu import Exchange, Queue

# DLQ Exchange (direct type for DLQ routing)
dlq_exchange = Exchange(
    'dlq',
    type='direct',
    durable=True
)

# DLQ Queue (holds failed tasks)
dlq_queue = Queue(
    'dlq',
    exchange=dlq_exchange,
    routing_key='dlq',
    durable=True
)

# Main default queue with DLQ binding
# Failed tasks will be routed to 'dlq' exchange
default_exchange = Exchange(
    'default',
    type='direct',
    durable=True
)

default_queue = Queue(
    'default',
    exchange=default_exchange,
    routing_key='default',
    durable=True,
    queue_arguments={
        # Dead letter exchange: where failed messages go
        'x-dead-letter-exchange': 'dlq',
        # Dead letter routing key: routes to DLQ
        'x-dead-letter-routing-key': 'dlq',
        # Message TTL: how long messages stay in queue before expiry
        'x-message-ttl': 86400000,  # 24 hours in milliseconds
    }
)

# Bank Statement Exchange (topic type for future event types)
bank_statement_exchange = Exchange(
    'bank.statement',
    type='topic',
    durable=True
)

# Bank Statement Queue with DLQ binding
bank_statement_queue = Queue(
    'bank_statement',
    exchange=bank_statement_exchange,
    routing_key='bank.statement',
    durable=True,
    queue_arguments={
        'x-dead-letter-exchange': 'dlq',
        'x-dead-letter-routing-key': 'dlq',
        'x-message-ttl': 86400000,  # 24 hours
    }
)

# Configure queues
app.conf.task_queues = [
    default_queue,
    bank_statement_queue,
    dlq_queue,
]

# Default queue for tasks without explicit routing
app.conf.task_default_queue = 'default'
app.conf.task_default_exchange = 'default'
app.conf.task_default_routing_key = 'default'

# Celery Beat Schedule - Periodic Tasks
from celery.schedules import crontab

app.conf.beat_schedule = {
    # Daily 9:00 AM digest of all production task delays
    'daily-delay-digest': {
        'task': 'tasks.send_delay_digest',
        'schedule': crontab(hour=9, minute=0),  # Daily at 9:00 AM
    },
}

@worker_shutdown.connect
def on_worker_shutdown(**kwargs):
    """Log worker shutdown event with active task count.

    task_acks_late=True ensures unacknowledged tasks are re-delivered on restart.
    """
    active_count = 0
    try:
        inspect = app.control.inspect()
        active = inspect.active()
        if active:
            active_count = sum(len(tasks) for tasks in active.values())
    except Exception:
        pass
    logger.info('Celery worker shutting down — active_tasks=%d', active_count)


# Import tasks module to register tasks
# Celery tasks are registered when the module is imported
from backend import tasks  # noqa: F401

if __name__ == '__main__':
    app.start()
