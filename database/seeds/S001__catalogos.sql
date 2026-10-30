-- S001: catálogos fijos (02-modelo-datos.md §7): roles, estados y transiciones de pedido, tipos de
-- movimiento, métodos de envío y la fila única de ParametroSistema.

INSERT INTO dbo.Rol (Codigo, Nombre)
SELECT r.Codigo, r.Nombre
FROM (VALUES
    ('Cliente',       N'Cliente'),
    ('Operador',      N'Operador'),
    ('Administrador', N'Administrador')
) AS r (Codigo, Nombre)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Rol WHERE Codigo = r.Codigo);

-- EsFinal: el estado no tiene transiciones de salida.
INSERT INTO dbo.EstadoPedido (Codigo, Nombre, EsFinal, Orden)
SELECT e.Codigo, e.Nombre, e.EsFinal, e.Orden
FROM (VALUES
    ('Pagado',          N'Pagado',             0, 1),
    ('EnPreparacion',   N'En preparación',     0, 2),
    ('Despachado',      N'Despachado',         0, 3),
    ('Entregado',       N'Entregado',          0, 4),
    ('Cancelado',       N'Cancelado',          1, 5),
    ('DevueltoParcial', N'Devuelto parcial',   0, 6),
    ('Devuelto',        N'Devuelto',           1, 7)
) AS e (Codigo, Nombre, EsFinal, Orden)
WHERE NOT EXISTS (SELECT 1 FROM dbo.EstadoPedido WHERE Codigo = e.Codigo);

-- N-08: transiciones permitidas por rol (§3.9).
INSERT INTO dbo.TransicionEstadoPedido (IDEstadoOrigen, IDEstadoDestino, IDRol)
SELECT eo.IDEstadoPedido, ed.IDEstadoPedido, r.IDRol
FROM (VALUES
    ('Pagado',          'EnPreparacion',   'Operador'),
    ('Pagado',          'EnPreparacion',   'Administrador'),
    ('EnPreparacion',   'Despachado',      'Operador'),
    ('EnPreparacion',   'Despachado',      'Administrador'),
    ('Despachado',      'Entregado',       'Operador'),
    ('Despachado',      'Entregado',       'Administrador'),
    ('Pagado',          'Cancelado',       'Cliente'),
    ('Pagado',          'Cancelado',       'Operador'),
    ('Pagado',          'Cancelado',       'Administrador'),
    ('EnPreparacion',   'Cancelado',       'Cliente'),
    ('EnPreparacion',   'Cancelado',       'Operador'),
    ('EnPreparacion',   'Cancelado',       'Administrador'),
    ('Entregado',       'DevueltoParcial', 'Operador'),
    ('Entregado',       'DevueltoParcial', 'Administrador'),
    ('Entregado',       'Devuelto',        'Operador'),
    ('Entregado',       'Devuelto',        'Administrador'),
    ('DevueltoParcial', 'Devuelto',        'Operador'),
    ('DevueltoParcial', 'Devuelto',        'Administrador')
) AS t (Origen, Destino, Rol)
JOIN dbo.EstadoPedido AS eo ON eo.Codigo = t.Origen
JOIN dbo.EstadoPedido AS ed ON ed.Codigo = t.Destino
JOIN dbo.Rol          AS r  ON r.Codigo  = t.Rol
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.TransicionEstadoPedido AS x
    WHERE x.IDEstadoOrigen = eo.IDEstadoPedido AND x.IDEstadoDestino = ed.IDEstadoPedido AND x.IDRol = r.IDRol);

-- EsManual: entradas y ajustes los registra el Operador; el resto lo generan los procesos (§3.4).
INSERT INTO dbo.TipoMovimiento (Codigo, Nombre, Signo, EsManual)
SELECT t.Codigo, t.Nombre, t.Signo, t.EsManual
FROM (VALUES
    ('EntradaCompra',        N'Entrada por compra',        1, 1),
    ('SalidaVenta',          N'Salida por venta',         -1, 0),
    ('AjustePositivo',       N'Ajuste positivo',           1, 1),
    ('AjusteNegativo',       N'Ajuste negativo',          -1, 1),
    ('ReingresoCancelacion', N'Reingreso por cancelación', 1, 0),
    ('ReingresoDevolucion',  N'Reingreso por devolución',  1, 0)
) AS t (Codigo, Nombre, Signo, EsManual)
WHERE NOT EXISTS (SELECT 1 FROM dbo.TipoMovimiento WHERE Codigo = t.Codigo);

-- N-04: tarifas fijas iniciales; el Administrador las ajusta después.
INSERT INTO dbo.MetodoEnvio (Codigo, Nombre, Costo, DiasMin, DiasMax)
SELECT m.Codigo, m.Nombre, m.Costo, m.DiasMin, m.DiasMax
FROM (VALUES
    ('Estandar', N'Estándar', CONVERT(DECIMAL(12,2), 35.00), 3, 5),
    ('Express',  N'Express',  CONVERT(DECIMAL(12,2), 75.00), 1, 1)
) AS m (Codigo, Nombre, Costo, DiasMin, DiasMax)
WHERE NOT EXISTS (SELECT 1 FROM dbo.MetodoEnvio WHERE Codigo = m.Codigo);

-- A-14: los valores iniciales son los DEFAULT de la tabla.
IF NOT EXISTS (SELECT 1 FROM dbo.ParametroSistema)
    INSERT INTO dbo.ParametroSistema DEFAULT VALUES;
