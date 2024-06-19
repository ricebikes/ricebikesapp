var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var Repair = require('../models/Repair');
var authmiddleware=require('../middleware/AuthMiddleware');
var adminMiddleware=require('../middleware/AdminMiddleware');

router.use(bodyParser.json());
router.use(authmiddleware);



router.get('/search', function (req, res) {
  if (!req.query.q) {
    return res.status(400).send();
  }
  Repair.find({$text: {$search: req.query.q}, disabled: false}, function (err, repairs) {
    if (err) return res.status(500);
    res.status(200).json(repairs);
  });
});

// everything below here is only for admins, so use the admin middleware to block it

router.use(adminMiddleware);
// get all repairs
router.get('/',function (req, res) {
    Repair.find({disabled: false}, function (err,repairs) {
        if(err) return res.status(500);
        res.status(200).json(repairs);

    })
});

// allow posting new repairs
router.post('/',function (request, response) {
    Repair.create({
        name:request.body.name,
        description:request.body.description,
        price:request.body.price
    }, function (err,repair) {
        if(err) return response.status(500);
        // respond with the created repair
        response.status(200).json(repair);
    })
}
);

// allow updating repairs with put
router.put('/:id',function (req,res) {
   Repair.findByIdAndUpdate(req.params.id,req.body,{new:true},function (err, repair) {
       if (err) return res.status(500).json();
       if (!repair) return res.status(404).json();
       return res.status(200).json(repair);
   });
});

// allow repair deletion
router.delete('/:id', function (req, res) {
    Repair.findById(req.params.id, function (err, repair) {
        if (err) res.status(500).json();
        if (!repair) res.status(404).json();
        repair.remove(function (err) {
            if (err) res.status(500).json({err: "There was a problem deleting the repair"})
        });
        res.status(200).end();
    });
});

module.exports = {router: router};
