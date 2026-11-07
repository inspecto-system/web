# web

Веб-приложение Inspecto (T-501…T-504): Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS, TanStack Query, next-intl, клиент API `openapi-fetch` с типами из контракта (`api/`, тег `api-v0.7.1`).

## Устройство

- Работает за nginx на одном адресе с API (ADR-013): запросы идут на `/api/v1/...` того же источника, поэтому refresh-cookie `SameSite=Strict` работает, а CORS не нужен.
- Access-токен — только в памяти (`src/auth/session.ts`), refresh-токен — cookie `HttpOnly; Secure; SameSite=Strict` (ADR-008); после перезагрузки сессия восстанавливается `POST /auth/refresh` с заголовком `X-CSRF-Protection`, при `401` токен обновляется один раз и запрос повторяется.
- `src/proxy.ts` (бывший middleware) ставит на каждую страницу строгую CSP с новым nonce: скрипты и стили — только с nonce, без `'unsafe-inline'` (SECURITY.md §10). Поэтому `cacheComponents` (частичный пререндеринг) выключен — у статической оболочки не было бы nonce, — и страницы рендерятся на запрос.
- Интерфейс на русском, английский подготовлен (`messages/`, ADR-019); язык в адресе не указывается.
- Шрифты системные: при сборке ничего не загружается со сторонних сервисов.
- Образ: `output: "standalone"`, `node:24-alpine`, пользователь `node`, без npm/yarn.

## Проверки (CODE_QUALITY.md §2, §6)

Node.js не обязателен на машине — команды можно запускать в контейнере `node:24-bookworm-slim`
(в Git Bash с `MSYS_NO_PATHCONV=1`, `node_modules` — в томе Docker):

```bash
docker run --rm -v "$(pwd -W):/web" -v inspecto-web-nm:/web/node_modules -w /web node:24-bookworm-slim \
  sh -c "npm ci --ignore-scripts && npm run format:check && npm run lint && npm run typecheck && npm run test:coverage"
```

| Скрипт                              | Что делает                                                                                                                                            |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generate:api`                      | Типы API из `api/*.yaml` в `src/api/generated/` (не в git; запускается перед lint, typecheck, test, build)                                            |
| `format:check`, `lint`, `typecheck` | Prettier, ESLint (`react/no-danger`, неиспользуемый код), `tsc --noEmit`                                                                              |
| `test`, `test:coverage`             | Vitest + React Testing Library; порог покрытия 60 %                                                                                                   |
| `build`, `start`                    | `next build` (standalone) и запуск собранного сервера                                                                                                 |
| `test:e2e`                          | Playwright в Chromium: сам запускает собранный сервер, или идёт на `E2E_BASE_URL`; `e2e/live.spec.ts` — только с `E2E_LIVE=1` против compose за nginx |

Playwright — в образе `mcr.microsoft.com/playwright:v1.65.0-noble`:

```bash
docker run --rm -v "$(pwd -W):/web" -v inspecto-web-nm:/web/node_modules -w /web -e CI=1 \
  mcr.microsoft.com/playwright:v1.65.0-noble sh -c "npm run build && npm run test:e2e"
```

CI — общие шаблоны `platform`: `node.yml` (проверки, сборка, Playwright), `security.yml` (Gitleaks, CodeQL), `container.yml` (образ, непривилегированный пользователь, Trivy).

`AGENTS.md` создан `create-next-app` и поддерживается самим Next.js: в нём ссылка на документацию установленной версии (`node_modules/next/dist/docs/`).
