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

router.get('/edit-offering', (req, res, next) => {
  try {
    req.app.locals.status = '';
    queryOfferingToEdit(req.query, req);
    res.render('edit-offering');
  } catch (err) {
    renderErrorPage(err, req, res, next);
  }
})

router.post('/submit', (req, res, next) => {
  const offerNo = req.body.offerNo;
  const formdata = req.body;
  console.info("Offering Selected:", offerNo);
  try {
    req.app.locals.status = '';
    queryStudentRoster(formdata, req, res, next, offerNo);
    res.render('student-roster');
  } catch (err) {
    renderErrorPage(err, req, res, next);
  }
})

router.get('/submit', (req, res, next) => {
  const offerNo = req.query.offerNo;
  const formdata = req.query;
  console.info("Getting offering:", offerNo);
  try {
    req.app.locals.status = '';
    performActions(formdata, req);
    queryStudentRoster(formdata, req, res, next, offerNo);
    res.render('student-roster');
  } catch (err) {
    renderErrorPage(err, req, res, next);
  }
})

function makePage(formdata, req, res, next) {
  console.info("Making page...");
  req.app.locals.formdata = formdata;
  req.app.locals.status = '';  // Clear any message left from an earlier request
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
      // For students
      case "add_course":
        console.info("[Student] Adding offering...");
        addCourse(formdata, req);
        break;
      case "drop_course":
        console.info("[Student] Dropping offering...");
        dropCourse(formdata, req);
        break;
      // For faculty
      case "edit_grade":
        console.info("[Faculty] Editing grade...");
        editGrade(formdata, req);
        break;
      // For registrar
      case "cancel_offering":
        console.info("[Registrar] Canceling offering...");
        cancelOffering(formdata, req);
        break;
      case "add_offering":
        console.info("[Registrar] Adding offering...");
        addOffering(formdata, req);
        break;
      case "edit_offering":
        console.info("[Registrar] Editing offering...");
        editOffering(formdata, req);
        break;
    }
  }
}

//- STUDENT QUERIES & ACTIONS

function queryStudent(formdata, req, res, next) {
  if (req.app.locals.db) {
    const db = req.app.locals.db;
    req.app.locals.invalid_student = !db.prepare("SELECT 1 FROM Student WHERE StdSSN = $SSN;").get({ $SSN: formdata.ID });
    // Query all of the student's enrolled courses
    let sql = "SELECT Offering.CourseNo, Offering.OffTerm, Offering.OffYear,"
                + " Faculty.FacFirstName, Faculty.FacLastName, Enrollment.EnrGrade"
                + " FROM (Offering INNER JOIN Enrollment ON Offering.OfferNO ="
                + " Enrollment.OfferNO) LEFT JOIN Faculty ON Offering.FacSSN ="
                + " Faculty.FacSSN WHERE Enrollment.StdSSN = $SSN ORDER BY OffYear"
                + " DESC, CASE OffTerm WHEN 'SPRING' THEN 1 WHEN 'WINTER' THEN 2"
                + " WHEN 'FALL' THEN 3 ELSE 4 END, CourseNo ASC;";
    req.app.locals.past_enrollments = db.prepare(sql).all({ $SSN: formdata.ID });
    console.info("Found", req.app.locals.past_enrollments.length, "for selected student");
    // Query all of the offerings for the latest term (Winter 2026)
    sql = "SELECT Offering.OfferNo, CourseNo, FacFirstName, FacLastName,"
                + " OffLocation, OffTime, OffDays, Offering.OfferNo IN"
                + " (SELECT OfferNo FROM Enrollment WHERE StdSSN = $SSN) AS"
                + " Enrolled FROM Offering LEFT JOIN Faculty ON Offering.FacSSN ="
                + " Faculty.FacSSN WHERE OffTerm = 'WINTER' and OffYear = 2026"
                + " Group BY Offering.OfferNo;";
    req.app.locals.offerings = db.prepare(sql).all({ $SSN: formdata.ID });
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
  // Only offerings in the upcoming term (Winter 2026) can be added
  if (!db.prepare("SELECT 1 FROM Student WHERE StdSSN = $SSN;").get({ $SSN: formdata.ID })) {
    throw new Error(`400 No Student has ID ${formdata.ID}`);
  }
  if (!db.prepare("SELECT 1 FROM Offering WHERE OfferNo = $offerno AND OffTerm = 'WINTER'"
                  + " AND OffYear = 2026;").get({ $offerno: formdata.offerNo })) {
    throw new Error(`400 Offering ${formdata.offerNo} is not offered in Winter 2026`);
  }
  // No duplicate enrollments (also covers refreshing the page after an add)
  if (db.prepare("SELECT 1 FROM Enrollment WHERE OfferNo = $offerno AND StdSSN = $SSN;")
        .get({ $offerno: formdata.offerNo, $SSN: formdata.ID })) {
    console.info("Student is already enrolled in this offering; nothing to add");
    return;
  }
  const sql = "INSERT INTO Enrollment (OfferNo, StdSSN) VALUES ($offerno,"
              + " $SSN);";
  const changes = db.prepare(sql).run({ $offerno: formdata.offerNo,
                                        $SSN: formdata.ID });
  console.info(`Enrollment changed ${changes.changes} row(s)`);
}

function dropCourse(formdata, req) {
  // IMPORTANT: After testing, delete 'univdb', make a copy of 'univdb_copy', 
  // then rename that copy to 'univdb'
  console.info("Trying to drop: [Course]", formdata.offerNo, "[Student]", formdata.ID);
  const db = req.app.locals.db;
  // Only Winter 2026 offerings can be dropped, so past enrollments (and their
  // grades) are never removed
  const sql = "DELETE FROM Enrollment WHERE OfferNo = $offerno AND StdSSN = $SSN"
              + " AND OfferNo IN (SELECT OfferNo FROM Offering WHERE OffTerm ="
              + " 'WINTER' AND OffYear = 2026);";
  const changes = db.prepare(sql).run({ $offerno: formdata.offerNo,
                                        $SSN: formdata.ID });
  console.info(`Enrollment changed ${changes.changes} row(s)`);
}

//- FACULTY QUERIES & ACTIONS

function queryInstructorCourses(formdata, req, res, next) {
  if (req.app.locals.db) {
    const db = req.app.locals.db;
    const sql = "SELECT OfferNo, CourseNo, OffTerm, OffYear FROM Offering LEFT JOIN"
                + " Faculty ON Offering.FacSSN = Faculty.FacSSN WHERE"
                + " Offering.FacSSN = $SSN ORDER BY OffYear DESC, CASE OffTerm WHEN"
                + " 'SPRING' THEN 1 WHEN 'WINTER' THEN 2 WHEN 'FALL' THEN 3 ELSE 4"
                + " END, OfferNo ASC;";
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
      const firstName = name.FacFirstName.charAt(0) + name.FacFirstName.slice(1).toLowerCase();
      const lastName = name.FacLastName.charAt(0) + name.FacLastName.slice(1).toLowerCase();
      req.app.locals.fac_name = `${firstName} ${lastName}`;
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
    let sql = "SELECT StdFirstName, StdLastName, Enrollment.StdSSN, EnrGrade"
                + " FROM Enrollment LEFT JOIN Student ON Enrollment.StdSSN ="
                + " Student.StdSSN WHERE OfferNo = $offerno ORDER BY StdLastName,"
                + " StdFirstName;";
    req.app.locals.students = db.prepare(sql).all({ $offerno: offerNo });
    req.app.locals.title = `Selected Offering: ${offerNo}`;
    sql = "SELECT Course.CourseNo, CrsDesc FROM Course INNER JOIN Offering ON"
          + " Course.CourseNo = Offering.CourseNo WHERE Offering.OfferNo ="
          + " $offerno;";
    const course = db.prepare(sql).get({ $offerno: offerNo })
    req.app.locals.course = `${course.CourseNo}: ${course.CrsDesc}`;
    req.app.locals.offering = offerNo;
    req.app.locals.ID = formdata.ID;
    req.app.locals.role = formdata.role;
    console.info(req.app.locals.students.length, "students found");
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
  // A grade must be a number from 0.0 to 4.0
  const grade = Number(formdata.new_grade);
  if (formdata.new_grade === undefined || String(formdata.new_grade).trim() === ""
      || !Number.isFinite(grade) || grade < 0 || grade > 4) {
    throw new Error(`400 A grade must be a number from 0.0 to 4.0 (got "${formdata.new_grade}")`);
  }
  const sql = "UPDATE Enrollment SET EnrGrade = $newgrade WHERE OfferNo = $offerno AND"
              + " StdSSN = $SSN;";
  const changes = db.prepare(sql).run({ $newgrade: grade,
                                        $offerno: formdata.offerNo,
                                        $SSN: formdata.ID });
  console.info(`Grade updated ${changes.changes} row(s)`);
  if (changes.changes === 0) {
    throw new Error(`400 Student ${formdata.ID} is not enrolled in offering ${formdata.offerNo}`);
  }
  req.app.locals.status = `Success: Saved grade ${grade} for student ${formdata.ID}.`;
}

//- REGISTRAR QUERIES & ACTIONS

function queryOfferings(formdata, req, res, next) {
  if (req.app.locals.db) {
    const db = req.app.locals.db;
    const sql = "SELECT OfferNo, CourseNo, FacFirstName, FacLastName, OffLocation,"
                + " OffTime, OffDays FROM Offering LEFT JOIN Faculty ON"
                + " Offering.FacSSN = Faculty.FacSSN WHERE OffTerm = 'WINTER' and"
                + " OffYear = 2026 ORDER BY OfferNo ASC;";
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
    const sql = "SELECT CourseNo, CrsDesc, CrsUnits FROM Course ORDER BY" 
                + " CourseNo ASC;";
    req.app.locals.courses = db.prepare(sql).all();
    console.info(req.app.locals.courses.length, "courses found");
    queryFacultyList(formdata, req, res, next);
  }
  else {
    throw new Error("500 Course List query failed to find database");
  }
}

function queryFacultyList(formdata, req, res, next) {
  if (req.app.locals.db) {
    const db = req.app.locals.db;
    const sql = "SELECT FacSSN, FacFirstName, FacLastName From Faculty;";
    req.app.locals.instructors = db.prepare(sql).all();
    console.info(req.app.locals.instructors.length, "instructors found");
  }
  else {
    throw new Error("500 Faculty list query failed in find database");
  }
}

// Loads the offering (and the instructor list) shown on the edit-offering page
function queryOfferingToEdit(formdata, req) {
  const db = req.app.locals.db;
  if (!db) {
    throw new Error("500 Offering query failed to find database");
  }
  const sql = "SELECT OfferNo, Offering.CourseNo, CrsDesc, OffLocation, OffTime,"
              + " FacSSN, OffDays FROM Offering INNER JOIN Course ON"
              + " Offering.CourseNo = Course.CourseNo WHERE OfferNo = $offerno AND"
              + " OffTerm = 'WINTER' AND OffYear = 2026;";
  const offering = db.prepare(sql).get({ $offerno: formdata.offerNo });
  console.info("Grabbing offering data for", formdata.offerNo);
  if (!offering) {
    throw new Error(`400 Offering ${formdata.offerNo} is not scheduled for Winter 2026`);
  }
  // The time input needs HH:MM:SS, but some times are stored as H:MM:SS
  if (offering.OffTime) {
    offering.OffTime = String(offering.OffTime).padStart(8, "0");
  }
  const instructors = db.prepare("SELECT FacSSN, FacFirstName, FacLastName FROM"
                                 + " Faculty ORDER BY FacLastName, FacFirstName;").all();
  req.app.locals.offering = offering;
  req.app.locals.instructors = instructors;
}

function cancelOffering(formdata, req) {
  // IMPORTANT: After testing, delete 'univdb', make a copy of 'univdb_copy',
  // then rename that copy to 'univdb'
  const db = req.app.locals.db;
  // Enrollments go first, then the offering (only Winter 2026 can be canceled)
  let sql = "DELETE FROM Enrollment WHERE OfferNo IN (SELECT OfferNo FROM Offering"
            + " WHERE OfferNo = $offerno AND OffTerm = 'WINTER' AND OffYear = 2026);";
  let changes = db.prepare(sql).run({ $offerno: formdata.offerNo });
  console.info(`Removing enrollments removing ${changes.changes} enrollments`);
  sql = "DELETE FROM Offering WHERE OfferNo = $offerno AND OffTerm = 'WINTER'"
        + " AND OffYear = 2026;";
  changes = db.prepare(sql).run({ $offerno: formdata.offerNo });
  console.info(`Canceling offering ${formdata.offerNo} canceling ${changes.changes} offerings`);
  if (changes.changes === 0) {
    // e.g. the page was refreshed after the offering was already canceled
    req.app.locals.status = `WARNING: Offering [${formdata.offerNo}] is not scheduled for Winter 2026, so nothing was canceled.`;
    return;
  }
  req.app.locals.status = `Success: Canceled offering [${formdata.offerNo}].`;
}

function addOffering(formdata, req) {
  // IMPORTANT: After testing, delete 'univdb', make a copy of 'univdb_copy', 
  // then rename that copy to 'univdb'
  console.info("Trying to add: [Offering]", formdata.offerNo, "[Course]", formdata.courseNo);
  const db = req.app.locals.db;
  let sql = "SELECT OfferNo FROM Offering WHERE OfferNo = $offerno;";
  // Check whether the offering number is already in use
  const check_offer = db.prepare(sql).all({ $offerno: formdata.offerNo });
  if (check_offer.length === 0) {
    sql = "INSERT INTO Offering (OfferNo, CourseNo, OffTerm, OffYear, OffLocation,"
          + " OffTime, FacSSN, OffDays) VALUES ($offerno, $courseno, $offterm,"
          + " $offyear, $offlocation, $offtime, $facSSN, $offdays);";
    const changes = db.prepare(sql).run({ $offerno: formdata.offerNo,
                                          $courseno: formdata.courseNo,
                                          $offterm: formdata.offTerm,
                                          $offyear: formdata.offYear,
                                          $offlocation: formdata.offLocation,
                                          $offtime: formdata.offTime,
                                          $facSSN: formdata.instructor || null, // No instructor yet
                                          $offdays: formdata.offDays });
    console.info(`Adding offering adding ${changes.changes} row(s)`);
    req.app.locals.status = `Success: Created new offering [${formdata.offerNo}].`;
  }
  else {
    req.app.locals.status = `WARNING: Offering number [${formdata.offerNo}] is`
                            + " already in use, either for the upcoming semester or"
                            + " for a previous semester. Please choose a different"
                            + " offering number and try again.";
    // throw new Error(`400 Offering number ${formdata.offerNo} is already in use. Please go back and try a different offering number.`);
  }
}

function editOffering(formdata, req) {
  // IMPORTANT: After testing, delete 'univdb', make a copy of 'univdb_copy', 
  // then rename that copy to 'univdb'
  console.info("Trying to edit: [Offering]", formdata.offerNo);
  const db = req.app.locals.db;
  // The offering number stays the same; the registrar changes the instructor,
  // location, time and days of an offering scheduled for Winter 2026
  const sql = "UPDATE Offering SET FacSSN=$facSSN, OffLocation=$offlocation,"
              + " OffTime=$offtime, OffDays=$offdays WHERE OfferNo=$offerno AND"
              + " OffTerm = 'WINTER' AND OffYear = 2026;";
  const changes = db.prepare(sql).run({ $offerno: formdata.offerNo,
                                        $facSSN: formdata.instructor || null, // No instructor yet
                                        $offlocation: formdata.offLocation,
                                        $offtime: formdata.offTime,
                                        $offdays: formdata.offDays });
  console.info(`Editing offering changing ${changes.changes} row(s)`);
  if (changes.changes === 0) {
    throw new Error(`400 Offering ${formdata.offerNo} is not scheduled for Winter 2026`);
  }
  req.app.locals.status = `Success: Updated offering [${formdata.offerNo}].`;
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
