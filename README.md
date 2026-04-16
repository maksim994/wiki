# Корпоративная wiki (MVP)

Исходный репозиторий: [github.com/maksim994/wiki](https://github.com/maksim994/wiki).

Self-hosted wiki: роли **Admin / Editor / Viewer**, пространства **space**, дерево страниц, **блочный редактор [BlockNote](https://www.blocknotejs.org/)** (стиль Notion: `/`, списки, заголовки и т.д.), автосохранение при правке (debounce), **история версий** с восстановлением, **недавние страницы** в сайдбаре (localStorage), поиск внутри space, комментарии, публикация по `/pub/:token`. Редактор подгружается отдельным чанком (меньше первый загрузочный JS).

## Быстрый старт (Docker)

```bash
cp .env.example .env
# Задайте JWT_SECRET и при необходимости ADMIN_EMAIL / ADMIN_PASSWORD
docker compose up --build
```

Откройте [http://localhost:3000](http://localhost:3000). Первый вход под администратором из переменных окружения (после первого запуска с пустой БД).

## Разработка (локально)

1. Поднимите PostgreSQL, например `docker compose up -d db` (порт хоста по умолчанию **5434**, см. [docker-compose.yml](docker-compose.yml)) или используйте свой инстанс.
2. Скопируйте [.env.example](.env.example) в `.env` и выставьте `DATABASE_URL`, `JWT_SECRET`.
3. Миграции и генерация Prisma:

```bash
npm install
npm run db:generate -w apps/api
npm run db:migrate -w apps/api
# или без миграций: npm run db:push -w apps/api
```

4. Два процесса: API и Vite (прокси в `vite.config.ts` на порт 3000):

```bash
npm run dev
```

Фронт: [http://localhost:5173](http://localhost:5173). API: [http://localhost:3000](http://localhost:3000).

Сборка продакшена (SPA + API, статика в `apps/api/public`):

```bash
npm run build
npm run start -w apps/api
```

## Структура

| Путь | Назначение |
|------|------------|
| [apps/api](apps/api) | Fastify + Prisma + PostgreSQL |
| [apps/web](apps/web) | React + Vite + react-router |
| [docs](docs) | Продуктовая спецификация (PRD, роли, модель данных) |

## Документы

| Документ | Содержание |
|----------|------------|
| [docs/MVP-SCOPE.md](docs/MVP-SCOPE.md) | Состав MVP |
| [docs/ROLES.md](docs/ROLES.md) | Матрица ролей |
| [docs/CONTENT-MODEL.md](docs/CONTENT-MODEL.md) | Сущности и версии |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Эксплуатация |
| [docs/PRD-MVP.md](docs/PRD-MVP.md) | PRD и API |
