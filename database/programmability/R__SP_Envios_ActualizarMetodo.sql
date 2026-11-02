-- N-04, RF-09: el Admin reemplaza la tarifa, el nombre, los días estimados y el estado de un método de envío.
-- El cambio queda en la bitácora con quién lo hizo y la petición (TR_Envios_Bitacora, A-18). El código no
-- cambia. Devuelve el método.
CREATE OR ALTER PROCEDURE dbo.SP_Envios_ActualizarMetodo
    @IDMetodoEnvio  INT,
    @Nombre         NVARCHAR(50),
    @Costo          DECIMAL(12,2),
    @DiasMin        TINYINT,
    @DiasMax        TINYINT,
    @Activo         BIT,
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

        IF NOT EXISTS (SELECT 1 FROM dbo.MetodoEnvio AS m WITH (UPDLOCK, ROWLOCK)
                       WHERE m.IDMetodoEnvio = @IDMetodoEnvio)
            THROW 50001, N'El método de envío no existe.', 1;

        UPDATE dbo.MetodoEnvio
        SET    Nombre = @Nombre, Costo = @Costo, DiasMin = @DiasMin, DiasMax = @DiasMax, Activo = @Activo,
               FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDMetodoEnvio = @IDMetodoEnvio;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF ERROR_NUMBER() = 547 AND ERROR_MESSAGE() LIKE N'%CK_MetodoEnvio_%'
            THROW 50003, N'Los datos del método de envío no son válidos.', 1;
        THROW;
    END CATCH

    SELECT m.IDMetodoEnvio, m.Codigo, m.Nombre, m.Costo, m.DiasMin, m.DiasMax, m.Activo
    FROM   dbo.MetodoEnvio AS m
    WHERE  m.IDMetodoEnvio = @IDMetodoEnvio;
END
GO
