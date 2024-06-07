/**
 * COPIED FROM OLD APP, UPDATE
 */
var mongoose = require('mongoose');

var CustomerSchema = new mongoose.Schema({
  first_name: String,
  last_name: String,
  email: String,
  phone: String,
});

CustomerSchema.index({'$**': 'text'});
mongoose.model('Customer', CustomerSchema);

module.exports = mongoose.model('Customer');