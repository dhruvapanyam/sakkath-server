const Tournament = require('./../models/tournament');
const Team = require('./../models/teams');
const Match = require('./../models/matches');
const Stage = require('./../models/stages');
const TeamService = require('./teams');
const StageService = require('./stages');

const {SwissDrawManager} = require('./swiss_pairings');



exports.resetTournament = async function(data){

    await clearTournament(); // clear all data

    try{ // try using new data

        var T = await Tournament.findOne(); // tourney data
        T.formats = {...data.formats};
        T.pools = {...data.pools};
        
        
        // set schedules, pool splits, make stages, etc
        console.log('resetTournament')
        
        // 0. validate
        if(!(await validateData(data))) throw 'Bad tournament data!';
        // console.log('valid data')

        // 1. populate pools
        var pools = await getPoolTeamIds(data.pools);
        // console.log(pools)
        
        // 2. create stages based on format
        var stages = await createStages(data.formats, pools);
        // console.log(stages);
        

        await T.save();



        return;


    }
    catch(e){
        await clearTournament();
        throw e;
    }
}

const clearTournament = async function(){
    console.log('clearTournament');
    // Completely reset everything except team information
    await Tournament.clear();

    // 1. delete all stages, create new stages
    await Stage.deleteMany();

    // 2. delete all matches, create new fixtures
    await Match.deleteMany();

    // reset upcoming match, current stage, stage rank
    var teams = await Team.find();
    let promises = [];
    teams.forEach(team => promises.push(team.clearMatchData()))
    await Promise.all(promises);

}

const beginInitialStages = async function(){
    var initial_stages = await Stage.find({initial_stage: true});
    initial_stages.forEach(async (stage) => {
        await beginNewStage(stage);
    })
}
exports.beginInitialStages = beginInitialStages;


const loadScheduleTemplate = async function(slot_data){
    let stages = {};
    for(let slot of slot_data){
        if(slot == null) continue;
        if((slot.division + slot.stage_name) in stages == false){
            let s = await Stage.findByNameDivision(slot.stage_name, slot.division);
            if(s?.id == null) continue;
            stages[slot.division + slot.stage_name] = s;
        }
        // console.log(stages);
        let stage = stages[slot.division + slot.stage_name];
        // console.log(slot.day)
        let m = await Match.create({
            stage: stage.id,
            slot_number: slot.slot_number,
            match_number: slot.match_number,
            status: "placeholder"
        });
        // console.log(slot.stage_name, slot.division)
    }
}
exports.loadScheduleTemplate = loadScheduleTemplate;

const getPoolTeamIds = async function(pool_data){
    console.log('getPoolTeamIds');
    // dictionary of team CODES in different pools ---> mapped to ids
    var pools = {};
    var seen_team_codes = new Set();
    for(let division in pool_data){
        pools[division] = [];
        for(let teams of pool_data[division]){
            let temp = [];
            for(let team_code of teams){

                team_code = team_code.trim()
                var team = await Team.findByCodeDivision(team_code, division);
                if(team?.id == undefined) throw `Unknown team name: ${team_code} in ${division} division!`;

                // please change this back to uncommented!!!
                if(seen_team_codes.has(team.id)) throw `Duplicate team found for ${team_code} in ${division} division!`

                temp.push(team.id);
                seen_team_codes.add(team.id);
            }
            pools[division].push([...temp]);
        }
    }
    return pools;
}



const beginNewStage = async function(stage_data){
    console.log('beginNewStage');
    stage_data.status = 'live';
    await stage_data.save();
    // console.log(stage_data.type)
    if(stage_data.type == "Swiss") return await beginNewSwissStage(stage_data);
    if(stage_data.type == "Bracket") return await beginNewBracketStage(stage_data);
}
exports.beginNewStage = beginNewStage;

const beginNewSwissStage = async function(stage_data){
    console.log('beginNewSwissStage',stage_data.division, stage_data.stage_name);
    // todo:
    // check if initial
    // if so, create empty table
    // if not, copy table from dependency
    var points_table;
    var teams = stage_data.teams;
    var team_oppositions = {};
    for(let team of teams){team_oppositions[team] = [];}

    const initial = stage_data.initial_stage;
    // console.log(stage_data.teams)

    if(initial){
        // create empty table, get rankings
        points_table = stage_data.teams.map((team_id,i) => {
            return {
                rank: i,
                team_id: team_id,
                played: 0,
                won: 0,
                lost: 0,
                points: 0,
                OPT: 0,
                GD: 0
            }
        })
    }
    else{
        let previous_stage = await Stage.findByNameDivision(stage_data.dependencies[0], stage_data.division)
        console.log('getting data from prev_stage:',previous_stage.stage_name);
        if(previous_stage == {}) throw 'Could not find previous points table!'
        points_table = [...previous_stage.table];


        var matches_played = await Match.getByTeams(teams);
        // console.log(matches_played);

        matches_played.forEach(match => {
            if(match.status != "completed") return;
            team_oppositions[match.team_1.toString()].push(match.team_2.toString());
            team_oppositions[match.team_2.toString()].push(match.team_1.toString());
        })

        // console.log(`Team opponents:`,team_oppositions);
    }

    stage_data.table = [...points_table];
    await stage_data.save();

    await StageService.updatePointsTable(stage_data);

    // await TeamService.setTeamStageRanks(stage_data.id, points_table)


    var S = new SwissDrawManager();
    var pairings = S.generateSwissPairings(stage_data.id, points_table, team_oppositions);
    if(pairings == null) throw `Could not make Swiss Draw pairings!`


    // console.log(stage_data.stage_name, pairings)

    // add fixtures
    // 

    await addStageFixtures(stage_data, pairings, 'Swiss');

}

const beginNewBracketStage = async function(stage_data){
    console.log('beginNewBracketStage',stage_data.division, stage_data.stage_name);
    const semis = stage_data.semi_final;
    const num_pools_to_merge = stage_data.dependencies.length;

    // console.log('BRACKET STAGE')
    var prev_stages = await Promise.all(stage_data.dependencies.map(dep => Stage.findByNameDivision(dep, stage_data.division)))
    // console.log(prev_stages);
    if(prev_stages.length == 0) return;
    
    // merge pools and create rankings
    var ranks = stage_data.teams.map(x=>null);
    for(let i=0; i<num_pools_to_merge; i++){
        prev_stages[i].table.forEach(row => {
            ranks[row.rank * num_pools_to_merge + i] = row.team_id;
        })
    }

    

    // console.log(ranks);
    stage_data.table = ranks.map((team,i) => {return {rank:i, team_id:team}});
    await stage_data.save();
    // console.log('saved table')


    await TeamService.setTeamStageRanks(stage_data.id, stage_data.table)




    // Create fixtures

    let fixs = [];
    if(semis){
        // 1v4, 2v3, 5v8, 6v7, ...
        for(i=0; i+3<ranks.length; i+=4){
            fixs.push([ranks[i],ranks[i+3]]);
            fixs.push([ranks[i+1],ranks[i+2]]);
        }
    }
    else{
        for(i=0; i+1<ranks.length; i+=2){
            fixs.push([ranks[i],ranks[i+1]]);
        }
    }

    // console.log('New fixtures:',stage_data.stage_name, fixs)

    await addStageFixtures(stage_data, fixs, 'Bracket');

}


const addStageFixtures = async function(stage_data, pairings, stage_type='Swiss'){
    console.log('addStageFixtures')
    // --> find placeholders for this stage
    var placeholders = await Match.find({stage: stage_data.id, status: "placeholder"});
    console.log(`found ${placeholders.length} placeholders`);
    // console.log(`matches found for [${stage_data.division}] ${stage_data.stage_name}:`,placeholders.map(p=>p.id))
    console.log(`updating ${pairings.length} fixtures...`)

    let team_data = await Promise.all(pairings.flat().map(tid => Team.findById(tid).select("stage_rank")));
    let team_ranks = {};
    for(let team of team_data) team_ranks[team._id] = team.stage_rank;

    // IF SWISS:

    // check if any placeholder match is incompatible with a fixture pairing
    // 1. get last match played by all teams involved
    // 2. sort pairings by latest slot played in
    // 3. assume that a compatible schedule is possible (it is)

    if(stage_type == 'Swiss'){
        let latest_match_played = {}
        let match_history = await Match.getByTeams(pairings.flat());
        match_history = match_history.filter(match => match.status == 'completed');
            
        for(let team_id in team_ranks){
            let team_history = match_history.filter(match => match.team_1 == team_id || match.team_2 == team_id);
            let latest = 0;
            if(team_history.length)
                latest = Math.max(...(team_history.map(match => match.slot_number)));

            latest_match_played[team_id] = latest;
        }

        console.log('latest matches played:',latest_match_played)

        pairings.sort((pair1,pair2) => {
            let latest1 = Math.max(latest_match_played[pair1[0]],latest_match_played[pair1[1]]);
            let latest2 = Math.max(latest_match_played[pair2[0]],latest_match_played[pair2[1]]);

            return latest1 - latest2;
        })

        console.log('sorted pairs:',pairings)
    }


    // IF BRACKET:

    // sort in descending order of rank, keep top matches for the later slots

    if(stage_type == 'Bracket'){
        pairings.sort((pair1,pair2) => {
            let min_rank1 = Math.min(team_ranks[pair1[0]],team_ranks[pair1[1]]);
            let min_rank2 = Math.min(team_ranks[pair2[0]],team_ranks[pair2[1]]);

            return min_rank2 - min_rank1;
        })

        console.log('team ranks:',team_ranks)
        console.log('sorted pairs:',pairings);
    }

    let promises = [];
    pairings.forEach((pair,i) => {
        placeholders[i].team_1 = pair[0];
        placeholders[i].team_2 = pair[1];
        placeholders[i].status = "pending";
        placeholders[i].rank_1 = team_ranks[pair[0]]
        placeholders[i].rank_2 = team_ranks[pair[1]]

        // console.log(stage_data.division,stage_data.stage_name,placeholders[i].id);
        // console.log(pair)

        promises.push(placeholders[i].save());
        promises.push(Team.setStageUpcoming(pair[0], stage_data.id, placeholders[i].id))
        promises.push(Team.setStageUpcoming(pair[1], stage_data.id, placeholders[i].id))
    })

    await Promise.all(promises);
    console.log(`Added fixtures for ${stage_data.stage_name}!`)
}







const validateData = async function(data){ // instead of returning false, throw an error
    console.log('validateData')
    // console.log(data)
    if(data.formats == undefined) return false;
    if(data.pools == undefined) return false;

    console.log('checking pool lengths')

    for(let division of ['Open',"Women's"]){
        if(data.formats[division] == undefined) return false;
        if(data.pools[division] == undefined) return false;

        // if(data.formats[division].num_teams != data.pools[division].flat().length) return false;

        let f = data.formats[division].format;

        // console.log(division,f)
        if(new Set(['Swiss']).has(f) == false) return false;

        
        // if(f == '2Swiss' && data.pools[division].length != 2) return false;
        // if(f == '2Swiss' && data.pools[division].length != 2) return false;
        // if(f == '1Swiss' && data.pools[division].length != 1) return false;

    }


    return true;
}


const createStages = async function(formats, pools){
    console.log('createStages');
    var promises = [];
    for(let division in formats){
        let f = formats[division].format;
        
        // things to add:
        // dependencies,
        // initial stage
        // teams
        // stage_name

        let pool_names = ['A','B','C','D'];
        let teams = pools[division];
        for(let i=0; i<formats[division].num_pools; i++){
            let pool_name = pool_names[i];
            for(let j=0; j<formats[division].num_rounds; j++){
                promises.push(Stage.create({
                    stage_name: `${pool_name}-R${j+1}`,
                    description: `${division}: Pool-${pool_name} Round-${j+1}`,
                    division: division,
                    type: "Swiss",
                    pool: `Swiss-${pool_name}`,
                    status: "pending",
                    semi_final: false,
                    initial_stage: (j==0),
                    dependencies: (j==0) ? [] : [`${pool_name}-R${j}`],
                    teams: [...teams[i]],
                    table: []
                }))
            }
        }

        let cur_dependencies = [];
        for(let i=0; i<formats[division].num_pools; i++){
            cur_dependencies.push(`${pool_names[i]}-R${formats[division].num_rounds}`);
        }
        if(formats[division].semi_final){
            promises.push(Stage.create({
                stage_name: `SF`,
                description: `${division}: Semi-final bracket`,
                division: division,
                type: "Bracket",
                pool: 'Brackets',
                status: "pending",
                semi_final: true,
                initial_stage: false,
                dependencies: [...cur_dependencies],
                teams: teams.flat(),
                table: []
            }));
            cur_dependencies = ['SF'];
        }
        promises.push(Stage.create({
            stage_name: `F`,
            description: `${division}: Final bracket`,
            division: division,
            type: "Bracket",
            pool: 'Brackets',
            status: "pending",
            semi_final: false,
            initial_stage: false,
            dependencies: [...cur_dependencies],
            teams: teams.flat(),
            table: []
        }))

    }
    return await Promise.all(promises);
}






exports.sortSwissTable = async function(rows){
    // get match history of these teams
    var group_matches = await Match.getByTeams(rows.map(row => row.team_id));

    // dictionary of all teams defeated
    var defeated_opps = {};
    console.log('rows:',rows)
    rows.forEach(row => {defeated_opps[row.team_id.toString()] = new Set()})
    group_matches.forEach(match => {
        if(match.status != 'completed') return;
        if(match.result.outcome == 'D') return;

        if(match.result.outcome == 'W'){
            defeated_opps[match.team_1.toString()].add(match.team_2.toString())
        }
        else if(match.result.outcome == 'L'){
            defeated_opps[match.team_2.toString()].add(match.team_1.toString())
        }

    })
    // let team_names = {}
    // for(let team in defeated_opps){
    //     team_names[team] = (await Team.findById(team))?.team_name;
    // }
    // console.log('defeated opps');
    // for(let team in team_names)
    //     console.log(team_names[team], Array.from(defeated_opps[team]).map(t=>team_names[t]));

    rows = rows
            .map(value => ({ value, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => value)
    
    rows.sort((r1,r2) => {
        if(r2.points > r1.points) return 1;
        if(r2.points < r1.points) return -1;

        if(defeated_opps[r1.team_id].has(r2.team_id.toString())) return -1;
        if(defeated_opps[r2.team_id].has(r1.team_id.toString())) return 1;

        if(r2.OPT > r1.OPT) return 1;
        if(r2.OPT < r1.OPT) return -1;

        if(r2.GD > r1.GD) return 1;
        if(r2.GD < r1.GD) return -1;

        if(r1.team_id > r2.team_id) return 1;
        if(r1.team_id > r2.team_id) return -1;

        return -1;
    })

    console.log(rows);

    return rows;


}