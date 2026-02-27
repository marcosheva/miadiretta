# Deploy su Render

1. **Push su GitHub** (se non l’hai già fatto):
   ```bash
   git add .
   git commit -m "Ready for Render"
   git push origin main
   ```

2. **Render**: vai su [render.com](https://render.com) → **New** → **Blueprint** e collega il repo. Oppure **New** → **Web Service**, repo `diretta`.

3. **Imposta le variabili d’ambiente** nel servizio:
   - `MONGODB_URI` = la tua connection string MongoDB (es. `mongodb+srv://...`)
   - `BETSAPI_TOKEN` = il token BetsAPI  
   Non serve `VITE_API_URL`: in produzione frontend e API sono sullo stesso host.

4. **Build & Start** (se usi il servizio manuale invece del Blueprint):
   - **Build command:** `npm install && npm run build && cd backend && npm install`
   - **Start command:** `cd backend && node server.js`
   - **Node version:** 20 (in Environment → Add Variable `NODE_VERSION` = `20`)

5. Dopo il deploy l’app sarà su `https://<nome-servizio>.onrender.com` (API, WebSocket e pagina Vue sullo stesso URL).
