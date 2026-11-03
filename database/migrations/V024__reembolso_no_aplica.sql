-- V024 (E9-H04, decisión del PO): estado NoAplica del reembolso. Al resolverlo a mano, la pasarela mostró que el
-- cobro nunca se capturó o se anuló: no hay dinero que devolver. Guarda el motivo, quién y cuándo (sin referencia,
-- porque no hubo devolución) y no cuenta como reembolsado. Solo se rehacen los dos CHECK que dependen del estado.
ALTER TABLE dbo.Reembolso DROP CONSTRAINT CK_Reembolso_Estado;
ALTER TABLE dbo.Reembolso DROP CONSTRAINT CK_Reembolso_ResolucionManual;

ALTER TABLE dbo.Reembolso ADD
    CONSTRAINT CK_Reembolso_Estado CHECK (Estado IN ('Pendiente', 'Completado', 'Fallido', 'ResueltoManual', 'NoAplica')),
    CONSTRAINT CK_Reembolso_ResolucionManual CHECK (
        (Estado = 'ResueltoManual' AND MotivoResolucion IS NOT NULL AND ReferenciaResolucion IS NOT NULL
            AND IDUsuarioResolucion IS NOT NULL AND FechaResolucion IS NOT NULL)
        OR (Estado = 'NoAplica' AND MotivoResolucion IS NOT NULL AND ReferenciaResolucion IS NULL
            AND IDUsuarioResolucion IS NOT NULL AND FechaResolucion IS NOT NULL)
        OR (Estado NOT IN ('ResueltoManual', 'NoAplica') AND MotivoResolucion IS NULL AND ReferenciaResolucion IS NULL
            AND IDUsuarioResolucion IS NULL AND FechaResolucion IS NULL));
GO
