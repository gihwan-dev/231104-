const mysql = require("mysql2/promise");

const dbInfo = {
  host: "localhost",
  port: "3306",
  user: "root",
  password: "Mswoori41@naver",
  database: "231104",
};

const pool = mysql.createPool(dbInfo);
module.exports = pool;
