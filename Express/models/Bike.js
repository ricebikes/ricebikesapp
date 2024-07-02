/**
 * Bike objects store general information about bikes
 * 
 * Note 6/10/24:
 * Changes from old app: added transaction field so we can have transactions 
 * be associated with bikes, instead of it being the other way around.
 */

var mongoose = require('mongoose');

var BikeSchema = new mongoose.Schema({
  make: String,
  model: String,
  description: String,
  transactions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }]
});

BikeSchema.index({'$**': 'text'});
mongoose.model('Bike', BikeSchema);

module.exports = mongoose.model('Bike');