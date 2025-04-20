const Match = require('./../models/matches')
const Team = require('./../models/teams')
const StageService = require('./stages');
const TournamentService = require('./tournament');
const Stage = require('./../models/stages');
const Slot = require('./../models/timeslots');

const getMatchTimings = async function(match_arr){
    var timeslots = await Slot.find();

    var matches = match_arr.map(match => match.toObject())

    let slot_start_times = {}
    timeslots.forEach(slot => {
        slot_start_times[slot.timeslot_number] = slot.start_time;
    })

    // console.log(slot_start_times);
    for(let i=0; i<matches.length; i++){
        let slot = parseInt(matches[i].slot_number);
        // console.log('slot',slot)
        matches[i].day = Math.floor(slot / 60) + 1;
        matches[i].field = (slot % 6) + 1;
        matches[i].start_time = slot_start_times[Math.floor(slot / 6)];
    }

    return matches;
}
exports.getMatchTimings = getMatchTimings;

exports.getFixtures = async function(){
    // return all fixtures, with time slot data
    var matches = await Match.find().populate("stage", "stage_name division").populate("team_1", "team_name logo").populate("team_2", "team_name logo")
                            .select('team_1 team_2 rank_1 rank_2 stage match_number slot_number status result')
    
    return getMatchTimings(matches);

}

const handleScoreSubmission = async function(match, result, team_submitting){
    console.log('handling score submission:',result);

    if(match.status == 'completed'){
        console.log('result has been computed already');
        return;
    }

    if(match.team_1 == team_submitting.toString()){
        match.submitted_score_1 = {
            score_1: result.score_1,
            score_2: result.score_2,
            status: 'submitted'
        }
    }
    else if(match.team_2 == team_submitting.toString()){
        match.submitted_score_2 = {
            score_1: result.score_1,
            score_2: result.score_2,
            status: 'submitted'
        }
    }

    await match.save();
    await checkScoreSubmissions(match);

}

const checkScoreSubmissions = async function(match){
    console.log('checking score submissions');
    if(match.submitted_score_1.status == 'pending' || match.submitted_score_2.status == 'pending') return;

    if(match.submitted_score_1.score_1 != match.submitted_score_2.score_1 || match.submitted_score_1.score_2 != match.submitted_score_2.score_2){
        // inconsistent scores
        console.log('scores are inconsistent!')
        match.result.status = 'inconsistent';
        await match.save();
        return;
    }

    console.log('scores are in!')
    // scores are correct
    match.result = {
        score_1: match.submitted_score_1.score_1,
        score_2: match.submitted_score_1.score_2,
    }
    match.result.status = 'consistent';

    let result = match.result;
    let s1 = result.score_1, s2 = result.score_2;

    // compute outcome
    let outcome = 'D';
    if(s1 > s2) outcome = 'W';
    else if(s1 < s2) outcome = 'L';

    match.result.outcome = outcome;

    match.status = 'completed';

    await match.save();
}

exports.addResult = async function(id, result, team_id_submitting){
    console.log('addResult');
    var match = await Match.findById(id);
    // console.log('found:',match)
    if(Object.keys(match).length == 0) throw `Could not find match id!`;
    // console.log('adding')

    if(match.status == "completed"){
        console.log('cannot add result to completed match!');
        return;
    }

    await handleScoreSubmission(match, result, team_id_submitting);

    if(match.status != "completed"){
        // either both sides not submitted, or inconsistent
        console.log('result not yet computable')
        return;
    }

    // update upcoming match for teams
    // set to null
    var [team1, team2] = await Promise.all([Team.findById(match.team_1), Team.findById(match.team_2)]);
    await Promise.all([team1.setUpcoming(null), team2.setUpcoming(null)]);


    var stage = await Stage.findById(match.stage);
    if(Object.keys(stage).length == 0) throw `Invalid stage id!`;

    // update points table
    if(stage.type == "Swiss")
        await StageService.updatePointsTable(stage);
    else{
        await StageService.updateBracketTable(match, stage.id);
    }

    // check if stage complete
    var stage_complete = await StageService.checkStageCompletion(match.stage);

    if(!stage_complete) {
        console.log('stage not yet complete, waiting for next result...')
        return;
    }
    // console.log('stage complete! checking next')

    // else, find next stage
    // console.log('stage:',stage)
    var next_stage = await Stage.findTransitionStage(stage.stage_name, stage.division);

    if(Object.keys(next_stage).length == 0) return; // no next stage
    // console.log('next stage:',next_stage)

    let promises = next_stage.dependencies.map(async (dep) => {
        let id = (await Stage.findByNameDivision(dep, stage.division))
        return StageService.checkStageCompletion(id);
    })

    var all_results = await Promise.all(promises);
    var all_complete = all_results.every(res => res == true);
    if(!all_complete){
        console.log('Not all dependencies completed...')
        return;
    }

    // begin new stage
    await TournamentService.beginNewStage(next_stage);
    
}


exports.addSpiritScore = async function(id, spirit, team_id_submitting){
    console.log('addSpiritScore');
    var match = await Match.findById(id);
    // console.log('found:',match)
    if(Object.keys(match).length == 0) throw `Could not find match id!`;
    // console.log('adding')

    console.log('received:',spirit)
    // return;

    if(team_id_submitting == match.team_1.toString()){
        match.spirit.spirit_score_2 = spirit.spirit_score;
        match.spirit.comments_2 = spirit.comments;
        match.spirit.mvp_2 = spirit.mvp;
        match.spirit.msp_2 = spirit.msp;
    }
    else if(team_id_submitting == match.team_2.toString()){
        match.spirit.spirit_score_1 = spirit.spirit_score;
        match.spirit.comments_1 = spirit.comments;
        match.spirit.mvp_1 = spirit.mvp;
        match.spirit.msp_1 = spirit.msp;
    }


    await match.save();
    console.log('Updating spirit scores')
}