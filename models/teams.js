const mongoose = require('mongoose');

const teamSchema = mongoose.Schema({
    team_name: String,
    team_code: String,
    city_of_origin: String,
    logo: String,
    division: String,
    current_stage_id: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: "Stage"
    },
    stage_rank: Number,
    upcoming_match_id: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: "Match"
    },

    roster: [String]
})

teamSchema.statics.findByName = function(name){
    return this.where({ team_name: name });
}

teamSchema.statics.findByNameDivision = function(name, division){
    return this.findOne().where({ team_name: name }).where({ division: division});
}
teamSchema.statics.findByCodeDivision = function(code, division){
    return this.findOne().where({ team_code: code }).where({ division: division});
}

teamSchema.methods.clearMatchData = async function(){
    // var team = await this.findById(id);
    this.current_stage_id = null;
    this.stage_rank = null;
    this.upcoming_match_id = null;
    await this.save();
}

teamSchema.statics.setStage = async function(id, stage, rank){
    var team = await this.findById(id);
    console.log(`setting ${team?.team_name} to rank ${rank} in stage ${stage}`);
    team.current_stage_id = stage;
    team.stage_rank = rank;
    await team.save();
}

teamSchema.statics.setStageUpcoming = async function(id, stage, upcoming){
    var team = await this.findById(id);
    team.current_stage_id = stage;
    // team.stage_rank = rank;
    team.upcoming_match_id = upcoming;
    await team.save();
}

teamSchema.methods.setUpcoming = async function(match_id){
    this.upcoming_match_id = match_id;
    await this.save();
}


module.exports = mongoose.model('Team', teamSchema);;