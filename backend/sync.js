const path = require('path');
const axios = require('axios');
const mongoose = require('mongoose');
const Match = require('./models/Match');

// Carica .env da backend/ o dalla root del progetto
require('dotenv').config({ path: path.join(__dirname, '.env') });
if (!process.env.BETSAPI_TOKEN && !process.env.MONGODB_URI) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
}

const TOKEN = process.env.BETSAPI_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;

async function syncMatches() {
  if (!TOKEN) {
    console.error('BETSAPI_TOKEN non trovato. Imposta .env in backend/ o nella root con BETSAPI_TOKEN=...');
    process.exit(1);
  }
  if (!MONGODB_URI) {
    console.error('MONGODB_URI non trovato. Imposta .env con MONGODB_URI=...');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);

    const allEvents = [];
    const liveEventIds = new Set();

    try {
      const inplayRes = await axios.get(`https://api.b365api.com/v1/events/inplay?sport_id=1&token=${TOKEN}`);
      const liveItems = inplayRes.data.results || [];
      allEvents.push(...liveItems);
      liveItems.forEach(ev => liveEventIds.add(ev.id));
    } catch (e) { /* ignore */ }

    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const MAX_PAGES = 60;
    for (let page = 1; page <= MAX_PAGES; page++) {
      try {
        await wait(1000);
        const upcomingRes = await axios.get(`https://api.b365api.com/v1/events/upcoming?sport_id=1&token=${TOKEN}&page=${page}`);
        const results = upcomingRes.data.results || [];
        if (results.length === 0) break;
        allEvents.push(...results);
      } catch (e) {
        await wait(5000);
      }
    }
    const ENDED_DAYS_BACK = 2; // 0 = oggi, 1 = ieri
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
          const endedItems = endedRes.data.results || [];
          allEvents.push(...endedItems);
          dayTotal += endedItems.length;
          if (endedItems.length < 50) break;
        } catch (e) {
          break;
        }
      }
    }

    const dbLiveMatches = await Match.find({ status: 'LIVE' });
    for (const dbMatch of dbLiveMatches) {
      if (dbMatch.eventId && !liveEventIds.has(dbMatch.eventId)) {
        dbMatch.status = 'FINISHED';
        await dbMatch.save();
      }
    }

    for (const ev of allEvents) {
      if (!ev.time) continue;

      let homeScore = 0;
      let awayScore = 0;
      if (ev.ss) {
        const scores = ev.ss.split('-');
        homeScore = parseInt(scores[0]) || 0;
        awayScore = parseInt(scores[1]) || 0;
      }

      const eventId = ev.id != null ? String(ev.id) : '';
      if (!eventId) continue;

      const matchData = {
        eventId,
        sport: 'Football',
        league: ev.league?.name || 'Unknown League',
        leagueId: ev.league?.id != null ? String(ev.league.id) : undefined,
        country: ev.cc?.toUpperCase() || (ev.league?.name?.split(' ')[0]?.toUpperCase() || 'UN'),
        startTime: new Date(parseInt(ev.time, 10) * 1000),
        status: ev.timer ? 'LIVE' : (ev.ss && ev.ss.includes('-') && !ev.timer ? 'FINISHED' : 'SCHEDULED'),
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

      await Match.findOneAndUpdate(
        { eventId: matchData.eventId },
        matchData,
        { upsert: true }
      );
    }

    const fiByKey = new Map();
    for (let page = 1; page <= 20; page++) {
      try {
        await wait(400);
        const res = await axios.get(`https://api.b365api.com/v1/bet365/upcoming?sport_id=1&token=${TOKEN}&page=${page}`);
        const list = res.data.results || [];
        if (list.length === 0) break;
        for (const ev of list) {
          const id = ev.id != null ? String(ev.id) : (ev.FI != null ? String(ev.FI) : '');
          if (!id) continue;
          const home = (ev.home?.name || '').trim().toLowerCase();
          const away = (ev.away?.name || '').trim().toLowerCase();
          const league = (ev.league?.name || '').trim().toLowerCase();
          const t = ev.time ? new Date(parseInt(ev.time, 10) * 1000) : null;
          const day = t ? `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}` : '';
          fiByKey.set(`${league}|${home}|${away}|${day}`, id);
        }
        if (list.length < 50) break;
      } catch (e) {
        break;
      }
    }
    if (fiByKey.size > 0) {
      const withoutFi = await Match.find({
        status: 'SCHEDULED',
        $or: [{ bet365FixtureId: { $exists: false } }, { bet365FixtureId: null }, { bet365FixtureId: '' }]
      }).limit(3000);
      let updated = 0;
      for (const m of withoutFi) {
        const home = (m.homeTeam?.name || '').trim().toLowerCase();
        const away = (m.awayTeam?.name || '').trim().toLowerCase();
        const league = (m.league || '').trim().toLowerCase();
        const d = m.startTime ? new Date(m.startTime) : null;
        const day = d ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}` : '';
        const fi = fiByKey.get(`${league}|${home}|${away}|${day}`);
        if (fi) {
          m.bet365FixtureId = fi;
          await m.save();
          updated++;
        }
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Sync error:', err.message);
    process.exit(1);
  }
}

syncMatches();
