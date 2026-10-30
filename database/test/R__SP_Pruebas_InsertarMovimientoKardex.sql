-- Solo existe en shopcart_test: inserta un movimiento tal cual llega, sin pasar por
-- SP_Inventario_RegistrarMovimiento, para comprobar que los constraints del kardex lo rechazan.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_InsertarMovimientoKardex
    @IDVariante           INT,
    @IDTipoMovimiento     INT,
    @Signo                SMALLINT,
    @Cantidad             INT,
    @ExistenciaAnterior   INT,
    @ExistenciaResultante INT,
    @IDUsuario            INT,
    @IDUsuarioActor       INT              = NULL,
    @RolActor             VARCHAR(20)      = NULL,
    @RequestId            UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    INSERT INTO dbo.MovimientoKardex
        (IDVariante, IDTipoMovimiento, Signo, Cantidad, ExistenciaAnterior, ExistenciaResultante, Motivo, IDUsuario)
    VALUES
        (@IDVariante, @IDTipoMovimiento, @Signo, @Cantidad, @ExistenciaAnterior, @ExistenciaResultante,
         N'Movimiento de prueba', @IDUsuario);

    SELECT CONVERT(BIGINT, SCOPE_IDENTITY()) AS IDMovimientoKardex;
END
GO
