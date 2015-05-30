var helpers = require('./twilio-helpers');
var config = require('./config');
var S3Uploader = require('my-s3-uploader').S3Uploader;
var AbstractThing = require('./AbstractThing').AbstractThing;
var Promise = require('promise');

module.exports = function createThingModel(connection, maxAge, twilio_id, twilio_token, aws_key, aws_secret, aws_bucket, aws_bucket_region) {

  var twilio = require('twilio')(twilio_id, twilio_token);
  var myS3 = new S3Uploader({
    key: aws_key,
    secret: aws_secret,
    bucket: aws_bucket,
    region: aws_bucket_region
  });

  var ThingSchema = new AbstractThing({twilio:{}});

  ThingSchema.statics.s3 = function(id) {
      return new Promise(function(resolve, reject) {
        console.log("s3")
        this.findById(id).exec(function(err, thing){
          if (err) return reject(err);
          // if (!thing) return reject(new errors.ArticleNotFound());
          // upload to s3
          myS3.upload(helpers.getUrlForS3(thing), function(err, result){
            if (err) {
              return reject(err);
            }

            thing.set({s3Url: result[0]}).save(onSave);

            function onSave(err,thing){
              if (err) {
                return reject(err);
              }
              console.log(thing);
              return resolve(thing);
            }
          
          });

        });
      }.bind(this));
    };
    ThingSchema.statics.validate = function(id) {
      return new Promise(function(resolve, reject) {

        this.findById(id).exec(function(err, thing){
          if (err) return reject(err);

          var result = helpers.validateTwilio(thing);

          thing.set({isValid: result.isValid}).save(onSave);

          function onSave(err,thing){
            if (err) {
              return reject(err);
            }
            console.log("about to resolve...");
            thing['message'] = result.message;
            return resolve(thing);
          }
        });
      }.bind(this));
    };
    ThingSchema.statics.confirm = function(id, isValid, message) {
     console.log("confirm")
      return new Promise(function(resolve, reject) {

        this.findById(id).exec(function(err, thing){
          if (err) return reject(err);
          // if (!thing) return reject(new errors.ArticleNotFound());
          // CONFIRM
          var promise = twilio.sendMessage({
            to: thing.twilio.From,
            from: thing.twilio.To,
            body: "Got your request: check it out at " + config.things_path + "/" + id
          })

          promise.then(function(result) {twilioSuccess(result)}, function(err){
          // promise.then(twilioSuccess, function(err){
            
            console.log(err.message);
            
            return reject(err)
          
          });
          // var self = this;
          // function twilioSuccess (mms) {
          var twilioSuccess = function (mms) {
            
            thing.set({confirmation: mms}).save(onSave);

            function onSave(err,thing){
              if (err) {
                return reject(err);
              }
              return resolve(thing);
            }
          
          } // end twilioSuccess

        });


      }.bind(this));
    };

  var Thing = connection.model('Thing',ThingSchema);
  return Thing;
};
