var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  let formdata = req.query;
  let page = 'index';
  let title = 'University DB'
  if (formdata.role) {
    page = formdata.role.toLowerCase();
    title = formdata.role
  }
  res.render(page, {
    title: title,
    formdata: formdata,
    role: formdata.role
  });
});

module.exports = router;
