const mongoose = require('mongoose');

const matchSchema = mongoose.Schema({
    team_1: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: "Team"
    },
    team_2: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: "Team"
    },
    rank_1: Number,
    rank_2: Number,
    stage: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: "Stage"
    },
    
    match_number: Number,
    slot_number: Number,

    status: String,
    submitted_score_1: {
        score_1: Number,
        score_2: Number,
        status: {
            type: String,
            default: 'pending'
        }
    },
    submitted_score_2: {
        score_1: Number,
        score_2: Number,
        status: {
            type: String,
            default: 'pending'
        }
    },
    result: {
        score_1: Number,
        score_2: Number,

        outcome: String,

        status: {
            type: String,
            default: 'pending'
        }
    },
    spirit: {
        spirit_score_1: [Number],
        spirit_score_2: [Number],
        self_spirit_score_1: [Number],
        self_spirit_score_2: [Number],
        comments_1: String,
        comments_2: String,
        mvp_1: String,
        mvp_2: String,
        msp_1: String,
        msp_2: String
    }
})

matchSchema.statics.getByStage = function(stage){
    // console.log('getting matches for stage')
    return this.find({stage: stage}).populate("team_1", "team_name logo").populate("team_2", "team_name logo").populate("stage", "division stage_name");
}

matchSchema.statics.getByTeams = function(teams){
    return this.find({$and: [{team_1: {$in: teams}, team_2: {$in: teams}}]});
}

module.exports = mongoose.model('Match', matchSchema);