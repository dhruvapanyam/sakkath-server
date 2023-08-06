const Team = require('./../models/teams.js');
const Match = require('./../models/matches');
const MatchService = require('./matches');


const getTeams = async function(){
    var teams = await Team.find().populate("current_stage_id", "stage_name division");
    return teams;
}
exports.getTeams = getTeams




exports.getTeamResults = async function(id){
    var results = await Match.find({ $or: [{ team_1: id }, { team_2: id }] })
                                .where("status").equals("completed")
                                .populate("team_1", "team_name logo roster")
                                .populate("team_2", "team_name logo roster")
                                .populate("stage", "stage_name division")
                                ;
    var record = {W:0,L:0,D:0};
    var form = [];
    results.forEach(res => {
        let outcome;
        // console.log(res.team_1._id.toString() == id, res.result.outcome)
        if(res.team_1._id.toString() == id){
            if(res.result.outcome == 'W') outcome = 'W'
            else if(res.result.outcome == 'L') outcome = 'L'
            else if(res.result.outcome == 'D') outcome = 'D'
        }
        else if(res.team_2._id.toString() == id){
            if(res.result.outcome == 'L') outcome = 'W'
            else if(res.result.outcome == 'W') outcome = 'L'
            else if(res.result.outcome == 'D') outcome = 'D'
        }

        if(outcome) record[outcome] += 1;
        if(outcome) form.push(outcome)
    });
    // console.log('record:',record);
    // console.log('form:',form)

    results = await MatchService.getMatchTimings(results);

    return {results, record, form};
}

exports.getTeamInfo = async function(id){
    var team_data = await Team.findById(id).populate("current_stage_id", "stage_name division type");
    var upcoming = await Match.findById(team_data?.upcoming_match_id).populate("team_1", "team_name logo roster").populate("team_2", "team_name logo roster").populate("stage", "stage_name division");
    return {team_data, upcoming};
}



exports.setTeamStageRanks = async function(stage_id, points_table){
    // [{rank, team_id}]
    await Promise.all(points_table.map(row => Team.setStage(row.team_id, stage_id, row.rank)));
}
