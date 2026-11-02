-- V017 (E7-H02, RNF-1): la consulta de la bitácora sin filtro de módulo ni de entidad ordena por fecha (la más
-- reciente primero). Los filtros por módulo y por entidad ya tienen IX_Bitacora_Modulo e IX_Bitacora_Entidad.
CREATE INDEX IX_Bitacora_Fecha ON dbo.Bitacora (Fecha DESC, IDBitacora DESC);
GO
