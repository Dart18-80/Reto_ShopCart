-- N-10, RF-07: el Operador o el Admin registra una devolución total o parcial (por línea y varias por pedido) de
-- un pedido Entregado o DevueltoParcial, dentro de DiasPlazoDevolucion días desde que pasó a Entregado (según su
-- historial; si no, 50704). @Lineas: JSON [{"idDetallePedido":1,"cantidad":2}].
-- "No devolver más de lo vendido" se garantiza aquí: las líneas se bloquean en orden de IDDetallePedido y
-- CantidadDevuelta + cantidad ≤ Cantidad (50703; CK_DetallePedido_CantidadDevuelta es la última defensa), así
-- dos devoluciones simultáneas de la misma línea nunca suman más que lo vendido.
-- Reembolso por línea: por unidad = precio efectivo pagado − descuento repartido (TotalLinea / Cantidad, al
-- centavo hacia abajo); la devolución que completa la línea se lleva el residuo, para que la suma de los
-- reembolsos de la línea sea exactamente su TotalLinea. El envío no se reembolsa. MontoReembolsado nunca supera
-- el total (50705; CK_Pedido_MontoReembolsado).
-- En la misma transacción: Devolucion (FechaLocal de Guatemala, N-11) y sus líneas, CantidadDevuelta,
-- ReingresoDevolucion en el kardex por línea (en orden de IDVariante), el estado derivado (DevueltoParcial o
-- Devuelto, solo aquí; nunca desde el endpoint de estado) con su historial, y el Reembolso Pendiente con una llave
-- determinista. La pasarela se llama después del COMMIT (el servicio).
-- Orden de bloqueo: pedido → líneas del pedido (por IDDetallePedido) → variantes (por IDVariante).
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_RegistrarDevolucion
    @IDPedido       INT,
    @Motivo         NVARCHAR(250),
    @Lineas         NVARCHAR(MAX),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @RolActor IS NULL OR @RolActor NOT IN ('Operador', 'Administrador') OR @IDUsuarioActor IS NULL
        THROW 50005, N'Solo el Operador y el Administrador registran devoluciones.', 1;
    IF NULLIF(LTRIM(RTRIM(@Motivo)), N'') IS NULL
        THROW 50003, N'La devolución requiere un motivo.', 1;
    IF @Lineas IS NULL OR ISJSON(@Lineas) = 0
        THROW 50003, N'Las líneas de la devolución no son válidas.', 1;

    DECLARE @Pedidas TABLE (IDDetallePedido INT PRIMARY KEY, Cantidad INT NOT NULL);
    DECLARE @Calculo TABLE (IDDetallePedido INT PRIMARY KEY, IDVariante INT NOT NULL, Cantidad INT NOT NULL,
                            Monto DECIMAL(12,2) NOT NULL);

    IF (SELECT COUNT(*) FROM OPENJSON(@Lineas)) = 0
        THROW 50003, N'La devolución necesita al menos una línea.', 1;
    IF EXISTS (SELECT 1 FROM OPENJSON(@Lineas) WITH (IDDetallePedido INT '$.idDetallePedido') AS j
               GROUP BY j.IDDetallePedido HAVING COUNT(*) > 1)
        THROW 50003, N'Una línea aparece más de una vez en la devolución.', 1;

    INSERT INTO @Pedidas (IDDetallePedido, Cantidad)
    SELECT j.IDDetallePedido, j.Cantidad
    FROM   OPENJSON(@Lineas) WITH (IDDetallePedido INT '$.idDetallePedido', Cantidad INT '$.cantidad') AS j;

    IF EXISTS (SELECT 1 FROM @Pedidas WHERE IDDetallePedido IS NULL OR Cantidad IS NULL OR Cantidad <= 0)
        THROW 50003, N'Cada línea necesita su ID y una cantidad mayor que cero.', 1;

    DECLARE @IDEstado INT, @Total DECIMAL(12,2), @Reembolsado DECIMAL(12,2), @Numero VARCHAR(20),
            @Entregado DATETIME2(3), @Dias SMALLINT, @ID INT, @Bloqueada INT, @Error NVARCHAR(2048),
            @MontoDevolucion DECIMAL(12,2), @IDDevolucion INT, @IDReembolso INT, @IDNuevo INT, @Cantidad INT,
            @Ahora DATETIME2(3) = SYSUTCDATETIME(),
            @IDEntregado INT       = (SELECT e.IDEstadoPedido FROM dbo.EstadoPedido AS e WHERE e.Codigo = 'Entregado'),
            @IDDevueltoParcial INT = (SELECT e.IDEstadoPedido FROM dbo.EstadoPedido AS e WHERE e.Codigo = 'DevueltoParcial'),
            @IDDevuelto INT        = (SELECT e.IDEstadoPedido FROM dbo.EstadoPedido AS e WHERE e.Codigo = 'Devuelto');

    SELECT TOP (1) @Dias = ps.DiasPlazoDevolucion FROM dbo.ParametroSistema AS ps ORDER BY ps.IDParametroSistema;

    BEGIN TRY
        BEGIN TRAN;

        SELECT @IDEstado = p.IDEstadoPedido, @Total = p.Total, @Reembolsado = p.MontoReembolsado,
               @Numero = p.NumeroPedido
        FROM   dbo.Pedido AS p WITH (UPDLOCK, ROWLOCK)
        WHERE  p.IDPedido = @IDPedido;

        IF @IDEstado IS NULL
            THROW 50001, N'El pedido no existe.', 1;
        IF @IDEstado NOT IN (@IDEntregado, @IDDevueltoParcial)
            THROW 50701, N'Solo se registran devoluciones de pedidos entregados.', 1;

        -- N-10: el plazo cuenta desde que el pedido pasó a Entregado (IX_HistorialEstadoPedido_Pedido).
        SET @Entregado = (SELECT MIN(h.Fecha) FROM dbo.HistorialEstadoPedido AS h
                          WHERE h.IDPedido = @IDPedido AND h.IDEstadoNuevo = @IDEntregado);
        IF @Entregado IS NULL OR DATEADD(DAY, @Dias, @Entregado) < @Ahora
            THROW 50704, N'El plazo de devolución de este pedido ya venció.', 1;

        -- Las líneas del pedido en orden de IDDetallePedido (las pedidas y las demás: el estado derivado las lee).
        SET @ID = (SELECT MIN(d.IDDetallePedido) FROM dbo.DetallePedido AS d WHERE d.IDPedido = @IDPedido);
        WHILE @ID IS NOT NULL
        BEGIN
            SELECT @Bloqueada = d.IDDetallePedido FROM dbo.DetallePedido AS d WITH (UPDLOCK, ROWLOCK)
            WHERE  d.IDDetallePedido = @ID;
            SET @ID = (SELECT MIN(d.IDDetallePedido) FROM dbo.DetallePedido AS d
                       WHERE d.IDPedido = @IDPedido AND d.IDDetallePedido > @ID);
        END

        IF EXISTS (SELECT 1 FROM @Pedidas AS l
                   WHERE NOT EXISTS (SELECT 1 FROM dbo.DetallePedido AS d
                                     WHERE d.IDDetallePedido = l.IDDetallePedido AND d.IDPedido = @IDPedido))
            THROW 50001, N'Una de las líneas no es de este pedido.', 1;

        IF EXISTS (SELECT 1 FROM @Pedidas AS l JOIN dbo.DetallePedido AS d ON d.IDDetallePedido = l.IDDetallePedido
                   WHERE d.CantidadDevuelta + l.Cantidad > d.Cantidad)
        BEGIN
            SET @Error = (SELECT N'La devolución excede lo vendido en algunas líneas.' AS mensaje,
                                 JSON_QUERY((SELECT l.IDDetallePedido AS idDetallePedido, l.Cantidad AS cantidad,
                                                    d.Cantidad - d.CantidadDevuelta AS disponible
                                             FROM @Pedidas AS l
                                             JOIN dbo.DetallePedido AS d ON d.IDDetallePedido = l.IDDetallePedido
                                             WHERE d.CantidadDevuelta + l.Cantidad > d.Cantidad
                                             ORDER BY l.IDDetallePedido FOR JSON PATH)) AS detalles
                          FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
            THROW 50703, @Error, 1;
        END

        -- Por unidad al centavo hacia abajo; la devolución que completa la línea se lleva el residuo.
        INSERT INTO @Calculo (IDDetallePedido, IDVariante, Cantidad, Monto)
        SELECT d.IDDetallePedido, d.IDVariante, l.Cantidad,
               CASE WHEN d.CantidadDevuelta + l.Cantidad = d.Cantidad
                    THEN d.TotalLinea - COALESCE((SELECT SUM(dd.MontoReembolso) FROM dbo.DetalleDevolucion AS dd
                                                  WHERE dd.IDDetallePedido = d.IDDetallePedido), 0)
                    ELSE l.Cantidad * FLOOR(d.TotalLinea * 100 / d.Cantidad) / 100 END
        FROM   @Pedidas AS l
        JOIN   dbo.DetallePedido AS d ON d.IDDetallePedido = l.IDDetallePedido;

        SET @MontoDevolucion = (SELECT SUM(c.Monto) FROM @Calculo AS c);
        IF @MontoDevolucion <= 0
            THROW 50003, N'La devolución no tiene monto que reembolsar.', 1;
        IF @Reembolsado + @MontoDevolucion > @Total
            THROW 50705, N'El reembolso excede el total pagado.', 1;

        INSERT INTO dbo.Devolucion (IDPedido, IDUsuario, Motivo, MontoReembolso, Fecha, FechaLocal)
        SELECT @IDPedido, @IDUsuarioActor, LTRIM(RTRIM(@Motivo)), @MontoDevolucion, @Ahora, f.FechaLocal
        FROM   dbo.FU_Sistema_FechaLocal(@Ahora) AS f;
        SET @IDDevolucion = SCOPE_IDENTITY();

        INSERT INTO dbo.DetalleDevolucion (IDDevolucion, IDDetallePedido, Cantidad, MontoReembolso)
        SELECT @IDDevolucion, c.IDDetallePedido, c.Cantidad, c.Monto FROM @Calculo AS c;

        UPDATE d
        SET    d.CantidadDevuelta = d.CantidadDevuelta + c.Cantidad, d.FechaActualizacion = @Ahora
        FROM   dbo.DetallePedido AS d
        JOIN   @Calculo AS c ON c.IDDetallePedido = d.IDDetallePedido;

        -- N-07, N-10: el producto siempre reingresa, en orden de IDVariante.
        SET @ID = (SELECT MIN(c.IDVariante) FROM @Calculo AS c);
        WHILE @ID IS NOT NULL
        BEGIN
            SET @Cantidad = (SELECT c.Cantidad FROM @Calculo AS c WHERE c.IDVariante = @ID);
            EXEC dbo.SP_Inventario_RegistrarMovimiento
                 @IDVariante = @ID, @CodigoTipo = 'ReingresoDevolucion', @Cantidad = @Cantidad,
                 @Motivo = N'Devolución del pedido', @Referencia = @Numero, @IDPedido = @IDPedido,
                 @IDDevolucion = @IDDevolucion;
            SET @ID = (SELECT MIN(c.IDVariante) FROM @Calculo AS c WHERE c.IDVariante > @ID);
        END

        -- N-08: el estado lo deriva este SP de lo devuelto; el trigger exige la transición para el rol.
        SET @IDNuevo = IIF(EXISTS (SELECT 1 FROM dbo.DetallePedido AS d
                                   WHERE d.IDPedido = @IDPedido AND d.CantidadDevuelta < d.Cantidad),
                           @IDDevueltoParcial, @IDDevuelto);
        IF @IDNuevo <> @IDEstado
        BEGIN
            UPDATE dbo.Pedido SET IDEstadoPedido = @IDNuevo, FechaActualizacion = @Ahora WHERE IDPedido = @IDPedido;
            INSERT INTO dbo.HistorialEstadoPedido (IDPedido, IDEstadoAnterior, IDEstadoNuevo, IDUsuario, Motivo,
                                                   RequestId)
            VALUES (@IDPedido, @IDEstado, @IDNuevo, @IDUsuarioActor, LTRIM(RTRIM(@Motivo)), @RequestId);
        END

        INSERT INTO dbo.Reembolso (IDPedido, IDDevolucion, Origen, Monto, Estado, LlaveIdempotencia,
                                   FechaProximoIntento)
        VALUES (@IDPedido, @IDDevolucion, 'Devolucion', @MontoDevolucion, 'Pendiente',
                CONVERT(UNIQUEIDENTIFIER,
                        HASHBYTES('MD5', CONCAT(N'Reembolso|', @IDPedido, N'|Devolucion|', @IDDevolucion))),
                @Ahora);
        SET @IDReembolso = SCOPE_IDENTITY();

        -- A-13: el contador con CHECK (MontoReembolsado BETWEEN 0 AND Total) es la última defensa.
        UPDATE dbo.Pedido SET MontoReembolsado = MontoReembolsado + @MontoDevolucion WHERE IDPedido = @IDPedido;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT @IDDevolucion AS IDDevolucion, @IDReembolso AS IDReembolso, @MontoDevolucion AS MontoReembolso;
END
GO
