const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    username: String,
    password: String,
    role: String,
    team_id: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: "Team"
    }
})

userSchema.statics.findByUsername = async function(u){
    return await this.find({username: u});
}


module.exports = mongoose.model('User', userSchema);;