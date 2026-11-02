-- M-01: recalcula los hashes de las tablas ledger y de sus bloques y los compara con los digests guardados
-- fuera de la base (@Digests: arreglo JSON). Si una fila o un bloque cambió después de algún digest, lanza un
-- error y no devuelve el resultado.
EXEC sys.sp_verify_database_ledger @digests = @Digests;
