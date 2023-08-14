const authConfig = require('../config/auth.config');
const User = require('./../models/users');
const UserService = require('./../services/users');
const jwt = require('jsonwebtoken')


exports.signup = async function(req, res, next){
    try{
        let user = await UserService.signup(req.body);
        return res.status(200).json({message: 'Successfully registered!'});
    }
    catch(e){
        return res.status(400).json({status: 400, message: e});
    }
}


exports.signin = async function(req, res, next){
    try{
        console.log('signing in')
        
        const users = await User.find({username:req.body.username}).populate("team_id", "team_name logo");
        if (users.length === 0) {
            return res.status(400).json({ message: "User Not found." });
        }
        const user = users[0];

        if(UserService.checkPassword(req?.body?.password, user.password) == false) {
            console.log('incorrect pwd')
            throw `Incorrect password!`
        }
        console.log('checking pwd',authConfig)


        const token = jwt.sign({ id: user.id },
            authConfig.secret,
            {
                algorithm: 'HS256',
                allowInsecureKeySizes: true,
                expiresIn: 86400, // 24 hours
            });

        // console.log('hi')
        // req.session.token = token;
        return res.status(200).json({
            id: user.id,
            username: user.username,
            token: token,
            team_name: user.team_id?.team_name,
            logo: user.team_id?.logo,
            team_id: user.team_id?.id
          });
    }
    catch(e){
        console.log(e)
        return res.status(400).json({status: 400, message: e});
    }
}


exports.signout = async (req, res) => {
    try {
        return res.status(200).json({
            message: "You've been signed out!"
        });
    } catch (err) {
        this.next(err);
    }
  };