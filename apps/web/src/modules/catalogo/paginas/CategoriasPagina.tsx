import { Link } from 'react-router';
import { EstadoVista } from '../../../shared/componentes/EstadoVista';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { Button } from '../../../shared/ui/button';
import type { Atributo, CategoriaAdmin } from '../catalogo.api';
import { DialogoNuevaCategoria } from '../componentes/DialogoCategoria';
import { DialogoNuevoAtributo, TarjetaAtributo } from '../componentes/SeccionAtributos';
import { TablaCategorias } from '../componentes/TablaCategorias';
import { useAtributos } from '../hooks/useAtributos';
import { useCategoriasAdmin } from '../hooks/useCategoriasAdmin';
import { RUTAS } from '../../../shared/rutas';

const sinCategorias = (categorias: CategoriaAdmin[]) => categorias.length === 0;
const sinAtributos = (atributos: Atributo[]) => atributos.length === 0;

/** M6-H02: `/backoffice/catalogo/categorias`, las categorías (activas o no) y los atributos, solo Admin. */
export function CategoriasPagina() {
  useTituloPagina('Categorías y atributos');
  const categorias = useCategoriasAdmin();
  const atributos = useAtributos();

  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="Ruta" className="texto-pequeno text-muted-foreground">
        <Link to={RUTAS.gestionCatalogo} className="hover:underline">
          Productos y precios
        </Link>
        {' / Categorías y atributos'}
      </nav>
      <h1 className="display-titulo-1">Categorías y atributos</h1>
      <section aria-labelledby="titulo-categorias" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="titulo-categorias" className="display-titulo-3">
            Categorías
          </h2>
          <DialogoNuevaCategoria disparador={<Button>Nueva categoría</Button>} />
        </div>
        <EstadoVista
          consulta={categorias}
          esVacio={sinCategorias}
          vacio={{ titulo: 'Todavía no hay categorías', descripcion: 'Crea la primera.' }}
        >
          {(lista) => <TablaCategorias categorias={lista} />}
        </EstadoVista>
      </section>
      <section aria-labelledby="titulo-atributos" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="titulo-atributos" className="display-titulo-3">
            Atributos
          </h2>
          <DialogoNuevoAtributo />
        </div>
        <EstadoVista
          consulta={atributos}
          esVacio={sinAtributos}
          vacio={{
            titulo: 'Todavía no hay atributos',
            descripcion: 'Crea Talla o Color para armar las variantes.',
          }}
        >
          {(lista) => (
            <div className="grid gap-4 md:grid-cols-2">
              {lista.map((atributo) => (
                <TarjetaAtributo key={atributo.idAtributo} atributo={atributo} />
              ))}
            </div>
          )}
        </EstadoVista>
      </section>
    </div>
  );
}
