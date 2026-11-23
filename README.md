# Трекер откликов

Личное веб-приложение для учёта откликов на вакансии. Данные хранятся в вашей собственной Google-таблице.

- **Отклики**: сводка (за неделю, всего, в процессе, ближайшее событие), таблица с поиском и фильтрами, карточка отклика с историей статусов, доска активных откликов с перетаскиванием, пометка «нет ответа 30+ дней» и массовая «Тишина».
- **Копилка**: свои разделы со ссылками и шаблонами. Ссылки копируются в один клик. В шаблонах работают переменные `{компания}`, `{должность}`, `{ссылка}`, `{контакт}`, а также любые свои, например `{имя}`.
- Работает на телефоне, можно установить на главный экран («Поделиться → На экран „Домой“» в Safari или «Установить приложение» в Chrome).

Стек: Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui, Auth.js (вход через Google), Google Sheets API, Vitest.

## Локальный запуск без Google

```bash
npm install
cp .env.example .env.local
# в .env.local раскомментируйте:
#   SHEETS_DRIVER=memory
#   AUTH_DISABLED=true
npm run dev
```

Приложение откроется на http://localhost:3000 с демо-данными. Данные хранятся в памяти и сбрасываются при перезапуске. В production оба флага игнорируются.

Тесты: `npm test`.

## Настройка для работы с Google-таблицей

### 1. Google Cloud: проект, Sheets API и служебный аккаунт

1. Откройте https://console.cloud.google.com/ и создайте проект, например `job-tracker`.
2. **APIs & Services → Library** → найдите **Google Sheets API** → **Enable**.
3. **APIs & Services → Credentials → Create credentials → Service account**. Задайте любое имя, роли не нужны.
4. **APIs & Services → Credentials**, внизу в блоке **Service Accounts** нажмите на email созданного аккаунта (или **IAM & Admin → Service Accounts** → аккаунт). На его странице откройте вкладку **Keys → Add key → Create new key → JSON → Create**. Скачается файл с ключом. Храните его как пароль и не коммитьте.
5. Скопируйте email служебного аккаунта (вида `…@….iam.gserviceaccount.com`).

### 2. Вход через Google (OAuth-клиент)

1. **Google Auth Platform** (бывший «OAuth consent screen») → **Get started**: укажите название приложения и свой email, на шаге **Audience** выберите **External**, затем завершите мастер (**Create**).
2. **Google Auth Platform → Audience → Test users → Add users**: добавьте свой Google-аккаунт. Статус «Testing» менять не нужно.
3. **Google Auth Platform → Clients → Create client** → тип **Web application**.
4. **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<ваш-домен>.vercel.app/api/auth/callback/google`
5. Сохраните **Client ID** и **Client secret**.

### 3. Новая таблица

1. Создайте **новую пустую** Google-таблицу. С ней будет работать приложение.
2. **Настройки доступа** → добавьте email служебного аккаунта с правом **Редактор**.
3. ID таблицы — это часть адреса между `/d/` и `/edit`.

Вкладки `applications`, `history`, `vault_sections`, `vault_items` с заголовками приложение создаст само при первом запуске. Не меняйте заголовки и колонку `id`. Открывать таблицу для просмотра можно в любой момент.

### 4. Переменные окружения

Локально впишите их в `.env.local`, на Vercel — в **Project → Settings → Environment Variables**:

| Переменная | Значение |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_FILE` | **локально**: путь к скачанному JSON-ключу, например `./my-key.json` (файл не коммитьте, добавьте его в `.gitignore`) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | **на Vercel**: содержимое JSON-ключа (вставьте файл целиком в поле значения). В `.env.local` многострочный JSON не работает, там используйте `GOOGLE_SERVICE_ACCOUNT_FILE` |
| `SPREADSHEET_ID` | ID новой таблицы |
| `AUTH_GOOGLE_ID` | Client ID |
| `AUTH_GOOGLE_SECRET` | Client secret |
| `AUTH_SECRET` | случайная строка: `npx auth secret` или `openssl rand -base64 32` |
| `ALLOWED_EMAIL` | ваш Google-email, единственный, кому разрешён вход |

### 5. Деплой на Vercel

1. Залейте репозиторий на GitHub и импортируйте его в Vercel (**Add New → Project**).
2. Добавьте переменные из шага 4 и нажмите **Deploy**.
3. Добавьте адрес деплоя в redirect URI OAuth-клиента (шаг 2.3).

## Перенос старых откликов

Скрипт один раз читает старую таблицу (только чтение) и переносит записи в новую.

1. Дайте служебному аккаунту доступ к **старой** таблице с правом **Читатель**.
2. В `.env.local` укажите `OLD_SPREADSHEET_ID` (ID старой таблицы) и `OLD_SHEET_TAB` (название вкладки, по умолчанию `отклики`), а также `GOOGLE_SERVICE_ACCOUNT_FILE` и `SPREADSHEET_ID` новой таблицы.
3. Пробный прогон без записи: `npm run migrate -- --dry-run`. Он покажет отчёт: сколько строк, какие статусы, что требует ручной проверки.
4. Если отчёт в порядке: `npm run migrate`. Повторный запуск не создаёт дублей.

Старая таблица не изменяется.
