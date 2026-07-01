import { AxiosError } from 'axios';

export function getApiErrorMessage(error: unknown, fallback = 'Une erreur est survenue'): string {
  if (error instanceof AxiosError) {
    if (error.code === 'ERR_NETWORK') {
      return "Serveur injoignable. Vérifiez que l'API est démarrée.";
    }
    const data = error.response?.data as { message?: string | string[] } | undefined;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(', ') : data.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

/** Vrai si le serveur a refuse le start car le defi du jour est deja termine (verrou 1x/jour). */
export function isDailyCompletedError(error: unknown): boolean {
  if (error instanceof AxiosError && error.response?.status === 409) {
    const data = error.response.data as { message?: string } | undefined;
    return data?.message === 'DAILY_ALREADY_COMPLETED';
  }
  return false;
}
