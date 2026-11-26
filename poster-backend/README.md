# Rang Poster Co. backend

Django REST Framework backend for the poster dashboard, using MySQL/MariaDB. **The React dashboard now uses the API and requires owner sign-in. Do not use this as a production system yet.** The OpenAPI schema currently has incomplete request/response descriptions, and further security, concurrency, data validation, and end-to-end review is required.

## Local setup

Requires Python 3.12+, MySQL/MariaDB, compiler and MySQL client development headers (on Debian/Ubuntu: `sudo apt install python3-dev default-libmysqlclient-dev build-essential pkg-config`).

```sh
cd poster-backend
python3 -m venv .venv
 .venv/Scripts/Activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env: use a unique SECRET_KEY and your database credentials.
```

Create the database and a least-privileged account in the MySQL shell (`sudo mysql` or `mysql -u root -p`). Replace `CHOOSE_A_STRONG_PASSWORD` with your own password, then put the same credentials in `.env`:

```sql
CREATE DATABASE rang_poster_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'rang_poster'@'localhost' IDENTIFIED BY 'CHOOSE_A_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON rang_poster_db.* TO 'rang_poster'@'localhost';
```

```sh
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

The MySQL account needs CREATE/DROP privileges for Django's separate `test_rang_poster_db` to run tests. Grant those on the test database only, or run tests with a test-specific database user.

```sh
python manage.py test sales delivery
```

For disposable demo data only, `python manage.py seed_demo` **deletes and replaces existing business data** and creates a known demo owner account. Never run it against real data. The demo reset API is also destructive: set `DEMO_MODE=False` outside disposable local environments. The sample `.env.example` is development-only; change the secret, disable debug, configure allowed hosts, CORS, HTTPS, backups and production serving, and perform a security review before deployment.

To get a richer dataset for manual testing, run `python manage.py seed_test_data` **after** `seed_demo` (it refuses to run twice on the same database). It layers on ~115 extra sales across the last 90 days (combo discounts, mixed Cash/UPI/Other payments, 4 cancellations), 18 more expenses, 10 home-delivery orders in every pipeline status (including delivered orders that create real linked sales), reprint batches, damage entries, and pushes a few designs to sold-out/low so the alerts and waiting-for-stock radar fire. All rows go through the same service functions as the REST API, so the stock ledger and COGS snapshots stay consistent.

## Frontend connection

```sh
cd ../poster-dashboard
npm install
npm run dev -- --host 0.0.0.0
```

By default the Vite dev server proxies `/api` to `http://127.0.0.1:8000`. In a deployed environment route `/api` to Django through a reverse proxy, or set `VITE_API_BASE_URL` (for example `http://localhost:8000/api`) and configure backend CORS for the frontend origin. Restart Vite after changing environment or proxy settings. Django uses the database configured in **its own** `.env`; phpMyAdmin must connect to the same host, port and database to see those records.

Sign in with an owner account. The dashboard fetches current data from the backend and posts changes to it. A previous browser-local demo snapshot is not automatically imported; the owner backup import replaces all business data, so only use it after a verified database backup and deliberate review. Current dashboard reads use the owner-only backup export endpoint, so staff users cannot yet use the dashboard. Refresh the page after changes made from another device. Demo seeding/reset is destructive and must only be used on disposable databases.

## API map

Base URL `http://localhost:8000/api/`. Except health, login and refresh, endpoints require `Authorization: Bearer <access>`. Responses are normally `{success,message,data}`, with errors `{success:false,message,...}`; backup export and CSV return raw documents. Lists currently return arrays without pagination on several resources.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health/` | Database health |
| POST | `/auth/login/` | `{username,password}` → access and refresh |
| POST | `/auth/refresh/` | `{refresh}` → rotated tokens |
| POST | `/auth/logout/` | `{refresh}` blacklist refresh |
| GET, PATCH | `/auth/me/` | Profile |
| POST | `/auth/change-password/` | Change password |
| POST | `/auth/register/` | Owner creates an account |
| GET, POST | `/designs/` | List/search and create designs |
| GET, PATCH, DELETE | `/designs/{code}/` | Detail, update, archive |
| GET | `/designs/low-stock/`, `/designs/out-of-stock/`, `/designs/stats/` | Inventory views |
| POST | `/designs/{code}/archive/`, `/batches/`, `/damage/` | Inventory actions |
| GET | `/designs/{code}/movements/` | Stock audit trail |
| GET, POST | `/sales/` | List and create sales |
| GET | `/sales/{number}/`, `/sales/stats/`, `/sales/summary/` | Sale and statistics |
| POST | `/sales/{number}/cancel/` | `{reason}`; restores stock |
| GET, POST | `/expenses/` | List and create expenses |
| GET, PATCH, DELETE | `/expenses/{code}/` | Expense detail and changes |
| GET | `/expenses/stats/` | Expense statistics |
| GET, POST | `/expense-categories/` | List and create categories |
| GET, PATCH, DELETE | `/expense-categories/{id}/` | Category management |
| GET, POST | `/orders/` | List/create orders. Create validates customer fields: name letters/spaces only, phone = 10-digit mobile with optional +91 (stored as `+91XXXXXXXXXX`), PIN = 6 digits starting 1–8, address required |
| GET, PATCH | `/orders/{number}/` | Order detail and changes |
| POST | `/orders/{number}/status/`, `/fulfill/` | Status transition, record sale |
| GET | `/orders/{number}/history/`, `/orders/waiting-radar/` | Status audit, waiting stock |
| GET | `/dashboard/overview/` | Dashboard data, accepts date ranges |
| GET | `/reports/daily/`, `/reports/monthly/`, `/reports/summary/` | Financial summaries |
| GET | `/reports/daily/export/` | CSV export |
| GET, PATCH | `/settings/` | Shop profile |
| GET, POST | `/categories/`, `/discount-rules/` | Manage categories and discount rules |
| GET, PATCH, DELETE | `/categories/{id}/`, `/discount-rules/{id}/` | Manage individual records |
| GET | `/backup/export/` | Owner export |
| POST | `/backup/import/`, `/demo/reset/` | Destructive restore/reset (owner) |
| GET | `/schema/`, `/docs/`, `/redoc/` | OpenAPI, Swagger UI, ReDoc |

Example sale: `POST /sales/` with `{"lines":[{"design_code":"D001","qty":2}],"payment":"Cash"}`. The server calculates the price and stock changes. Error responses include HTTP 400 for invalid inputs, 401 for missing/invalid JWT, 403 for insufficient permissions, and 404 for missing records. The generated Swagger descriptions are currently incomplete; consult serializers and views for authoritative request fields until the schema is completed.

The standalone `/home/user/api_smoke.py` is an integration smoke test in this workspace and modifies the demo database; it expects demo seed credentials and sample rows. Never run it on real data.
