-- Interno (sqlserver-sp §7), N-06, RF-06: el único punto que reserva existencia (nombre del enunciado). Lo llaman
-- SP_Checkout_IniciarSesion (las reservas de la sesión) y SP_Pedidos_CrearPedido (las que vencieron durante el
-- pago). Recibe las líneas en JSON (A-22): [{"idVariante": 1, "cantidad": 2}, …].
-- Bloquea las variantes en orden de IDVariante (§9.1; si el llamador ya las tiene, no espera) y valida todo o
-- nada con FU_Inventario_Disponible: si alguna línea no alcanza, 50301 con el detalle de todas las que fallan y
-- nada se escribe. Hay una fila por sesión y variante (UQ_Reserva_IDSesionCheckoutIDVariante): la reserva Activa
-- que venció en la misma sesión se renueva en su fila; las demás se insertan.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ReservarExistencia
    @IDSesionCheckout INT,
    @Lineas           NVARCHAR(MAX),
    @FechaExpiracion  DATETIME2(3),
    @MensajeError     NVARCHAR(200) = N'No hay existencia suficiente para algunos productos.'
AS
BEGIN
    SET NOCOUNT ON;

    IF @@TRANCOUNT = 0
        THROW 50005, N'SP_Inventario_ReservarExistencia debe ejecutarse dentro de una transacción.', 1;
    IF @IDSesionCheckout IS NULL OR @FechaExpiracion IS NULL OR ISJSON(@Lineas) <> 1
        THROW 50005, N'SP_Inventario_ReservarExistencia recibió parámetros incompletos.', 1;

    DECLARE @Pedidas TABLE (IDVariante INT NOT NULL PRIMARY KEY, Cantidad INT NOT NULL);
    INSERT INTO @Pedidas (IDVariante, Cantidad)
    SELECT j.IDVariante, j.Cantidad
    FROM   OPENJSON(@Lineas) WITH (IDVariante INT '$.idVariante', Cantidad INT '$.cantidad') AS j;

    IF NOT EXISTS (SELECT 1 FROM @Pedidas)
       OR EXISTS (SELECT 1 FROM @Pedidas AS p WHERE p.IDVariante IS NULL OR p.Cantidad IS NULL OR p.Cantidad <= 0)
        THROW 50005, N'SP_Inventario_ReservarExistencia recibió líneas inválidas.', 1;

    DECLARE @ID INT = (SELECT MIN(p.IDVariante) FROM @Pedidas AS p), @Bloqueada INT, @Error NVARCHAR(2048);
    WHILE @ID IS NOT NULL
    BEGIN
        SELECT @Bloqueada = v.IDVariante FROM dbo.Variante AS v WITH (UPDLOCK, ROWLOCK) WHERE v.IDVariante = @ID;
        SET @ID = (SELECT MIN(p.IDVariante) FROM @Pedidas AS p WHERE p.IDVariante > @ID);
    END

    -- N-06: todo o nada, con las variantes bloqueadas (el disponible ya no cambia hasta el COMMIT del llamador).
    IF EXISTS (SELECT 1 FROM @Pedidas AS p CROSS APPLY dbo.FU_Inventario_Disponible(p.IDVariante) AS d
               WHERE d.Disponible < p.Cantidad)
    BEGIN
        SET @Error = (SELECT @MensajeError AS mensaje,
                             JSON_QUERY((SELECT p.IDVariante AS idVariante, pr.Nombre AS producto, p.Cantidad AS cantidad,
                                                IIF(d.Disponible < 0, 0, d.Disponible) AS disponible
                                         FROM @Pedidas AS p
                                         CROSS APPLY dbo.FU_Inventario_Disponible(p.IDVariante) AS d
                                         JOIN dbo.Variante AS v ON v.IDVariante = p.IDVariante
                                         JOIN dbo.Producto AS pr ON pr.IDProducto = v.IDProducto
                                         WHERE d.Disponible < p.Cantidad
                                         ORDER BY p.IDVariante FOR JSON PATH)) AS detalles
                      FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
        THROW 50301, @Error, 1;
    END

    UPDATE r
    SET    r.Cantidad = p.Cantidad, r.FechaExpiracion = @FechaExpiracion
    FROM   dbo.Reserva AS r
    JOIN   @Pedidas AS p ON p.IDVariante = r.IDVariante
    WHERE  r.IDSesionCheckout = @IDSesionCheckout AND r.Estado = 'Activa';

    INSERT INTO dbo.Reserva (IDSesionCheckout, IDVariante, Cantidad, Estado, FechaExpiracion)
    SELECT @IDSesionCheckout, p.IDVariante, p.Cantidad, 'Activa', @FechaExpiracion
    FROM   @Pedidas AS p
    WHERE  NOT EXISTS (SELECT 1 FROM dbo.Reserva AS r
                       WHERE r.IDSesionCheckout = @IDSesionCheckout AND r.IDVariante = p.IDVariante);
END
GO
