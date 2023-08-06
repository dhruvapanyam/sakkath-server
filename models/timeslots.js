const mongoose = require('mongoose');

const slotSchema = mongoose.Schema({
    timeslot_number: Number,
    start_time: String
})

module.exports = mongoose.model('Slot', slotSchema);