/* IMPORTANT - this file contains placeholder code
referencing the Grasshopper database. Any references to that
database will be removed at a later point. */
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
      queryDatabase(formdata, req, res, next);
    }
    else {
      req.app.locals.page = 'index';
      req.app.locals.title = 'University DB';
    }

    renderPage(formdata, req, res, next);
  } catch (err) {
    renderErrorPage(err, req, res, next);
  }
}

function performActions(formdata, req) {
  if (formdata.action) {
    switch(formdata.action) {
      case "cancel_ticket":
        cancelTicket(formdata.ticket_ID, req.app.locals.db);
        break;
      case "book_flight":
        bookFlight(formdata, req);
        break;
    }
  }
}

function cancelTicket(ticket_ID, db) {
  const sql = 'delete from Ticket where TktNum = $tktnum;';
  const changes = db.prepare(sql).run({ $tktnum: ticket_ID });
  console.info(`Canceling ticket changed ${changes.changes} row(s)`);
}

function bookFlight(formdata, req) {
  const db = req.app.locals.db;
  const sql = 'insert into Ticket (PsgrID, FltNum, FltDate)'
              + ' values ($id, $fltnum, $fltdate);';
  const changes = db.prepare(sql).run({ $id: formdata.ID, 
                                        $fltnum: formdata.FltNum, 
                                        $fltdate: formdata.FltDate });
  console.info(`Booking flight changed ${changes.changes} row(s)`)
}

function queryDatabase(formdata, req, res, next) {
  if (formdata.role) {
    // if (formdata.role === "Passenger" || formdata.role === "Scheduler") {
    if (formdata.role === "Student" || formdata.role === "Faculty" || formdata.role === "Registrar") {
      queryOfferings(formdata, req, res, next);
      // queryFlights(formdata, req, res, next);
    }
    else {
      throw new Error(`400 Unknown role: ${formdata.role}`);
    }
  }  // No role, no query
}

function queryFlights(formdata, req, res, next) {
  if (req.app.locals.db) {
    const db = req.app.locals.db;
    const sql = 'select FltNum as Flight, Origin, Dest, Departs, Arrives,'
                  + ' ModelName as Aircraft'
                  + ' from Flight natural join ACModel order by Departs;';
    req.app.locals.flights = db.prepare(sql).all();
    console.info(req.app.locals.flights.length, "flights found", );
    if (formdata.role === "Passenger") {
      queryPassengerName(formdata, req, res, next);
    }
  }
  else {
    throw new Error("500 Flights query failed to find database");
  }
}

function queryOfferings(formdata, req, res, next) {
  if (req.app.locals.db) {
    const db = req.app.locals.db;
    const sql = "SELECT OfferNo, CourseNo, FacFirstName, FacLastName, OffLocation,"
                + " OffTime, OffDays FROM Offering LEFT JOIN Faculty ON"
                + " Offering.FacSSN = Faculty.FacSSN WHERE OffTerm = 'WINTER' and"
                + " OffYear = 2026;";
    req.app.locals.offerings = db.prepare(sql).all();
    console.info(req.app.locals.offerings.length, "offerings found", );
    // if (formdata.role === "Registrar") {
    //   queryPassengerName(formdata, req, res, next);
    // }
  }
  else {
    throw new Error("500 Offerings query failed to find database");
  }
}

function queryPassengerName(formdata, req, res, next) {
  if (req.app.locals.db) {
    const db = req.app.locals.db;
    const sql = 'select FirstName, LastName from Passenger where PsgrID = $id;';
    const name = db.prepare(sql).get({ $id: formdata.ID });
    if (name) {
      req.app.locals.psgr_name = name;
      req.app.locals.title = `Welcome, ${name.FirstName} ${name.LastName}`;
      queryTickets(formdata, req, res, next);
    }
    else {
      throw new Error(`400 No passenger has ID ${formdata.ID}`);
    }
  }
  else {
    throw new Error("500 Passenger-name query failed to find database");
  }
}

function queryTickets(formdata, req, res, next) {
  if (req.app.locals.db) {
    const db = req.app.locals.db;
    const sql = 'SELECT TktNum as Ticket, FltNum as Flight, Origin as "From",'
                + ' Dest as "To", FltDate as Date, Departs, Arrives,'
                + ' ModelName as Aircraft, Seat'
                + ' from Ticket natural join Flight natural join ACModel'
                + ' where PsgrID = $id'
                + ' order by FltDate, Departs;';
    const tickets = db.prepare(sql).all({ $id: formdata.ID });
    if (tickets) {
      console.info(`${tickets.length} tickets found`);
      req.app.locals.tickets = tickets;
    }
  }
  else {
    throw new Error("500 Tickets query failed to find database");
  }
}

function renderPage(formdata, req, res, next) {
  res.render(req.app.locals.page, { 
    title: req.app.locals.title,
    formdata: formdata,
    role: formdata.role,
    offerings: req.app.locals.offerings,
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
      codemsg = "400 Bad request";
      break;
    case 518:
      codemsg = "518 I'm a teapot";
      break;
    default: // Stick with 500
      codemsg = `${code} Internal server error`;
      break;
  }

  res.render('error', {
    message: msg,
    error: {
      status: codemsg,
      stack: err.stack,
    },
    formdata: JSON.stringify(req.app.locals.formdata)
  });
}

module.exports = router;