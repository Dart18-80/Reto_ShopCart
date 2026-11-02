-- N-04, RF-09: el Admin reemplaza la tarifa, el nombre, los días estimados y el estado de un método de envío.
-- El cambio queda en la bitácora con quién lo hizo y la petición (TR_Envios_Bitacora, A-18). El código no
-- cambia. Siempre queda al menos un método activo (50901): sin ninguno, ningún checkout podría empezar.
-- Devuelve el método.
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

        -- N-04: se bloquean todas las filas (son pocas, en el orden de la llave): dos desactivaciones simultáneas
        -- de los dos últimos activos se serializan y la segunda ve que ya no queda otro.
        DECLARE @Existe INT, @OtrosActivos INT;
        SELECT @Existe       = COUNT(CASE WHEN m.IDMetodoEnvio = @IDMetodoEnvio THEN 1 END),
               @OtrosActivos = COUNT(CASE WHEN m.IDMetodoEnvio <> @IDMetodoEnvio AND m.Activo = 1 THEN 1 END)
        FROM   dbo.MetodoEnvio AS m WITH (UPDLOCK, HOLDLOCK);

        IF @Existe = 0
            THROW 50001, N'El método de envío no existe.', 1;
        IF @Activo = 0 AND @OtrosActivos = 0
            THROW 50901, N'Debe quedar al menos un método de envío activo: activa otro antes de desactivar este.', 1;

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
