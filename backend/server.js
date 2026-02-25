const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const Match = require('./models/Match');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json());
// Loghi squadre locali (cartella team_images con file ID.png)
app.use('/team_images', express.static(path.join(__dirname, '..', 'team_images')));

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    setInterval(syncLiveOnly, LIVE_SYNC_INTERVAL_MS);
    syncLiveOnly(); // subito i live, senza aspettare la full sync
    syncFromAPI().then(() => {
      setInterval(syncFromAPI, FULL_SYNC_INTERVAL_MS);
    });
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Estrae punteggio da BetsAPI (ss può essere "1-2" o oggetto { "1": "0-1", "2": "1-2" } = HT/FT)
function parseScore(ss) {
  let homeScore = 0, awayScore = 0;
  if (!ss) return { homeScore, awayScore };
  let scoreStr = null;
  if (typeof ss === 'string') {
    scoreStr = ss.trim();
  } else if (typeof ss === 'object' && ss !== null) {
    const keys = Object.keys(ss).filter(k => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
    if (keys.length > 0) scoreStr = ss[String(keys[keys.length - 1])];
  }
  if (scoreStr && typeof scoreStr === 'string') {
    const parts = scoreStr.split(/[-:]/).map(s => parseInt(s.trim(), 10));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      homeScore = parts[0];
      awayScore = parts[1];
    }
  }
  return { homeScore, awayScore };
}

// Helper: da evento BetsAPI a oggetto match e salvataggio in DB
function buildMatchData(ev) {
  const { homeScore, awayScore } = parseScore(ev.ss);
  const eventId = ev.id != null ? String(ev.id) : '';
  return {
    eventId,
    sport: 'Football',
    league: ev.league?.name || 'Unknown League',
    leagueId: ev.league_id != null ? String(ev.league_id) : (ev.league?.id != null ? String(ev.league.id) : undefined),
    country: ev.cc?.toUpperCase() || (ev.league?.name?.split(' ')[0]?.toUpperCase() || 'UN'),
    startTime: new Date(parseInt(ev.time) * 1000),
    status: ev.timer ? 'LIVE' : (ev.ss && !ev.timer ? 'FINISHED' : 'SCHEDULED'),
    minute: ev.timer?.tm ? `${ev.timer.tm}'` : '',
    homeTeam: {
      name: ev.home?.name || 'Home',
      id: (ev.home?.image_id ?? ev.home?.id) != null ? String(ev.home.image_id ?? ev.home.id) : undefined,
      logo: ev.home?.image_id ? `https://assets.b365api.com/images/team/m/${ev.home.image_id}.png` : '',
      score: homeScore
    },
    awayTeam: {
      name: ev.away?.name || 'Away',
      id: (ev.away?.image_id ?? ev.away?.id) != null ? String(ev.away.image_id ?? ev.away.id) : undefined,
      logo: ev.away?.image_id ? `https://assets.b365api.com/images/team/m/${ev.away.image_id}.png` : '',
      score: awayScore
    }
  };
}

// Chiave "naturale" per evitare doppioni (stessa partita con eventId generico e FI)
function sameMatchKey(m) {
  const t = m.startTime ? new Date(m.startTime) : null;
  if (!t || !m.league || !m.homeTeam?.name || !m.awayTeam?.name) return null;
  const startMin = new Date(t);
  startMin.setMinutes(startMin.getMinutes() - 2);
  const startMax = new Date(t);
  startMax.setMinutes(startMax.getMinutes() + 2);
  return {
    league: m.league,
    'homeTeam.name': m.homeTeam.name,
    'awayTeam.name': m.awayTeam.name,
    startTime: { $gte: startMin, $lte: startMax }
  };
}

async function saveEventToDb(ev) {
  if (!ev.time) return;
  const matchData = buildMatchData(ev);
  const eid = matchData.eventId;
  if (!eid) return;
  const key = sameMatchKey(matchData);
  if (key) {
    const existing = await Match.findOne(key);
    if (existing) {
      const merged = { ...matchData, eventId: existing.eventId };
      if (existing.homeTeam?.logo && !merged.homeTeam?.logo) merged.homeTeam = { ...merged.homeTeam, logo: existing.homeTeam.logo };
      if (existing.awayTeam?.logo && !merged.awayTeam?.logo) merged.awayTeam = { ...merged.awayTeam, logo: existing.awayTeam.logo };
      if (existing.homeTeam?.id && !merged.homeTeam?.id) merged.homeTeam = { ...merged.homeTeam, id: existing.homeTeam.id };
      if (existing.awayTeam?.id && !merged.awayTeam?.id) merged.awayTeam = { ...merged.awayTeam, id: existing.awayTeam.id };
      await Match.findByIdAndUpdate(existing._id, merged);
      return;
    }
  }
  const query = /^\d+$/.test(eid) ? { $or: [{ eventId: eid }, { eventId: parseInt(eid, 10) }] } : { eventId: eid };
  await Match.findOneAndUpdate(query, { ...matchData, eventId: eid }, { upsert: true });
}

// Partite da bet365/upcoming: FI = id da usare in prematch (preferiamo ev.FI se c'è).
function buildMatchDataFromBet365(ev) {
  const id = (ev.FI != null && String(ev.FI).trim()) ? String(ev.FI) : (ev.id != null ? String(ev.id) : '');
  if (!id) return null;
  const t = ev.time != null ? parseInt(ev.time, 10) : (ev.start_time != null ? parseInt(ev.start_time, 10) : null);
  if (!t || isNaN(t)) return null;
  const time = t;
  return {
    eventId: id,
    sport: 'Football',
    league: ev.league?.name || 'Unknown League',
    leagueId: ev.league?.id != null ? String(ev.league.id) : (ev.league_id != null ? String(ev.league_id) : undefined),
    country: ev.cc?.toUpperCase() || (ev.league?.name?.split(' ')[0]?.toUpperCase() || 'UN'),
    startTime: new Date(time * 1000),
    status: 'SCHEDULED',
    minute: '',
    homeTeam: {
      name: ev.home?.name || 'Home',
      id: (ev.home?.image_id ?? ev.home?.id) != null ? String(ev.home.image_id ?? ev.home.id) : undefined,
      logo: (ev.home?.image_id || ev.home?.id) ? `https://assets.b365api.com/images/team/m/${ev.home?.image_id || ev.home?.id}.png` : '',
      score: 0
    },
    awayTeam: {
      name: ev.away?.name || 'Away',
      id: (ev.away?.image_id ?? ev.away?.id) != null ? String(ev.away.image_id ?? ev.away.id) : undefined,
      logo: (ev.away?.image_id || ev.away?.id) ? `https://assets.b365api.com/images/team/m/${ev.away?.image_id || ev.away?.id}.png` : '',
      score: 0
    }
  };
}

async function saveBet365UpcomingToDb(ev) {
  const matchData = buildMatchDataFromBet365(ev);
  if (!matchData) return;
  const eid = matchData.eventId;
  const key = sameMatchKey(matchData);
  if (key) {
    const existing = await Match.findOne(key);
    if (existing) {
      const merged = { ...matchData, eventId: eid };
      if (existing.homeTeam?.logo && !merged.homeTeam?.logo) merged.homeTeam = { ...merged.homeTeam, logo: existing.homeTeam.logo };
      if (existing.awayTeam?.logo && !merged.awayTeam?.logo) merged.awayTeam = { ...merged.awayTeam, logo: existing.awayTeam.logo };
      if (existing.homeTeam?.id && !merged.homeTeam?.id) merged.homeTeam = { ...merged.homeTeam, id: existing.homeTeam.id };
      if (existing.awayTeam?.id && !merged.awayTeam?.id) merged.awayTeam = { ...merged.awayTeam, id: existing.awayTeam.id };
      await Match.findByIdAndUpdate(existing._id, merged);
      return;
    }
  }
  const query = /^\d+$/.test(eid) ? { $or: [{ eventId: eid }, { eventId: parseInt(eid, 10) }] } : { eventId: eid };
  await Match.findOneAndUpdate(query, { ...matchData, eventId: eid }, { upsert: true });
}

// Recupera da BetsAPI il risultato finale di una partita (event/view) e aggiorna il DB
async function fetchAndSaveFinishedMatch(eventId) {
  const TOKEN = process.env.BETSAPI_TOKEN;
  if (!TOKEN) return false;
  try {
    const viewRes = await axios.get(`https://api.b365api.com/v1/event/view?event_id=${eventId}&token=${TOKEN}`);
    const ev = viewRes.data.results?.[0];
    if (ev && ev.time) {
      await saveEventToDb(ev);
      return true;
    }
  } catch (e) {
    // ignore: endpoint può fallire per eventi appena chiusi
  }
  return false;
}

// Sync solo LIVE: 1 richiesta, aggiorna punteggi/minuti e marca FINISHED chi non è più live
const LIVE_SYNC_INTERVAL_MS = 20 * 1000; // 20 secondi

async function syncLiveOnly() {
  const TOKEN = process.env.BETSAPI_TOKEN;
  if (!TOKEN) return;
  try {
    const inplayRes = await axios.get(`https://api.b365api.com/v1/events/inplay?sport_id=1&token=${TOKEN}`);
    const liveItems = inplayRes.data.results || [];
    const liveEventIds = new Set(liveItems.map(ev => String(ev.id)));

    const dbLiveMatches = await Match.find({ status: 'LIVE' });
    for (const dbMatch of dbLiveMatches) {
      if (dbMatch.eventId && !liveEventIds.has(dbMatch.eventId)) {
        // Aggiorna subito il risultato finale da BetsAPI invece di lasciare l'ultimo punteggio live
        const updated = await fetchAndSaveFinishedMatch(dbMatch.eventId);
        if (!updated) {
          dbMatch.status = 'FINISHED';
          await dbMatch.save();
        }
      }
    }

    for (const ev of liveItems) await saveEventToDb(ev);
    if (liveItems.length > 0) console.log(`Live sync: ${liveItems.length} partite aggiornate`);
  } catch (e) {
    console.error('Live sync error:', e.message);
  }
}

// Sync completa: inplay + upcoming + ended (per nuove partite e risultati finiti)
const FULL_SYNC_INTERVAL_MS = 2 * 60 * 1000; // 2 minuti (risultati ended più allineati a BetsAPI)
const UPCOMING_PAGES = 20; // pagine upcoming

async function syncFromAPI() {
  const TOKEN = process.env.BETSAPI_TOKEN;
  if (!TOKEN) {
    console.log('Skipping API sync: No BetsAPI Token provided');
    return;
  }

  try {
    const allEvents = [];
    const liveEventIds = new Set();

    try {
      const inplayRes = await axios.get(`https://api.b365api.com/v1/events/inplay?sport_id=1&token=${TOKEN}`);
      const liveItems = inplayRes.data.results || [];
      allEvents.push(...liveItems);
      liveItems.forEach(ev => liveEventIds.add(String(ev.id)));
    } catch (e) { console.error('Error fetching live:', e.message); }

    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Partite in programma da bet365/upcoming — id = FI (stesso da usare in prematch per le quote)
    try {
      let upcomingCount = 0;
      for (let page = 1; page <= UPCOMING_PAGES; page++) {
        await wait(400);
        const res = await axios.get(`https://api.b365api.com/v1/bet365/upcoming?sport_id=1&token=${TOKEN}&page=${page}`);
        const results = res.data.results || [];
        if (results.length === 0) break;
        for (const ev of results) {
          await saveBet365UpcomingToDb(ev);
          upcomingCount++;
        }
        if (results.length < 50) break;
      }
      if (upcomingCount > 0) console.log(`Upcoming (bet365 FI): ${upcomingCount} partite`);
    } catch (e) {
      console.error('Bet365 upcoming:', e.message);
    }

    // Ended: ultimi 15 giorni — sia UTC sia ora Italia (Europe/Rome) per non perdere risultati
    const ENDED_DAYS_BACK = 15;
    const ENDED_MAX_PAGES_PER_DAY = 100;
    const daysToRequest = new Set();
    const now = Date.now();
    for (let daysAgo = 0; daysAgo < ENDED_DAYS_BACK; daysAgo++) {
      const d = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
      daysToRequest.add(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`);
      const sRome = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });
      if (sRome) daysToRequest.add(sRome.replace(/-/g, ''));
    }
    for (const day of [...daysToRequest].sort()) {
      let dayTotal = 0;
      for (let page = 1; page <= ENDED_MAX_PAGES_PER_DAY; page++) {
        try {
          await wait(280);
          const endedRes = await axios.get(`https://api.b365api.com/v1/events/ended?sport_id=1&token=${TOKEN}&day=${day}&page=${page}`);
          const ended = endedRes.data.results || [];
          allEvents.push(...ended);
          dayTotal += ended.length;
          if (ended.length < 50) break;
        } catch (e) {
          if (page === 1) console.error('Error fetching ended day=', day, e.message);
          break;
        }
      }
      if (dayTotal > 0) console.log(`Ended day=${day}: ${dayTotal} eventi`);
    }

    // Ended per leghe prioritarie (Serie A ecc.) — stesso giorno in UTC
    const PRIORITY_LEAGUE_IDS = [199]; // 199 = Italy Serie A
    for (const leagueId of PRIORITY_LEAGUE_IDS) {
      for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - daysAgo);
        const day = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
        try {
          await wait(250);
          const res = await axios.get(`https://api.b365api.com/v1/events/ended?sport_id=1&token=${TOKEN}&day=${day}&league_id=${leagueId}`);
          const list = res.data.results || [];
          if (list.length > 0) {
            allEvents.push(...list);
            console.log(`Ended league ${leagueId} (${daysAgo}d fa): ${list.length} eventi`);
          }
        } catch (e) { /* ignore */ }
      }
    }

    const dbLiveMatches = await Match.find({ status: 'LIVE' });
    for (const dbMatch of dbLiveMatches) {
      if (dbMatch.eventId && !liveEventIds.has(dbMatch.eventId)) {
        const updated = await fetchAndSaveFinishedMatch(dbMatch.eventId);
        if (!updated) {
          dbMatch.status = 'FINISHED';
          await dbMatch.save();
        }
      }
    }

    // Recupero: partite ancora LIVE nel DB ma iniziate da più di 2.5 ore (es. server era spento quando è finita)
    const staleThreshold = new Date(Date.now() - 2.5 * 60 * 60 * 1000);
    const staleLive = await Match.find({ status: 'LIVE', startTime: { $lt: staleThreshold } });
    for (const m of staleLive) {
      if (m.eventId) {
        const updated = await fetchAndSaveFinishedMatch(m.eventId);
        if (updated) console.log(`Recuperato risultato finale: ${m.homeTeam?.name} - ${m.awayTeam?.name}`);
        await new Promise(r => setTimeout(r, 400));
      }
    }

    // Refresh risultati: TUTTE le partite FINISHED degli ultimi 15 giorni da BetsAPI
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    const finishedRecent = await Match.find({
      status: 'FINISHED',
      startTime: { $gte: fifteenDaysAgo },
      eventId: { $exists: true, $ne: null, $ne: '' }
    }).sort({ startTime: -1 });
    for (const m of finishedRecent) {
      if (m.eventId) {
        await fetchAndSaveFinishedMatch(m.eventId);
        await new Promise(r => setTimeout(r, 320));
      }
    }
    if (finishedRecent.length > 0) console.log(`Refresh risultati: ${finishedRecent.length} partite (ultimi 15 gg)`);

    console.log(`Full sync: ${allEvents.length} events`);
    for (const ev of allEvents) await saveEventToDb(ev);

    // Mappa bet365 FI (da bet365/upcoming) per prematch quote — FI = id in quella risposta
    try {
      const fiByKey = new Map();
      for (let page = 1; page <= 8; page++) {
        await wait(400);
        const b365Res = await axios.get(`https://api.b365api.com/v1/bet365/upcoming?sport_id=1&token=${TOKEN}&page=${page}`);
        const list = b365Res.data.results || [];
        if (list.length === 0) break;
        for (const ev of list) {
          const id = ev.id != null ? String(ev.id) : '';
          if (!id) continue;
          const home = (ev.home?.name || '').trim().toLowerCase();
          const away = (ev.away?.name || '').trim().toLowerCase();
          const league = (ev.league?.name || '').trim().toLowerCase();
          const t = ev.time ? new Date(parseInt(ev.time) * 1000) : null;
          const day = t ? `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}` : '';
          const key = `${league}|${home}|${away}|${day}`;
          fiByKey.set(key, id);
        }
        if (list.length < 50) break;
      }
      if (fiByKey.size > 0) {
        const matchesWithoutFi = await Match.find({ $or: [{ bet365FixtureId: { $exists: false } }, { bet365FixtureId: null }, { bet365FixtureId: '' }] }).limit(2000);
        let updated = 0;
        for (const match of matchesWithoutFi) {
          const home = (match.homeTeam?.name || '').trim().toLowerCase();
          const away = (match.awayTeam?.name || '').trim().toLowerCase();
          const league = (match.league || '').trim().toLowerCase();
          const d = match.startTime ? new Date(match.startTime) : null;
          const day = d ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}` : '';
          const key = `${league}|${home}|${away}|${day}`;
          const fi = fiByKey.get(key);
          if (fi) {
            match.bet365FixtureId = fi;
            await match.save();
            updated++;
          }
        }
        if (updated > 0) console.log(`Bet365 FI: aggiornati ${updated} match per quote prematch`);
      }
    } catch (e) {
      console.error('Bet365 upcoming (FI map):', e.message);
    }
  } catch (err) {
    console.error('Full sync error:', err.message);
  }
}


// Deduplica partite già in DB (stessa lega, squadre, orario): tiene una per gruppo
function dedupeMatches(matches) {
  const byKey = new Map();
  for (const m of matches) {
    const league = (m.league || '').trim();
    const home = (m.homeTeam?.name || '').trim();
    const away = (m.awayTeam?.name || '').trim();
    const t = m.startTime ? new Date(m.startTime).getTime() : 0;
    const key = `${league}|${home}|${away}|${t}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, m);
    } else {
      // Preferisci il doc con bet365FixtureId (per prematch) o con più dati
      const hasFi = (x) => (x.bet365FixtureId && String(x.bet365FixtureId).trim()) || /^\d+$/.test(String(x.eventId || ''));
      if (hasFi(m) && !hasFi(existing)) byKey.set(key, m);
    }
  }
  return [...byKey.values()];
}

// Routes
app.get('/api/matches', async (req, res) => {
  try {
    const { league, country, date } = req.query;
    const query = {};
    if (league) query.league = league;
    if (country) query.country = country.toUpperCase();
    
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.startTime = { $gte: startOfDay, $lte: endOfDay };
    }
    
    const raw = await Match.find(query).sort({ startTime: 1 });
    const matches = dedupeMatches(raw);
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/leagues', async (req, res) => {
  try {
    const leagues = await Match.aggregate([
      {
        $group: {
          _id: { country: "$country", league: "$league" },
          count: { $sum: 1 },
          leagueId: { $first: "$leagueId" }
        }
      },
      {
        $group: {
          _id: "$_id.country",
          leagues: { $push: { name: "$_id.league", count: "$count", leagueId: "$leagueId" } }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    res.json(leagues);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Verifica se la risposta API contiene una classifica utilizzabile dal frontend
function hasTableData(data) {
  if (!data) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (data.results != null) {
    const r = data.results;
    if (Array.isArray(r)) return r.length > 0;
    if (r && typeof r === 'object' && (Array.isArray(r.table) || Array.isArray(r.standings) || Array.isArray(r.total) || Array.isArray(r.overall))) return true;
    if (r && typeof r === 'object' && Object.keys(r).length > 0) return true;
  }
  if (data.table != null && (Array.isArray(data.table) || (typeof data.table === 'object' && (data.table.overall || data.table.total)))) return true;
  return false;
}

function tableErrorMessage(apiError) {
  const s = (apiError && String(apiError).toUpperCase()) || '';
  if (s.includes('PARAM_INVALID') || s.includes('INVALID_LEAGUE') || s.includes('NOT_FOUND')) {
    return 'Classifica non disponibile per questo campionato.';
  }
  if (apiError) return String(apiError);
  return 'Classifica non disponibile per questo campionato.';
}

async function fetchTableByLeagueId(TOKEN, leagueId) {
  const id = encodeURIComponent(String(leagueId));
  const urls = [
    `https://api.b365api.com/v3/league/table?token=${TOKEN}&league_id=${id}`,
    `https://api.b365api.com/v2/league/table?token=${TOKEN}&league_id=${id}`,
    `https://api.b365api.com/v1/league/table?token=${TOKEN}&league_id=${id}`
  ];
  for (const url of urls) {
    try {
      const apiRes = await axios.get(url);
      const data = apiRes.data;
      if (data && data.success === 0 && data.error) return { error: data.error };
      if (hasTableData(data)) return { data };
      return { error: 'Risposta senza classifica' };
    } catch (err) {
      const e = err.response?.data?.error || err.response?.data?.message || err.message;
      if (e) return { error: e };
    }
  }
  return { error: 'Classifica non disponibile' };
}

async function resolveLeagueIdByName(TOKEN, leagueName, country) {
  const cc = (country && String(country).toLowerCase().slice(0, 2)) || '';
  const url = `https://api.b365api.com/v1/league?token=${TOKEN}&sport_id=1${cc ? `&cc=${encodeURIComponent(cc)}` : ''}`;
  try {
    const apiRes = await axios.get(url);
    const results = apiRes.data?.results || apiRes.data?.league || [];
    const list = Array.isArray(results) ? results : Object.values(results);
    const want = (String(leagueName || '').trim().toLowerCase()).replace(/\s+/g, ' ');
    if (!want) return null;
    const match = list.find((l) => {
      const name = (l?.name ?? l?.league?.name ?? l?.title ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
      return name === want || name.includes(want) || want.includes(name);
    });
    const id = match?.id ?? match?.league_id ?? match?.league?.id;
    return id != null ? String(id) : null;
  } catch (e) {
    return null;
  }
}

app.get('/api/league/:leagueId/table', async (req, res) => {
  const TOKEN = process.env.BETSAPI_TOKEN;
  const { leagueId } = req.params;
  const leagueName = req.query.leagueName;
  const country = req.query.country;
  if (!TOKEN) {
    return res.status(400).json({ message: 'Token richiesto' });
  }
  if (!leagueId) {
    return res.status(400).json({ message: 'leagueId richiesto' });
  }

  let result = await fetchTableByLeagueId(TOKEN, leagueId);
  if (result.data) return res.json(result.data);
  const firstError = result.error;

  const isParamInvalid = firstError && String(firstError).toUpperCase().includes('PARAM_INVALID');
  if (isParamInvalid && leagueName && TOKEN) {
    const resolvedId = await resolveLeagueIdByName(TOKEN, leagueName, country);
    if (resolvedId && resolvedId !== String(leagueId)) {
      result = await fetchTableByLeagueId(TOKEN, resolvedId);
      if (result.data) return res.json(result.data);
    }
  }

  res.status(400).json({ message: tableErrorMessage(result.error || firstError) });
});

app.get('/api/matches/live', async (req, res) => {
  try {
    const raw = await Match.find({ status: 'LIVE' }).sort({ startTime: 1 });
    res.json(dedupeMatches(raw));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/match/:id', async (req, res) => {
  try {
    const TOKEN = process.env.BETSAPI_TOKEN;
    const match = await Match.findOne({ eventId: req.params.id });
    if (!match) return res.status(404).json({ message: 'Match not found' });

    // Fetch timeline from BetsAPI if needed
    if (TOKEN && (match.status === 'LIVE' || (match.status === 'FINISHED' && (!match.events || match.events.length === 0)))) {
      try {
        const viewRes = await axios.get(`https://api.b365api.com/v1/event/view?event_id=${match.eventId}&token=${TOKEN}`);
        const result = viewRes.data.results?.[0];
        if (result && result.events) {
          const homeName = match.homeTeam.name.toLowerCase();
          const awayName = match.awayTeam.name.toLowerCase();

          match.events = result.events.map(ev => {
            const rawText = ev.text || '';
            const timeMatch = rawText.match(/^([0-9'+]+)/);
            const time = timeMatch ? timeMatch[1].replace("'", "") : '';
            
            let type = 'unknown';
            if (rawText.toLowerCase().includes('goal')) type = 'goal';
            else if (rawText.toLowerCase().includes('card')) type = 'card';
            else if (rawText.toLowerCase().includes('substitut')) type = 'sub';
            else if (rawText.toLowerCase().includes('var')) type = 'var';
            
            // Skip non-events like "Score After..."
            if (!time && !rawText.includes('Goal')) return null;

            let side = 'home';
            if (rawText.toLowerCase().includes(awayName)) side = 'away';
            else if (rawText.toLowerCase().includes(homeName)) side = 'home';
            else {
              // Fallback: try to see if it's the 2nd team mentioned if we can't find exact names
              // but usually BetsAPI includes the team name in parentheses
            }

            // Extract score if present in text (e.g. "Score After Full Time - 5-1" or in some goal texts)
            const scoreMatch = rawText.match(/([0-9]+-[0-9]+)/);
            const score = scoreMatch ? scoreMatch[1] : '';

            return {
              time,
              type,
              main_text: rawText,
              side,
              score
            };
          }).filter(e => e !== null);
          await match.save();
        }
        if (result && (result.main_odds || result.odds)) {
          const main = result.main_odds || result.odds;
          const arr = Array.isArray(main) ? main : [];
          const one = arr.find(o => /home|1|casa/i.test(String(o.NA || o.name || '')));
          const draw = arr.find(o => /draw|x|pareggio/i.test(String(o.NA || o.name || '')));
          const two = arr.find(o => /away|2|trasferta/i.test(String(o.NA || o.name || '')));
          const od = (x) => (x && (x.OD ?? x.odd ?? x.odds != null)) ? (x.OD ?? x.odd ?? x.odds) : null;
          if (od(one) != null || od(draw) != null || od(two) != null) {
            match.odds = { home: od(one), draw: od(draw), away: od(two) };
            await match.save();
          }
        }
      } catch (e) { }
    }
    if (TOKEN && (!match.odds || (match.odds?.home == null && match.odds?.draw == null && match.odds?.away == null))) {
      try {
        const viewRes = await axios.get(`https://api.b365api.com/v1/event/view?event_id=${match.eventId}&token=${TOKEN}`);
        const result = viewRes.data.results?.[0];
        if (result && (result.main_odds || result.odds)) {
          const main = result.main_odds || result.odds;
          const arr = Array.isArray(main) ? main : [];
          const one = arr.find(o => /home|1|casa/i.test(String(o.NA || o.name || '')));
          const draw = arr.find(o => /draw|x|pareggio/i.test(String(o.NA || o.name || '')));
          const two = arr.find(o => /away|2|trasferta/i.test(String(o.NA || o.name || '')));
          const od = (x) => (x && (x.OD ?? x.odd ?? x.odds != null)) ? (x.OD ?? x.odd ?? x.odds) : null;
          if (od(one) != null || od(draw) != null || od(two) != null) {
            match.odds = { home: od(one), draw: od(draw), away: od(two) };
            await match.save();
          }
        }
      } catch (e) { }
    }
    res.json(match);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Estrae valore quota da numero/stringa o da oggetto BetsAPI (es. { OD: "1.85" })
// Converte anche frazioni bet365 (es. "2/1" -> 3.0)
function toOddVal(v) {
  if (v == null) return null;
  if (typeof v === 'object') v = v.OD ?? v.odd ?? v.odds ?? v.value ?? null;
  if (v == null) return null;
  const s = String(v).trim();
  if (s.includes('/')) {
    const [a, b] = s.split('/').map(x => parseFloat(x.trim()));
    if (!Number.isNaN(a) && !Number.isNaN(b) && b !== 0) return (a / b + 1).toFixed(2);
  }
  const n = Number(v);
  return Number.isNaN(n) ? v : n;
}

// Raccoglie mercati da un array (id, odds object)
function parseMarketsArray(markets, out) {
  if (!Array.isArray(markets)) return;
  for (const m of markets) {
    const id = (m.id || m.market_id || '').toString();
    const odds = m.odds || m;
    if (id === '1_1' || id === '1') {
      const one = odds['1'] ?? odds['Home'] ?? odds['home'];
      const x = odds['X'] ?? odds['Draw'] ?? odds['draw'];
      const two = odds['2'] ?? odds['Away'] ?? odds['away'];
      if (one != null || x != null || two != null) out.main = { 1: toOddVal(one), X: toOddVal(x), 2: toOddVal(two) };
    } else if ((id === '1_3' || id === '3') && !out.overUnder25) {
      const keys = Object.keys(odds);
      const overKey = keys.find(k => /over\s*2\.?5|o\s*2\.?5/i.test(k));
      const underKey = keys.find(k => /under\s*2\.?5|u\s*2\.?5/i.test(k));
      const over = overKey ? odds[overKey] : (odds['Over 2.5'] ?? odds['Over'] ?? odds['O2.5']);
      const under = underKey ? odds[underKey] : (odds['Under 2.5'] ?? odds['Under'] ?? odds['U2.5']);
      if (over != null || under != null) out.overUnder25 = { over: toOddVal(over), under: toOddVal(under) };
    } else if ((id === '1_8' || id === '8') && !out.btts) {
      const yes = odds['Yes'] ?? odds['GG'] ?? odds['yes'];
      const no = odds['No'] ?? odds['NG'] ?? odds['no'];
      if (yes != null || no != null) out.btts = { yes: toOddVal(yes), no: toOddVal(no) };
    }
  }
}

// Quote da risposta BetsAPI v2 event/odds (results = oggetto bookmaker o array)
function normalizeOddsFromBetsAPI(data) {
  const out = { main: null, overUnder25: null, btts: null };
  if (!data) return out;
  const results = data.results;
  if (!results) return out;

  // results = { bet365: { odds: [ { id: "1_1", odds: {...} } ] } } (oggetto per bookmaker)
  if (typeof results === 'object' && !Array.isArray(results)) {
    for (const key of Object.keys(results)) {
      const book = results[key];
      const arr = book?.odds || book;
      if (Array.isArray(arr)) parseMarketsArray(arr, out);
      else if (arr && typeof arr === 'object') parseMarketsArray([arr], out);
    }
  } else if (Array.isArray(results)) {
    parseMarketsArray(results, out);
  }

  const oddsRef = results.odds || results;
  if (Array.isArray(oddsRef)) parseMarketsArray(oddsRef, out);

  // results.odds = array diretto
  if (!out.main && results.odds && Array.isArray(results.odds)) parseMarketsArray(results.odds, out);

  // Fallback: risultati con chiavi 1_1, 1_3 (oggetto piatto)
  const flat = results.odds || results;
  if (flat && typeof flat === 'object' && !Array.isArray(flat)) {
    const m1 = flat['1_1'] || flat['1'];
    if (!out.main && m1 && typeof m1 === 'object' && (m1['1'] != null || m1['X'] != null || m1['2'] != null)) {
      out.main = { 1: toOddVal(m1['1'] ?? m1['Home']), X: toOddVal(m1['X'] ?? m1['Draw']), 2: toOddVal(m1['2'] ?? m1['Away']) };
    }
    const m3 = flat['1_3'] || flat['3'];
    if (!out.overUnder25 && m3 && typeof m3 === 'object') {
      const over = m3['Over 2.5'] ?? m3['Over'] ?? m3['O2.5'];
      const under = m3['Under 2.5'] ?? m3['Under'] ?? m3['U2.5'];
      if (over != null || under != null) out.overUnder25 = { over: toOddVal(over), under: toOddVal(under) };
    }
    const m8 = flat['1_8'] || flat['8'];
    if (!out.btts && m8 && typeof m8 === 'object' && (m8['Yes'] != null || m8['No'] != null)) {
      out.btts = { yes: toOddVal(m8['Yes']), no: toOddVal(m8['No']) };
    }
  }
  return out;
}

// Estrae Over/Under 2.5 da array piatto tipo v3 (PA con NA "Over 2.5" / "Under 2.5", OD)
function extractOverUnder25FromFlatList(arr) {
  if (!Array.isArray(arr)) return null;
  let over = null, under = null;
  for (const o of arr) {
    if (!o || typeof o !== 'object') continue;
    const na = String(o.NA ?? o.name ?? o.header ?? '').trim();
    const od = o.OD ?? o.odds ?? o.odd;
    if (/over\s*2\.?5|over\s*2,5/i.test(na)) over = od;
    else if (/under\s*2\.?5|under\s*2,5/i.test(na)) under = od;
  }
  if (over != null || under != null) return { over: toOddVal(over), under: toOddVal(under) };
  return null;
}

// Quote da bet365 prematch (v4/v3) — risultati con asian_lines, main, o lista piatta MG/MA/PA
function normalizeOddsFromPrematch(data) {
  const out = { main: null, overUnder25: null, btts: null };
  if (!data) return out;

  // v3: risposta può essere array di oggetti { type, NA, OD } (mercato 1_3 = Over/Under 2.5)
  const flat = data.results ?? data.events ?? data.pre_match ?? data;
  const flatArr = Array.isArray(flat) ? flat : (flat && typeof flat === 'object' && !Array.isArray(flat) ? Object.values(flat) : []);
  if (flatArr.length > 0) {
    const ou = extractOverUnder25FromFlatList(flatArr);
    if (ou) out.overUnder25 = ou;
    // Se results è array di array (un livello più interno)
    if (!out.overUnder25 && flatArr[0] && Array.isArray(flatArr[0])) {
      for (const sub of flatArr) {
        const ou2 = extractOverUnder25FromFlatList(sub);
        if (ou2) { out.overUnder25 = ou2; break; }
      }
    }
  }

  let results = data.results;
  if (!results) results = flatArr.length ? flatArr : [];
  if (!Array.isArray(results)) results = Object.keys(results).length ? [results[Object.keys(results)[0]]] : [];
  if (results.length === 0 && !out.overUnder25) return out;

  for (const item of results) {
    if (!item || typeof item !== 'object') continue;

    // Over/Under 2.5: asian_lines.sp.goal_line.odds[] con name "2.5", header "Over" / "Under"
    if (!out.overUnder25) {
      const goalLine = item.asian_lines?.sp?.goal_line || item.goal_line;
      if (goalLine?.odds) {
        const arr = Array.isArray(goalLine.odds) ? goalLine.odds : [];
        let over = null, under = null;
        for (const o of arr) {
          const name = String(o.name ?? o.header ?? '').trim().replace(',', '.');
          const header = String(o.header ?? o.name ?? '').trim().toLowerCase();
          if (name.includes('2.5')) {
            if (header === 'over') over = o.odds ?? o.OD;
            else if (header === 'under') under = o.odds ?? o.OD;
          }
        }
        if (over != null || under != null) out.overUnder25 = { over: toOddVal(over), under: toOddVal(under) };
      }
    }
    // Over/Under in item con struttura .sp o .main (goal_line / over_under)
    if (!out.overUnder25 && item.sp) {
      const ouSp = item.sp.goal_line || item.sp.over_under_25 || item.sp.over_under;
      if (ouSp?.odds && Array.isArray(ouSp.odds)) {
        const ou = extractOverUnder25FromFlatList(ouSp.odds);
        if (ou) out.overUnder25 = ou;
      }
    }
    if (!out.overUnder25 && item.main?.sp) {
      const ouSp = item.main.sp.goal_line || item.main.sp.over_under_25;
      if (ouSp?.odds && Array.isArray(ouSp.odds)) {
        const ou = extractOverUnder25FromFlatList(ouSp.odds);
        if (ou) out.overUnder25 = ou;
      }
    }

    // 1X2: main.sp.full_time_result.odds[] con name "1", "Draw", "2"
    if (!out.main && item.main?.sp?.full_time_result?.odds) {
      const arr = item.main.sp.full_time_result.odds;
      if (Array.isArray(arr)) {
        const one = arr.find(o => String(o.name || o.header || '').trim() === '1');
        const draw = arr.find(o => /draw|pareggio|x/i.test(String(o.name || o.header || '').trim()));
        const two = arr.find(o => String(o.name || o.header || '').trim() === '2');
        if (one || draw || two) {
          out.main = {
            1: toOddVal(one?.odds ?? one),
            X: toOddVal(draw?.odds ?? draw),
            2: toOddVal(two?.odds ?? two)
          };
        }
      }
    }

    if (!out.main && item.main) {
      const m = item.main;
      if (Array.isArray(m.odds)) {
        const one = m.odds.find(o => String(o.header || o.name || o.id || '').trim() === '1' || /home|casa/i.test(String(o.header || o.name || '')));
        const draw = m.odds.find(o => String(o.header || o.name || o.id || '').trim().toUpperCase() === 'X' || /draw|pareggio/i.test(String(o.header || o.name || '')));
        const two = m.odds.find(o => String(o.header || o.name || o.id || '').trim() === '2' || /away|trasferta/i.test(String(o.header || o.name || '')));
        if (one || draw || two) out.main = { 1: toOddVal(one?.odds ?? one), X: toOddVal(draw?.odds ?? draw), 2: toOddVal(two?.odds ?? two) };
      } else if (m['1'] != null || m['X'] != null || m['2'] != null || m.Home != null || m.Draw != null || m.Away != null) {
        out.main = { 1: toOddVal(m['1'] ?? m.Home), X: toOddVal(m['X'] ?? m.Draw), 2: toOddVal(m['2'] ?? m.Away) };
      }
    }

    if (!out.main && item.sp) {
      const mainSp = item.sp.full_time_result || item.sp.main || item.sp.main_market || item.sp.match_result;
      if (mainSp && Array.isArray(mainSp.odds)) {
        const one = mainSp.odds.find(o => String(o.name || o.header || '').trim() === '1');
        const draw = mainSp.odds.find(o => /draw|pareggio|x/i.test(String(o.name || o.header || '').trim()));
        const two = mainSp.odds.find(o => String(o.name || o.header || '').trim() === '2');
        if (one || draw || two) out.main = { 1: toOddVal(one?.odds ?? one), X: toOddVal(draw?.odds ?? draw), 2: toOddVal(two?.odds ?? two) };
      }
    }

    // Gol / No Gol: main.sp.both_teams_to_score.odds[] con name "Yes", "No"
    const btts = item.main?.sp?.both_teams_to_score || item.sp?.both_teams_to_score;
    if (!out.btts && btts?.odds && Array.isArray(btts.odds)) {
      const yes = btts.odds.find(o => /^yes$/i.test(String(o.name || o.header || '').trim()));
      const no = btts.odds.find(o => /^no$/i.test(String(o.name || o.header || '').trim()));
      if (yes || no) out.btts = { yes: toOddVal(yes?.odds ?? yes), no: toOddVal(no?.odds ?? no) };
    }
  }

  // Fallback: parser generico (mercati in .markets / .MA / .main)
  const list = Array.isArray(results) ? results : [];
  const items = list.length ? list : (data.events || data.pre_match || []);
  if (!Array.isArray(items)) return out;
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const markets = item.markets || item.MA || item.main || item.odds || [];
    const mList = Array.isArray(markets) ? markets : (typeof markets === 'object' ? Object.values(markets) : []);
    // v3: Over/Under può essere lista di PA (NA "Over 2.5" / "Under 2.5", OD) nello stesso blocco
    if (!out.overUnder25 && mList.some(m => m && /over\s*2\.?5|under\s*2\.?5/i.test(String(m.NA || m.name || '')))) {
      const ou = extractOverUnder25FromFlatList(mList);
      if (ou) out.overUnder25 = ou;
    }
    for (const m of mList) {
      if (!m || typeof m !== 'object') continue;
      const name = (m.name || m.NA || m.type || m.id || '').toString().toLowerCase();
      const participants = m.participants || m.PA || m.odds || m.options || [];
      const pList = Array.isArray(participants) ? participants : (typeof participants === 'object' ? Object.values(participants) : []);
      if (!out.main && (name.includes('fulltime') || name.includes('1x2') || name.includes('match result') || name === '1_1' || name === '1')) {
        const one = pList.find(p => /^1$|home| casa/i.test((p.NA || p.name || p.label || p.id || '').toString()));
        const draw = pList.find(p => /^x$|draw|pareggio/i.test((p.NA || p.name || p.label || p.id || '').toString()));
        const two = pList.find(p => /^2$|away|trasferta/i.test((p.NA || p.name || p.label || p.id || '').toString()));
        if (one || draw || two) out.main = { 1: toOddVal(one), X: toOddVal(draw), 2: toOddVal(two) };
      } else if (!out.overUnder25 && ((name.includes('over') && name.includes('under')) || name.includes('2.5') || name.includes('goals') || name === '1_3' || name === '3')) {
        const over = pList.find(p => /over|sopra|o\s*2\.?5/i.test((p.NA || p.name || p.label || '').toString()));
        const under = pList.find(p => /under|sotto|u\s*2\.?5/i.test((p.NA || p.name || p.label || '').toString()));
        if (over || under) out.overUnder25 = { over: toOddVal(over), under: toOddVal(under) };
      } else if (!out.btts && (name.includes('both team') || name.includes('gol no gol') || name.includes('btts') || name === '1_8' || name === '8')) {
        const yes = pList.find(p => /yes|gol|gg/i.test((p.NA || p.name || p.label || '').toString()));
        const no = pList.find(p => /no|ng/i.test((p.NA || p.name || p.label || '').toString()));
        if (yes || no) out.btts = { yes: toOddVal(yes), no: toOddVal(no) };
      }
    }
    if (item.main && typeof item.main === 'object' && !out.main) {
      const m = item.main;
      if (m['1'] != null || m['X'] != null || m['2'] != null || m.Home != null || m.Draw != null || m.Away != null) {
        out.main = { 1: toOddVal(m['1'] ?? m.Home), X: toOddVal(m['X'] ?? m.Draw), 2: toOddVal(m['2'] ?? m.Away) };
      }
    }
  }
  return out;
}

// Quote da event/view (main_odds con NA/OD)
function oddsFromEventView(ev) {
  const out = { main: null, overUnder25: null, btts: null };
  const main = ev?.main_odds || ev?.odds;
  if (!main || !Array.isArray(main)) return out;
  const one = main.find(o => (o.NA || o.name || '').toString().toLowerCase().includes('home') || (o.NA || o.name) === '1');
  const draw = main.find(o => (o.NA || o.name || '').toString().toLowerCase().includes('draw') || (o.NA || o.name) === 'X');
  const two = main.find(o => (o.NA || o.name || '').toString().toLowerCase().includes('away') || (o.NA || o.name) === '2');
  const od = (x) => (x && (x.OD ?? x.odd ?? x.odds != null)) ? toOddVal(x) : null;
  if (od(one) != null || od(draw) != null || od(two) != null) {
    out.main = { 1: od(one), X: od(draw), 2: od(two) };
  }
  return out;
}

app.get('/api/match/:id/odds', async (req, res) => {
  try {
    const TOKEN = process.env.BETSAPI_TOKEN;
    const eventId = req.params.id;
    if (!TOKEN || !eventId) return res.status(400).json({ message: 'Token e event_id richiesti' });

    const matchForFi = await Match.findOne({ $or: [{ eventId }, { eventId: parseInt(eventId, 10) }] });

    // Risposta da cache MongoDB (veloce)
    let normalized = { main: null, overUnder25: null, btts: null };
    if (matchForFi) {
      if (matchForFi.odds && (matchForFi.odds.home != null || matchForFi.odds.draw != null || matchForFi.odds.away != null)) {
        normalized.main = { 1: matchForFi.odds.home, X: matchForFi.odds.draw, 2: matchForFi.odds.away };
      }
      if (matchForFi.oddsOverUnder25 && (matchForFi.oddsOverUnder25.over != null || matchForFi.oddsOverUnder25.under != null)) {
        normalized.overUnder25 = { over: matchForFi.oddsOverUnder25.over, under: matchForFi.oddsOverUnder25.under };
      }
      if (matchForFi.oddsBtts && (matchForFi.oddsBtts.yes != null || matchForFi.oddsBtts.no != null)) {
        normalized.btts = { yes: matchForFi.oddsBtts.yes, no: matchForFi.oddsBtts.no };
      }
      if (normalized.main || normalized.overUnder25 || normalized.btts) {
        return res.json(normalized);
      }
    }

    const fi = (matchForFi?.bet365FixtureId && String(matchForFi.bet365FixtureId).trim()) || eventId;

    // Cache vuota: fetch da API e salva in DB
    for (const version of ['v4', 'v3']) {
      try {
        const url = `https://api.b365api.com/${version}/bet365/prematch?token=${TOKEN}&FI=${fi}`;
        const apiRes = await axios.get(url);
        const fromPrematch = normalizeOddsFromPrematch(apiRes.data);
        if (fromPrematch.main) normalized.main = fromPrematch.main;
        if (fromPrematch.overUnder25) normalized.overUnder25 = fromPrematch.overUnder25;
        if (fromPrematch.btts) normalized.btts = fromPrematch.btts;
        if (normalized.main || normalized.overUnder25 || normalized.btts) break;
      } catch (e) {
        // ignore
      }
    }

    if (!normalized.main && !normalized.overUnder25 && !normalized.btts) {
      try {
        const url = `https://api.b365api.com/v2/event/odds?event_id=${eventId}&token=${TOKEN}`;
        const apiRes = await axios.get(url);
        normalized = normalizeOddsFromBetsAPI(apiRes.data);
      } catch (e) {
        // ignore
      }
    }

    if (!normalized.main && !normalized.overUnder25 && !normalized.btts) {
      try {
        const viewRes = await axios.get(`https://api.b365api.com/v1/event/view?event_id=${eventId}&token=${TOKEN}`);
        const ev = viewRes.data.results?.[0];
        if (ev) {
          const fromView = oddsFromEventView(ev);
          if (fromView.main) normalized.main = fromView.main;
          if (fromView.overUnder25) normalized.overUnder25 = fromView.overUnder25;
          if (fromView.btts) normalized.btts = fromView.btts;
        }
      } catch (e) {
        // ignore
      }
    }

    if (!normalized.main && matchForFi?.odds && (matchForFi.odds.home != null || matchForFi.odds.draw != null || matchForFi.odds.away != null)) {
      normalized.main = { 1: matchForFi.odds.home, X: matchForFi.odds.draw, 2: matchForFi.odds.away };
    }

    // Salva in MongoDB per le prossime richieste
    if (matchForFi && (normalized.main || normalized.overUnder25 || normalized.btts)) {
      const toSet = {};
      if (normalized.main) toSet.odds = { home: normalized.main['1'], draw: normalized.main['X'], away: normalized.main['2'] };
      if (normalized.overUnder25) toSet.oddsOverUnder25 = { over: normalized.overUnder25.over, under: normalized.overUnder25.under };
      if (normalized.btts) toSet.oddsBtts = { yes: normalized.btts.yes, no: normalized.btts.no };
      await Match.updateOne({ _id: matchForFi._id }, { $set: toSet });
    }

    res.json(normalized);
  } catch (err) {
    if (err.response?.status === 404) return res.status(404).json({ message: 'Quote non disponibili' });
    res.status(500).json({ message: err.message || 'Errore quote' });
  }
});

// Sync Endpoint for Vercel Cron
app.get('/api/sync', async (req, res) => {
  try {
    console.log('Manual/Cron sync triggered');
    await syncFromAPI();
    res.json({ message: 'Sync started' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  }).on('error', (err) => {
    console.error('Server failed to start:', err);
  });
}

module.exports = app;
