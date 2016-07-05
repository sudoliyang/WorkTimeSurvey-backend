var express = require('express');
var router = express.Router();
var cors = require('./cors');
var HttpError = require('./errors').HttpError;

router.use(cors);

/*
 * GET /
 * [page = 0]
 * [key = ""]: on empty, it will search all company
 * Show 25 results per page
 */
router.get('/search', function(req, res, next) {
    var search = req.query.key || "";
    var page = req.query.page || 0;
    var q;

    if (search == "") {
        q = {};
    } else {
        q = {name: new RegExp("^" + search)};
    }

    var collection = req.db.collection('companies');

    collection.find(q).skip(25 * page).limit(25).toArray().then(function(results) {
        res.send(results);
    }).catch(function(err) {
        next(new HttpError("Internal Server Error", 500));
    });
});

module.exports = router;