/**
 * Repair stores information about a repair; name, price, description of what consitutes the repair,
 * and if it is disabled.
 * 
 * Note 6/10/24:
 * Schema is unchanged from old app.
 */

var mongoose = require('mongoose');

var RepairSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  disabled: {type: Boolean, default: false}
});

RepairSchema.index({name: 'text'});
mongoose.model('Repair', RepairSchema);

module.exports = mongoose.model('Repair');
