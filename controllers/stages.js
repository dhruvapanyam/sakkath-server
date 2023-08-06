const StageService = require('./../services/stages');
const Stage = require('./../models/stages');

exports.addStage = async function(req, res, next){
    var stage_data = req.body;
    try{
        var stage = await Stage.create(stage_data);
        return res.status(200).json(stage);
    }
    catch(e){
        return res.status(400).json({status: 400, message: e});
    }
}

exports.getStages = async function(req, res, next){
    try{
        var teams = await StageService.getStagesInfo();
        return res.status(200).json(teams);
    }
    catch(e){
        return res.status(400).json({status: 400, message: e});
    }
}