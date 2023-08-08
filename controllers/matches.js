const MatchService = require('./../services/matches');
const Match = require('./../models/matches');
const User = require('../models/users');


exports.getFixtures = async function(req, res, next){
    try{
        // var matches = await Match.find().populate("stage", "stage_name division").populate("team_1", "team_name logo").populate("team_2", "team_name logo");
        var matches = await MatchService.getFixtures();
        return res.status(200).json(matches);
    }
    catch(e){
        return res.status(400).json({status: 400, message: e});
    }
}

exports.getFixturesByDay = async function(req, res, next){
    var day = req.params.day;
    try{
        var teams = await Match.find().where("day").equals(day);
        return res.status(200).json(teams);
    }
    catch(e){
        return res.status(400).json({status: 400, message: e});
    }
}


exports.addResult = async function(req, res, next){
    var match_id = req.params.match_id;
    var user_id = req.user_id;
    var result_data = req.body;
    // console.log(match_id, result_data);
    try{

        // var temp_team_1 = req.body.temp_team_1;
        // var temp_team_2 = req.body.temp_team_2;

        // console.log('temp team submitting:',req.body);


        // await MatchService.addResult(match_id, result_data, temp_team_1);
        // await MatchService.addResult(match_id, result_data, temp_team_2);


        
        // please uncomment below and comment above!!!

        // check if user_id is a valid user (token has been verified)
        var [user, fixture] = await Promise.all([User.findById(user_id), Match.findById(match_id)]);
        if(user.team_id == null){
            throw `Unauthorized to add this result`;
        }
        if(fixture.team_1.toString() != user.team_id.toString() && fixture.team_2.toString() != user.team_id.toString()){
            throw `Unauthorized to add this result`;
        }

        


        await MatchService.addResult(match_id, result_data, user.team_id);
        return res.status(200).json();
    }
    catch(e){
        console.log('err add result:',e)
        return res.status(400).json({status: 400, message: e});
    }

}

exports.addSpiritScore = async function(req, res, next){
    var match_id = req.params.match_id;
    var user_id = req.user_id;
    var spirit_data = req.body;
    // console.log(match_id, result_data);
    try{
        // check if user_id is a valid user (token has been verified)
        var [user, fixture] = await Promise.all([User.findById(user_id), Match.findById(match_id)]);
        if(user.team_id == null){
            throw `Unauthorized to add this result`;
        }
        if(fixture.team_1.toString() != user.team_id.toString() && fixture.team_2.toString() != user.team_id.toString()){
            throw `Unauthorized to add this result`;
        }


        var match = await MatchService.addSpiritScore(match_id, spirit_data, user.team_id);
        return res.status(200).json();
    }
    catch(e){
        console.log('err add result:',e)
        return res.status(400).json({status: 400, message: e});
    }

}





exports.addFixture = async function(req, res, next){
    var fix_data = req.body;
    try{
        var teams = await Match.create(fix_data);
        return res.status(200).json(teams);
    }
    catch(e){
        return res.status(400).json({status: 400, message: e});
    }
}