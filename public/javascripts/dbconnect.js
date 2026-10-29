const { DatabaseSync } = require('node:sqlite'); //.verbose();
// const db = new Database('public/univdb.sqli');

const dbopen = (dbpath) => {
  const db = new DatabaseSync(dbpath);
  console.info('Connected to database ' + dbpath);
  return db;
};

// close the database connection
const dbclose = (db, afterCloseCallback) => { 
  if (db.isOpen) {
    db.close();
    console.info('Closed the database connection.');
  }
  else {
    console.error('Database was not open.');
  }
};
  
module.exports = { dbopen, dbclose };