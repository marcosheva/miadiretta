const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
  eventId: { type: String, unique: true, sparse: true }, // BetsAPI Event ID (generic)
  bet365FixtureId: String, // FI da bet365/upcoming, usato per prematch quote
  sport: { type: String, required: true, default: 'Football' },
  league: { type: String, required: true },
  leagueId: String,
  leagueLogo: String,
  country: String,
  countryFlag: String,
  startTime: { type: Date, required: true },
  status: { type: String, enum: ['LIVE', 'FINISHED', 'SCHEDULED'], default: 'SCHEDULED' },
  minute: String, // For live matches
  homeTeam: {
    name: { type: String, required: true },
    id: String,   // team/image_id per loghi locali (team_images/ID.png)
    logo: String,
    score: { type: Number, default: 0 }
  },
  awayTeam: {
    name: { type: String, required: true },
    id: String,
    logo: String,
    score: { type: Number, default: 0 }
  },
  odds: {
    home: Number,
    draw: Number,
    away: Number
  },
  oddsOverUnder25: { over: Number, under: Number },
  oddsBtts: { yes: Number, no: Number },
  events: [mongoose.Schema.Types.Mixed],
  logosFromBet365Result: { type: Boolean, default: false } // true = loghi già corretti da bet365/result
}, { timestamps: true });

module.exports = mongoose.model('Match', MatchSchema);
