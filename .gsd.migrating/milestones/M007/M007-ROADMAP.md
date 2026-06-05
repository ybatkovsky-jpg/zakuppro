# M007: Production Hardening

**Vision:** Финальный milestone: закрыть все отложенные требования по отказоустойчивости, наблюдаемости, безопасности и администрированию. Система готова к реальной эксплуатации.

## Success Criteria

- Все 7 сервисов имеют health endpoints и graceful shutdown
- External calls обёрнуты в retry с exponential backoff + jitter
- Web UI разграничивает доступ по ролям (Owner/Manager/Склад)
- DLQ админка позволяет просматривать и перезапускать failed tasks

## Slices

- [x] **S01: S01** `risk:medium` `depends:[]`
  > After this: GET /health на каждом сервисе возвращает статус; docker-compose stop отрабатывает без потери задач

- [x] **S02: S02** `risk:medium` `depends:[]`
  > After this: Искусственный сбой OpenAI API → автоматический retry с растущей задержкой → успешный ответ или graceful failure

- [x] **S03: S03** `risk:high` `depends:[]`
  > After this: Владелец видит все проекты и склад, Менеджер — только свои проекты, Склад — только остатки

- [ ] **S04: DLQ Admin UI** `risk:medium` `depends:[]`
  > After this: Страница /admin/failed-tasks с таблицей неудачных задач, кнопкой Retry и деталями ошибок

## Boundary Map

Not provided.
