-- RF-05, N-12: el Admin edita un cupón. PATCH (sqlserver-sp §9.5): NULL significa "sin cambio";
-- @QuitarMontoMaximoDescuento y @QuitarCategoria quitan esos valores.
-- - N-12: un cupón usado (al menos una fila en UsoCupon) solo cambia su vigencia, sus límites y su estado;
--   tipo, valor, categoría, compra mínima, tope y código son inmutables: 50509 con el campo en los detalles.
--   Se decide bajo el bloqueo del cupón, el mismo que toma la reserva de un uso (sqlserver-sp §9.2).
-- - Un CHECK violado con los valores ya combinados (por ejemplo, una fecha final anterior a la inicial
--   guardada) se traduce a 50003 con el campo en los detalles (FU_Cupones_RestriccionViolada).
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

    DECLARE @Existe BIT, @CampoInmutable VARCHAR(30), @Campo VARCHAR(30), @MensajeCampo NVARCHAR(200),
            @Error NVARCHAR(2048);

    BEGIN TRY
        BEGIN TRAN;

        SELECT @Existe = 1,
               -- El primer campo inmutable que cambia de verdad (enviar el mismo valor no cuenta).
               @CampoInmutable = CASE
                   WHEN @Tipo IS NOT NULL AND @Tipo <> c.Tipo THEN 'tipo'
                   WHEN @Valor IS NOT NULL AND @Valor <> c.Valor THEN 'valor'
                   WHEN (@QuitarCategoria = 1 AND c.IDCategoria IS NOT NULL)
                        OR (@IDCategoria IS NOT NULL AND (c.IDCategoria IS NULL OR @IDCategoria <> c.IDCategoria))
                       THEN 'idCategoria'
                   WHEN @MontoMinimoCompra IS NOT NULL AND @MontoMinimoCompra <> c.MontoMinimoCompra
                       THEN 'montoMinimoCompra'
                   WHEN (@QuitarMontoMaximoDescuento = 1 AND c.MontoMaximoDescuento IS NOT NULL)
                        OR (@MontoMaximoDescuento IS NOT NULL
                            AND (c.MontoMaximoDescuento IS NULL OR @MontoMaximoDescuento <> c.MontoMaximoDescuento))
                       THEN 'montoMaximoDescuento'
                   WHEN @Codigo IS NOT NULL AND UPPER(LTRIM(RTRIM(@Codigo))) <> c.Codigo THEN 'codigo'
               END
        FROM   dbo.Cupon AS c WITH (UPDLOCK, ROWLOCK)
        WHERE  c.IDCupon = @IDCupon;

        IF @Existe IS NULL
            THROW 50001, N'El cupón no existe.', 1;

        IF @CampoInmutable IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.UsoCupon AS u WHERE u.IDCupon = @IDCupon)
        BEGIN
            SET @Error = (SELECT N'El cupón ya se usó: solo se pueden cambiar su vigencia, sus límites y su estado.' AS mensaje,
                                 JSON_QUERY((SELECT @CampoInmutable AS campo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)) AS detalles
                          FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
            THROW 50509, @Error, 1;
        END

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
        IF ERROR_NUMBER() = 547
        BEGIN
            SELECT @Campo = r.Campo, @MensajeCampo = r.Mensaje
            FROM   dbo.FU_Cupones_RestriccionViolada(ERROR_MESSAGE()) AS r;
            IF @Campo IS NOT NULL
            BEGIN
                SET @Error = (SELECT @MensajeCampo AS mensaje,
                                     JSON_QUERY((SELECT @Campo AS campo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)) AS detalles
                              FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
                THROW 50003, @Error, 1;
            END
        END;
        THROW;
    END CATCH

    EXEC dbo.SP_Cupones_Obtener @IDCupon = @IDCupon;
END
GO
