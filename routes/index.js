/* IMPORTANT - this file contains placeholder code
referencing the Grasshopper database. Any references to that
database will be removed at a later point. 

Also, yes, you cannot load student/faculty/registrar pages quite yet :)
*/

var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  console.info('GET Formdata:', req.query);
  makePage(req.query, req, res, next);
});

/* POST home page */
router.post('/', function(req, res, next) {
  console.info('POST Formdata:', req.body);
  makePage(req.body, res, next);
});

function makePage(formdata, req, res, next) {
  req.app.locals.formdata = formdata;
  try {
    performActions(formdata, req);

    if (formdata.role) {
      req.app.locals.page = formdata.role.toLowerCase();
      req.app.locals.title = formdata.role
      // TODO: Change function name to reflect University DB
      queryFlights(formdata, req, res, next);
    }
    else {
      req.app.locals.page = 'index';
      req.app.locals.title = 'University DB';
      renderPage(formdata, req, res, next);
    }

    renderPage(formdata, req, res, next);
  } catch (err) {
    renderErrorPage(err, req, res, next);
  }
}

function performActions(formdata, req) {
  if (formdata.action) {
    switch(formdata.action) {
      case "something1":
        // something1();
        break;
      case "something2":
        // something2();
        break;
    }
  }
}

// TODO: Here, add the code for our SQL queries

//

function renderPage(formdata, req, res, next) {
  // Obviously, change this to reference University DB
  res.render(req.app.locals.page, {
    title: req.app.locals.title,
    formdata: formdata,
    role: formdata.role,
    flights: req.app.locals.flights,
    tickets: req.app.locals.tickets,
    name: req.app.locals.psgr_name
  });
}

function renderErrorPage(err, req, res, next) {
  let code = 500;
  let msg = err.message;

  const regex = /^[0-9]{3}/
  const found = msg.match(regex);
  if (found) {
    code = parseInt(found[0]);
    msg = msg.slice(3).trim();
  }

  let codemsg = '';
  switch (code) {
    case 400:
      codemsg = '400: Bad request';
      break;
    case 518:
      codemsg = "518: I'm a teapot";
      break;
    default:
      codemsg = `${code} Internal server error`;
      break;
  }

  res.render('error', {
    message: msg,
    error: {
      status: codemsg,
      stack: JSON.stringify(formdata)
    },
    formdata: JSON.stringify(req.app.locals.formdata)
  });
}

module.exports = router;