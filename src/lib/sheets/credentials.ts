/**
 * Service-account key from GOOGLE_SERVICE_ACCOUNT_FILE (path to the downloaded JSON, handy locally)
 * or GOOGLE_SERVICE_ACCOUNT_JSON (the JSON itself, e.g. in Vercel env vars). Errors never include the key.
 */
export function resolveCredentialsJson(
  env: NodeJS.ProcessEnv,
  readFile: (path: string) => string,
): string {
  const file = env.GOOGLE_SERVICE_ACCOUNT_FILE?.trim();
  let raw: string;
  let source: string;
  if (file) {
    source = `файл ${file} (GOOGLE_SERVICE_ACCOUNT_FILE)`;
    try {
      raw = readFile(file);
    } catch {
      throw new Error(`Не удалось прочитать ${source}. Проверьте путь к JSON-ключу.`);
    }
  } else if (env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()) {
    source = 'GOOGLE_SERVICE_ACCOUNT_JSON';
    raw = env.GOOGLE_SERVICE_ACCOUNT_JSON;
  } else {
    throw new Error(
      'Не задан ключ служебного аккаунта: укажите GOOGLE_SERVICE_ACCOUNT_FILE (путь к JSON-файлу) или GOOGLE_SERVICE_ACCOUNT_JSON.',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `${source}: ключ прочитан не полностью (${raw.length} символов) или это не JSON. ` +
        'В .env.local JSON нельзя вставлять в несколько строк — укажите вместо него ' +
        'GOOGLE_SERVICE_ACCOUNT_FILE=путь/к/ключу.json, а переменную GOOGLE_SERVICE_ACCOUNT_JSON удалите.',
    );
  }
  const p = parsed as { client_email?: unknown; private_key?: unknown };
  if (typeof p?.client_email !== 'string' || typeof p?.private_key !== 'string') {
    throw new Error(`${source}: это не ключ служебного аккаунта — нет полей client_email / private_key.`);
  }
  return raw;
}
