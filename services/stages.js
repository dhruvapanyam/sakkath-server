const Stage = require('./../models/stages');
const Match = require('./../models/matches');
const Team = require('../models/teams');
const TeamService = require('./teams');
const TournamentService = require('./tournament');
const MatchService = require('./matches');

exports.getStagesInfo = async function(){
    // get standings & results
    var promises = [Stage.find(), Team.find()];
    var [stages, teams] = await Promise.all(promises);
    // var stages = [...(await Stage.find())];
    var res = {"Open": {}, "Women's": {}};
    // console.log('1')

    stages.sort((s1,s2) => (s1.stage_name > s2.stage_name) ? 1 : -1)
    // console.log(stages.map(s => s.stage_name))
    
    promises = [];
    for(let stage of stages){
        // console.log('stage.id:',stage.id)
        promises.push(Match.getByStage(stage.id));
    }
    
    var fixture_sets = await Promise.all(promises);
    fixture_sets = await Promise.all(fixture_sets.map(fixs => {
        return MatchService.getMatchTimings(fixs.filter(fix => fix.status != 'placeholder'));
    }))
    // console.log('2')
    for(let i=0; i<stages.length; i++){
        let stage = stages[i]
        if(stage.pool in res[stage.division] == false) res[stage.division][stage.pool] = {}

        let fixs = fixture_sets[i]

        res[stage.division][stage.pool][stage.stage_name] = {
            info: stage,
            fixtures: fixs
        }
    };
    // console.log('3')

    return {
        standings: res,
        teams: teams
    };
}


exports.updateBracketTable = async function(match, stage_id){
    // maybe safer to get all matches in the stage and compute consequences of all
    console.log('updateBracketTable')
    var stage = await Stage.findById(stage_id);

    // seed swap: find rank of both teams involved
    // depending on result, swap ranks

    let rank1 = match.rank_1;
    let rank2 = match.rank_2;

    let ranks = {};
    stage.table.forEach(row => {
        ranks[row.team_id.toString()] = row.rank;
    })

    // if the lower (larger) rank team won, then seed swap, otherwise keep as is
    if((rank1 > rank2 && match.result.outcome == 'W') || (rank1 < rank2 && match.result.outcome == 'L')){
        // swap seeds
        ranks[match.team_1.toString()] = rank2;
        ranks[match.team_2.toString()] = rank1;
    }

    stage.table = [...Object.keys(ranks).map(team => {return {team_id: team, rank: ranks[team]}})]


    await stage.save();

    await TeamService.setTeamStageRanks(stage.id, stage.table)


}


exports.updatePointsTable = async function(stage, initial_stage=false){
    // update stage.table
    console.log('updatePointsTable')
    

    // get team results
    var pool_games = await Match.getByTeams(stage.teams);
    var results = pool_games.filter(game => game.status == 'completed');
    // console.log('pool games',pool_games)
    
    var new_table = {};
    for(let row of stage.table) 
        new_table[row.team_id] = {
            rank: row.rank,
            team_id: row.team_id,
            played: 0,
            won: 0,
            lost: 0,
            drawn: 0,
            points: 0,
            GD: 0,
            OPT: 0,
        }
    
    // console.log('reset table',new_table)


    results.forEach((res, i) => {
        let t1 = res.team_1.toString(), t2 = res.team_2.toString(), s1 = res.result.score_1, s2 = res.result.score_2;
        let outcome = res.result.outcome;

        new_table[t1].played += 1;
        new_table[t2].played += 1;

        new_table[t1].GD += (s1 - s2);
        new_table[t2].GD += (s2 - s1);

        if(outcome == 'W'){
            new_table[t1].won += 1;
            new_table[t1].points += 2;
            new_table[t2].lost += 1;
        }
        else if(outcome == 'L'){
            new_table[t2].won += 1;
            new_table[t2].points += 2;
            new_table[t1].lost += 1;
        }
        else if(outcome == 'D'){
            new_table[t1].drawn += 1;
            new_table[t2].drawn += 1;
            new_table[t1].points += 1;
            new_table[t2].points += 1;
        }
    })

    // console.log('calculating opt')
    // calc aor, opt, etc
    for(let team in new_table){
        let opt = 0;
        for(let res of results){
            if(res.team_1 == team) {
                opt += new_table[res.team_2].points;
            }
            else if(res.team_2 == team) {
                opt += new_table[res.team_1].points;
            }
        }
        new_table[team].OPT = opt;
    }

    console.log('new table:',new_table)

    // console.log('calculating table')
    // calculate rank
    // -----------IMPORTANT-----------
    var table_rows = Object.values(new_table);
    if(!initial_stage)
        table_rows = await TournamentService.sortSwissTable(Object.values(new_table));
    // console.log('sorted table:',table_rows)
    for(let i=0; i<table_rows.length; i++){
        console.log('rank',i,'points',table_rows[i].points);
        new_table[table_rows[i].team_id].rank = i;
    }

    

    // console.log('saving table')
    stage.table.forEach((row, i, arr) => {
        arr[i] = {...new_table[arr[i].team_id]}
    })

    await stage.save();

    await TeamService.setTeamStageRanks(stage.id, stage.table)


    // console.log('win',stage.table[win_ind])
}


exports.checkStageCompletion = async function(stage_id){
    console.log('checkStageCompletion')
    // check if pending / (pending + completed) = 0
    var stage = await Stage.findById(stage_id);
    if(Object.keys(stage).length == 0) return false;

    console.log('Looking at stage:',stage.division,stage.stage_name)
    var stage_matches = await Match.getByStage(stage_id);
    // console.log(`Found ${stage_matches.length} matches in this stage`)
    var completed = stage_matches.filter(s => s.status == "completed");
    var pending = stage_matches.filter(s => s.status == "pending");

    console.log(completed.length, pending.length, '<-- [complete, pending] stage matches')
    if(completed.length == 0) return false;
    if(pending.length == 0){
        stage.status = 'completed'
        await stage.save();
        return true;
    }

    return false;
}