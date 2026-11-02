-- RF-05: traduce la violación de un CHECK de Cupon (el mensaje del error 547) al campo de la API y a un
-- mensaje para el Admin. Ninguna fila si la constraint no es una de estas. CK_Cupon_UsosComprometidos no
-- está: tiene su propio código (50511). La usan SP_Cupones_Crear y SP_Cupones_Actualizar en su CATCH.
CREATE OR ALTER FUNCTION dbo.FU_Cupones_RestriccionViolada (@MensajeError NVARCHAR(4000))
RETURNS TABLE
AS
RETURN
    SELECT TOP (1) r.Campo, r.Mensaje
    FROM (VALUES
        (N'CK_Cupon_CodigoMayusculas',     'codigo',               N'El código debe estar en mayúsculas.'),
        (N'CK_Cupon_Tipo',                 'tipo',                 N'El tipo debe ser Porcentaje o MontoFijo.'),
        (N'CK_Cupon_Valor',                'valor',                N'El valor debe ser mayor que cero y un porcentaje no puede pasar de 100.'),
        (N'CK_Cupon_MontoMaximoDescuento', 'montoMaximoDescuento', N'El tope de descuento debe ser mayor que cero y solo aplica a cupones de porcentaje.'),
        (N'CK_Cupon_MontoMinimoCompra',    'montoMinimoCompra',    N'La compra mínima no puede ser negativa.'),
        (N'CK_Cupon_Vigencia',             'fechaFin',             N'La fecha final debe ser posterior a la inicial.'),
        (N'CK_Cupon_LimiteUsosTotal',      'limiteUsosTotal',      N'El límite de usos debe ser mayor que cero.'),
        (N'CK_Cupon_LimiteUsosPorCliente', 'limiteUsosPorCliente', N'El límite de usos por cliente debe ser mayor que cero.')
    ) AS r (Restriccion, Campo, Mensaje)
    -- Comillas alrededor del nombre: así CK_Cupon_Valor no coincide con otra constraint que empiece igual.
    WHERE @MensajeError LIKE N'%"' + r.Restriccion + N'"%';
GO
