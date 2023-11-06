const bcrypt = require("bcryptjs");

const hash = async (password) => {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  return hashedPassword;
};

const compare = async (password, hashedPassword) => {
  const result = await bcrypt.compare(password, hashedPassword);
  return result;
};

module.exports = { hash, compare };
