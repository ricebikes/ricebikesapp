/**
 * COPIED FROM OLD APP, UPDATING CURRENTLY
 */

// Import the mongoose module
const mongoose = require("mongoose");

// Set `strictQuery: false` to globally opt into filtering by properties that aren't in the schema
// Included because it removes preparatory warnings for Mongoose 7.
// See: https://mongoosejs.com/docs/migrating_to_6.html#strictquery-is-removed-and-replaced-by-strict
mongoose.set("strictQuery", false);

// MOVE THIS SO ALL MODELS CAN USE?
const Schema = mongoose.Schema;

var CustomerSchema = new mongoose.Schema({
  first_name: String,
  last_name: String,
  email: String,
  phone: String,
});

CustomerSchema.index({'$**': 'text'});
mongoose.model('Customer', CustomerSchema);

module.exports = mongoose.model('Customer');