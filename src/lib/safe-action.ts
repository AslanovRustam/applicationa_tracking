import type { ActionResult } from './action-result';

export const NETWORK_ERROR = 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.';

/**
 * Server actions reject (instead of returning {ok:false}) when the request never gets a valid reply:
 * offline, a gateway error page, or a new deploy while the app was open. Normalize that into a result.
 */
export async function safeAction<T>(call: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await call();
  } catch (e) {
    console.error('[action] request failed', e);
    return { ok: false, error: NETWORK_ERROR };
  }
}
