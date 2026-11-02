-- RF-05, N-12: el Admin crea un cupón. El código se guarda en mayúsculas y es único sin distinguir
-- mayúsculas: UQ_Cupon_Codigo es la autoridad (dos altas simultáneas del mismo código: una responde 50510).
-- Los CHECK de la tabla son la última defensa de las reglas que Zod ya valida; cada uno se traduce a 50003 con
-- el campo en los detalles (FU_Cupones_RestriccionViolada, A-19). Devuelve el cupón.
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Crear
    @Codigo               VARCHAR(30),
    @Descripcion          NVARCHAR(200),
    @Tipo                 VARCHAR(10),
    @Valor                DECIMAL(12,2),
    @MontoMaximoDescuento DECIMAL(12,2),
    @MontoMinimoCompra    DECIMAL(12,2),
    @IDCategoria          INT,
    @FechaInicio          DATETIME2(3),
    @FechaFin             DATETIME2(3),
    @LimiteUsosTotal      INT,
    @LimiteUsosPorCliente INT,
    @Activo               BIT,
    @IDUsuarioActor       INT              = NULL,
    @RolActor             VARCHAR(20)      = NULL,
    @RequestId            UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @IDCupon INT, @Campo VARCHAR(30), @MensajeCampo NVARCHAR(200), @Error NVARCHAR(2048);

    BEGIN TRY
        BEGIN TRAN;

        INSERT INTO dbo.Cupon (Codigo, Descripcion, Tipo, Valor, MontoMaximoDescuento, MontoMinimoCompra,
                               IDCategoria, FechaInicio, FechaFin, LimiteUsosTotal, LimiteUsosPorCliente, Activo)
        VALUES (UPPER(LTRIM(RTRIM(@Codigo))), @Descripcion, @Tipo, @Valor, @MontoMaximoDescuento,
                @MontoMinimoCompra, @IDCategoria, @FechaInicio, @FechaFin, @LimiteUsosTotal,
                @LimiteUsosPorCliente, @Activo);
        SET @IDCupon = SCOPE_IDENTITY();

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
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
