/* IMPORTANT - this file contains placeholder code
referencing the Grasshopper database. Any references to that
database will be removed at a later point. */

var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  console.info('GET Formdata:', req.app.locals.formdata);
  makePage(req.query, req, res, next);
});

/* POST home page */
router.post('/', function(req, res, next) {
  console.info('POST Formdata:', req.app.locals.formdata);
  makePage(req.body, res, next);
});

function makePage(formdata, req, res, next) {
  req.app.locals.formdata = formdata;
  if (formdata.role) {
    req.app.locals.page = formdata.role.toLowerCase();
    req.app.locals.title = formdata.role
    if (formdata.role === "Passenger" || formdata.role === "Scheduler") {
      queryFlights(formdata, req, res, next);
    }
    else {
      renderErrorPage(400, `Unknown role: ${formdata.role}`, formdata, res);
    }
  }
  else {
    req.app.locals.page = 'index';
    req.app.locals.title = 'University DB';
    renderPage(formdata, req, res, next);
  }
}

function renderPage(formdata, req, res, next) {
  res.render(req.app.locals.page, {
    title: req.app.locals.title,
    formdata: formdata,
    role: formdata.role,
    flights: req.app.locals.flights,
    tickets: req.app.locals.tickets,
    name: req.app.locals.psgr_name
  });
}

function renderErrorPage(code, msg, formdata, res) {
  let codemsg = '500: Internal server error';
  switch (code) {
    case 400:
      codemsg = '400: Bad request';
      break;
    case 518:
      codemsg = "518: I'm a teapot";
      break;
    default:
      break;
  }
  res.render('error', {
    message: msg,
    error: {
      status: codemsg,
      stack: JSON.stringify(formdata)
    }
  })
}

module.exports = router;
