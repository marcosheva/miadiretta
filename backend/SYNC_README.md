# Sync partite (BetsAPI → MongoDB)

Per popolare il DB con partite **live**, **in programma** e **risultati (ultimi 15 giorni)**:

```bash
# Dalla root del progetto (con .env in backend/ o nella root)
npm run sync
```

Oppure:

```bash
cd backend
node sync.js
```

**Variabili richieste** (in `backend/.env` o `.env` alla root):

- `BETSAPI_TOKEN` – token BetsAPI
- `MONGODB_URI` – connection string MongoDB

Dopo la sync, le partite del giorno 12 (e degli altri giorni richiesti) saranno nel DB e visibili nel sito (filtro **CONCLUSI** + data).

**In produzione (cron)** – eseguire periodicamente, ad esempio ogni 15 minuti:

```bash
0,15,30,45 * * * * cd /path/to/diretta && npm run sync
```

Oppure chiamare l’endpoint (se il server è avviato): `GET /api/sync` (avvia la sync in background).
