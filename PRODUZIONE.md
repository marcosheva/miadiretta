# Backend sempre attivo (anche con Cursor chiuso)

## In locale: PM2

Per far continuare il download anche **chiudendo Cursor** (e il terminale), avvia il backend con **PM2**:

```bash
# Una tantum: installa PM2 (opzionale, puoi usare npx)
npm install -g pm2

# Dalla root del progetto
npm run server:pm2
```

Il backend resta in esecuzione in background. Ogni 2 minuti scarica live, upcoming e risultati degli ultimi 7 giorni.

**Comandi utili:**
- `npm run server:pm2:logs` — vedi i log
- `npm run server:pm2:stop` — ferma il backend
- `pm2 status` — stato di tutti i processi PM2

Poi avvia il frontend quando serve con `npm run client` (o `npm run dev` se vuoi anche il server nel terminale).

---

## In produzione: sì, scarica

In **produzione** (VPS, Railway, Render, ecc.) il backend è un processo che gira 24/7. La sync ogni 2 minuti continua sempre, quindi **sì, in produzione il backend continua a scaricare** risultati e partite.

- **MongoDB**: usa un database remoto (es. MongoDB Atlas) con `MONGODB_URI` in `.env`.
- **Variabili d’ambiente**: imposta `BETSAPI_TOKEN` e `MONGODB_URI` sul server.
- **Frontend**: dopo `npm run build`, servi la cartella `dist/` con un server statico o dallo stesso dominio del backend.

Se usi PM2 sul server:

```bash
NODE_ENV=production npm run server:pm2
```
