import { Link } from 'react-router';
import { Aviso } from '../../../shared/componentes/Aviso';
import { Monto } from '../../../shared/componentes/Monto';
import type { ProductoTienda } from '../catalogo.api';
import { useSeleccionVariante } from '../hooks/useSeleccionVariante';
import { precioMenor } from '../seleccionVariante';
import { CompraProducto } from './CompraProducto';
import { EtiquetaExistencia } from './EtiquetaExistencia';
import { GaleriaProducto } from './GaleriaProducto';
import { ATRIBUTO_COLOR, SelectorAtributo } from './SelectorAtributo';

interface PropsFichaProducto {
  producto: ProductoTienda;
  idVarianteEnUrl: number | undefined;
  alResolver: (idVariante: number | undefined) => void;
}

/** Figma 24:314 y 24:406 (M2-H03): el detalle de un producto, con la variante elegida en la URL. */
export function FichaProducto({ producto, idVarianteEnUrl, alResolver }: PropsFichaProducto) {
  const seleccion = useSeleccionVariante({
    variantes: producto.variantes,
    idVarianteEnUrl,
    alResolver,
  });
  const { variante, atributos } = seleccion;
  const atributoColor = atributos.find((a) => a.nombre === ATRIBUTO_COLOR);
  // FE-15: la ilustración toma el color elegido o, mientras no hay uno, el primero del producto.
  const color = atributoColor
    ? (seleccion.valorElegido(atributoColor) ?? atributoColor.valores[0]?.valor)
    : undefined;
  const precio = variante?.precio ?? precioMenor(producto.variantes);

  return (
    <div className="flex flex-col gap-6 pb-24 md:pb-0">
      <p className="texto-pequeno text-muted-foreground hidden md:block">
        <Link to="/" className="hover:text-primary">
          Catálogo
        </Link>
        {' / '}
        <Link to={`/?categoria=${String(producto.idCategoria)}`} className="hover:text-primary">
          {producto.categoria}
        </Link>
        {` / ${producto.nombre}`}
      </p>
      <div className="grid gap-6 md:grid-cols-2 md:gap-12">
        <div className="-mx-4 -mt-4 md:mx-0 md:mt-0">
          <GaleriaProducto
            ilustracion={producto.ilustracion}
            color={color}
            imagenes={producto.imagenes}
          />
        </div>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p className="texto-pequeno text-muted-foreground">{producto.categoria}</p>
            <h1 className="display-titulo-2 md:display-titulo-1">{producto.nombre}</h1>
            <p className="flex flex-wrap items-baseline gap-x-3">
              {variante === undefined && (
                <span className="texto-nota text-muted-foreground">Desde</span>
              )}
              {precio !== undefined && <Monto valor={precio} className="display-titulo-2" />}
              {/* N-18: los precios del catálogo ya incluyen el IVA. */}
              <span className="texto-nota text-muted-foreground">Incluye IVA del 12 %</span>
            </p>
            {variante && (
              <EtiquetaExistencia
                estado={variante.estadoExistencia}
                unidadesRestantes={variante.unidadesRestantes}
              />
            )}
          </div>
          <hr />
          {atributos.map((atributo) => (
            <SelectorAtributo
              key={atributo.idAtributo}
              atributo={atributo}
              opciones={seleccion.opcionesDe(atributo)}
              elegido={seleccion.seleccion[atributo.idAtributo]}
              enLoElegido={seleccion.elegidoEnLosDemas(atributo)}
              onElegir={(idValorAtributo) => {
                seleccion.elegir(atributo.idAtributo, idValorAtributo);
              }}
            />
          ))}
          <CompraProducto
            faltan={seleccion.faltan}
            agotada={variante?.estadoExistencia === 'Agotado'}
          />
          <Aviso tipo="info">
            {`Al agregarlo, su precio queda garantizado por ${String(producto.diasGarantiaPrecio)} días: si sube, pagas el anterior; si baja, pagas el nuevo.`}
          </Aviso>
          {producto.descripcion && (
            <section className="flex flex-col gap-2">
              <h2 className="display-titulo-3">Descripción</h2>
              <p className="texto-base text-muted-foreground">{producto.descripcion}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
