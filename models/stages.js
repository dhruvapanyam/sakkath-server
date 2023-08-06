const mongoose = require('mongoose');

const stageSchema = mongoose.Schema({
    stage_name: String,
    description: String,
    division: String,
    pool: String,
    type: String,
    status: String,
    initial_stage: Boolean,
    semi_final: Boolean,
    dependencies: [String],
    teams: [],
    table: []
})

stageSchema.methods.setStatus = async function(status){
    this.status = status;
    await this.save();
}

stageSchema.statics.findTransitionStage = async function(name, division){
    // find the stage that has this stage_name as a dependency
    var res = (await this.find({division: division})).filter(stage => stage.dependencies.includes(name));
    return res.length ? res[0] : {}
}

stageSchema.statics.findByNameDivision = async function(name, division){
    return this.findOne({division: division, stage_name: name})
}

module.exports = mongoose.model('Stage', stageSchema);