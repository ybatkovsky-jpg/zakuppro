"""
Transition service with guard for project status changes.

Provides can_transition_to(project, target_status, db) returning (bool, reason)
used by the project update router to enforce business rules before allowing
status transitions. The primary rule: transition to "В производстве" requires
all ProjectItems to be "На складе" or "Оплачено".
"""
import logging
from collections import Counter
from sqlalchemy.orm import Session

from backend.models import Project, ProjectItem

logger = logging.getLogger(__name__)

# ProjectItem statuses considered ready for production
PRODUCTION_READY_STATUSES = {"На складе", "Оплачено"}


def can_transition_to(project: Project, target_status: str, db: Session) -> tuple[bool, str]:
    """
    Check whether a project can transition to the given target status.

    Returns (True, "") if the transition is allowed, or (False, reason) with
    a human-readable reason if blocked.

    Current rules:
    - Transition to "В производстве": all ProjectItems must have status
      "На складе" or "Оплачено". Blocked otherwise with item counts per
      non-ready status.
    """
    if target_status != "В производстве":
        return True, ""

    items = db.query(ProjectItem).filter(
        ProjectItem.project_id == project.id
    ).all()

    if not items:
        return True, ""

    # Count items by status
    status_counts: Counter[str] = Counter()
    for item in items:
        status_counts[item.status or ""] += 1

    non_ready: dict[str, int] = {}
    for status, count in status_counts.items():
        if status not in PRODUCTION_READY_STATUSES:
            non_ready[status] = count

    if non_ready:
        total = len(items)
        ready = sum(
            count for status, count in status_counts.items()
            if status in PRODUCTION_READY_STATUSES
        )
        breakdown = ", ".join(
            f"{status}: {count}" for status, count in non_ready.items()
        )
        reason = (
            f"Невозможно перевести проект в «В производстве»: "
            f"не все позиции готовы. "
            f"Готово: {ready}/{total}. "
            f"Не готовы — {breakdown}"
        )
        logger.info(
            "can_transition_to: blocked transition to production "
            "for project_id=%s — ready=%s/%s, non_ready=%s",
            project.id, ready, total, dict(non_ready),
        )
        return False, reason

    logger.info(
        "can_transition_to: allowed transition to production "
        "for project_id=%s — all %s items ready",
        project.id, len(items),
    )
    return True, ""
