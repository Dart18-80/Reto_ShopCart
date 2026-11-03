-- V023 (E9-H04, decisión del PO al cierre de la Fase 1): revisión manual de pagos y reembolsos.
-- IntentoPago guarda cómo resolvió el Admin un intento EnRevision (CobroVerificado, SinCobro o Reembolsar), con
-- su motivo, quién y cuándo: los cuatro juntos o ninguno.
ALTER TABLE dbo.IntentoPago ADD
    ResolucionManual    VARCHAR(16)   NULL,
    MotivoResolucion    NVARCHAR(250) NULL,
    IDUsuarioResolucion INT           NULL,
    FechaResolucion     DATETIME2(3)  NULL;
GO

ALTER TABLE dbo.IntentoPago ADD
    CONSTRAINT FK_IntentoPago_UsuarioResolucion FOREIGN KEY (IDUsuarioResolucion) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT CK_IntentoPago_ResolucionManual CHECK (
        (ResolucionManual IS NULL AND MotivoResolucion IS NULL AND IDUsuarioResolucion IS NULL
            AND FechaResolucion IS NULL)
        OR (ResolucionManual IN ('CobroVerificado', 'SinCobro', 'Reembolsar') AND MotivoResolucion IS NOT NULL
            AND IDUsuarioResolucion IS NOT NULL AND FechaResolucion IS NOT NULL));

-- La lista del Admin (SP_Pedidos_ListarPagosEnRevision): los EnRevision, los más recientes primero.
CREATE INDEX IX_IntentoPago_EnRevision
    ON dbo.IntentoPago (FechaActualizacion DESC, IDIntentoPago DESC) WHERE Estado = 'EnRevision';
GO

-- Reembolso: un cobro capturado sin pedido se devuelve con un reembolso que apunta al intento (exactamente uno de
-- IDPedido e IDIntentoPago). El estado nuevo ResueltoManual (14 caracteres) guarda el motivo, la referencia,
-- quién y cuándo. Las restricciones e índices que dependen de las columnas que cambian se vuelven a crear.
DROP INDEX UX_Reembolso_CancelacionPorPedido ON dbo.Reembolso;
DROP INDEX IX_Reembolso_Pendientes ON dbo.Reembolso;
DROP INDEX IX_Reembolso_Fecha ON dbo.Reembolso;
ALTER TABLE dbo.Reembolso DROP CONSTRAINT CK_Reembolso_Estado;
ALTER TABLE dbo.Reembolso DROP CONSTRAINT CK_Reembolso_Origen;
ALTER TABLE dbo.Reembolso ALTER COLUMN IDPedido INT NULL;
ALTER TABLE dbo.Reembolso ALTER COLUMN Estado VARCHAR(14) NOT NULL;
ALTER TABLE dbo.Reembolso ADD
    IDIntentoPago        BIGINT        NULL,
    MotivoResolucion     NVARCHAR(250) NULL,
    ReferenciaResolucion NVARCHAR(100) NULL,
    IDUsuarioResolucion  INT           NULL,
    FechaResolucion      DATETIME2(3)  NULL;
GO

ALTER TABLE dbo.Reembolso ADD
    CONSTRAINT FK_Reembolso_IntentoPago FOREIGN KEY (IDIntentoPago) REFERENCES dbo.IntentoPago (IDIntentoPago),
    CONSTRAINT FK_Reembolso_UsuarioResolucion FOREIGN KEY (IDUsuarioResolucion) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT CK_Reembolso_Destino CHECK (
        (IDPedido IS NOT NULL AND IDIntentoPago IS NULL) OR (IDPedido IS NULL AND IDIntentoPago IS NOT NULL)),
    CONSTRAINT CK_Reembolso_Origen CHECK (
        (Origen = 'Devolucion' AND IDDevolucion IS NOT NULL AND IDPedido IS NOT NULL)
        OR (Origen = 'Cancelacion' AND IDDevolucion IS NULL AND IDPedido IS NOT NULL)
        OR (Origen = 'SinPedido' AND IDDevolucion IS NULL AND IDIntentoPago IS NOT NULL)),
    CONSTRAINT CK_Reembolso_Estado CHECK (Estado IN ('Pendiente', 'Completado', 'Fallido', 'ResueltoManual')),
    CONSTRAINT CK_Reembolso_ResolucionManual CHECK (
        (Estado = 'ResueltoManual' AND MotivoResolucion IS NOT NULL AND ReferenciaResolucion IS NOT NULL
            AND IDUsuarioResolucion IS NOT NULL AND FechaResolucion IS NOT NULL)
        OR (Estado <> 'ResueltoManual' AND MotivoResolucion IS NULL AND ReferenciaResolucion IS NULL
            AND IDUsuarioResolucion IS NULL AND FechaResolucion IS NULL));

CREATE UNIQUE INDEX UX_Reembolso_CancelacionPorPedido ON dbo.Reembolso (IDPedido) WHERE Origen = 'Cancelacion';
-- Un solo reembolso por intento, por su monto: nunca se devuelve más de lo capturado.
CREATE UNIQUE INDEX UX_Reembolso_PorIntento ON dbo.Reembolso (IDIntentoPago) WHERE IDIntentoPago IS NOT NULL;
CREATE INDEX IX_Reembolso_Pendientes ON dbo.Reembolso (FechaProximoIntento) WHERE Estado = 'Pendiente';
CREATE INDEX IX_Reembolso_Fecha ON dbo.Reembolso (FechaCreacion DESC, IDReembolso DESC) INCLUDE (Estado);
GO
