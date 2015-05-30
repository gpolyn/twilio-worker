var _ = require('lodash');

exports.getUrlForS3 = function (thing){
  if (!_.isEmpty(thing.twilio)){
    return thing.twilio.MediaUrl0;
  } 
  return null;
}

exports.validateTwilio = function (thing){
  var twilio = thing.twilio;
  var numMedia = parseInt(twilio.NumMedia);
  var message = "";
  if(twilio.Body.trim().length < 2){
    message += "Text must be at least 2 characters. ";
  }

  if (numMedia !==1 ) {
    if (message.length > 0){
      message += "Also, attach one and just one image. "
    } else {
      message += "Attach one and just one image. "
    }
  }

  var isValid = (message.length > 0 ? false: true);
  return {isValid: isValid, message: message.trim()};
}
