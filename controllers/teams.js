const TeamService = require('./../services/teams');
const Team = require('./../models/teams');
const authConfig = require('../config/auth.config');
const jwt = require('jsonwebtoken');
const User = require('../models/users');


exports.getTeams = async function(req, res, next){
    try{
        var teams = await TeamService.getTeams();
        return res.status(200).json(teams);
    }
    catch(e){
        return res.status(500).json({status: 400, message: e});
    }
}



exports.getTeamInfo = async function(req, res, next){
    var id = req.params.id || null;
    // console.log(id)

    try{
        // console.log('hello!')
        var info = await TeamService.getTeamInfo(id);

        // check if token is current team's

        let token = req.header('x-auth-token');
        jwt.verify(
            token,
            authConfig.secret,
            async (err, decoded) => {
                let own_team = false;
                if(!err){
                    let user = await User.findById(decoded.id);
                    own_team = (user?.team_id == id);
                }
                else{
                    // console.log('token team info error:',err?.name)
                }
                return res.status(200).json({...info, own_team});
            }
        );

        // console.log('waiting for team info verification')
        // console.log(info)
    }
    catch(e){
        console.log(`err: ${e}`)
        return res.status(500).json({status: 400, message: e});
    }
}
exports.getTeamResults = async function(req, res, next){
    var id = req.params.id || null;
    // console.log(id)

    try{
        var info = await TeamService.getTeamResults(id);
        // console.log(info)
        return res.status(200).json(info);
    }
    catch(e){
        return res.status(500).json({status: 400, message: e});
    }
}


exports.addTeam = async function(req, res, next){
    var team_data = req.body;
    console.log(req.body)
    try{
        await Team.create(team_data);
        return res.status(200).json();
    }
    catch(e){
        return res.status(500).json({status: 400, message: e});
    }
}