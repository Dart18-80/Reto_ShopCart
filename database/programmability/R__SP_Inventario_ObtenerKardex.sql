-- RF-03: kardex de una variante (Operador), paginado, del movimiento más reciente al más antiguo
-- (IX_MovimientoKardex_Variante). Una variante inexistente responde 50001.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ObtenerKardex
    @IDVariante     INT,
    @Pagina         INT,
    @Tamano         INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina < 1 OR @Tamano NOT BETWEEN 1 AND 100
        THROW 50003, N'Los parámetros de paginación no son válidos.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Variante WHERE IDVariante = @IDVariante)
        THROW 50001, N'La variante no existe.', 1;

    SELECT m.IDMovimientoKardex, m.IDVariante, m.Tipo, m.Signo, m.Cantidad, m.ExistenciaAnterior,
           m.ExistenciaResultante, m.Motivo, m.Referencia, m.IDPedido, m.IDDevolucion, m.IDUsuario,
           m.Usuario, m.Fecha, COUNT(*) OVER () AS TotalFilas
    FROM   dbo.FU_Inventario_Movimientos(@IDVariante) AS m
    ORDER BY m.IDMovimientoKardex DESC
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY;
END
GO
