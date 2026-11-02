-- A-14, RF-09: el Admin cambia parámetros del sistema. PATCH (sqlserver-sp §9.5): NULL significa "sin
-- cambio"; @QuitarMontoEnvioGratis = 1 deja la tienda sin envío gratis. Los CHECK de la tabla son la última
-- defensa de los rangos que Zod ya valida. El cambio queda en la bitácora con quién lo hizo y la petición
-- (TR_Configuracion_Bitacora, A-18). Devuelve los parámetros.
CREATE OR ALTER PROCEDURE dbo.SP_Configuracion_Actualizar
    @DiasGarantiaPrecio            TINYINT,
    @MinutosReserva                SMALLINT,
    @HorasCarritoAbandonado        SMALLINT,
    @DiasExpiracionCarritoInvitado SMALLINT,
    @UmbralUltimasUnidades         SMALLINT,
    @MontoEnvioGratis              DECIMAL(12,2),
    @QuitarMontoEnvioGratis        BIT              = 0,
    @MaxIntentosPagoRechazados     TINYINT,
    @DiasPlazoDevolucion           SMALLINT,
    @MaxLineasCarrito              SMALLINT,
    @IDUsuarioActor                INT              = NULL,
    @RolActor                      VARCHAR(20)      = NULL,
    @RequestId                     UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @QuitarMontoEnvioGratis = 1 AND @MontoEnvioGratis IS NOT NULL
        THROW 50003, N'No se puede enviar un monto de envío gratis y quitarlo a la vez.', 1;

    BEGIN TRY
        BEGIN TRAN;

        UPDATE p
        SET    DiasGarantiaPrecio            = COALESCE(@DiasGarantiaPrecio, p.DiasGarantiaPrecio),
               MinutosReserva                = COALESCE(@MinutosReserva, p.MinutosReserva),
               HorasCarritoAbandonado        = COALESCE(@HorasCarritoAbandonado, p.HorasCarritoAbandonado),
               DiasExpiracionCarritoInvitado = COALESCE(@DiasExpiracionCarritoInvitado,
                                                        p.DiasExpiracionCarritoInvitado),
               UmbralUltimasUnidades         = COALESCE(@UmbralUltimasUnidades, p.UmbralUltimasUnidades),
               MontoEnvioGratis              = CASE WHEN @QuitarMontoEnvioGratis = 1 THEN NULL
                                                    ELSE COALESCE(@MontoEnvioGratis, p.MontoEnvioGratis) END,
               MaxIntentosPagoRechazados     = COALESCE(@MaxIntentosPagoRechazados, p.MaxIntentosPagoRechazados),
               DiasPlazoDevolucion           = COALESCE(@DiasPlazoDevolucion, p.DiasPlazoDevolucion),
               MaxLineasCarrito              = COALESCE(@MaxLineasCarrito, p.MaxLineasCarrito),
               IDUsuarioActualizacion        = @IDUsuarioActor,
               FechaActualizacion            = SYSUTCDATETIME()
        FROM   dbo.ParametroSistema AS p WITH (UPDLOCK, ROWLOCK)
        WHERE  p.IDParametroSistema = 1;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF ERROR_NUMBER() = 547 AND ERROR_MESSAGE() LIKE N'%CK_ParametroSistema_%'
            THROW 50003, N'Algún parámetro está fuera de su rango.', 1;
        THROW;
    END CATCH

    EXEC dbo.SP_Configuracion_Obtener;
END
GO
