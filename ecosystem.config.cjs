/**
 * PM2: avvia il backend in modo che continui a scaricare anche chiudendo Cursor/terminale.
 * Uso: dalla root del progetto →  npx pm2 start ecosystem.config.cjs
 * Comandi utili: pm2 status | pm2 logs | pm2 stop diretta-backend
 */
module.exports = {
  apps: [
    {
      name: 'diretta-backend',
      cwd: './backend',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      env: { NODE_ENV: 'development' },
      env_production: { NODE_ENV: 'production' }
    }
  ]
};
