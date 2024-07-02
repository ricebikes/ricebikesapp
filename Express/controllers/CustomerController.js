/**
 * 6/28/24 - added pagination and error handling for it
 */
var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var Customer = require('../models/Customer');
const authMiddleware = require('../middleware/AuthMiddleware');

router.use(bodyParser.json());
router.use(authMiddleware);

router.get('/search', async function (req, res) {
  /**
   * keep track of the page, the page limit, and the skip for pagination
   */
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  // error handling for invalid pagination
  if (page < 1 || limit < 1) {
    return res.status(400).json({ error: 'Invalid page or limit value'});
  }

  const skip = (page - 1) * limit;

  try {
    const customers = await Customer.find({ $text: {$search: req.query.q } }).skip(skip).limit(limit).exec();
    res.status(200).json(customers);
  } catch (err) {
    console.error('Error searching customers: ', err);
    res.status(500).json({ error: 'Internal server error'});
  }
});

module.exports = { router: router };