import {
  consultaUsuariosSchema,
  ROLES_DE_USUARIO,
  type ConsultaUsuarios,
  type OrdenUsuarios,
  type RolDeUsuario,
} from '@shopcart/shared';
import { useId } from 'react';
import { Aviso } from '../../../shared/componentes/Aviso';
import { CLASE_SELECT } from '../../../shared/componentes/CampoSeleccion';
import { DialogoConfirmacion } from '../../../shared/componentes/DialogoConfirmacion';
import { TablaServidor, type ColumnaTabla } from '../../../shared/componentes/TablaServidor';
import { formatearDia } from '../../../shared/formato/fecha';
import { useParametrosUrl, type ParametrosUrl } from '../../../shared/hooks/useParametrosUrl';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { Button } from '../../../shared/ui/button';
import { DialogoEditarUsuario, DialogoNuevoUsuario } from '../componentes/DialogosUsuario';
import { useCambiarEstadoUsuario, useUsuarios } from '../hooks/useUsuariosAdmin';
import type { AccionUsuario, UsuarioAdmin } from '../usuarios.api';

const esRol = (valor: string): valor is RolDeUsuario =>
  (ROLES_DE_USUARIO as readonly string[]).includes(valor);

const ESTADOS = { '': 'Activos e inactivos', true: 'Activos', false: 'Inactivos' } as const;
const estadoDe = (activo: boolean | undefined) =>
  activo === undefined ? '' : activo ? 'true' : 'false';

function Filtros({ parametros }: { parametros: ParametrosUrl<ConsultaUsuarios> }) {
  const idRol = useId();
  const idEstado = useId();
  const { valores, cambiar } = parametros;
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:max-w-xl">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={idRol} className="control-etiqueta">
          Rol
        </label>
        <select
          id={idRol}
          value={valores.rol ?? ''}
          onChange={(evento) => {
            const valor = evento.target.value;
            cambiar({ rol: esRol(valor) ? valor : undefined });
          }}
          className={CLASE_SELECT}
        >
          <option value="">Todos</option>
          {ROLES_DE_USUARIO.map((rol) => (
            <option key={rol} value={rol}>
              {rol}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={idEstado} className="control-etiqueta">
          Estado
        </label>
        <select
          id={idEstado}
          value={estadoDe(valores.activo)}
          onChange={(evento) => {
            const valor = evento.target.value;
            cambiar({ activo: valor === '' ? undefined : valor === 'true' });
          }}
          className={CLASE_SELECT}
        >
          {Object.entries(ESTADOS).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/** Desactivar corta sus sesiones al instante (A-07): se confirma antes; activar no. */
function CambioDeEstado({
  usuario,
  cambiar,
  ocupado,
}: {
  usuario: UsuarioAdmin;
  cambiar: (idUsuario: number, accion: AccionUsuario) => void;
  ocupado: boolean;
}) {
  if (!usuario.activo) {
    return (
      <Button
        variant="link"
        size="sm"
        disabled={ocupado}
        aria-label={`Activar a ${usuario.nombre}`}
        onClick={() => {
          cambiar(usuario.idUsuario, 'activar');
        }}
      >
        Activar
      </Button>
    );
  }
  return (
    <DialogoConfirmacion
      titulo={`¿Desactivar a ${usuario.nombre}?`}
      descripcion="No podrá ingresar y sus sesiones abiertas dejan de funcionar de inmediato. Puedes activarlo después."
      textoConfirmar="Desactivar"
      disparador={
        <Button
          variant="link"
          size="sm"
          disabled={ocupado}
          aria-label={`Desactivar a ${usuario.nombre}`}
        >
          Desactivar
        </Button>
      }
      alConfirmar={() => {
        cambiar(usuario.idUsuario, 'desactivar');
      }}
    />
  );
}

const columnas = (
  cambiar: (idUsuario: number, accion: AccionUsuario) => void,
  ocupado: boolean,
): ColumnaTabla<UsuarioAdmin, OrdenUsuarios['orden']>[] => [
  {
    id: 'nombre',
    etiqueta: 'Nombre',
    prioridad: 1,
    ordenable: 'nombre',
    celda: (u) => <span className="texto-pequeno-fuerte">{u.nombre}</span>,
  },
  { id: 'correo', etiqueta: 'Correo', prioridad: 1, ordenable: 'correo', celda: (u) => u.correo },
  { id: 'rol', etiqueta: 'Rol', prioridad: 1, ordenable: 'rol', celda: (u) => u.rol },
  {
    id: 'estado',
    etiqueta: 'Estado',
    prioridad: 1,
    celda: (u) => (
      <span className={u.activo ? 'text-exito' : 'text-muted-foreground'}>
        {u.activo ? 'Activo' : 'Inactivo'}
      </span>
    ),
  },
  {
    id: 'fecha',
    etiqueta: 'Creado',
    prioridad: 2,
    ordenable: 'recientes',
    celda: (u) => <span className="whitespace-nowrap">{formatearDia(u.fechaCreacion)}</span>,
  },
  {
    id: 'acciones',
    etiqueta: 'Acciones',
    prioridad: 1,
    alineacion: 'fin',
    celda: (u) => (
      <span className="inline-flex gap-1">
        <DialogoEditarUsuario usuario={u} />
        <CambioDeEstado usuario={u} cambiar={cambiar} ocupado={ocupado} />
      </span>
    ),
  },
];

/**
 * M10-H01: `/backoffice/usuarios`, solo Admin. Los usuarios con orden, filtros y paginación del servidor (FE-06,
 * M6-H01); alta de internos, edición, activar y desactivar.
 */
export function UsuariosPagina() {
  useTituloPagina('Usuarios');
  const parametros = useParametrosUrl(consultaUsuariosSchema);
  const usuarios = useUsuarios(parametros.valores);
  const estado = useCambiarEstadoUsuario();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="display-titulo-1">Usuarios</h1>
          <p className="texto-base text-muted-foreground">
            Clientes, operadores y administradores de la tienda.
          </p>
        </div>
        <DialogoNuevoUsuario />
      </div>
      {estado.error && (
        <Aviso
          tipo="error"
          acciones={
            <Button variant="outline" size="sm" onClick={estado.reset}>
              Entendido
            </Button>
          }
        >
          {estado.error.mensaje}
        </Aviso>
      )}
      <TablaServidor
        titulo="Usuarios"
        columnas={columnas((idUsuario, accion) => {
          estado.mutate({ idUsuario, accion });
        }, estado.isPending)}
        consulta={usuarios}
        parametros={parametros}
        claveFila={(u) => u.idUsuario}
        vacio={{ titulo: 'Todavía no hay usuarios' }}
        filtros={<Filtros parametros={parametros} />}
      />
    </div>
  );
}
