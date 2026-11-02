-- Solo existe en shopcart_test: hace fallar, dentro de la transacción del SP, la fusión (Activo → Fusionado)
-- o la asignación (el hash del invitado pasa a NULL) de un carrito que tenga una variante con SKU 'FALLA-…'.
-- Sirve para probar la política de N-05 con una falla real: el SP revierte todo y el login responde igual.
CREATE OR ALTER TRIGGER dbo.TR_Pruebas_FallarPaseDeCarrito
ON dbo.Carrito
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1
               FROM   inserted AS i
               JOIN   deleted  AS d ON d.IDCarrito = i.IDCarrito
               JOIN   dbo.LineaCarrito AS l ON l.IDCarrito = i.IDCarrito
               JOIN   dbo.Variante     AS v ON v.IDVariante = l.IDVariante
               WHERE  v.SKU LIKE 'FALLA-%'
                 AND  (   (d.Estado = 'Activo' AND i.Estado = 'Fusionado')
                       OR (d.HashTokenInvitado IS NOT NULL AND i.HashTokenInvitado IS NULL)))
        THROW 59999, N'Falla simulada al pasar el carrito de invitado.', 1;
END
GO
