import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

export type Tema = 'claro' | 'oscuro';
type Preferencia = Tema | 'sistema';

/** 05 §6: la preferencia visual se guarda en este navegador; no es un dato de la cuenta. */
export const CLAVE_TEMA = 'shopcart-tema';
const CONSULTA_OSCURO = '(prefers-color-scheme: dark)';
const CLASE_OSCURO = 'dark';

function leerPreferencia(): Preferencia {
  try {
    const guardada = localStorage.getItem(CLAVE_TEMA);
    return guardada === 'claro' || guardada === 'oscuro' ? guardada : 'sistema';
  } catch {
    // Sin acceso al almacenamiento (modo privado, cookies bloqueadas): se sigue el tema del sistema.
    return 'sistema';
  }
}

function guardarPreferencia(tema: Tema) {
  try {
    localStorage.setItem(CLAVE_TEMA, tema);
  } catch {
    // Sin almacenamiento, el tema elegido dura lo que dura la pestaña.
  }
}

function suscribirAlSistema(avisar: () => void) {
  const consulta = window.matchMedia(CONSULTA_OSCURO);
  consulta.addEventListener('change', avisar);
  return () => {
    consulta.removeEventListener('change', avisar);
  };
}

const sistemaEsOscuro = () => window.matchMedia(CONSULTA_OSCURO).matches;

interface ContextoTema {
  tema: Tema;
  elegirTema: (tema: Tema) => void;
}

const contextoTema = createContext<ContextoTema | null>(null);

/** Aplica el tema con la clase `dark` de `<html>`, que activa el modo Oscuro de las variables (FE-15). */
export function ProveedorTema({ children }: { children: ReactNode }) {
  const [preferencia, setPreferencia] = useState(leerPreferencia);
  const oscuroDelSistema = useSyncExternalStore(suscribirAlSistema, sistemaEsOscuro);
  const tema: Tema =
    preferencia === 'sistema' ? (oscuroDelSistema ? 'oscuro' : 'claro') : preferencia;

  useLayoutEffect(() => {
    document.documentElement.classList.toggle(CLASE_OSCURO, tema === 'oscuro');
  }, [tema]);

  const valor = useMemo(
    () => ({
      tema,
      elegirTema: (elegido: Tema) => {
        guardarPreferencia(elegido);
        setPreferencia(elegido);
      },
    }),
    [tema],
  );

  return <contextoTema.Provider value={valor}>{children}</contextoTema.Provider>;
}

export function useTema(): ContextoTema {
  const contexto = useContext(contextoTema);
  if (!contexto) throw new Error('useTema necesita un ProveedorTema más arriba.');
  return contexto;
}
