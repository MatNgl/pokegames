/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Import a effet de bord de la police variable (CSS embarque, pas de types fournis par le paquet).
declare module '@fontsource-variable/outfit';
