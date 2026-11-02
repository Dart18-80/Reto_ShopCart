-- Interno (sqlserver-sp §7), N-12, A-13: reserva el uso del cupón para una sesión de checkout recién creada.
-- Bloquea el cupón (lo último en el orden de 01 §6.6) y lo revalida bajo el bloqueo con FU_Cupones_Validar
-- (cada causa con su código; el mínimo trae lo que falta). El CHECK del contador es la autoridad del límite
-- total: el UPDATE condicionado responde 50505 si ya no queda uso, y CK_Cupon_UsosComprometidos es la última
-- defensa.
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_ReservarUso
    @IDCupon          INT,
    @IDSesionCheckout INT,
    @IDUsuario        INT,
    @IDCarrito        INT,
    @MontoDescuento   DECIMAL(12,2)
AS
BEGIN
    SET NOCOUNT ON;

    IF @@TRANCOUNT = 0
        THROW 50005, N'SP_Cupones_ReservarUso debe ejecutarse dentro de una transacción.', 1;

    DECLARE @Bloqueado INT, @NumeroError INT, @Mensaje NVARCHAR(200), @Faltante DECIMAL(15,2), @Error NVARCHAR(2048);

    SELECT @Bloqueado = c.IDCupon FROM dbo.Cupon AS c WITH (UPDLOCK, ROWLOCK) WHERE c.IDCupon = @IDCupon;

    SELECT @NumeroError = v.NumeroError, @Mensaje = v.Mensaje, @Faltante = v.Faltante
    FROM   dbo.FU_Cupones_Validar(@Bloqueado, @IDUsuario, @IDCarrito) AS v;

    IF @NumeroError = 50507
    BEGIN
        SET @Error = (SELECT @Mensaje AS mensaje,
                             JSON_QUERY((SELECT CONVERT(VARCHAR(20), @Faltante) AS faltante
                                         FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)) AS detalles
                      FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
        THROW 50507, @Error, 1;
    END
    IF @NumeroError IS NOT NULL
        THROW @NumeroError, @Mensaje, 1;

    UPDATE dbo.Cupon
    SET    UsosComprometidos = UsosComprometidos + 1
    WHERE  IDCupon = @Bloqueado AND UsosComprometidos < LimiteUsosTotal;

    IF @@ROWCOUNT = 0
        THROW 50505, N'El cupón alcanzó su límite de usos.', 1;

    INSERT INTO dbo.UsoCupon (IDCupon, IDUsuario, IDSesionCheckout, Estado, MontoDescuento)
    VALUES (@Bloqueado, @IDUsuario, @IDSesionCheckout, 'Reservado', @MontoDescuento);
END
GO
