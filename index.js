const app = require('express')();
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const cors = require('cors')
app.use(cors())

const fs = require('fs');
const cert = fs.readFileSync('./certificate.crt');
const key = fs.readFileSync('./private.key');

const creds = {key, cert};

app.use(function(req, res, next) {
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, Content-Type, Accept"
    );
    next();
});

const PORT = process.env.PORT || 4040;
app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}...`)
});

const mongoose = require('mongoose');

const Team = require('./models/teams')
const Match = require('./models/matches')
const Stage = require('./models/stages')
const User = require('./models/users')
const Tournament = require('./models/tournament');
const Slot = require('./models/timeslots');

const TeamController = require('./controllers/teams');
const MatchController = require('./controllers/matches');
const StageController = require('./controllers/stages');
const TournamentController = require('./controllers/tournament');
const AuthController = require('./controllers/auth');

const UserService = require('./services/users');
const verifySignup = require('./middleware/verify_signup');
const authJwt = require('./middleware/auth_jwt');
const TournamentService = require('./services/tournament');
const { isAdmin, verifyToken } = require('./middleware/auth_jwt');

mongoose.connect(
    `mongodb+srv://dhruvapanyam16:dhruvapanyam@sakkath-db.ihmzxku.mongodb.net/?retryWrites=true&w=majority`,{
        dbName: 'sakkath-final-demo'
        // dbName: 'test'
    }
)
.then(()=>{
    console.log('connected to the DB!')
})

// const team_details = require('./team_details/team_details.json')


async function setup_new_database(){
    // things to do:
    // 1. add a tournament entry
    // 2. time slots data
    // 3. teams
    // 4. users + admin
    // 5. delete all stages, matches

    // 1. add a tournament
    await Tournament.deleteMany();
    await Tournament.create({
        formats: {"Open":{}, "Women's":{}},
        pools: {"Open":[],"Women's":[]}
    })


    // 2. add time slots
    await Slot.deleteMany();
    const default_slots = ['0630','0740','0850','1000','1110','1220','1330','1440','1550','1700'];
    for(let i=0; i<30; i++){
        await Slot.create({
            timeslot_number: i,
            start_time: default_slots[i%10]
        });
    }


    // 3. add teams
    await Team.deleteMany();
    for(let team_data of team_details){
        await Team.create(team_data);
    }

    // 4. add users
    await User.deleteMany();
    for(let team of await Team.find()){
        let username = (team.team_code + team.division[0]).toLowerCase();
        console.log(username)

        await UserService.signup({
            username,
            password: username,
            role: 'captain',
            team_id: team._id
        })
    }

    await UserService.signup({
        username: 'admin',
        password: 'admin',
        role: 'admin'
    })


    // 5. delete all matches, stages
    await Match.deleteMany();
    await Stage.deleteMany();

    
}

// --------------------------------------------------------------------------------
async function run(){

    // setup_new_database();

    // let stage = await Stage.findOne({stage_name: 'B-R6', division: 'Open'});
    // await TournamentService.sortSwissTable([...stage.table]);




}
run();
// --------------------------------------------------------------------------------


// Teams
app.get('/teams', TeamController.getTeams);
app.get('/team_results/:id', TeamController.getTeamResults);
app.get('/team_info/:id', TeamController.getTeamInfo);

app.post('/teams', TeamController.addTeam); // remember to add required fields



// Matches
app.get('/fixtures', MatchController.getFixtures)

// app.post('/fixtures', MatchController.addFixture)



// Standings
app.get('/standings', StageController.getStages)

app.post('/stages', StageController.addStage) // not for client



// Results
app.post('/result/:match_id', authJwt.verifyToken,MatchController.addResult)
app.post('/spirit_score/:match_id', authJwt.verifyToken,MatchController.addSpiritScore)






// Login
app.post('/signup', 
    [
        verifySignup.checkDuplicateUsername,
    ],
    AuthController.signup
)

app.post("/signin", AuthController.signin);

app.post("/signout", AuthController.signout);



app.get('/test', authJwt.verifyToken, (req, res, next) => {
    console.log(req.user_id);
    res.send();
})


app.get('/admin_access', verifyToken, isAdmin, (req, res) => {
    res.send();
})


// Tourney
app.put('/tournament', verifyToken, isAdmin, TournamentController.resetTournament)



app.post('/schedule_load', verifyToken, isAdmin, async (req, res) => {
    try{
        await TournamentService.loadScheduleTemplate(req.body);
        res.json()
    }
    catch(e){
        console.log(e);
        res.status(400).json({message: e})
    }
})

app.post('/schedule_start', verifyToken, isAdmin, async (req, res) => {
    try{
        await TournamentService.beginInitialStages();
        res.json()
    }
    catch(e){
        console.log(e);
        res.status(400).json({message: e})
    }
})




app.post('/schedule_change', verifyToken, isAdmin, async (req, res) => {
    try{
        let changed_data = req.body;
        for(let match_data of changed_data){
            let match = await Match.findById(match_data.id);
            if(!match?.id) continue;

            match.slot_number = match_data.slot_number;

            // console.log(match.match_number, match);
            console.log('changed data of match #',match.match_number);

            await match.save();
        }

        return res.json();
    }
    catch(e){
        console.log(e)
        res.status(400).json({message: e})
    }
})



app.get('/timeslots', verifyToken, isAdmin, async (req, res) => {
    try{
        let slots = await Slot.find();
        let slot_start_times = [
            [0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0]
        ];
        slots.forEach(slot => {
            let t = slot.timeslot_number;
            slot_start_times[Math.floor(t/10)][t%10] = slot.start_time;
        })

        return res.json(slot_start_times);
    }
    catch(e){
        console.log(e)
        res.status(400).json({message: e})
    }
})


app.post('/timeslots_change', verifyToken, isAdmin, async (req, res) => {

    // console.log(req.body);
    // return;
    try{
        let changed_data = req.body;
        for(let timeslot_number in changed_data){
            let slot = await Slot.findOne({timeslot_number: timeslot_number});
            if(!slot?.id) continue;

            slot.start_time = changed_data[timeslot_number];
            await slot.save();

            // console.log(match.match_number, match);
            console.log('changed slot',slot);
        }

        return res.json();
    }
    catch(e){
        console.log(e)
        res.status(400).json({message: e})
    }
})

// app.get('/mvps', verifyToken, isAdmin, async (req, res) => {
    app.get('/mvps', async (req, res) => {
        try{
            let matches = await Match.find().where('status').equals('completed').select('team_1 team_2 spirit.mvp_1 spirit.mvp_2').populate('team_1','team_name division').populate('team_2','team_name division')
            let team_mvps = {}
            matches.forEach(match => {
                if(match.team_1._id in team_mvps == false) team_mvps[match.team_1._id] = {team_name: match.team_1.team_name, division: match.team_1.division, mvps:[]};
                if(match.team_2._id in team_mvps == false) team_mvps[match.team_2._id] = {team_name: match.team_2.team_name, division: match.team_2.division, mvps:[]};
        
                team_mvps[match.team_1._id].mvps.push(match.spirit?.mvp_1);
                team_mvps[match.team_2._id].mvps.push(match.spirit?.mvp_2);
            })

            let results = {'Open': [], "Women's": []}
            for(let team in team_mvps){
                let team_data = await Team.findById(team).select('stage_rank');
                team_mvps[team].rank = team_data.stage_rank;
                team_mvps[team].mvps.sort();
                const counts = {};
                const sampleArray = [...team_mvps[team].mvps];
                sampleArray.forEach(function (x) { counts[x] = (counts[x] || 0) + 1; });
                let sorted_counts = Object.keys(counts).map(player => [player, counts[player]])
                sorted_counts.sort((p1,p2) => p1[1] - p2[1])
                // if(counts["undefined"]) delete counts["undefined"]

                results[team_mvps[team].division].push({
                    team_name: team_mvps[team].team_name,
                    rank: team_mvps[team].rank,
                    players: counts
                })
            }

            results.Open.sort((t1,t2) => t1.rank - t2.rank)
            results['Women\'s'].sort((t1,t2) => t1.rank - t2.rank)



            return res.type('json').send(JSON.stringify(results, null, 2) + '\n');
        }
        catch(e){
            console.log(e)
            res.status(500).json({message:e});
        }
    })
    

// app.get('/msps', verifyToken, isAdmin, async (req, res) => {
    app.get('/msps', async (req, res) => {
        try{
            let matches = await Match.find().where('status').equals('completed').select('team_1 team_2 spirit.msp_1 spirit.msp_2').populate('team_1','team_name division').populate('team_2','team_name division')
            let team_msps = {}
            matches.forEach(match => {
                if(match.team_1._id in team_msps == false) team_msps[match.team_1._id] = {team_name: match.team_1.team_name, division: match.team_1.division, msps:[]};
                if(match.team_2._id in team_msps == false) team_msps[match.team_2._id] = {team_name: match.team_2.team_name, division: match.team_2.division, msps:[]};
        
                team_msps[match.team_1._id].msps.push(match.spirit?.msp_1);
                team_msps[match.team_2._id].msps.push(match.spirit?.msp_2);
            })

            let results = {'Open': [], "Women's": []}
            for(let team in team_msps){
                let team_data = await Team.findById(team).select('stage_rank');
                team_msps[team].rank = team_data.stage_rank;
                const counts = {};
                const sampleArray = [...team_msps[team].msps];
                sampleArray.forEach(function (x) { counts[x] = (counts[x] || 0) + 1; });
                // if(counts["undefined"]) delete counts["undefined"]

                results[team_msps[team].division].push({
                    team_name: team_msps[team].team_name,
                    rank: team_msps[team].rank,
                    players: counts
                })
            }

            results.Open.sort((t1,t2) => t1.rank - t2.rank)
            results['Women\'s'].sort((t1,t2) => t1.rank - t2.rank)


            return res.type('json').send(JSON.stringify(results, null, 2) + '\n');
        }
        catch(e){
            console.log(e)
            res.status(500).json({message:e});
        }
    })
    
    

// app.get('/msps', verifyToken, isAdmin, async (req, res) => {
app.get('/spirit_ranking', async (req, res) => {
    try{
        let matches = await Match.find().where('status').equals('completed').select('team_1 team_2 spirit.spirit_score_1 spirit.spirit_score_2').populate('team_1','team_name division').populate('team_2','team_name division')
        let team_spirit = {}
        matches.forEach(match => {
            if(match.team_1._id in team_spirit == false) team_spirit[match.team_1._id] = {team_name: match.team_1.team_name, division: match.team_1.division, spirit:[0,0]};
            if(match.team_2._id in team_spirit == false) team_spirit[match.team_2._id] = {team_name: match.team_2.team_name, division: match.team_2.division, spirit:[0,0]};


    
            team_spirit[match.team_1._id].spirit[0] += (match.spirit?.spirit_score_1 || []).reduce((partial, a) => partial + a, 0);;
            team_spirit[match.team_2._id].spirit[0] += (match.spirit?.spirit_score_2 || []).reduce((partial, a) => partial + a, 0);;
            if(match.spirit?.spirit_score_1.length) team_spirit[match.team_1._id].spirit[1] += 1
            if(match.spirit?.spirit_score_2.length) team_spirit[match.team_2._id].spirit[1] += 1
        })

        let results = {'Open': [], "Women's": []}
        for(let team in team_spirit){
            let team_data = await Team.findById(team).select('stage_rank');
            team_spirit[team].rank = team_data.stage_rank;
            results[team_spirit[team].division].push({
                team_name: team_spirit[team].team_name,
                rank: team_spirit[team].rank,
                spirit: team_spirit[team].spirit[1] ? team_spirit[team].spirit[0] / team_spirit[team].spirit[1] : 0
            })
        }

        results.Open.sort((t1,t2) => t2.spirit - t1.spirit)
        results['Women\'s'].sort((t1,t2) => t2.spirit - t1.spirit)


        return res.type('json').send(JSON.stringify(results, null, 2) + '\n');
    }
    catch(e){
        console.log(e)
        res.status(500).json({message:e});
    }
})

    


app.get('/spirit_pending', async (req, res) => {
    try{
        let matches = await Match.find({status: 'completed'})
                                .populate('team_1', 'team_name')
                                .populate('team_2', 'team_name')
                                .select('team_1 team_2 match_number spirit.spirit_score_1 spirit.spirit_score_2');
        
        let pending = matches.filter(match => match.spirit.spirit_score_1.length + match.spirit.spirit_score_2.length < 20);

        var response = pending.map(match => {
            return {
                match_number: match.match_number,
                team_1: match.team_1.team_name,
                team_2: match.team_2.team_name,
                team_1_submitted: (match.spirit.spirit_score_2.length == 10),
                team_2_submitted: (match.spirit.spirit_score_1.length == 10),
            }
        })

        return res.status(200).json(response)

    }
    catch(e){
        console.log(e);
        return res.status(400).json();
    }
})
    
    


app.get('/health', (req, res) => {
    return res.status(200).send();
})





const https = require('https');
const httpsServer = https.createServer(creds, app);
httpsServer.listen(443);
