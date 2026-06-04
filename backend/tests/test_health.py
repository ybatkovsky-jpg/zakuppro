"""
Tests for GET /health endpoint and health check helper functions.

Covers:
- All services healthy → 200
- Email worker degraded (missing heartbeat) → error in response
- Telegram bot degraded (stale heartbeat) → error in response
- Database down → 503
- RabbitMQ down → 503
- check_email_worker / check_telegram_bot unit tests with real temp files
"""
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone, timedelta
from pathlib import Path

from sqlalchemy.exc import SQLAlchemyError


# =============================================================================
# /health Endpoint Tests
# =============================================================================

class TestHealthEndpoint:

    def test_health_all_ok(self, test_client):
        """All services healthy → 200 with email_worker and telegram_bot fields."""
        with patch('backend.routers.health.check_rabbitmq', return_value='ok'), \
             patch('backend.routers.health.check_celery_worker', return_value='ok'), \
             patch('backend.routers.health.check_email_worker', return_value='ok'), \
             patch('backend.routers.health.check_telegram_bot', return_value='ok'):
            resp = test_client.get('/health')
            assert resp.status_code == 200
            data = resp.json()
            assert data['status'] == 'ok'
            assert data['db'] == 'ok'
            assert data['rabbitmq'] == 'ok'
            assert data['celery_worker'] == 'ok'
            assert data['email_worker'] == 'ok'
            assert data['telegram_bot'] == 'ok'

    def test_health_email_worker_degraded(self, test_client):
        """Email worker heartbeat missing → 503, email_worker='error'."""
        with patch('backend.routers.health.check_rabbitmq', return_value='ok'), \
             patch('backend.routers.health.check_celery_worker', return_value='ok'), \
             patch('backend.routers.health.check_email_worker', return_value='error'), \
             patch('backend.routers.health.check_telegram_bot', return_value='ok'):
            resp = test_client.get('/health')
            assert resp.status_code == 503
            detail = resp.json()['detail']
            assert detail['email_worker'] == 'error'
            assert detail['status'] == 'degraded'

    def test_health_telegram_bot_degraded(self, test_client):
        """Telegram bot heartbeat stale → 503, telegram_bot='error'."""
        with patch('backend.routers.health.check_rabbitmq', return_value='ok'), \
             patch('backend.routers.health.check_celery_worker', return_value='ok'), \
             patch('backend.routers.health.check_email_worker', return_value='ok'), \
             patch('backend.routers.health.check_telegram_bot', return_value='error'):
            resp = test_client.get('/health')
            assert resp.status_code == 503
            detail = resp.json()['detail']
            assert detail['telegram_bot'] == 'error'
            assert detail['status'] == 'degraded'

    def test_health_db_down(self, test_client):
        """DB failure → 503 with db='error'."""
        from backend.database import get_db
        app = test_client.app

        def override_get_db():
            mock_db = MagicMock()
            mock_db.execute.side_effect = SQLAlchemyError("connection refused")
            yield mock_db

        old_overrides = dict(app.dependency_overrides)
        app.dependency_overrides.clear()
        app.dependency_overrides[get_db] = override_get_db

        try:
            with patch('backend.routers.health.check_rabbitmq', return_value='ok'), \
                 patch('backend.routers.health.check_celery_worker', return_value='ok'), \
                 patch('backend.routers.health.check_email_worker', return_value='ok'), \
                 patch('backend.routers.health.check_telegram_bot', return_value='ok'):
                resp = test_client.get('/health')
                assert resp.status_code == 503
                assert resp.json()['detail']['db'] == 'error'
        finally:
            app.dependency_overrides.clear()
            app.dependency_overrides.update(old_overrides)

    def test_health_rabbitmq_down(self, test_client):
        """RabbitMQ failure → 503 with rabbitmq='error'."""
        with patch('backend.routers.health.check_rabbitmq', return_value='error'), \
             patch('backend.routers.health.check_celery_worker', return_value='ok'), \
             patch('backend.routers.health.check_email_worker', return_value='ok'), \
             patch('backend.routers.health.check_telegram_bot', return_value='ok'):
            resp = test_client.get('/health')
            assert resp.status_code == 503
            detail = resp.json()['detail']
            assert detail['rabbitmq'] == 'error'
            assert detail['status'] == 'degraded'


# =============================================================================
# check_email_worker / check_telegram_bot Unit Tests
# =============================================================================

class TestCheckEmailWorker:

    def test_ok_with_fresh_heartbeat(self, tmp_path):
        """Fresh heartbeat file → 'ok'."""
        from backend.routers.health import check_email_worker

        hb_file = tmp_path / 'email_heartbeat'
        hb_file.write_text(datetime.now(timezone.utc).isoformat())

        result = check_email_worker(str(hb_file), max_age=120)
        assert result == 'ok'

    def test_error_missing_file(self, tmp_path):
        """Missing heartbeat file → 'error'."""
        from backend.routers.health import check_email_worker

        missing = tmp_path / 'nonexistent'
        result = check_email_worker(str(missing), max_age=120)
        assert result == 'error'

    def test_error_stale_heartbeat(self, tmp_path):
        """Heartbeat older than max_age → 'error'."""
        from backend.routers.health import check_email_worker

        hb_file = tmp_path / 'stale_heartbeat'
        stale_time = datetime.now(timezone.utc) - timedelta(seconds=200)
        hb_file.write_text(stale_time.isoformat())

        result = check_email_worker(str(hb_file), max_age=120)
        assert result == 'error'

    def test_error_unparseable(self, tmp_path):
        """Unparseable heartbeat content → 'error'."""
        from backend.routers.health import check_email_worker

        hb_file = tmp_path / 'bad_heartbeat'
        hb_file.write_text('not-a-timestamp')

        result = check_email_worker(str(hb_file), max_age=120)
        assert result == 'error'


class TestCheckTelegramBot:

    def test_ok_with_fresh_heartbeat(self, tmp_path):
        """Fresh heartbeat file → 'ok' (90s threshold)."""
        from backend.routers.health import check_telegram_bot

        hb_file = tmp_path / 'tg_heartbeat'
        hb_file.write_text(datetime.now(timezone.utc).isoformat())

        result = check_telegram_bot(str(hb_file), max_age=90)
        assert result == 'ok'

    def test_error_missing_file(self, tmp_path):
        """Missing heartbeat file for telegram bot → 'error'."""
        from backend.routers.health import check_telegram_bot

        missing = tmp_path / 'nonexistent_tg'
        result = check_telegram_bot(str(missing), max_age=90)
        assert result == 'error'

    def test_error_stale_heartbeat(self, tmp_path):
        """Heartbeat older than 90s → 'error'."""
        from backend.routers.health import check_telegram_bot

        hb_file = tmp_path / 'stale_tg'
        stale_time = datetime.now(timezone.utc) - timedelta(seconds=100)
        hb_file.write_text(stale_time.isoformat())

        result = check_telegram_bot(str(hb_file), max_age=90)
        assert result == 'error'

    def test_error_unparseable(self, tmp_path):
        """Unparseable heartbeat content for telegram bot → 'error'."""
        from backend.routers.health import check_telegram_bot

        hb_file = tmp_path / 'bad_tg'
        hb_file.write_text('garbage')

        result = check_telegram_bot(str(hb_file), max_age=90)
        assert result == 'error'
