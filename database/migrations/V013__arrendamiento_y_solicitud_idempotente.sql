-- V013 (E5-H03, N-03): arrendamiento del intento de pago, estado Fallido para la conciliación y llaves de
-- idempotencia de las operaciones que no son pagos (entradas y ajustes de inventario).

-- Hasta cuándo una petición tiene tomado el intento en curso; NULL cuando ya no está en curso.
ALTER TABLE dbo.IntentoPago ADD ArrendadoHasta DATETIME2(3) NULL;
GO

-- Fallido: la conciliación confirmó que la pasarela nunca autorizó (sin cobro).
ALTER TABLE dbo.IntentoPago DROP CONSTRAINT CK_IntentoPago_Estado;
ALTER TABLE dbo.IntentoPago ADD CONSTRAINT CK_IntentoPago_Estado CHECK (
    Estado IN ('Pendiente', 'Autorizado', 'Capturado', 'Rechazado', 'Anulado', 'Fallido', 'Error'));

-- La conciliación busca los intentos en curso con el arrendamiento vencido.
DROP INDEX IX_IntentoPago_PorConciliar ON dbo.IntentoPago;
CREATE INDEX IX_IntentoPago_PorConciliar
    ON dbo.IntentoPago (ArrendadoHasta) INCLUDE (Estado, IDSesionCheckout)
    WHERE Estado IN ('Pendiente', 'Autorizado');
GO

CREATE TABLE dbo.SolicitudIdempotente (
    IDSolicitudIdempotente BIGINT IDENTITY(1,1) NOT NULL,
    IDUsuario              INT                  NOT NULL,
    LlaveIdempotencia      UNIQUEIDENTIFIER     NOT NULL,
    Operacion              VARCHAR(40)          NOT NULL,
    -- Detecta "misma llave, otro contenido" (422).
    HashSolicitud          BINARY(32)           NOT NULL,
    -- Lo necesario para devolver la misma respuesta.
    Respuesta              NVARCHAR(MAX)        NOT NULL,
    FechaCreacion          DATETIME2(3)         NOT NULL CONSTRAINT DF_SolicitudIdempotente_FechaCreacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_SolicitudIdempotente PRIMARY KEY (IDSolicitudIdempotente),
    -- Candado de idempotencia: la misma llave del mismo usuario no se procesa dos veces.
    CONSTRAINT UQ_SolicitudIdempotente_IDUsuarioLlave UNIQUE (IDUsuario, LlaveIdempotencia),
    CONSTRAINT FK_SolicitudIdempotente_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT CK_SolicitudIdempotente_Respuesta CHECK (ISJSON(Respuesta) = 1)
);

-- El job horario purga las llaves de más de 24 h.
CREATE INDEX IX_SolicitudIdempotente_Fecha ON dbo.SolicitudIdempotente (FechaCreacion);
GO
