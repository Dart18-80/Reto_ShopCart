-- V018 (revisión de E7, RNF-1): SP_Bitacora_Listar ordena por Fecha DESC, IDBitacora DESC. Con el filtro por módulo,
-- este índice entrega las filas ya en ese orden (IX_Bitacora_Modulo lleva IDBitacora implícito en ASC y obliga a
-- ordenar todo el módulo en cada página).
CREATE INDEX IX_Bitacora_ModuloFecha ON dbo.Bitacora (Modulo, Fecha DESC, IDBitacora DESC);
GO
