const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'contacts.db');

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    nom  TEXT    NOT NULL,
    prenom TEXT  NOT NULL,
    email TEXT,
    telephone TEXT
  )
`);

module.exports = db;
