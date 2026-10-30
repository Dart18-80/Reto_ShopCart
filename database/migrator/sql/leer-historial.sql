-- Última aplicación registrada de cada script (los R__ pueden tener varias).
SELECT  h.Script,
        h.Tipo,
        h.Checksum
FROM    dbo.HistorialMigracion AS h
WHERE   h.IDHistorialMigracion = (SELECT MAX(u.IDHistorialMigracion)
                                  FROM   dbo.HistorialMigracion AS u
                                  WHERE  u.Script = h.Script);
