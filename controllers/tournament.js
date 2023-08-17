const TournamentService = require('./../services/tournament');
const Tournament = require('./../models/tournament');


exports.resetTournament = async function(req, res, next){
    var tourney_data = req.body;
    // console.log(tourney_data)
    try{
        console.log('attempting')
        var T = await TournamentService.resetTournament(tourney_data);
        return res.status(200).json(T);
    }
    catch(e){
        console.log('caught',e)
        return res.status(500).json({status: 400, message: e});
    }
}