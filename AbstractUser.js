var bcrypt = require('bcrypt-nodejs');
var crypto = require('crypto');
var mongoose = require('mongoose');
var Schema = require('mongoose').Schema;
var util = require('util');

var AbstractUser = function () {
  Schema.apply(this, arguments);
  this.add({
  email: { type: String, unique: true, lowercase: true },
  password: String,

  facebook: String,
  twitter: String,
  google: String,
  github: String,
  instagram: String,
  linkedin: String,
  tokens: Array,

  profile: {
    name: { type: String, default: '' },
    gender: { type: String, default: '' },
    location: { type: String, default: '' },
    website: { type: String, default: '' },
    picture: { type: String, default: '' },
    mobile_numbers: [String],
    email_addresses: [String]
  },

  resetPasswordToken: String,
  resetPasswordExpires: Date
  });

  /**
   * Password hash middleware.
   */
  this.pre('save', function(next) {
    var user = this;
    if (!user.isModified('password')) return next();
    bcrypt.genSalt(10, function(err, salt) {
      if (err) return next(err);
      bcrypt.hash(user.password, salt, null, function(err, hash) {
        if (err) return next(err);
        user.password = hash;
        next();
      });
    });
  });

  /**
   * Helper method for validating user's password.
   */
  this.methods.comparePassword = function(candidatePassword, cb) {
    bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
      if (err) return cb(err);
      cb(null, isMatch);
    });
  };

  /**
   * Helper method for getting user's gravatar.
   */
  this.methods.gravatar = function(size) {
    if (!size) size = 200;
    if (!this.email) return 'https://gravatar.com/avatar/?s=' + size + '&d=retro';
    var md5 = crypto.createHash('md5').update(this.email).digest('hex');
    return 'https://gravatar.com/avatar/' + md5 + '?s=' + size + '&d=retro';
  };
};

util.inherits(AbstractUser, Schema); // unsure of the need for this!

exports.AbstractUser = AbstractUser;
