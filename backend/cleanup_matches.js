const path = require('path');
const mongoose = require('mongoose');
const Match = require('./models/Match');

// Carica .env da backend/ o dalla root del progetto
require('dotenv').config({ path: path.join(__dirname, '.env') });
if (!process.env.MONGODB_URI) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI non trovato. Imposta .env con MONGODB_URI=...');
  process.exit(1);
}

// Stessa logica di bucket/dedup usata nel server (league + squadre + startTime arrotondato)
function dedupeKey(m) {
  if (!m) return null;
  const league = (m.league || '').trim();
  const home = (m.homeTeam?.name || '').trim();
  const away = (m.awayTeam?.name || '').trim();
  const t = m.startTime ? new Date(m.startTime).getTime() : 0;
  if (!league || !home || !away || !t) return null;
  const bucket = Math.round(t / (2 * 60 * 1000)); // 2 minuti
  return `${league}|${home}|${away}|${bucket}`;
}

// Stessa priorità del server: LIVE > FINISHED > SCHEDULED, poi più eventi, poi chi ha bet365FixtureId
function pickBetter(a, b) {
  if (!a) return b;
  if (!b) return a;
  const order = (x) => (x.status === 'LIVE' ? 3 : x.status === 'FINISHED' ? 2 : 1);
  const sa = order(a);
  const sb = order(b);
  if (sa !== sb) return sa > sb ? a : b;
  const evA = Array.isArray(a.events) ? a.events.length : 0;
  const evB = Array.isArray(b.events) ? b.events.length : 0;
  if (evA !== evB) return evA > evB ? a : b;
  const hasFi = (x) => x && x.bet365FixtureId && String(x.bet365FixtureId).trim();
  if (hasFi(a) && !hasFi(b)) return a;
  if (hasFi(b) && !hasFi(a)) return b;
  // In ultima istanza tieni il più recente
  const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
  const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
  return ta >= tb ? a : b;
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB for cleanup');

  const all = await Match.find({}).lean();
  console.log(`Trovati ${all.length} documenti Match`);

  const bestByKey = new Map();
  const idsByKey = new Map();

  for (const m of all) {
    const key = dedupeKey(m);
    if (!key) continue;
    const currentBest = bestByKey.get(key);
    const chosen = pickBetter(currentBest, m);
    bestByKey.set(key, chosen);
    const list = idsByKey.get(key) || [];
    list.push(m._id);
    idsByKey.set(key, list);
  }

  const toDelete = [];
  for (const [key, best] of bestByKey.entries()) {
    const list = idsByKey.get(key) || [];
    for (const id of list) {
      if (String(id) !== String(best._id)) {
        toDelete.push(id);
      }
    }
  }

  console.log(`Partite duplicate da eliminare: ${toDelete.length}`);

  if (toDelete.length > 0) {
    const res = await Match.deleteMany({ _id: { $in: toDelete } });
    console.log(`Eliminati ${res.deletedCount} documenti duplicati`);
  }

  // Backfill loghi mancanti dai dati BetsAPI (id -> URL CDN)
  const missingLogos = await Match.find({
    $or: [
      { 'homeTeam.id': { $ne: null }, 'homeTeam.logo': { $in: [null, ''] } },
      { 'awayTeam.id': { $ne: null }, 'awayTeam.logo': { $in: [null, ''] } }
    ]
  });

  console.log(`Partite con loghi mancanti da sistemare: ${missingLogos.length}`);

  let updatedLogos = 0;
  for (const m of missingLogos) {
    let changed = false;
    if (m.homeTeam && m.homeTeam.id && (!m.homeTeam.logo || m.homeTeam.logo === '')) {
      m.homeTeam.logo = `https://assets.b365api.com/images/team/m/${m.homeTeam.id}.png`;
      changed = true;
    }
    if (m.awayTeam && m.awayTeam.id && (!m.awayTeam.logo || m.awayTeam.logo === '')) {
      m.awayTeam.logo = `https://assets.b365api.com/images/team/m/${m.awayTeam.id}.png`;
      changed = true;
    }
    if (changed) {
      // eslint-disable-next-line no-await-in-loop
      await m.save();
      updatedLogos++;
    }
  }

  console.log(`Loghi aggiornati per ${updatedLogos} partite`);

  await mongoose.disconnect();
  console.log('Cleanup completato');
  process.exit(0);
}

run().catch((err) => {
  console.error('Errore durante cleanup:', err);
  process.exit(1);
});

