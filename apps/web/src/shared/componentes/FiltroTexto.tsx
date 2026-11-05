import { Search } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import type { ParametrosUrl } from '../hooks/useParametrosUrl';

/** Los campos de la consulta que guardan texto libre. */
type CampoDeTexto<C> = { [K in keyof C]-?: C[K] extends string | undefined ? K : never }[keyof C];

interface PropsFiltroTexto<C> {
  parametros: ParametrosUrl<C>;
  campo: CampoDeTexto<C>;
  etiqueta: string;
  placeholder?: string;
  /** El largo máximo del esquema: así nunca se escribe un texto que la consulta rechazaría. */
  maxLength?: number;
}

/**
 * Texto libre de un listado (FE-06): llega a la URL 300 ms después de dejar de escribir, y toda una búsqueda
 * ocupa una sola entrada del historial (`historial: 'texto'`).
 */
export function FiltroTexto<C>({
  parametros,
  campo,
  etiqueta,
  placeholder,
  maxLength,
}: PropsFiltroTexto<C>) {
  const id = useId();
  const enUrl = String(parametros.valores[campo] ?? '');
  const [texto, setTexto] = useState(enUrl);
  const [enUrlAnterior, setEnUrlAnterior] = useState(enUrl);
  // Si la URL cambia por fuera («atrás», Limpiar filtros), el campo la sigue. El eco de lo que este campo escribió
  // no lo pisa: el esquema recorta, y borraría el espacio que se está escribiendo («gorra |azul»).
  if (enUrl !== enUrlAnterior) {
    setEnUrlAnterior(enUrl);
    if (enUrl !== texto.trim()) setTexto(enUrl);
  }
  const textoEstable = useDebounce(texto);
  const enviado = useRef<string | null>(null);
  const { cambiar } = parametros;

  useEffect(() => {
    // Solo cuando la espera terminó sobre lo que hay escrito: tras un «atrás», el texto viejo no vuelve a la URL.
    if (textoEstable !== texto) return;
    if (textoEstable.trim() === enUrl) {
      enviado.current = textoEstable;
      return;
    }
    // Ya se envió y el esquema lo rechazó (más largo que el máximo): no se reenvía en cada render.
    if (textoEstable === enviado.current) return;
    enviado.current = textoEstable;
    const valor = textoEstable.trim() === '' ? undefined : textoEstable;
    // CampoDeTexto<C> garantiza que el campo admite texto o undefined.
    cambiar({ [campo]: valor } as Partial<C>, { historial: 'texto' });
  }, [textoEstable, texto, enUrl, campo, cambiar]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <label htmlFor={id} className="control-etiqueta">
        {etiqueta}
      </label>
      <div className="bg-card border-input focus-within:ring-ring/50 flex items-center gap-2 rounded-md border px-4 py-3 focus-within:ring-[3px]">
        <Search aria-hidden className="text-muted-foreground size-4.5 shrink-0" />
        <input
          id={id}
          type="search"
          value={texto}
          placeholder={placeholder}
          maxLength={maxLength}
          onChange={(evento) => {
            setTexto(evento.target.value);
          }}
          className="texto-base placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent outline-none"
        />
      </div>
    </div>
  );
}
