const mysql = require("mysql2/promise");

const dbInfo = {
  host: "dongnaecomm.cafe24app.com",
  port: "3306",
  user: "	devcafe1",
  password: "dlatl13579!",
  database: "devcafe1",
};

const pool = mysql.createPool(dbInfo);
module.exports = pool;
