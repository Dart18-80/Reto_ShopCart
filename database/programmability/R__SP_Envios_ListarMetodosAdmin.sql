-- N-04, M9-H02: todos los métodos de envío para el Admin, también los inactivos (para reactivarlos), con su costo
-- base, sus días estimados y su estado, en el orden de su ID. El costo para un carrito (envío gratis) lo calcula
-- SP_Envios_ListarMetodos; este listado es la tarifa que el Admin edita con SP_Envios_ActualizarMetodo.
CREATE OR ALTER PROCEDURE dbo.SP_Envios_ListarMetodosAdmin
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @RolActor IS NULL OR @RolActor <> 'Administrador'
        THROW 50005, N'Solo el Administrador administra los métodos de envío.', 1;

    SELECT m.IDMetodoEnvio, m.Codigo, m.Nombre, m.Costo, m.DiasMin, m.DiasMax, m.Activo
    FROM   dbo.MetodoEnvio AS m
    ORDER BY m.IDMetodoEnvio;
END
GO
