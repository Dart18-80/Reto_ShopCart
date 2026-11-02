// import-in-the-middle publica sus tipos como register-hooks.d.ts junto a un .mjs y sin campo "exports": con
// moduleResolution NodeNext, TypeScript no los encuentra. Es la misma firma que publica el paquete (3.5.3).
declare module 'import-in-the-middle/register-hooks.mjs' {
  export interface RegisterHooksOptions {
    include?: (string | RegExp)[];
    exclude?: (string | RegExp)[];
    disableCjsSourceStripping?: boolean;
  }

  /** Hooks de carga síncronos (module.registerHooks) para los módulos de `include`. */
  export function register(options?: RegisterHooksOptions): void;
}
