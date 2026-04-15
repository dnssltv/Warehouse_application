# Warehouse App - Полная документация проекта

## 1. Назначение системы

`warehouse-app` - это система управления складскими заявками на сборку устройств/аксессуаров.
Приложение покрывает полный процесс:

- создание заявки заказчиком;
- назначение исполнителей заведующим складом;
- выполнение заявки кладовщиком;
- подтверждение результата заведующим;
- оценка качества заказчиком;
- администрирование пользователей и ролей.

## 2. Архитектура

### 2.1 Backend

- Технологии: `FastAPI`, `SQLAlchemy`, `Pydantic`, `PostgreSQL`, `JWT`.
- Точка входа: `backend/app/main.py`.
- API роутер: `backend/app/api/router.py` (префикс `/api`).
- Роуты:
  - `backend/app/api/routes/users.py`
  - `backend/app/api/routes/requests.py`
  - `backend/app/api/routes/work_types.py`
- Модели:
  - `backend/app/models/user.py`
  - `backend/app/models/request.py`
  - `backend/app/models/work_type.py`
- Безопасность:
  - `backend/app/core/security.py`
  - `backend/app/dependencies.py`

### 2.2 Frontend

- Технологии: `React`, `TypeScript`, `Vite`.
- Точка входа: `frontend/src/main.tsx`.
- Основной UI: `frontend/src/App.tsx`.
- API base URL задается через `VITE_API_BASE_URL`.

### 2.3 Инфраструктура

- Оркестрация: `docker-compose.yml`.
- Сервисы:
  - `db` (PostgreSQL)
  - `backend` (FastAPI/Uvicorn)
  - `frontend` (Vite)
  - `db_backup` (автоматические бэкапы БД)

## 3. Роли и права

Роли в системе:

- `admin`
- `requester`
- `warehouse_manager`
- `warehouse_operator`
- `pending`

### 3.1 admin

- Управление пользователями:
  - создание (`POST /api/users/admin-create`)
  - изменение профиля (`PATCH /api/users/{user_id}`)
  - смена роли (`PATCH /api/users/{user_id}/role`)
  - смена пароля (`PATCH /api/users/{user_id}/password`)
  - просмотр списка (`GET /api/users`)
- Админское редактирование заявки (`PATCH /api/requests/{request_id}/admin-edit`)
- Просмотр всех заявок (`GET /api/requests`)
- Добавление/удаление вложений в любых заявках.

### 3.2 requester (заказчик)

- Создание заявки (`POST /api/requests`)
- Просмотр только своих заявок (`GET /api/requests`)
- Добавление/удаление вложений только в своих заявках
- Оценка только своих заявок после подтверждения (`POST /api/requests/{request_id}/rate`)

### 3.3 warehouse_manager (заведующий складом)

- Просмотр всех заявок
- Просмотр пользователей
- Назначение кладовщиков на заявку (`POST /api/requests/{request_id}/assign`)
- Подтверждение сборки (`POST /api/requests/{request_id}/approve`)
- Возврат заявки в работу (`POST /api/requests/{request_id}/return-to-work`)

### 3.4 warehouse_operator (кладовщик)

- Просмотр только назначенных ему заявок
- Старт работы (`POST /api/requests/{request_id}/start`)
- Пауза (`POST /api/requests/{request_id}/pause`)
- Возобновление (`POST /api/requests/{request_id}/resume`)
- Завершение (`POST /api/requests/{request_id}/finish`)

### 3.5 pending

- Техническая роль для новых регистраций.
- Нет бизнес-доступа к операциям заявок.

## 4. Жизненный цикл заявки

Основные статусы:

- `new` (новая)
- `assigned` (назначена)
- `in_progress` (в работе)
- `paused` (на паузе)
- `assembled` (собрана)
- `approved` (подтверждена)
- `returned_to_work` (возврат в работу)
- `rated` (оценена)

Переходы:

1. `new` -> `assigned` (заведующий назначает исполнителей)
2. `assigned` -> `in_progress` (кладовщик берет в работу)
3. `in_progress` -> `paused` (кладовщик ставит на паузу)
4. `paused` -> `in_progress` (кладовщик возобновляет)
5. `in_progress` -> `assembled` (кладовщик завершает)
6. `assembled` -> `approved` (заведующий подтверждает)
7. `assembled` -> `returned_to_work` (заведующий возвращает)
8. `returned_to_work` -> `assigned` (повторное назначение)
9. `approved` -> `rated` (заказчик оценивает)

Ограничения переходов:

- Все действия выполняются "только от себя" по `user_id/manager_id/requester_id`.
- Кладовщик должен быть в списке назначенных `assignee_ids`.
- Заведующий должен быть назначенным менеджером конкретной заявки.

## 5. API (по фактическому коду)

### 5.1 Аутентификация и пользователи

- `POST /api/auth/register` - регистрация, роль `pending`
- `POST /api/auth/login` - логин, выдача JWT
- `GET /api/auth/me` - профиль текущего пользователя
- `GET /api/users` - список пользователей (`admin`, `warehouse_manager`)
- `POST /api/users/admin-create` - создание пользователя админом
- `PATCH /api/users/{user_id}/role` - смена роли
- `PATCH /api/users/{user_id}` - редактирование пользователя
- `PATCH /api/users/{user_id}/password` - смена пароля

### 5.2 Типы работ

- `GET /api/work-types`
- `POST /api/work-types` (только `admin`)

### 5.3 Заявки

- `GET /api/requests`
- `POST /api/requests`
- `POST /api/requests/{request_id}/attachments`
- `DELETE /api/requests/{request_id}/attachments`
- `PATCH /api/requests/{request_id}/admin-edit`
- `POST /api/requests/{request_id}/assign`
- `POST /api/requests/{request_id}/start`
- `POST /api/requests/{request_id}/pause`
- `POST /api/requests/{request_id}/resume`
- `POST /api/requests/{request_id}/finish`
- `POST /api/requests/{request_id}/approve`
- `POST /api/requests/{request_id}/return-to-work`
- `POST /api/requests/{request_id}/rate`

## 6. Бизнес-логика и вычисления

### 6.1 Номер заявки

`backend/app/services/request_service.py`

- Формат: `REQ-YYYYMM-XXXX`.
- Для устойчивости добавлен retry при коллизии уникального ключа.

### 6.2 Дедлайн

`backend/app/services/request_service.py`

- Норматив: `item_qty * 60` секунд.
- Рабочее окно: `08:00-21:00`.
- Если расчет выходит за границы дня, переносится на следующий рабочий день.

### 6.3 Длительность выполнения

- `duration_seconds = finished_at - started_at`.
- Заполняется при `finish`.

## 7. Данные и хранилище

### 7.1 БД

- Таблицы: `users`, `requests`, `work_types`.
- Создание схемы при старте: `Base.metadata.create_all`.

### 7.2 Вложения

- Файлы сохраняются в `uploads`.
- Раздаются как static по `/uploads`.

### 7.3 Бэкапы БД

В `docker-compose.yml` добавлен сервис `db_backup`:

- каждые `BACKUP_INTERVAL_HOURS` часов выполняется `pg_dump`;
- дампы сохраняются в `./backups`;
- старые дампы удаляются по `BACKUP_KEEP_DAYS`.

## 8. Конфигурация и переменные окружения

Основные переменные:

- БД: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`
- Backend: `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `CORS_ORIGINS`
- Админ: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME`, `SYNC_ADMIN_ON_STARTUP`
- Frontend: `VITE_API_BASE_URL`
- Бэкап: `BACKUP_INTERVAL_HOURS`, `BACKUP_KEEP_DAYS`

Текущая админская учетная запись (по требованиям):

- логин: `d.guselnikov@breezy.kz`
- пароль: `Ui4ufiyo`

## 9. Запуск и эксплуатация

### 9.1 Локальный запуск

1. Заполнить `.env` на основе `.env.example`.
2. Выполнить:
   - `docker compose up --build`
3. Доступ:
   - Frontend: `http://localhost:5173`
   - Backend: `http://localhost:8000`

### 9.2 Доступ из локальной сети

1. Узнать IP хоста (например `192.168.1.50`).
2. В `.env` задать:
   - `VITE_API_BASE_URL=http://192.168.1.50:8000/api`
   - добавить этот origin в `CORS_ORIGINS`
3. Перезапустить compose.
4. Открыть порты Windows Firewall: `5173` и `8000`.
5. Клиенты в LAN используют `http://192.168.1.50:5173`.

### 9.3 Рекомендуемый режим 24/7

- Docker Desktop в автозапуск.
- `docker compose up -d`.
- Отключить сон ноутбука при питании от сети.
- Закрепить IP на роутере (DHCP reservation).

## 10. Известные ограничения и техдолг

- Нет отдельного migration workflow (Alembic не интегрирован в runtime).
- `frontend/src/App.tsx` монолитный (весь UI в одном файле).
- Нет автоматизированных тестов в репозитории.
- Нет CI/CD pipeline.
- Нужно обязательно хранить production-секреты вне Git.

## 11. Контрольный чеклист "ежедневно"

- Проверить, что контейнеры `db`, `backend`, `frontend`, `db_backup` в статусе Up.
- Проверить вход в систему админом.
- Проверить создание тестовой заявки и переходы статусов.
- Проверить, что в `backups` появился свежий `.sql.gz`.
- Проверить, что дисковое место не заканчивается.

## 12. Контрольный чеклист "перед продом"

- Поменять `SECRET_KEY` на длинный случайный.
- Поменять админский пароль.
- Ограничить `CORS_ORIGINS` конкретными адресами.
- Выключить лишние debug/dev режимы.
- Настроить HTTPS/reverse proxy.
- Внедрить миграции и CI.
