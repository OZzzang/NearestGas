/// <reference types="vite/client" />

// Vite only types `import.meta.env` generically out of the box (as `ImportMetaEnv` with an
// index signature) — this augments it so `import.meta.env.VITE_API_URL` is typed as
// `string` everywhere it's used, instead of `any`.
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_GOOGLE_MAPS_API_KEY: string;
  readonly VITE_GOOGLE_MAPS_MAP_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
