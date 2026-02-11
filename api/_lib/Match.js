const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
  eventId: { type: String, unique: true, sparse: true },
  sport: { type: String, required: true, default: 'Football' },
  league: { type: String, required: true },
  leagueId: String,
  leagueLogo: String,
  country: String,
  countryFlag: String,
  startTime: { type: Date, required: true },
  status: { type: String, enum: ['LIVE', 'FINISHED', 'SCHEDULED'], default: 'SCHEDULED' },
  minute: String,
  homeTeam: {
    name: { type: String, required: true },
    logo: String,
    score: { type: Number, default: 0 }
  },
  awayTeam: {
    name: { type: String, required: true },
    logo: String,
    score: { type: Number, default: 0 }
  },
  odds: {
    home: Number,
    draw: Number,
    away: Number
  },
  events: [mongoose.Schema.Types.Mixed]
}, { timestamps: true });

module.exports = mongoose.models.Match || mongoose.model('Match', MatchSchema);
