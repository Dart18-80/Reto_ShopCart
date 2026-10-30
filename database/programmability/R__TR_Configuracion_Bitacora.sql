-- RF-09: cambios de los parámetros del sistema (plazos, umbrales y envío gratis).
CREATE OR ALTER TRIGGER dbo.TR_Configuracion_Bitacora
ON dbo.ParametroSistema
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDUsuario INT              = TRY_CONVERT(INT, SESSION_CONTEXT(N'IDUsuario')),
            @RequestId UNIQUEIDENTIFIER = TRY_CONVERT(UNIQUEIDENTIFIER, SESSION_CONTEXT(N'RequestId'));

    INSERT INTO dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario, RequestId)
    SELECT  'Configuracion', 'ParametroSistema', CONVERT(VARCHAR(50), i.IDParametroSistema),
            CASE WHEN d.IDParametroSistema IS NULL THEN 'Crear' ELSE 'Modificar' END,
            CASE WHEN d.IDParametroSistema IS NULL THEN NULL ELSE
                (SELECT d.DiasGarantiaPrecio, d.MinutosReserva, d.HorasCarritoAbandonado, d.DiasExpiracionCarritoInvitado,
                        d.UmbralUltimasUnidades, d.MontoEnvioGratis, d.MaxIntentosPagoRechazados, d.DiasPlazoDevolucion,
                        d.MaxLineasCarrito
                 FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
            (SELECT i.DiasGarantiaPrecio, i.MinutosReserva, i.HorasCarritoAbandonado, i.DiasExpiracionCarritoInvitado,
                    i.UmbralUltimasUnidades, i.MontoEnvioGratis, i.MaxIntentosPagoRechazados, i.DiasPlazoDevolucion,
                    i.MaxLineasCarrito
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            @IDUsuario, @RequestId
    FROM    inserted AS i
    LEFT JOIN deleted AS d ON d.IDParametroSistema = i.IDParametroSistema
    WHERE   d.IDParametroSistema IS NULL
       OR   EXISTS (SELECT i.DiasGarantiaPrecio, i.MinutosReserva, i.HorasCarritoAbandonado, i.DiasExpiracionCarritoInvitado,
                           i.UmbralUltimasUnidades, i.MontoEnvioGratis, i.MaxIntentosPagoRechazados, i.DiasPlazoDevolucion,
                           i.MaxLineasCarrito
                    EXCEPT
                    SELECT d.DiasGarantiaPrecio, d.MinutosReserva, d.HorasCarritoAbandonado, d.DiasExpiracionCarritoInvitado,
                           d.UmbralUltimasUnidades, d.MontoEnvioGratis, d.MaxIntentosPagoRechazados, d.DiasPlazoDevolucion,
                           d.MaxLineasCarrito);
END
GO
