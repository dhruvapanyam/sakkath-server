const User = require('./../models/users');

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");


exports.signup = async function(user_data){
    // console.log(user_data.password)
    user_data.password = bcrypt.hashSync(user_data.password);
    // console.log(user_data.password)
    let user = await User.create(user_data);
    return user;
}


exports.checkPassword = function(pwd, hash){
    console.log('comparing',pwd,hash, bcrypt.compareSync(pwd, hash))
    return bcrypt.compareSync(pwd, hash);
}
