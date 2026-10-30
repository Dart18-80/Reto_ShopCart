import { describe, expect, it } from 'vitest';
import { planificar, validarIntegridad, type ScriptAplicado } from '../src/plan.ts';
import { calcularChecksum, type Script, type TipoScript } from '../src/scripts.ts';

function script(nombre: string, tipo: TipoScript, contenido = `-- ${nombre}`): Script {
  return { nombre, tipo, checksum: calcularChecksum(contenido), lotes: [], dependencias: [] };
}

function aplicado(nombre: string, tipo: TipoScript, contenido = `-- ${nombre}`) {
  return [nombre, { tipo, checksum: calcularChecksum(contenido) }] as const;
}

function historial(...filas: (readonly [string, ScriptAplicado])[]): Map<string, ScriptAplicado> {
  return new Map(filas);
}

describe('validarIntegridad (A-09)', () => {
  it('acepta scripts aplicados que no cambiaron', () => {
    const scripts = [script('V001__base.sql', 'V'), script('S001__catalogos.sql', 'S')];

    expect(() => {
      validarIntegridad(
        scripts,
        historial(aplicado('V001__base.sql', 'V'), aplicado('S001__catalogos.sql', 'S')),
      );
    }).not.toThrow();
  });

  it('falla si un V### aplicado cambió después de aplicarse', () => {
    const scripts = [script('V001__base.sql', 'V', '-- versión editada')];

    expect(() => {
      validarIntegridad(scripts, historial(aplicado('V001__base.sql', 'V', '-- versión original')));
    }).toThrow(/V001__base\.sql cambió después de aplicarse/);
  });

  it('falla si un S### aplicado cambió después de aplicarse', () => {
    const scripts = [script('S001__catalogos.sql', 'S', '-- editado')];

    expect(() => {
      validarIntegridad(scripts, historial(aplicado('S001__catalogos.sql', 'S', '-- original')));
    }).toThrow(/S001__catalogos\.sql cambió/);
  });

  it('falla si un V### aplicado ya no existe en el repositorio', () => {
    expect(() => {
      validarIntegridad([], historial(aplicado('V001__base.sql', 'V')));
    }).toThrow(/V001__base\.sql se aplicó pero ya no existe/);
  });

  it('acepta que un R__ aplicado haya cambiado: se reaplica', () => {
    const scripts = [script('R__SP_Sistema_Health.sql', 'R', '-- nueva versión')];

    expect(() => {
      validarIntegridad(
        scripts,
        historial(aplicado('R__SP_Sistema_Health.sql', 'R', '-- versión anterior')),
      );
    }).not.toThrow();
  });

  it('reporta todos los scripts modificados a la vez', () => {
    const scripts = [script('V001__a.sql', 'V', '-- x'), script('V002__b.sql', 'V', '-- y')];

    expect(() => {
      validarIntegridad(
        scripts,
        historial(aplicado('V001__a.sql', 'V'), aplicado('V002__b.sql', 'V')),
      );
    }).toThrow(/V001__a\.sql[\s\S]*V002__b\.sql/);
  });
});

describe('planificar', () => {
  it('incluye los scripts que nunca se aplicaron', () => {
    const scripts = [script('V001__base.sql', 'V'), script('V002__tablas.sql', 'V')];

    const pendientes = planificar(scripts, historial(aplicado('V001__base.sql', 'V')));

    expect(pendientes.map((pendiente) => pendiente.nombre)).toEqual(['V002__tablas.sql']);
  });

  it('nunca vuelve a aplicar un V### o S### ya aplicado', () => {
    const scripts = [script('V001__base.sql', 'V'), script('S001__catalogos.sql', 'S')];

    const pendientes = planificar(
      scripts,
      historial(aplicado('V001__base.sql', 'V'), aplicado('S001__catalogos.sql', 'S')),
    );

    expect(pendientes).toEqual([]);
  });

  it('reaplica un R__ cuyo contenido cambió', () => {
    const scripts = [script('R__SP_Sistema_Health.sql', 'R', '-- nueva')];

    const pendientes = planificar(
      scripts,
      historial(aplicado('R__SP_Sistema_Health.sql', 'R', '-- anterior')),
    );

    expect(pendientes.map((pendiente) => pendiente.nombre)).toEqual(['R__SP_Sistema_Health.sql']);
  });

  it('no reaplica un R__ que no cambió', () => {
    const scripts = [script('R__SP_Sistema_Health.sql', 'R')];

    const pendientes = planificar(scripts, historial(aplicado('R__SP_Sistema_Health.sql', 'R')));

    expect(pendientes).toEqual([]);
  });

  it('conserva el orden V → R → S de la entrada', () => {
    const scripts = [
      script('V001__base.sql', 'V'),
      script('R__SP_Sistema_Health.sql', 'R'),
      script('S001__catalogos.sql', 'S'),
    ];

    const pendientes = planificar(scripts, historial());

    expect(pendientes.map((pendiente) => pendiente.tipo)).toEqual(['V', 'R', 'S']);
  });
});
