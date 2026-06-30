// URL de base de l'API (prefixe /api). Surchargeable via VITE_API_URL.
const rawApiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

export const API_URL = rawApiUrl.replace(/\/+$/, '');

// Origine de l'API sans le prefixe /api : sert a construire les URLs de sprites chargees en <img>.
export const API_ORIGIN = API_URL.replace(/\/api$/, '');
