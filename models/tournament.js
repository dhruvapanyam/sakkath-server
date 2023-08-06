const mongoose = require('mongoose');

const tournamentSchema = mongoose.Schema({
    formats: {
        "Open": {
            format_type: String,
            num_pools: Number,
            num_rounds: Number,
            semi_final: Boolean,
            num_teams: Number
        },
        "Women's": {
            format_type: String,
            num_pools: Number,
            num_rounds: Number,
            semi_final: Boolean,
            num_teams: Number
        },
    },
    pools: {
        "Open": [[String]],
        "Women's": [[String]],
    },
})


tournamentSchema.statics.clear = async function(){
    var T = await this.findOne();
    T.formats = {};
    T.pools = {};
    await T.save();
}

module.exports = mongoose.model('Tournament', tournamentSchema);;