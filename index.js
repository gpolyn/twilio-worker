var logger = require('logfmt');
var Promise = require('promise');
var uuid = require('node-uuid');
var EventEmitter = require('events').EventEmitter;
var ThingModel = require('./thing-model');
var UserModel = require('./user-model');
var twilioHandling = require('./twilio-queue-handling');
var _ = require('lodash');

var connections = require('./connections');
var QUEUE_COUNT = 7
var CHECK_FOR_USER_QUEUE = 'match_user.text.twilio';
var RECORD_NEW_MESSAGE_QUEUE = 'save_new_record.text.twilio';
// var CHECK_FOR_USER_QUEUE = 'twilio.matching_user';
var UPDATE_USER_WITH_CONTACT_INFO_QUEUE = 'twilio.update_user';
// var RECORD_NEW_MESSAGE_QUEUE = 'twilio.new_record';
var VALIDATE_TWILIO_QUEUE = 'validate.text.twilio';
var CONFIRM_TWILIO_QUEUE = 'twilio.confirm';
// var S3_TWILIO_QUEUE = 'twilio.s3';
var S3_TWILIO_QUEUE = 's3.text.twilio';
var NEW_TWILIO_QUEUE = 'twilio.didit';

function App(config) {
  EventEmitter.call(this);

  this.config = config;
  this.connections = connections(config.mongo_url, config.rabbit_url);
  this.connections.once('ready', this.onConnected.bind(this));
  this.connections.once('lost', this.onLost.bind(this));
}

// module.exports = function createApp(config) {
//   return new App(config);
// };
module.exports.createApp = function(config) {
  return new App(config);
};

App.prototype = Object.create(EventEmitter.prototype);
_.extend(App.prototype, twilioHandling);

App.prototype.onConnected = function() {
  var queues = 0;
  this.Thing = ThingModel(this.connections.db, this.config.mongo_cache, this.config.twilio.account_sid,this.config.twilio.auth_token,this.config.aws.aws_key,this.config.aws.aws_secret,this.config.aws.s3.bucket,this.config.aws.s3.bucket_region);
  this.User = UserModel(this.connections.db, this.config.mongo_cache);
  var self = this;
  _.each(this.queueList, function(queue){
    self.connections.queue.create(queue, { prefetch: 5 }, onCreate.bind(self));
  });
  // this.connections.queue.create(RECORD_NEW_MESSAGE_QUEUE, { prefetch: 5 }, onCreate.bind(this));
  this.connections.queue.create(UPDATE_USER_WITH_CONTACT_INFO_QUEUE, { prefetch: 5 }, onCreate.bind(this));
  // this.connections.queue.create(VALIDATE_TWILIO_QUEUE, { prefetch: 5 }, onCreate.bind(this));
  // this.connections.queue.create(CONFIRM_TWILIO_QUEUE, { prefetch: 5 }, onCreate.bind(this));
  // this.connections.queue.create(S3_TWILIO_QUEUE, { prefetch: 5 }, onCreate.bind(this));
  this.connections.queue.create(NEW_TWILIO_QUEUE, { prefetch: 5 }, onCreate.bind(this));
  // this.connections.queue.create(CHECK_FOR_USER_QUEUE, { prefetch: 5 }, onCreate.bind(this));

  function onCreate() {
    if (++queues === QUEUE_COUNT) this.onReady();
  }
};

App.prototype.onReady = function() {
  logger.log({ type: 'info', msg: 'app.ready' });
  this.emit('ready');
};

App.prototype.onLost = function() {
  logger.log({ type: 'info', msg: 'app.lost' });
  this.emit('lost');
};

// App.prototype.processTwilio = function(twilio) {
//   var id = uuid.v1();
//   this.connections.queue.publish(CHECK_FOR_USER_QUEUE, {id: id, twilio: twilio});
//   return Promise.resolve();
// };

App.prototype.updateMatchingUser = function(user_id, record) {
  logger.log({ type: 'info', msg: 'updateMatchingUser' });
  return new Promise(function(resolve, reject) {
    console.log("about to search for..."+ user_id)
    console.log(record);

    if (_.isEmpty(record.twilio)){
    var from = record.postmark.From;
    console.log(from);
    this.User
        .findOneAndUpdate({_id: user_id},{$push: {"profile.email_addresses": from}})
        .exec(onSave);
    } else {
    var from = record.twilio.From;
    console.log(from);
    this.User
        .findOneAndUpdate({_id: user_id},{$push: {"profile.mobile_numbers": from}})
        .exec(onSave);
    }

    function onSave(err, thing){
      if (err) {
        logger.log({ type: 'info', msg: 'findMatchingUser: failed to find' });
        console.log(err);
        return reject(err);
      }
      if (!thing){
        console.log("nothing found!");
        return reject('fuck');
      }
      logger.log({ type: 'info', msg: 'findMatchingUser: found' });
      return resolve(thing._id);
    }
  }.bind(this));
};

// App.prototype.findMatchingUser = function(twilio) {
//   logger.log({ type: 'info', msg: 'findMatchingUser' });
//   return new Promise(function(resolve, reject) {
//     console.log(twilio);
//     console.log("about to search for..."+ twilio.From)
//     this.User
//         .findOne({'profile.mobile_numbers': twilio.From})
//         .exec(onSave);

//     function onSave(err,thing){
//       if (err) {
//         logger.log({ type: 'info', msg: 'findMatchingUser: failed to find' });
//         return reject(err);
//       }
//       if (!thing){
//         return reject('fuck');
//       }
//       logger.log({ type: 'info', msg: 'findMatchingUser: found' });
//       return resolve(thing._id);
//     }
//   }.bind(this));
// };

// App.prototype.saveTwilio = function(twilio, user_id) {
//   logger.log({ type: 'info', msg: 'saveTwilio' });
//   var id = uuid.v1();
//   return new Promise(function(resolve, reject) {
//     if (user_id){
//       new this.Thing({_id: id, user_id: user_id, verbalRequest: twilio.Body, twilio: twilio}).save(onSave);
//     } else {
//       new this.Thing({_id: id, verbalRequest: twilio.Body, twilio: twilio}).save(onSave);
//     }

//     function onSave(err,thing){
//       if (err) {
//         logger.log({ type: 'info', msg: 'saveTwilio: failed to save' });
//         return reject(err);
//       }
//       logger.log({ type: 'info', msg: 'saveTwilio: saved' });
//       return resolve(thing._id);
//     }
//   }.bind(this));
// };

// App.prototype.validateTwilio = function(id) {
//   return this.Thing.validate(id);
// };

// App.prototype.confirmTwilio = function(id, isValid, message) {
//   logger.log({ type: 'info', msg: 'handling job', queue: CONFIRM_TWILIO_QUEUE, id: id, message: message});
//   return this.Thing.confirm(id,isValid,message);
// };

App.prototype.startProcessing = function() {
  this.connections.queue.handle(UPDATE_USER_WITH_CONTACT_INFO_QUEUE, this.handleUpdateUserJob.bind(this));
  this.assignHandlersToQueues();
  // this.connections.queue.handle(CHECK_FOR_USER_QUEUE, this.handleTwilioJob.bind(this));
  // this.connections.queue.handle(RECORD_NEW_MESSAGE_QUEUE, this.saveTwilioJob.bind(this));
  // this.connections.queue.handle(VALIDATE_TWILIO_QUEUE, this.handleValidateTwilioJob.bind(this));
  // this.connections.queue.handle(CONFIRM_TWILIO_QUEUE, this.handleConfirmationTwilioJob.bind(this));
  // this.connections.queue.handle(S3_TWILIO_QUEUE, this.handleS3TwilioJob.bind(this));
  return this;
};

// App.prototype.saveTwilioJob = function(job, ack) {
//   logger.log({ type: 'info', msg: 'handling job', queue: RECORD_NEW_MESSAGE_QUEUE, twilio: job.twilio });

//   var self = this;
//   var user_id = job.user_id
//   this
//     .saveTwilio(job.twilio, user_id)
//     .then(onSuccess, onError);

//   function onSuccess(thing_id) {
//     logger.log({ type: 'info', msg: 'job complete', queue: RECORD_NEW_MESSAGE_QUEUE, status: 'success' });
//     self.connections.queue.publish(VALIDATE_TWILIO_QUEUE, {id: thing_id});
//     ack();
//   }

//   function onError(err) {
//     logger.log({ type: 'info', msg: 'job complete', queue: RECORD_NEW_MESSAGE_QUEUE, status: 'failure', error: err });
//     ack();
//   }
// };

App.prototype.handleUpdateUserJob = function(job, ack) {
  logger.log({ type: 'info', msg: 'handling job', queue: UPDATE_USER_WITH_CONTACT_INFO_QUEUE, user_id: job.user_id, record: job.record });

  var self = this;

  this
    .updateMatchingUser(job.user_id, job.record)
    .then(onSuccess, onError);

  function onSuccess(thing_id) {
    logger.log({ type: 'info', msg: 'job complete', queue: UPDATE_USER_WITH_CONTACT_INFO_QUEUE, status: 'success' });
    ack();
  }

  function onError(err) {
    logger.log({ type: 'info', msg: 'job complete', queue: UPDATE_USER_WITH_CONTACT_INFO_QUEUE, error: err, status: 'failure'});
    ack();
  }
};

// App.prototype.handleTwilioJob = function(job, ack) {
//   logger.log({ type: 'info', msg: 'handling job', queue: CHECK_FOR_USER_QUEUE, twilio: job.twilio });

//   var self = this;

//   this
//     .findMatchingUser(job.twilio)
//     .then(onSuccess, onError);

//   function onSuccess(thing_id) {
//     logger.log({ type: 'info', msg: 'job complete', queue: CHECK_FOR_USER_QUEUE, status: 'success' });
//     self.connections.queue.publish(RECORD_NEW_MESSAGE_QUEUE, {user_id: thing_id, twilio: job.twilio});
//     ack();
//   }

//   function onError(err) {
//     self.connections.queue.publish(RECORD_NEW_MESSAGE_QUEUE, {twilio: job.twilio});
//     logger.log({ type: 'info', msg: 'job complete', queue: CHECK_FOR_USER_QUEUE, status: 'failure', error: err });
//     ack();
//   }
// };

// App.prototype.handleS3TwilioJob = function (job, ack){
//   logger.log({ type: 'info', msg: 'handling job', queue: S3_TWILIO_QUEUE, id: job.id });

//   var self = this;

//   this
//     .Thing
//     .s3(job.id)
//     .then(onSuccess, onError);

//   function onSuccess(thing) {
//     logger.log({ type: 'info', msg: 'job complete', queue: S3_TWILIO_QUEUE, status: 'success'});
//     self.connections.queue.publish(NEW_TWILIO_QUEUE, {id: thing});
//     ack();
//   }

//   function onError(err) {
//     logger.log({ type: 'info', msg: 'job complete', queue: S3_TWILIO_QUEUE, status: 'failure', error: err });
//     ack();
//   }
// }

// App.prototype.handleConfirmationTwilioJob = function (job, ack){

//   logger.log({ type: 'info', msg: 'handling job', queue: CONFIRM_TWILIO_QUEUE, id: job.id });
//   var self = this;

//   this
//     .confirmTwilio(job.id, job.isValid, job.message) // confirmTwilio
//     .then(onSuccess, onError);

//   function onSuccess(thing) {
//     logger.log({ type: 'info', msg: 'job complete', queue: CONFIRM_TWILIO_QUEUE, status: 'success', validation: thing.message });
//     self.connections.queue.publish(S3_TWILIO_QUEUE, {id: thing._id, isValid: thing.isValid});
//     ack();
//   }

//   function onError(err) {
//     logger.log({ type: 'info', msg: 'job complete', queue: CONFIRM_TWILIO_QUEUE, status: 'failure', error: err });
//     ack();
//   }
// };

// App.prototype.handleValidateTwilioJob = function(job, ack) {
//   logger.log({ type: 'info', msg: 'handling job', queue: VALIDATE_TWILIO_QUEUE, id: job.id });
//   var self = this;
//   this
//     .validateTwilio(job.id)
//     .then(onSuccess, onError);

//   function onSuccess(thing) {
//     logger.log({ type: 'info', msg: 'job complete', queue: VALIDATE_TWILIO_QUEUE, status: 'success', validation: thing.message });
//     self.connections.queue.publish(CONFIRM_TWILIO_QUEUE, {id: thing._id});
//     ack();
//   }

//   function onError(err) {
//     logger.log({ type: 'info', msg: 'job complete', queue: VALIDATE_TWILIO_QUEUE, status: 'failure', error: err.message });
//     console.log(err.message);
//     ack();
//   }
// };

App.prototype.addFromDataToUser = function(user_id, record) {
  this.connections.queue.publish(UPDATE_USER_WITH_CONTACT_INFO_QUEUE, {user_id: user_id, record: record});
};

App.prototype.stopProcessing = function() {
  var self = this;
  _.each(this.queueList, function(queue){
    self.connections.queue.ignore(queue);
  });
  this.connections.queue.ignore(UPDATE_USER_WITH_CONTACT_INFO_QUEUE);
  // this.connections.queue.ignore(RECORD_NEW_MESSAGE_QUEUE);
  // this.connections.queue.ignore(CHECK_FOR_USER_QUEUE);
  // this.connections.queue.ignore(VALIDATE_TWILIO_QUEUE);
  // this.connections.queue.ignore(CONFIRM_TWILIO_QUEUE);
  // this.connections.queue.ignore(S3_TWILIO_QUEUE);
  return this;
};

// module.exports.createApp = function(config) {
//   return new App(config);
// };

var express = require('express');
var Thing = ThingModel;

var ERR_MAP = {
  'ArticleNotFound': 404,
  'VoteNotAllowed': 403,
  'ScrapeFailed': 500
};

module.exports.createRouter = function (app) {

  return new express.Router()
    .post('/twilio', processTwilio)
    .use(articleErrors)

  function processTwilio(req, res, next) {
    console.log("TWILIO-WORKER:processTwilio");
    console.log(req.body);
    app
      .processTwilio(req.body)
      .then(sendLink, next);

    function sendLink() {
      res.end();
    }
  }

  function articleErrors(err, req, res, next) {
    var status = ERR_MAP[err.name];
    if (status) err.status = status;
    next(err);
  }
};
