const mysql = require("mysql2/promise");

const dbInfo = {
  host: "localhost",
  port: "3306",
  user: "	devcafe1",
  password: "dlatl13579!",
  database: "devcafe1",
};

const pool = mysql.createPool(dbInfo);
module.exports = pool;
