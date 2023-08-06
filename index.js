
const app = require('express')();
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const cors = require('cors')
app.use(cors())

const cookieSession = require('cookie-session');

app.use(
    cookieSession({
        name: "sakkath-session",
        keys: ["COOKIE_SECRET"], // should use as secret environment variable
        httpOnly: true,
    })
);

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
    `mongodb+srv://dhruvapanyam16:dhruvapanyam@sakkath-db.ihmzxku.mongodb.net/?retryWrites=true&w=majority`
)

async function run(){
    // console.log(await Team.find().select("_id"));
    // console.log(await Stage.find());
    // console.log(await 
    //     Match.find()
    //         .populate("team_1", "team_name")
    //         .populate("team_2", "team_name")
    //         .populate("stage", "stage_name division")
    //         );

    // await Team.deleteMany();
    // console.log('hello',await Tournament.findOne())

    // console.log(await Stage.findTransitionStage("A-R6", "Open"))
    // let u = await UserService.signup({username: 'dpan', password: 'dpan'});
    // console.log(u)
    // console.log(await UserService.checkPassword('dpan',u.password));

    // var teams = await Team.find();
    // await User.deleteMany();
    // var users = await User.find();
    // console.log(users)
    // for(let team of teams){
    //     UserService.signup({
    //         username: (team.team_code+team.division[0]).toLowerCase(),
    //         password: (team.team_code+team.division[0]).toLowerCase(),
    //         team_id: team.id,
    //         role: 'captain'
    //     })
    // }


    // let m = (await Match.findOne());
    // m.result = {...(new Match()).result};
    // await m.save();
    // console.log(m)

    // let teams = await Team.find();
    // for(let i=0; i<teams.length; i++){
    //     teams[i].roster = [];
    //     for(let j=1; j<16; j++){
    //         teams[i].roster.push(`${teams[i].team_code} - Player ${j}`)
    //     }
    //     await teams[i].save();
    // }

    // console.log(teams);

    // let slots = ["0630","0740","0850","1000","1100","1220","1330","1440","1550","1700"]
    // for(let i=0; i<30; i++){
    //     await Slot.create({
    //         timeslot_number: i,
    //         start_time: slots[i%10]
    //     });
    // }

    // console.log(await Slot.find())

}
run();


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