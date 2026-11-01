-- N-02, RF-02: cambia el precio de una variante. En una transacción, con la variante bloqueada: cierra la
-- versión vigente (VigenteHasta = ahora) e inserta la nueva (VigenteDesde = ahora). Dos cambios simultáneos
-- se serializan en la fila de la variante y UX_PrecioVariante_Vigente garantiza un solo precio vigente.
-- Los pedidos guardan su IDPrecioVariante: un cambio nunca altera el monto de pedidos ya realizados.
-- TR_Catalogo_PrecioVarianteBitacora registra la nueva versión con el precio anterior (R5).
-- Un precio igual al vigente no crea versión ni fila de bitácora (PUT idempotente). Devuelve el historial.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CambiarPrecio
    @IDVariante     INT,
    @Precio         DECIMAL(12,2),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @Precio IS NULL OR @Precio <= 0
        THROW 50003, N'El precio debe ser mayor que cero.', 1;

    BEGIN TRY
        BEGIN TRAN;

        IF NOT EXISTS (SELECT 1 FROM dbo.Variante WITH (UPDLOCK, ROWLOCK) WHERE IDVariante = @IDVariante)
            THROW 50001, N'La variante no existe.', 1;

        DECLARE @IDVigente INT, @PrecioVigente DECIMAL(12,2), @VigenteDesde DATETIME2(3),
                @Ahora DATETIME2(3) = SYSUTCDATETIME();
        SELECT @IDVigente = pv.IDPrecioVariante, @PrecioVigente = pv.Precio, @VigenteDesde = pv.VigenteDesde
        FROM   dbo.PrecioVariante AS pv WITH (UPDLOCK, ROWLOCK)
        WHERE  pv.IDVariante = @IDVariante AND pv.VigenteHasta IS NULL;

        IF @PrecioVigente = @Precio
        BEGIN
            COMMIT;
            EXEC dbo.SP_Catalogo_HistorialPrecios @IDVariante = @IDVariante;
            RETURN;
        END

        -- CK_PrecioVariante_Vigencia exige VigenteHasta > VigenteDesde: dos cambios en el mismo milisegundo
        -- corren el nuevo un milisegundo para que las versiones no se encimen.
        IF @VigenteDesde IS NOT NULL AND @Ahora <= @VigenteDesde
            SET @Ahora = DATEADD(MILLISECOND, 1, @VigenteDesde);

        UPDATE dbo.PrecioVariante SET VigenteHasta = @Ahora WHERE IDPrecioVariante = @IDVigente;

        INSERT INTO dbo.PrecioVariante (IDVariante, Precio, VigenteDesde, IDUsuario)
        VALUES (@IDVariante, @Precio, @Ahora, @IDUsuarioActor);

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    EXEC dbo.SP_Catalogo_HistorialPrecios @IDVariante = @IDVariante;
END
GO
