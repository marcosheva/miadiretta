const express = require('express');
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

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    syncFromAPI().then(() => {
      setInterval(syncLiveOnly, LIVE_SYNC_INTERVAL_MS);
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
      logo: ev.home?.image_id ? `https://assets.b365api.com/images/team/m/${ev.home.image_id}.png` : '',
      score: homeScore
    },
    awayTeam: {
      name: ev.away?.name || 'Away',
      logo: ev.away?.image_id ? `https://assets.b365api.com/images/team/m/${ev.away.image_id}.png` : '',
      score: awayScore
    }
  };
}

async function saveEventToDb(ev) {
  if (!ev.time) return;
  const matchData = buildMatchData(ev);
  const eid = matchData.eventId;
  if (!eid) return;
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
    const liveEventIds = new Set(liveItems.map(ev => ev.id));

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
      liveItems.forEach(ev => liveEventIds.add(ev.id));
    } catch (e) { console.error('Error fetching live:', e.message); }

    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    for (let page = 1; page <= UPCOMING_PAGES; page++) {
      try {
        await wait(500);
        const res = await axios.get(`https://api.b365api.com/v1/events/upcoming?sport_id=1&token=${TOKEN}&page=${page}`);
        const results = res.data.results || [];
        if (results.length === 0) break;
        allEvents.push(...results);
        if (results.length < 50) break;
      } catch (e) { break; }
    }

    // Ended: oggi + fino a 6 giorni fa, con paginazione (fino a 100 pagine/giorno = ~5000 partite)
    // Serie A e altre leghe possono essere in pagine alte: 25 non bastavano
    const ENDED_DAYS_BACK = 7;
    const ENDED_MAX_PAGES_PER_DAY = 100;  // max BetsAPI, così non perdiamo leghe (es. Serie A)
    for (let daysAgo = 0; daysAgo < ENDED_DAYS_BACK; daysAgo++) {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dayNum = String(d.getDate()).padStart(2, '0');
      const day = `${y}${m}${dayNum}`;
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
          if (daysAgo === 0 && page === 1) console.error('Error fetching ended:', e.message);
          break;
        }
      }
      if (dayTotal > 0 && daysAgo > 0) console.log(`Ended (${daysAgo} day(s) ago): ${dayTotal} eventi`);
    }

    // Ended per leghe prioritarie (Serie A ecc.): così i risultati non restano "fermi" anche se in pagine alte
    const PRIORITY_LEAGUE_IDS = [199]; // 199 = Italy Serie A (altri: 152 Premier, 302 La Liga, ...)
    for (const leagueId of PRIORITY_LEAGUE_IDS) {
      for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
        const d = new Date();
        d.setDate(d.getDate() - daysAgo);
        const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
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

    // Refresh risultati: TUTTE le partite FINISHED degli ultimi 7 giorni da BetsAPI
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const finishedRecent = await Match.find({
      status: 'FINISHED',
      startTime: { $gte: sevenDaysAgo },
      eventId: { $exists: true, $ne: null, $ne: '' }
    }).sort({ startTime: -1 });
    for (const m of finishedRecent) {
      if (m.eventId) {
        await fetchAndSaveFinishedMatch(m.eventId);
        await new Promise(r => setTimeout(r, 320));
      }
    }
    if (finishedRecent.length > 0) console.log(`Refresh risultati: ${finishedRecent.length} partite (ultimi 7 gg)`);

    console.log(`Full sync: ${allEvents.length} events`);
    for (const ev of allEvents) await saveEventToDb(ev);
  } catch (err) {
    console.error('Full sync error:', err.message);
  }
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
    
    const matches = await Match.find(query).sort({ startTime: 1 });
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

app.get('/api/league/:leagueId/table', async (req, res) => {
  const TOKEN = process.env.BETSAPI_TOKEN;
  const { leagueId } = req.params;
  if (!TOKEN || !leagueId) {
    return res.status(400).json({ message: 'leagueId e token richiesti' });
  }
  const id = encodeURIComponent(leagueId);
  const urls = [
    `https://api.b365api.com/v3/league/table?token=${TOKEN}&league_id=${id}`,
    `https://api.b365api.com/v1/league/table?token=${TOKEN}&league_id=${id}`
  ];
  let lastError = null;
  for (const url of urls) {
    try {
      const apiRes = await axios.get(url);
      const data = apiRes.data;
      if (data && data.success === 0 && data.error) {
        lastError = data.error;
        continue;
      }
      if (data && (data.results != null || data.table != null || Array.isArray(data))) {
        return res.json(data);
      }
      lastError = lastError || 'Risposta senza classifica';
    } catch (err) {
      lastError = err.response?.data?.error || err.response?.data?.message || err.message;
    }
  }
  res.status(400).json({ message: lastError || 'Classifica non disponibile per questo campionato' });
});

app.get('/api/matches/live', async (req, res) => {
  try {
    const matches = await Match.find({ status: 'LIVE' }).sort({ startTime: 1 });
    res.json(matches);
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
      } catch (e) { }
    }
    res.json(match);
  } catch (err) {
    res.status(500).json({ message: err.message });
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
