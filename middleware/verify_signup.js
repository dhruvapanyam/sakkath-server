const User = require('../models/users');
const UserService = require('../services/users');

const checkDuplicateUsername = async function(req, res, next){
    try{
        if(!req?.body?.username) throw `No username found!`

        let users = await User.findByUsername(req.body.username);
        console.log('found for username:',users)
        if(users.length) throw `Username already exists!`;


        next();
        
    }
    catch(e){
        return res.status(500).json({status: 400, message: e});
    }
}


const verifySignup = {
    checkDuplicateUsername
}

module.exports = verifySignup;