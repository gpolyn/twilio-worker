var Schema = require('mongoose').Schema;
var Promise = require('promise');
var util = require('util');
var timestamps = require('mongoose-timestamp');

var AbstractThing = function () {

  Schema.apply(this, arguments);

  this.add({
    _id: { type: String },
    s3Url: { type: String },
    verbalRequest: { type: String },
    confirmation: {},
    user_id: {type: Schema.ObjectId},
    isValid: { type: Boolean },
    isPublic: { type: Boolean },
    category: [{ type: String }],
    twilio: {},
  });

  this.set('strict', true);

  this.plugin(timestamps);

  this.statics = {
    list: function(n, fresh) {
      return new Promise(function(resolve, reject) {
        this.find()
          .sort('-createdAt')
          .limit(n || 50)
          // .cache(!fresh)
          .exec(onArticles);

        function onArticles(err, articles) {
          if (err) return reject(err);
          resolve(articles);
        }
      }.bind(this));
    }
  };

};
util.inherits(AbstractThing, Schema); // unsure of the need for this!

exports.AbstractThing = AbstractThing;
