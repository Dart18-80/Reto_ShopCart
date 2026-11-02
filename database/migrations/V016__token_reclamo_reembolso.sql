-- V016 (revisión de E6, N-09): token del reclamo de un reembolso. Cada toma (SP_Pedidos_TomarReembolso) genera uno
-- nuevo; un fallo solo se registra si quien lo reporta tiene el reclamo vigente, así un proceso desplazado no suma
-- intentos ni lo deja Fallido. Un éxito de la pasarela se registra siempre (es la verdad del dinero).
ALTER TABLE dbo.Reembolso ADD TokenReclamo UNIQUEIDENTIFIER NULL;
GO
