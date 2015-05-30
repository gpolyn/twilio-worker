var express = require('express');
var Thing = require('../../models/Thing');

var ERR_MAP = {
  'ArticleNotFound': 404,
  'VoteNotAllowed': 403,
  'ScrapeFailed': 500
};

module.exports = function articlesRouter(app) {

  return new express.Router()
    // .get('/', showForm)
    .get('/somethings.json', listThings)
    // .get('/articles/:articleId.json', showArticle)
    // .post('/articles/:articleId/vote.json', upvoteArticle)
    .post('/twilio', processTwilio)
    .put('/things/:thingId/claim', claimThing)
    .use(articleErrors)
    // .use(express.static(path.join(__dirname, 'public')));

  // function showForm(req, res, next) {
  //   res.render(path.join(__dirname, 'list'));
  // }

  function claimThing(req, res, next) {
  // var claimThing = function(req, res) {
    console.log("claimThing");

    var userId = req.session.passport.user;
    Thing
      .findByIdAndUpdate(req.params.thingId, { $set: { user_id: userId } })
      .exec(function(erro, thing){
        if (erro){
        req.flash('errors', { msg: erro.message });
        return res.redirect('/things');
        }
        if (!thing){
        req.flash('errors', { msg: "Couldn't find" });
        return res.redirect('/things');
        }
        app
          .addFromDataToUser(req.session.passport.user, thing)
        res.json(thing);
      })
  };

  function listThings(req, res, next) {
    app
      .listThings(15, req.param('fresh'))
      .then(sendList, next);

    function sendList(list) {
      res.json(list);
    }
  }

  function processTwilio(req, res, next) {
    console.log(req.body);
    app
      .processTwilio(req.body)
      .then(sendLink, next);

    function sendLink() {
      res.end();
    }
  }

  // function showArticle(req, res, next) {
  //   app
  //     .getArticle(req.params.articleId)
  //     .then(sendArticle, next);

  //   function sendArticle(article) {
  //     return res.json(article);
  //   }
  // }

  // function upvoteArticle(req, res, next) {
  //   app
  //     .addUpvote(req.user.id, req.params.articleId)
  //     .then(sendLink, next);

  //   function sendLink(id) {
  //     return res.json({ link: '/articles/' + id + '.json' });
  //   }
  // }

  function articleErrors(err, req, res, next) {
    var status = ERR_MAP[err.name];
    if (status) err.status = status;
    next(err);
  }
};
