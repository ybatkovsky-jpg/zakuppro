"""
Status mapping: Russian (DB) ↔ English (Frontend)

Standalone module to avoid circular imports.
"""

# Project status: Russian → English
PROJECT_STATUS_RU_TO_EN = {
    "Проектирование": "new",
    "Закупки": "processing",
    "В производстве": "requested",
    "Монтаж": "delivered",
}

# Project status: English → Russian
PROJECT_STATUS_EN_TO_RU = {v: k for k, v in PROJECT_STATUS_RU_TO_EN.items()}

# Item status: Russian → English
ITEM_STATUS_RU_TO_EN = {
    "К закупке": "pending",
    "Запрошено": "requested",
    "Счет получен": "invoiced",
    "Оплачено": "paid",
    "На складе": "delivered",
    "В производстве": "ordered",
}

# Item status: English → Russian
ITEM_STATUS_EN_TO_RU = {v: k for k, v in ITEM_STATUS_RU_TO_EN.items()}


def map_project_status(status: str) -> str:
    """Convert Russian status to English for frontend."""
    return PROJECT_STATUS_RU_TO_EN.get(status, status)


def map_project_status_to_ru(status: str) -> str:
    """Convert English status from frontend to Russian for DB."""
    return PROJECT_STATUS_EN_TO_RU.get(status, status)


def map_item_status(status: str) -> str:
    """Convert Russian item status to English for frontend."""
    return ITEM_STATUS_RU_TO_EN.get(status, status)


def map_item_status_to_ru(status: str) -> str:
    """Convert English item status from frontend to Russian for DB."""
    return ITEM_STATUS_EN_TO_RU.get(status, status)
