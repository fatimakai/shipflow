# Local PostgreSQL

The ShipFlow development database runs as PostgreSQL 18.4 through Docker
Compose. Docker Desktop or another Compose-compatible Docker engine must be
running before using these commands.

## Start and Inspect

Start PostgreSQL and wait for its health check:

```bash
docker compose up -d --wait postgres
docker compose ps
```

Inspect startup or query logs:

```bash
docker compose logs -f postgres
```

Verify the database directly:

```bash
docker compose exec postgres pg_isready -U shipflow -d shipflow
docker compose exec postgres psql -U shipflow -d shipflow -c "SELECT version();"
```

The database is available to host applications at `localhost:5432`. Override
the port and development credentials in the ignored local `.env` file when
needed.

## Stop, Restart, and Reset

Stop the services without deleting database data:

```bash
docker compose down
```

Restart PostgreSQL while keeping the named volume:

```bash
docker compose up -d --wait postgres
```

To intentionally destroy the local database and create a clean cluster:

```bash
docker compose down --volumes
docker compose up -d --wait postgres
```

`docker compose down --volumes` permanently deletes the local PostgreSQL
volume. Create a backup first when the data matters.

## Verify Persistence

Create a temporary marker, recreate the container, verify the marker, and then
remove it:

```bash
docker compose exec postgres psql -U shipflow -d shipflow -c "CREATE TABLE persistence_check (value text NOT NULL); INSERT INTO persistence_check VALUES ('present');"
docker compose down
docker compose up -d --wait postgres
docker compose exec postgres psql -U shipflow -d shipflow -c "SELECT * FROM persistence_check;"
docker compose exec postgres psql -U shipflow -d shipflow -c "DROP TABLE persistence_check;"
```

## Backup and Restore

Create a custom-format backup inside the container and copy it into the ignored
`backups` directory:

```bash
mkdir backups
docker compose exec postgres pg_dump -U shipflow -d shipflow --format=custom --file=/tmp/shipflow.dump
docker compose cp postgres:/tmp/shipflow.dump backups/shipflow.dump
```

Restore a backup into the local development database:

```bash
docker compose cp backups/shipflow.dump postgres:/tmp/shipflow.dump
docker compose exec postgres pg_restore -U shipflow -d shipflow --clean --if-exists /tmp/shipflow.dump
```

These commands are development conveniences. The provider-independent
production procedure and restore-safety requirements are documented in
[Production Baseline](production-baseline.md); automated off-site retention and
encryption remain deployment decisions.
