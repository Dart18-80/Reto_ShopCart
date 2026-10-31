-- Solo existe en shopcart_test: crea un pedido Pagado para el usuario (con su sesión e intento de
-- pago) y asegura los estados y las dos transiciones que usan las pruebas, si la semilla aún no está.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_CrearPedido
    @IDUsuario      INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    BEGIN TRY
        BEGIN TRAN;

        INSERT INTO dbo.Rol (Codigo, Nombre)
        SELECT r.Codigo, r.Nombre
        FROM (VALUES ('Cliente', N'Cliente'), ('Operador', N'Operador'), ('Administrador', N'Administrador')) AS r (Codigo, Nombre)
        WHERE NOT EXISTS (SELECT 1 FROM dbo.Rol WITH (UPDLOCK, HOLDLOCK) WHERE Codigo = r.Codigo);

        INSERT INTO dbo.EstadoPedido (Codigo, Nombre, EsFinal, Orden)
        SELECT e.Codigo, e.Nombre, e.EsFinal, e.Orden
        FROM (VALUES ('Pagado', N'Pagado', 0, 1), ('EnPreparacion', N'En preparación', 0, 2),
                     ('Despachado', N'Despachado', 0, 3), ('Entregado', N'Entregado', 0, 4),
                     ('Cancelado', N'Cancelado', 1, 5), ('DevueltoParcial', N'Devuelto parcial', 0, 6),
                     ('Devuelto', N'Devuelto', 1, 7)) AS e (Codigo, Nombre, EsFinal, Orden)
        WHERE NOT EXISTS (SELECT 1 FROM dbo.EstadoPedido WITH (UPDLOCK, HOLDLOCK) WHERE Codigo = e.Codigo);

        INSERT INTO dbo.TransicionEstadoPedido (IDEstadoOrigen, IDEstadoDestino, IDRol)
        SELECT o.IDEstadoPedido, d.IDEstadoPedido, r.IDRol
        FROM (VALUES ('Pagado', 'EnPreparacion', 'Operador'), ('Pagado', 'Cancelado', 'Cliente')) AS t (Origen, Destino, Rol)
        JOIN dbo.EstadoPedido AS o ON o.Codigo = t.Origen
        JOIN dbo.EstadoPedido AS d ON d.Codigo = t.Destino
        JOIN dbo.Rol          AS r ON r.Codigo = t.Rol
        WHERE NOT EXISTS (SELECT 1 FROM dbo.TransicionEstadoPedido AS x WITH (UPDLOCK, HOLDLOCK)
                          WHERE x.IDEstadoOrigen = o.IDEstadoPedido AND x.IDEstadoDestino = d.IDEstadoPedido
                            AND x.IDRol = r.IDRol);

        DECLARE @Sesion TABLE (IDSesionCheckout INT);
        INSERT INTO @Sesion EXEC dbo.SP_Pruebas_CrearSesionCheckout @IDUsuario = @IDUsuario, @IDUsuarioActor = @IDUsuarioActor,
                                                  @RolActor = @RolActor, @RequestId = @RequestId;
        DECLARE @IDSesionCheckout INT = (SELECT IDSesionCheckout FROM @Sesion);

        INSERT INTO dbo.IntentoPago (IDSesionCheckout, LlaveIdempotencia, HashSolicitud, Monto, Estado,
                                     IDTransaccionPasarela, MarcaTarjeta, UltimosDigitos)
        VALUES (@IDSesionCheckout, NEWID(), HASHBYTES('SHA2_256', CONVERT(NVARCHAR(36), NEWID())), 135, 'Capturado',
                CONVERT(VARCHAR(36), NEWID()), 'Visa', '4242');
        DECLARE @IDIntentoPago BIGINT = SCOPE_IDENTITY();

        INSERT INTO dbo.Pedido (
            IDUsuario, IDSesionCheckout, IDIntentoPago, IDEstadoPedido, Subtotal, Descuento, CostoEnvio, Total,
            BaseImponible, IVA, IDMetodoEnvio, NombreMetodoEnvio, FechaEstimadaEntrega, NombreRecibe, TelefonoRecibe,
            IDMunicipio, Departamento, Municipio, DireccionLinea, IDTransaccionPasarela, MarcaTarjeta, UltimosDigitos,
            FechaPago, FechaPagoLocal)
        SELECT s.IDUsuario, s.IDSesionCheckout, ip.IDIntentoPago,
               (SELECT IDEstadoPedido FROM dbo.EstadoPedido WHERE Codigo = 'Pagado'),
               s.Subtotal, s.Descuento, s.CostoEnvio, s.Total, 120.54, 14.46, s.IDMetodoEnvio, s.NombreMetodoEnvio,
               CONVERT(DATE, DATEADD(DAY, s.DiasMax, SYSUTCDATETIME())), s.NombreRecibe, s.TelefonoRecibe,
               s.IDMunicipio, s.Departamento, s.Municipio, s.DireccionLinea, ip.IDTransaccionPasarela,
               ip.MarcaTarjeta, ip.UltimosDigitos, SYSUTCDATETIME(),
               CONVERT(DATE, SWITCHOFFSET(SYSDATETIMEOFFSET(), '-06:00'))
        FROM dbo.SesionCheckout AS s
        JOIN dbo.IntentoPago    AS ip ON ip.IDIntentoPago = @IDIntentoPago
        WHERE s.IDSesionCheckout = @IDSesionCheckout;
        DECLARE @IDPedido INT = SCOPE_IDENTITY();

        COMMIT;
        SELECT @IDPedido AS IDPedido;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
