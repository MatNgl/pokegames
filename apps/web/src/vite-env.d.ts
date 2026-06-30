/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Imports a effet de bord des polices (CSS embarque, pas de types fournis par les paquets).
declare module '@fontsource/*';
declare module '@fontsource-variable/*';
