-- V020 (E8-H02, RNF-1): SP_Pedidos_ListarReembolsos (lista del Admin) ordena por FechaCreacion DESC,
-- IDReembolso DESC con un filtro opcional por estado. Este índice entrega la página ya ordenada.
CREATE INDEX IX_Reembolso_Fecha ON dbo.Reembolso (FechaCreacion DESC, IDReembolso DESC) INCLUDE (Estado);
GO
