-- N-07: único punto que modifica Variante.ExistenciaFisica y escribe el kardex, en el mismo paso.
-- Interno: lo llaman otros SPs (entradas, ajustes, pedidos, cancelaciones, devoluciones) y la semilla,
-- siempre dentro de su transacción. El actor y el RequestId salen de SESSION_CONTEXT (A-18).
-- @IDMovimientoKardex devuelve el movimiento registrado, para que el llamador no tenga que buscarlo.
-- @FechaMovimiento (N-07, E7-H03): solo cuando el rol del contexto es Sistema (las semillas, para que kardex,
-- pedidos e historial coincidan en el tiempo), nunca en el futuro ni antes del último movimiento de la variante;
-- si no, la fecha es la actual.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_RegistrarMovimiento
    @IDVariante   INT,
    @CodigoTipo   VARCHAR(30),
    @Cantidad     INT,
    @Motivo       NVARCHAR(250),
    @Referencia   NVARCHAR(100),
    @IDPedido     INT,
    @IDDevolucion INT,
    @IDMovimientoKardex BIGINT = NULL OUTPUT,
    @FechaMovimiento    DATETIME2(3) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Una transacción propia anidada revertiría también la del llamador en un ROLLBACK.
    IF @@TRANCOUNT = 0
        THROW 50005, N'SP_Inventario_RegistrarMovimiento debe ejecutarse dentro de una transacción.', 1;

    DECLARE @IDUsuario INT              = TRY_CONVERT(INT, SESSION_CONTEXT(N'IDUsuario')),
            @RequestId UNIQUEIDENTIFIER = TRY_CONVERT(UNIQUEIDENTIFIER, SESSION_CONTEXT(N'RequestId'));

    IF @IDUsuario IS NULL
        THROW 50005, N'Todo movimiento de inventario necesita un usuario responsable.', 1;
    IF @FechaMovimiento IS NOT NULL AND ISNULL(TRY_CONVERT(VARCHAR(20), SESSION_CONTEXT(N'Rol')), '') <> 'Sistema'
        THROW 50005, N'Solo un proceso del sistema registra un movimiento con fecha propia.', 1;
    IF @FechaMovimiento > SYSUTCDATETIME()
        THROW 50003, N'Un movimiento de inventario no puede tener fecha futura.', 1;
    -- Tope técnico por movimiento (el mismo que CANTIDAD_MAXIMA en Zod): lejos del desborde de INT.
    DECLARE @CantidadMaxima INT = 1000000;

    IF @Cantidad IS NULL OR @Cantidad <= 0
        THROW 50003, N'La cantidad del movimiento debe ser mayor que cero.', 1;
    IF @Cantidad > @CantidadMaxima
        THROW 50003, N'La cantidad del movimiento supera el máximo de 1 000 000.', 1;

    DECLARE @IDTipoMovimiento INT, @Signo SMALLINT;
    SELECT @IDTipoMovimiento = t.IDTipoMovimiento, @Signo = t.Signo
    FROM   dbo.TipoMovimiento AS t
    WHERE  t.Codigo = @CodigoTipo;

    IF @IDTipoMovimiento IS NULL
        THROW 50003, N'El tipo de movimiento no existe.', 1;

    -- Bloquea la variante hasta el fin de la transacción del llamador: dos movimientos simultáneos
    -- se serializan y cada uno parte del saldo que dejó el anterior.
    DECLARE @ExistenciaAnterior INT;
    SELECT @ExistenciaAnterior = v.ExistenciaFisica
    FROM   dbo.Variante AS v WITH (UPDLOCK, ROWLOCK)
    WHERE  v.IDVariante = @IDVariante;

    IF @ExistenciaAnterior IS NULL
        THROW 50001, N'La variante no existe.', 1;

    -- N-07: dentro de una variante las fechas del kardex nunca retroceden, así ordenarlo por fecha o por ID da el
    -- mismo orden y los mismos saldos. La fecha actual nunca queda antes de una pasada; una fecha propia se
    -- compara con el último movimiento bajo el bloqueo de la variante.
    IF @FechaMovimiento < (SELECT TOP (1) m.Fecha FROM dbo.MovimientoKardex AS m
                           WHERE m.IDVariante = @IDVariante ORDER BY m.IDMovimientoKardex DESC)
        THROW 50003, N'Un movimiento de inventario no puede tener fecha anterior al último de su variante.', 1;

    DECLARE @ExistenciaResultante INT = @ExistenciaAnterior + @Signo * @Cantidad;

    IF @ExistenciaResultante < 0
        THROW 50301, N'No hay existencia suficiente.', 1;

    UPDATE dbo.Variante
    SET    ExistenciaFisica = @ExistenciaResultante, FechaActualizacion = SYSUTCDATETIME()
    WHERE  IDVariante = @IDVariante;

    INSERT INTO dbo.MovimientoKardex (IDVariante, IDTipoMovimiento, Signo, Cantidad, ExistenciaAnterior,
                                      ExistenciaResultante, Motivo, Referencia, IDPedido, IDDevolucion,
                                      IDUsuario, RequestId, Fecha)
    VALUES (@IDVariante, @IDTipoMovimiento, @Signo, @Cantidad, @ExistenciaAnterior,
            @ExistenciaResultante, @Motivo, @Referencia, @IDPedido, @IDDevolucion,
            @IDUsuario, @RequestId, COALESCE(@FechaMovimiento, SYSUTCDATETIME()));
    SET @IDMovimientoKardex = SCOPE_IDENTITY();
END
GO
