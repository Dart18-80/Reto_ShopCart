-- RF-05, N-12: el Admin edita un cupón. PATCH (sqlserver-sp §9.5): NULL significa "sin cambio";
-- @QuitarMontoMaximoDescuento y @QuitarCategoria quitan esos valores.
-- - Un cupón usado (VW_Cupones_Admin.Usado) no cambia su tipo ni su valor: 50509. Se decide bajo el bloqueo
--   del cupón, el mismo que toma la reserva de un uso (sqlserver-sp §9.2).
-- - Bajar LimiteUsosTotal por debajo de UsosComprometidos lo rechaza CK_Cupon_UsosComprometidos (A-13);
--   el CATCH traduce esa constraint a 50511 con los usos comprometidos en los detalles (A-19).
-- Devuelve el cupón.
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Actualizar
    @IDCupon                    INT,
    @Codigo                     VARCHAR(30),
    @Descripcion                NVARCHAR(200),
    @Tipo                       VARCHAR(10),
    @Valor                      DECIMAL(12,2),
    @MontoMaximoDescuento       DECIMAL(12,2),
    @QuitarMontoMaximoDescuento BIT              = 0,
    @MontoMinimoCompra          DECIMAL(12,2),
    @IDCategoria                INT,
    @QuitarCategoria            BIT              = 0,
    @FechaInicio                DATETIME2(3),
    @FechaFin                   DATETIME2(3),
    @LimiteUsosTotal            INT,
    @LimiteUsosPorCliente       INT,
    @IDUsuarioActor             INT              = NULL,
    @RolActor                   VARCHAR(20)      = NULL,
    @RequestId                  UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF (@QuitarMontoMaximoDescuento = 1 AND @MontoMaximoDescuento IS NOT NULL)
       OR (@QuitarCategoria = 1 AND @IDCategoria IS NOT NULL)
        THROW 50003, N'No se puede enviar un valor y quitarlo a la vez.', 1;

    DECLARE @TipoActual VARCHAR(10), @ValorActual DECIMAL(12,2), @Error NVARCHAR(2048);

    BEGIN TRY
        BEGIN TRAN;

        SELECT @TipoActual = c.Tipo, @ValorActual = c.Valor
        FROM   dbo.Cupon AS c WITH (UPDLOCK, ROWLOCK)
        WHERE  c.IDCupon = @IDCupon;

        IF @TipoActual IS NULL
            THROW 50001, N'El cupón no existe.', 1;

        -- N-12: un cupón ya usado no cambia su tipo ni su valor (sí vigencia, límites y estado).
        IF ((@Tipo IS NOT NULL AND @Tipo <> @TipoActual) OR (@Valor IS NOT NULL AND @Valor <> @ValorActual))
           AND EXISTS (SELECT 1 FROM dbo.UsoCupon AS u WHERE u.IDCupon = @IDCupon)
            THROW 50509, N'El cupón ya se usó: no se pueden cambiar su tipo ni su valor.', 1;

        UPDATE dbo.Cupon
        SET    Codigo               = COALESCE(UPPER(LTRIM(RTRIM(@Codigo))), Codigo),
               Descripcion          = COALESCE(@Descripcion, Descripcion),
               Tipo                 = COALESCE(@Tipo, Tipo),
               Valor                = COALESCE(@Valor, Valor),
               MontoMaximoDescuento = CASE WHEN @QuitarMontoMaximoDescuento = 1 THEN NULL
                                           ELSE COALESCE(@MontoMaximoDescuento, MontoMaximoDescuento) END,
               MontoMinimoCompra    = COALESCE(@MontoMinimoCompra, MontoMinimoCompra),
               IDCategoria          = CASE WHEN @QuitarCategoria = 1 THEN NULL
                                           ELSE COALESCE(@IDCategoria, IDCategoria) END,
               FechaInicio          = COALESCE(@FechaInicio, FechaInicio),
               FechaFin             = COALESCE(@FechaFin, FechaFin),
               LimiteUsosTotal      = COALESCE(@LimiteUsosTotal, LimiteUsosTotal),
               LimiteUsosPorCliente = COALESCE(@LimiteUsosPorCliente, LimiteUsosPorCliente),
               FechaActualizacion   = SYSUTCDATETIME()
        WHERE  IDCupon = @IDCupon;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF ERROR_NUMBER() = 547 AND ERROR_MESSAGE() LIKE N'%CK_Cupon_UsosComprometidos%'
        BEGIN
            SET @Error = (SELECT N'El límite de usos no puede ser menor que los usos ya comprometidos.' AS mensaje,
                                 JSON_QUERY((SELECT c.UsosComprometidos AS usosComprometidos
                                             FROM dbo.Cupon AS c WHERE c.IDCupon = @IDCupon
                                             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)) AS detalles
                          FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
            THROW 50511, @Error, 1;
        END
        IF ERROR_NUMBER() IN (2601, 2627) AND ERROR_MESSAGE() LIKE N'%UQ_Cupon_Codigo%'
            THROW 50510, N'Ya existe un cupón con ese código.', 1;
        IF ERROR_NUMBER() = 547 AND ERROR_MESSAGE() LIKE N'%FK_Cupon_Categoria%'
            THROW 50001, N'La categoría no existe.', 1;
        IF ERROR_NUMBER() = 547 AND ERROR_MESSAGE() LIKE N'%CK_Cupon_%'
            THROW 50003, N'Los datos del cupón no son válidos.', 1;
        THROW;
    END CATCH

    EXEC dbo.SP_Cupones_Obtener @IDCupon = @IDCupon;
END
GO
