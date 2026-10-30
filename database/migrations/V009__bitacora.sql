-- V009: bitácora de auditoría (02-modelo-datos.md §3.10, RF-09).
-- M-01: ledger append-only. La alimentan los triggers TR_*_Bitacora; ningún SP la modifica.

CREATE TABLE dbo.Bitacora (
    IDBitacora    BIGINT IDENTITY(1,1) NOT NULL,
    Modulo        VARCHAR(30)          NOT NULL,
    Entidad       VARCHAR(50)          NOT NULL,
    IDEntidad     VARCHAR(50)          NOT NULL,
    Accion        VARCHAR(20)          NOT NULL,
    ValorAnterior NVARCHAR(MAX)        NULL,
    ValorNuevo    NVARCHAR(MAX)        NULL,
    -- NULL = proceso del sistema (por ejemplo, un job).
    IDUsuario     INT                  NULL,
    RequestId     UNIQUEIDENTIFIER     NULL,
    Fecha         DATETIME2(3)         NOT NULL CONSTRAINT DF_Bitacora_Fecha DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Bitacora PRIMARY KEY (IDBitacora),
    CONSTRAINT FK_Bitacora_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT CK_Bitacora_Modulo CHECK (Modulo IN (
        'Catalogo', 'Inventario', 'Cupones', 'Pedidos', 'Envios', 'Usuarios', 'Configuracion')),
    CONSTRAINT CK_Bitacora_Accion CHECK (Accion IN (
        'Crear', 'Modificar', 'Desactivar', 'Activar', 'Eliminar', 'CambioEstado')),
    CONSTRAINT CK_Bitacora_ValorAnterior CHECK (ISJSON(ValorAnterior) = 1),
    CONSTRAINT CK_Bitacora_ValorNuevo CHECK (ISJSON(ValorNuevo) = 1)
) WITH (LEDGER = ON (APPEND_ONLY = ON));

CREATE INDEX IX_Bitacora_Modulo ON dbo.Bitacora (Modulo, Fecha DESC);
CREATE INDEX IX_Bitacora_Entidad ON dbo.Bitacora (Entidad, IDEntidad, Fecha DESC);
