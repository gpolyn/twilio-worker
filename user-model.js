var AbstractUser = require('./AbstractUser').AbstractUser;

module.exports = function createUserModel(connection, maxAge) {

  var UserSchema = new AbstractUser();
  var User = connection.model('User',UserSchema);

  return User;

};
