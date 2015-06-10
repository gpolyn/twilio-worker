var logger = require('logfmt');
var uuid = require('node-uuid');
var Promise = require('promise');
var _ = require('lodash');

var CHECK_FOR_USER_QUEUE = 'match_user.text.twilio';
var RECORD_NEW_MESSAGE_QUEUE = 'save_new_record.text.twilio';
var VALIDATE_TWILIO_QUEUE = 'validate.text.twilio';
var CONFIRM_MESSAGE_RECEIVED_QUEUE = 'confirm_receipt.text.twilio';
var S3_TWILIO_QUEUE = 's3.text.twilio';

var twilioHandling = {
  
  assignHandlersToQueues: function(){
    this.connections.queue.handle(CHECK_FOR_USER_QUEUE, this.handleTwilioJob.bind(this));
    this.connections.queue.handle(RECORD_NEW_MESSAGE_QUEUE, this.saveTwilioJob.bind(this));
    this.connections.queue.handle(VALIDATE_TWILIO_QUEUE, this.handleValidateTwilioJob.bind(this));
    this.connections.queue.handle(CONFIRM_MESSAGE_RECEIVED_QUEUE, this.handleConfirmationTwilioJob.bind(this));
    this.connections.queue.handle(S3_TWILIO_QUEUE, this.handleS3TwilioJob.bind(this));
  },

  queueList: [CHECK_FOR_USER_QUEUE,S3_TWILIO_QUEUE, RECORD_NEW_MESSAGE_QUEUE, VALIDATE_TWILIO_QUEUE, CONFIRM_MESSAGE_RECEIVED_QUEUE],

  processTwilio : function(twilio) {
    var id = uuid.v1();
    this.connections.queue.publish(CHECK_FOR_USER_QUEUE, {id: id, twilio: twilio});
    return Promise.resolve();
  },

  findMatchingUser: function(message) {
    logger.log({ type: 'info', msg: 'findMatchingUser' });
    return new Promise(function(resolve, reject) {
      console.log(message);
      
      // only novel part!

      var queryParam = {};

      if (_.isObject(message.twilio) && !_.isEmpty(message.twilio)){
        queryParam['profile.mobile_numbers'] = message.twilio.From;
      } else {
        queryParam['profile.email_addresses'] = message.postmark.From;
      }
      console.log("the params...")
      console.log(queryParam)

      this.User
          .findOne(queryParam)
          .exec(onSave);

      function onSave(err,thing){
        if (err) {
          logger.log({ type: 'info', msg: 'findMatchingUser: failed to find' });
          return reject(err);
        }
        if (!thing){
          return reject('fuck');
        }
        logger.log({ type: 'info', msg: 'findMatchingUser: found' });
        return resolve(thing._id);
      }
    }.bind(this));
  },

  handleTwilioJob: function(job, ack) {
    logger.log({ type: 'info', msg: 'handling job', queue: CHECK_FOR_USER_QUEUE });

    var self = this;

    this
      .findMatchingUser(job)
      .then(onSuccess, onError);

    function onSuccess(thing_id) {
      logger.log({ type: 'info', msg: 'job complete', queue: CHECK_FOR_USER_QUEUE, status: 'success' });
      // console.log(job)
      self.connections.queue.publish(RECORD_NEW_MESSAGE_QUEUE, {user_id: thing_id, message: job});
      ack();
    }

    function onError(err) {
      self.connections.queue.publish(RECORD_NEW_MESSAGE_QUEUE, {message: job});
      logger.log({ type: 'info', msg: 'job complete', queue: CHECK_FOR_USER_QUEUE, status: 'failure', error: err });
      ack();
    }
  },

  saveTwilio : function(twilio, user_id) {
    logger.log({ type: 'info', msg: 'saveTwilio' });
    var id = uuid.v1();
    return new Promise(function(resolve, reject) {
      if (user_id){
        new this.Thing({_id: id, user_id: user_id, verbalRequest: twilio.Body, twilio: twilio}).save(onSave);
      } else {
        new this.Thing({_id: id, verbalRequest: twilio.Body, twilio: twilio}).save(onSave);
      }

      function onSave(err,thing){
        if (err) {
          logger.log({ type: 'info', msg: 'saveTwilio: failed to save' });
          return reject(err);
        }
        logger.log({ type: 'info', msg: 'saveTwilio: saved' });
        return resolve(thing._id);
      }
    }.bind(this));
  },

  saveTwilioJob: function(job, ack) {
    logger.log({ type: 'info', msg: 'handling job', queue: RECORD_NEW_MESSAGE_QUEUE});
    console.log(job);
    var self = this;
    var user_id = job.user_id
    this
      .saveTwilio(job.message.twilio, user_id)
      .then(onSuccess, onError);

    function onSuccess(thing_id) {
      logger.log({ type: 'info', msg: 'job complete', queue: RECORD_NEW_MESSAGE_QUEUE, status: 'success' });
      self.connections.queue.publish(VALIDATE_TWILIO_QUEUE, {id: thing_id});
      ack();
    }

    function onError(err) {
      logger.log({ type: 'info', msg: 'job complete', queue: RECORD_NEW_MESSAGE_QUEUE, status: 'failure', error: err });
      ack();
    }
  },

  handleValidateTwilioJob : function(job, ack) {
    logger.log({ type: 'info', msg: 'handling job', queue: VALIDATE_TWILIO_QUEUE, id: job.id });
    var self = this;
    this
      // .validateTwilio(job.id)
      .Thing.validate(job.id)
      .then(onSuccess, onError);

    function onSuccess(thing) {
      logger.log({ type: 'info', msg: 'job complete', queue: VALIDATE_TWILIO_QUEUE, status: 'success', validation: thing.message });
      self.connections.queue.publish(CONFIRM_MESSAGE_RECEIVED_QUEUE, {id: thing._id});
      ack();
    }

    function onError(err) {
      logger.log({ type: 'info', msg: 'job complete', queue: VALIDATE_TWILIO_QUEUE, status: 'failure', error: err.message });
      console.log(err.message);
      ack();
    }
  },

  handleConfirmationTwilioJob : function (job, ack){
    logger.log({ type: 'info', msg: 'handling job', queue: CONFIRM_MESSAGE_RECEIVED_QUEUE, id: job.id });
    var self = this;

    this
      .Thing.confirm(job.id, job.isValid, job.message) // confirmTwilio
      // .confirmTwilio(job.id, job.isValid, job.message) // confirmTwilio
      .then(onSuccess, onError);

    function onSuccess(thing) {
      logger.log({ type: 'info', msg: 'job complete', queue: CONFIRM_MESSAGE_RECEIVED_QUEUE, status: 'success', validation: thing.message });
      self.connections.queue.publish(S3_TWILIO_QUEUE, {id: thing._id, isValid: thing.isValid});
      ack();
    }

    function onError(err) {
      logger.log({ type: 'info', msg: 'job complete', queue: CONFIRM_MESSAGE_RECEIVED_QUEUE, status: 'failure', error: err });
      ack();
    }
  },

  handleS3TwilioJob : function (job, ack){
    logger.log({ type: 'info', msg: 'handling job', queue: S3_TWILIO_QUEUE, id: job.id });

    var self = this;

    this
      .Thing
      .s3(job.id)
      .then(onSuccess, onError);

    function onSuccess(thing) {
      logger.log({ type: 'info', msg: 'job complete', queue: S3_TWILIO_QUEUE, status: 'success'});
      self.connections.queue.publish(NEW_TWILIO_QUEUE, {id: thing});
      ack();
    }

    function onError(err) {
      logger.log({ type: 'info', msg: 'job complete', queue: S3_TWILIO_QUEUE, status: 'failure', error: err });
      ack();
    }
  }

}

module.exports = twilioHandling;
