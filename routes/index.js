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
  makePage(req.body, req, res, next);
});

router.get('/new-offering', (req, res) => {
  res.render('new-offering');
});

router.post('/submit', (req, res, next) => {
  const offerNo = req.body.offerNo;
  const formdata = req.body;
  console.info("Offering Selected:", offerNo);
  queryStudentRoster(formdata, req, res, next, offerNo);
  res.render('student-roster');
})

router.get('/submit', (req, res, next) => {
  const offerNo = req.query.offerNo;
  const formdata = req.query;
  console.info("Getting offering:", offerNo);
  performActions(formdata, req);
  queryStudentRoster(formdata, req, res, next, offerNo);
  res.render('student-roster');
})

function makePage(formdata, req, res, next) {
  console.info("Making page...");
  req.app.locals.formdata = formdata;
  try {
    performActions(formdata, req);

    if (formdata.role) {
      console.info("A user role has been found:", formdata.role);
      req.app.locals.page = formdata.role.toLowerCase();
      req.app.locals.title = formdata.role;
      queryDatabase(formdata, req, res, next);
    }
    else {
      console.info("No user role could be found.");
      req.app.locals.page = 'index';
      req.app.locals.title = 'University DB';
    }

    renderPage(formdata, req, res, next);
  } catch (err) {
    renderErrorPage(err, req, res, next);
  }
}

/* START OF SQL QUERIES & ACTIONS */

function queryDatabase(formdata, req, res, next) {
  if (formdata.role) {
    if (formdata.role === "Student") {
      queryStudent(formdata, req, res, next);
    }
    else if (formdata.role === "Faculty") {
      queryInstructorCourses(formdata, req, res, next);
      // queryStudentRoster(formdata, req, res, next);
    }
    else if (formdata.role === "Registrar") {
      queryOfferings(formdata, req, res, next);
      queryCourseList(formdata, req, res, next); // Always grabbing the course list may not be the most efficient solution
    }
    else {
      throw new Error(`400 Unknown role: ${formdata.role}`);
    }
  }  // No role, no query
}

function performActions(formdata, req) {
  if (formdata.action) {
    console.info("Trying to perform an action:", formdata.action);
    switch(formdata.action) {
      // case "cancel_ticket":
      //   cancelTicket(formdata.ticket_ID, req.app.locals.db);
      //   break;
      // case "book_flight":
      //   bookFlight(formdata, req);
      //   break;
      case "add_course":
        console.info("Adding offering...");
        addCourse(formdata, req);
        break;
      case "drop_course":
        console.info("Dropping offering...");
        dropCourse(formdata, req);
        break;
      case "edit_grade":
        console.info("Editing grade...");
        editGrade(formdata, req);
        break;
    }
  }
}

//- STUDENT QUERIES & ACTIONS

function queryStudent(formdata, req, res, next) {
  if (req.app.locals.db) {
    const db = req.app.locals.db;
    req.app.locals.invalid_student = !db.prepare("SELECT 1 FROM Student WHERE StdSSN = $SSN;").get({ $SSN: formdata.ID });
    const sql = "SELECT Offering.CourseNo, Offering.OffTerm, Offering.OffYear,"
                + " Faculty.FacFirstName, Faculty.FacLastName, Enrollment.EnrGrade"
                + " FROM (Offering INNER JOIN Enrollment ON Offering.OfferNO ="
                + " Enrollment.OfferNO) LEFT JOIN Faculty ON Offering.FacSSN ="
                + " Faculty.FacSSN WHERE Enrollment.StdSSN = $SSN;";
                //- AND (Offering.OffYear <> 2026 OR Offering.OffTerm <> 'WINTER');";
    req.app.locals.past_enrollments = db.prepare(sql).all({ $SSN: formdata.ID });
    const sql2 = "SELECT Offering.OfferNo, CourseNo, FacFirstName, FacLastName,"
                + " OffLocation, OffTime, OffDays, Offering.OfferNo IN"
                + " (SELECT OfferNo FROM Enrollment WHERE StdSSN = $SSN) AS"
                + " Enrolled FROM Offering LEFT JOIN Faculty ON Offering.FacSSN ="
                + " Faculty.FacSSN WHERE OffTerm = 'WINTER' and OffYear = 2026"
                + " Group BY Offering.OfferNo;";
    req.app.locals.offerings = db.prepare(sql2).all({ $SSN: formdata.ID });
    console.info(req.app.locals.past_enrollments.length, "offerings found", );
    queryStudentName(formdata, req, res, next);
  }
  else {
    throw new Error("500 Students query failed to find database");
  }
}

function queryStudentName(formdata, req, res, next) {
  if (req.app.locals.db) {
    const db = req.app.locals.db;
    const sql = "SELECT StdFirstName, StdLastName FROM Student WHERE StdSSN ="
                + " $SSN;";
    const name = db.prepare(sql).get({ $SSN: formdata.ID });
    if (name) {
      req.app.locals.std_name = `${name.StdFirstName} ${name.StdLastName}`;
      req.app.locals.title = `Student - ${req.app.locals.std_name}`;
      req.app.locals.welcome = `Welcome, ${req.app.locals.std_name}`;
      req.app.locals.invalid_student = false;
    }
    else {
      // No student has this ID: the page shows a message instead of an error
      req.app.locals.invalid_student = true;
      req.app.locals.welcome = "Student";
    }
  }
  else {
    throw new Error("500 Student-name query failed to find database");
  }
}

function addCourse(formdata, req) {
  // IMPORTANT: After testing, delete 'univdb', make a copy of 'univdb_copy', 
  // then rename that copy to 'univdb'
  console.info("Trying to add: [Course]", formdata.offerNo, "[Student]", formdata.ID);
  const db = req.app.locals.db;
  const sql = "INSERT INTO Enrollment (OfferNo, StdSSN) VALUES ($OfferNo,"
              + " $SSN);";
  const changes = db.prepare(sql).run({ $OfferNo: formdata.offerNo,
                                        $SSN: formdata.ID });
  console.info(`Enrollment changed ${changes.changes} row(s)`);
}

function dropCourse(formdata, req) {
  // IMPORTANT: After testing, delete 'univdb', make a copy of 'univdb_copy', 
  // then rename that copy to 'univdb'
  console.info("Trying to drop: [Course]", formdata.offerNo, "[Student]", formdata.ID);
  const db = req.app.locals.db;
  const sql = "DELETE FROM Enrollment WHERE OfferNo = $OfferNo AND StdSSN = $SSN;";
  const changes = db.prepare(sql).run({ $OfferNo: formdata.offerNo,
                                        $SSN: formdata.ID });
  console.info(`Enrollment changed ${changes.changes} row(s)`);
}

//- FACULTY QUERIES

function queryInstructorCourses(formdata, req, res, next) {
  if (req.app.locals.db) {
    const db = req.app.locals.db;
    const sql = "SELECT OfferNo, CourseNo, OffTerm, OffYear FROM Offering LEFT JOIN"
                + " Faculty ON Offering.FacSSN = Faculty.FacSSN WHERE"
                + " Offering.FacSSN = $SSN;";
    req.app.locals.courses = db.prepare(sql).all({ $SSN: formdata.ID });
    console.info(req.app.locals.courses.length, "courses found for this instructor", );
    queryFacultyName(formdata, req, res, next);
  }
  else {
    throw new Error("500 Instructor Courses query failed to find database");
  }
}

function queryFacultyName(formdata, req, res, next) {
  if (req.app.locals.db) {
    const db = req.app.locals.db;
    const sql = "SELECT FacFirstName, FacLastName FROM Faculty WHERE FacSSN ="
                + " $SSN;";
    const name = db.prepare(sql).get({ $SSN: formdata.ID });
    if (name) {
      req.app.locals.fac_name = `${name.FacFirstName} ${name.FacLastName}`;
      req.app.locals.title = `Faculty - ${req.app.locals.fac_name}`;
      req.app.locals.welcome = `Welcome, ${req.app.locals.fac_name}`;
      req.app.locals.invalid_faculty = false;
    }
    else {
      // No faculty has this ID: the page shows a message instead of an error
      req.app.locals.invalid_faculty = true;
      req.app.locals.welcome = "Faculty";
    }
  }
  else {
    throw new Error("500 Faculty-name query failed to find database");
  }
}

function queryStudentRoster(formdata, req, res, next, offerNo) {
  if (req.app.locals.db) {
    const db = req.app.locals.db;
    const sql = "SELECT StdFirstName, StdLastName, Enrollment.StdSSN, EnrGrade"
                + " FROM Enrollment LEFT JOIN Student on Enrollment.StdSSN ="
                + " Student.StdSSN WHERE OfferNo = $OfferNo";
    req.app.locals.students = db.prepare(sql).all({ $OfferNo: offerNo });
    // const name = req.app.locals.students;
    req.app.locals.title = `Selected Offering: ${offerNo}`;
    req.app.locals.offering = offerNo;
    req.app.locals.ID = formdata.ID;
    req.app.locals.role = formdata.role;
    console.info(req.app.locals.students.length, "students found", );
    queryFacultyName(formdata, req, res, next);
  }
  else {
    throw new Error("500 Instructor Courses query failed to find database");
  }
}

function editGrade(formdata, req) {
  // IMPORTANT: After testing, delete 'univdb', make a copy of 'univdb_copy', 
  // then rename that copy to 'univdb'
  console.info("Trying to edit grade: [Grade]", formdata.new_grade, "for [Student]", formdata.ID, "[Offering]", formdata.offerNo);
  const db = req.app.locals.db;
  const sql = "UPDATE Enrollment SET EnrGrade = $NewGrade WHERE OfferNo = $OfferNo AND"
              + " StdSSN = $SSN;";
  const changes = db.prepare(sql).run({ $NewGrade: formdata.new_grade,
                                        $OfferNo: formdata.offerNo,
                                        $SSN: formdata.ID });
  console.info(`Grade updated ${changes.changes} row(s)`);
}

//- REGISTRAR QUERIES

function queryOfferings(formdata, req, res, next) {
  if (req.app.locals.db) {
    const db = req.app.locals.db;
    const sql = "SELECT OfferNo, CourseNo, FacFirstName, FacLastName, OffLocation,"
                + " OffTime, OffDays FROM Offering LEFT JOIN Faculty ON"
                + " Offering.FacSSN = Faculty.FacSSN WHERE OffTerm = 'WINTER' and"
                + " OffYear = 2026;";
    req.app.locals.offerings = db.prepare(sql).all();
    console.info(req.app.locals.offerings.length, "offerings found", );
  }
  else {
    throw new Error("500 Offerings query failed to find database");
  }
}

function queryCourseList(formdata, req, res, next) {
  if (req.app.locals.db) {
    const db = req.app.locals.db;
    const sql = "SELECT CourseNo, CrsDesc, CrsUnits FROM Course";
    req.app.locals.courses = db.prepare(sql).all();
    console.info(req.app.locals.courses.length, "courses found", );
  }
  else {
    throw new Error("500 Course List query failed to find database");
  }
}

/* END OF SQL QUERIES & ACTIONS */

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


//* LEFTOVER FUNCTIONS FROM DR. BROWN'S WORK *//

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