var express = require('express');
var router = express.Router();
const indexController = require("../controllers/indexControllers");


router.get('/319', indexController.index);


module.exports = router;