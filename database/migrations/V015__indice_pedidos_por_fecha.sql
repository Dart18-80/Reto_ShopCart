-- V015 (E6-H01, RNF-1): la gestión de pedidos sin filtros ordena por FechaPago (los más recientes primero). Los
-- filtros por estado, cliente y fecha local ya tienen IX_Pedido_Gestion, IX_Pedido_Cliente e IX_Pedido_Reportes.
CREATE INDEX IX_Pedido_FechaPago
    ON dbo.Pedido (FechaPago DESC, IDPedido DESC) INCLUDE (IDUsuario, IDEstadoPedido, Total, FechaPagoLocal);
GO
