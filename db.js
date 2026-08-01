const fs = require('fs');
const path = require('path');

function getDB() {
  const dbPath = path.join(__dirname, 'db.json');
  if (!fs.existsSync(dbPath)) {
    const initial = { posts: [] };
    fs.writeFileSync(dbPath, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function saveDB(data) {
  const dbPath = path.join(__dirname, 'db.json');
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

module.exports = { getDB, saveDB };
