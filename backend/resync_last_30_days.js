const path = require('path');
const axios = require('axios');
const mongoose = require('mongoose');
const Match = require('./models/Match');

// Carica .env da backend/ o dalla root del progetto
require('dotenv').config({ path: path.join(__dirname, '.env') });
if (!process.env.BETSAPI_TOKEN || !process.env.MONGODB_URI) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
}

const TOKEN = process.env.BETSAPI_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;

if (!TOKEN) {
  console.error('BETSAPI_TOKEN non trovato. Imposta BETSAPI_TOKEN in .env');
  process.exit(1);
}
if (!MONGODB_URI) {
  console.error('MONGODB_URI non trovato. Imposta MONGODB_URI in .env');
  process.exit(1);
}

// --- Helpers copiati/simplificati da server.js ---

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
    if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
      homeScore = parts[0];
      awayScore = parts[1];
    }
  }
  return { homeScore, awayScore };
}

function buildMatchData(ev) {
  const { homeScore, awayScore } = parseScore(ev.ss);
  const eventId = ev.id != null ? String(ev.id) : '';
  return {
    eventId,
    sport: 'Football',
    league: ev.league?.name || 'Unknown League',
    leagueId: ev.league_id != null ? String(ev.league_id) : (ev.league?.id != null ? String(ev.league.id) : undefined),
    country: ev.cc?.toUpperCase() || (ev.league?.name?.split(' ')[0]?.toUpperCase() || 'UN'),
    startTime: new Date(parseInt(ev.time, 10) * 1000),
    status: ev.timer ? 'LIVE' : (ev.ss && !ev.timer ? 'FINISHED' : 'SCHEDULED'),
    minute: ev.timer?.tm ? `${ev.timer.tm}'` : '',
    homeTeam: {
      name: ev.home?.name || 'Home',
      id: (ev.home?.image_id ?? ev.home?.id) != null ? String(ev.home.image_id ?? ev.home.id) : undefined,
      logo: (ev.home?.image_id || ev.home?.id) ? `https://assets.b365api.com/images/team/m/${ev.home?.image_id || ev.home?.id}.png` : '',
      score: homeScore
    },
    awayTeam: {
      name: ev.away?.name || 'Away',
      id: (ev.away?.image_id ?? ev.away?.id) != null ? String(ev.away.image_id ?? ev.away.id) : undefined,
      logo: (ev.away?.image_id || ev.away?.id) ? `https://assets.b365api.com/images/team/m/${ev.away?.image_id || ev.away?.id}.png` : '',
      score: awayScore
    }
  };
}

async function saveEventToDb(ev) {
  if (!ev.time) return;
  const matchData = buildMatchData(ev);
  const eid = matchData.eventId;
  if (!eid) return;
  await Match.findOneAndUpdate(
    { eventId: eid },
    { ...matchData, eventId: eid },
    { upsert: true }
  );
}

function teamImageId(team) {
  if (!team) return null;
  const id = team.image_id ?? team.IG ?? team.id;
  return id != null && String(id).trim() !== '' ? String(id) : null;
}

function buildMatchDataFromBet365(ev) {
  const id = (ev.FI != null && String(ev.FI).trim()) ? String(ev.FI) : (ev.id != null ? String(ev.id) : '');
  if (!id) return null;
  const t = ev.time != null ? parseInt(ev.time, 10) : (ev.start_time != null ? parseInt(ev.start_time, 10) : null);
  if (!t || Number.isNaN(t)) return null;
  const time = t;
  const homeImgId = teamImageId(ev.home);
  const awayImgId = teamImageId(ev.away);
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
      id: (ev.home?.image_id ?? ev.home?.IG ?? ev.home?.id) != null ? String(ev.home.image_id ?? ev.home.IG ?? ev.home.id) : undefined,
      logo: homeImgId ? `https://assets.b365api.com/images/team/m/${homeImgId}.png` : '',
      score: 0
    },
    awayTeam: {
      name: ev.away?.name || 'Away',
      id: (ev.away?.image_id ?? ev.away?.IG ?? ev.away?.id) != null ? String(ev.away.image_id ?? ev.away.IG ?? ev.away.id) : undefined,
      logo: awayImgId ? `https://assets.b365api.com/images/team/m/${awayImgId}.png` : '',
      score: 0
    }
  };
}

async function saveBet365UpcomingToDb(ev) {
  const matchData = buildMatchDataFromBet365(ev);
  if (!matchData) return;
  const eid = matchData.eventId;
  await Match.findOneAndUpdate(
    { eventId: eid },
    { ...matchData, eventId: eid },
    { upsert: true }
  );
}

async function resyncLast30Days() {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  await mongoose.connect(MONGODB_URI);
  console.log('Connesso a MongoDB, inizio resync ultimi 30 giorni...');

  let totalSaved = 0;

  // 1) Partite finite: events/ended per ultimi 30 giorni (UTC)
  const DAYS_BACK = 30;
  const MAX_PAGES_PER_DAY = 60;

  const now = Date.now();
  for (let daysAgo = 0; daysAgo < DAYS_BACK; daysAgo++) {
    const d = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
    const day = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
    let dayTotal = 0;
    for (let page = 1; page <= MAX_PAGES_PER_DAY; page++) {
      try {
        await wait(260);
        const url = `https://api.b365api.com/v1/events/ended?sport_id=1&token=${TOKEN}&day=${day}&page=${page}`;
        const res = await axios.get(url);
        const ended = res.data.results || [];
        if (!ended.length) break;
        for (const ev of ended) {
          await saveEventToDb(ev);
          dayTotal++;
        }
        if (ended.length < 50) break;
      } catch (e) {
        console.error('Errore events/ended day=', day, 'page=', page, e.message);
        break;
      }
    }
    if (dayTotal > 0) {
      totalSaved += dayTotal;
      console.log(`Ended day=${day}: salvate ${dayTotal} partite`);
    }
  }

  // 2) Live attuali
  try {
    const liveRes = await axios.get(`https://api.b365api.com/v1/events/inplay?sport_id=1&token=${TOKEN}`);
    const liveItems = liveRes.data.results || [];
    for (const ev of liveItems) {
      await saveEventToDb(ev);
      totalSaved++;
    }
    console.log(`Live attuali: ${liveItems.length} partite salvate/aggiornate`);
  } catch (e) {
    console.error('Errore events/inplay:', e.message);
  }

  // 3) Upcoming generici (events/upcoming) - partite programmate con image_id
  const UPCOMING_GENERIC_PAGES = 18;
  try {
    for (let page = 1; page <= UPCOMING_GENERIC_PAGES; page++) {
      await wait(350);
      const res = await axios.get(`https://api.b365api.com/v1/events/upcoming?sport_id=1&token=${TOKEN}&page=${page}`);
      const results = res.data.results || [];
      if (!results.length) break;
      for (const ev of results) {
        if (ev.time) {
          await saveEventToDb(ev);
          totalSaved++;
        }
      }
      if (results.length < 50) break;
    }
    console.log('Upcoming (events/upcoming) salvate');
  } catch (e) {
    console.error('Errore events/upcoming:', e.message);
  }

  // 4) Upcoming da bet365 (FI per quote + loghi bet365 dove disponibili)
  const UPCOMING_BET365_PAGES = 20;
  try {
    let upcomingCount = 0;
    for (let page = 1; page <= UPCOMING_BET365_PAGES; page++) {
      await wait(400);
      const res = await axios.get(`https://api.b365api.com/v1/bet365/upcoming?sport_id=1&token=${TOKEN}&page=${page}`);
      const results = res.data.results || [];
      if (!results.length) break;
      for (const ev of results) {
        await saveBet365UpcomingToDb(ev);
        upcomingCount++;
      }
      if (results.length < 50) break;
    }
    console.log(`Upcoming (bet365 FI): ${upcomingCount} partite salvate/aggiornate`);
  } catch (e) {
    console.error('Errore bet365/upcoming:', e.message);
  }

  console.log(`Resync completato. Totale partite salvate/aggiornate (approssimativo): ${totalSaved}`);
  await mongoose.disconnect();
  process.exit(0);
}

resyncLast30Days().catch((err) => {
  console.error('Errore resync_last_30_days:', err);
  process.exit(1);
});

