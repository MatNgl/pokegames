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
