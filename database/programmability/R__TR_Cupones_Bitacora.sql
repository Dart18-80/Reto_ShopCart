-- RF-09: creación, cambios y desactivación de cupones. UsosComprometidos es un contador técnico:
-- no se registra, o cada pago llenaría la bitácora.
CREATE OR ALTER TRIGGER dbo.TR_Cupones_Bitacora
ON dbo.Cupon
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDUsuario INT              = TRY_CONVERT(INT, SESSION_CONTEXT(N'IDUsuario')),
            @RequestId UNIQUEIDENTIFIER = TRY_CONVERT(UNIQUEIDENTIFIER, SESSION_CONTEXT(N'RequestId'));

    INSERT INTO dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario, RequestId)
    SELECT  'Cupones', 'Cupon', CONVERT(VARCHAR(50), COALESCE(i.IDCupon, d.IDCupon)),
            CASE
                WHEN d.IDCupon IS NULL             THEN 'Crear'
                WHEN i.IDCupon IS NULL             THEN 'Eliminar'
                WHEN d.Activo = 1 AND i.Activo = 0 THEN 'Desactivar'
                WHEN d.Activo = 0 AND i.Activo = 1 THEN 'Activar'
                ELSE 'Modificar'
            END,
            CASE WHEN d.IDCupon IS NULL THEN NULL ELSE
                (SELECT d.Codigo, d.Descripcion, d.Tipo, d.Valor, d.MontoMaximoDescuento, d.MontoMinimoCompra,
                        d.IDCategoria, d.FechaInicio, d.FechaFin, d.LimiteUsosTotal, d.LimiteUsosPorCliente, d.Activo
                 FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
            CASE WHEN i.IDCupon IS NULL THEN NULL ELSE
                (SELECT i.Codigo, i.Descripcion, i.Tipo, i.Valor, i.MontoMaximoDescuento, i.MontoMinimoCompra,
                        i.IDCategoria, i.FechaInicio, i.FechaFin, i.LimiteUsosTotal, i.LimiteUsosPorCliente, i.Activo
                 FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
            @IDUsuario, @RequestId
    FROM    inserted AS i
    FULL OUTER JOIN deleted AS d ON d.IDCupon = i.IDCupon
    WHERE   i.IDCupon IS NULL OR d.IDCupon IS NULL
       OR   EXISTS (SELECT i.Codigo, i.Descripcion, i.Tipo, i.Valor, i.MontoMaximoDescuento, i.MontoMinimoCompra,
                           i.IDCategoria, i.FechaInicio, i.FechaFin, i.LimiteUsosTotal, i.LimiteUsosPorCliente, i.Activo
                    EXCEPT
                    SELECT d.Codigo, d.Descripcion, d.Tipo, d.Valor, d.MontoMaximoDescuento, d.MontoMinimoCompra,
                           d.IDCategoria, d.FechaInicio, d.FechaFin, d.LimiteUsosTotal, d.LimiteUsosPorCliente, d.Activo);
END
GO
