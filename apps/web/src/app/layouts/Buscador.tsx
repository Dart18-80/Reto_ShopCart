import { LARGO_MAXIMO_TEXTO_BUSQUEDA } from '@shopcart/shared';
import { Search } from 'lucide-react';
import type { SubmitEvent } from 'react';
import { useNavigate } from 'react-router';
import { cn } from '../../shared/ui/cn';
import { CLASE_GRUPO_CONTROL } from '../../shared/ui/control';
import { RAIZ_DE_AREA } from '../rutas';

// El catálogo lee el texto con el mismo nombre que la búsqueda del backend (GET /productos?texto=).
const PARAMETRO_TEXTO = 'texto';

/** Figma: Buscador del Encabezado tienda. Lleva al catálogo con el texto en la URL. */
export function Buscador({ className }: { className?: string }) {
  const navegar = useNavigate();

  function buscar(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault();
    const texto = new FormData(evento.currentTarget).get(PARAMETRO_TEXTO);
    const consulta = typeof texto === 'string' && texto.trim() !== '' ? texto.trim() : null;
    void navegar(
      consulta === null
        ? RAIZ_DE_AREA.tienda
        : `${RAIZ_DE_AREA.tienda}?${new URLSearchParams({ [PARAMETRO_TEXTO]: consulta }).toString()}`,
    );
  }

  return (
    <form
      role="search"
      onSubmit={buscar}
      // D4: el buscador de la tienda va en píldora.
      className={cn(CLASE_GRUPO_CONTROL, 'rounded-full px-4', className)}
    >
      <Search aria-hidden className="text-muted-foreground size-4.5 shrink-0" />
      <input
        type="search"
        name={PARAMETRO_TEXTO}
        aria-label="Buscar productos"
        maxLength={LARGO_MAXIMO_TEXTO_BUSQUEDA}
        placeholder="Busca camisas, tenis o mochilas"
        className="texto-base placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent outline-none"
      />
    </form>
  );
}
