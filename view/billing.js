// Stripe info
// Plan ID: BASIC_HOSTING_PLAN
// Cost: $5.00 per 30 days, no trial
// Statement: Hook.io Hosting Plan

var hook = require('../lib/resources/hook');
var user = require('../lib/resources/user');
var config = require('../config');
var bodyParser = require('body-parser');
var mergeParams = require('./mergeParams');
var request = require('request');
var billing = require('../lib/resources/billing')
var stripe = require('stripe')(config.stripe.secretKey);

var billingForm = require('./billingForm');
var addPaymentOption = require('./addPaymentOption');

module['exports'] = function view (opts, callback) {

  var $ = this.$;
  var req = opts.request, res = opts.response;

  $('#addPaymentMethod').attr('data-key', config.stripe.publicKey);

  bodyParser()(req, res, function bodyParsed(){
    mergeParams(req, res, function(){});
    var params = req.resource.params;

    function createStripeSubscription (id, opts, cb) {
      stripe.customers.createSubscription(id, opts, cb);
    }
    
    function createLocalBillings (opts, cb) {
      if (typeof opts.owner === "undefined") {
        var slug = require('slug');
        // quick hack fix for creating a unique user name based on email
        // TODO: no way to update user name now...fix that in /account page
        var name = slug(opts.email);
        user.find({ email: opts.email }, function (err, results) {
          if (err) {
            return res.end(err.message);
          }
          if(results.length === 0) {
            user.create({ name: name, email: opts.email, paidStatus: "paid" }, function (err, result) {
              if (err) {
                return res.end(err.message);
              }
              req.session.paidStatus = "paid";
              complete(result)
            });
          } else {
            var u = results[0];
            u.paidStatus = "paid";
            req.session.paidStatus = "paid";
            u.save(function(err, r){
              if (err) {
                return res.end(err.message);
              }
              complete(u);
            });
          }
        });
      } else {
        complete();
      }
      function complete (user) {
        // console.log('creating billings', opts);
        if (typeof user !== "undefined") {
          opts.owner = user.name;
          req.login(user, function (err){
            if (err) {
              return res.end(err.message);
            }
            req.session.user = user.name.toLowerCase();
            billing.create(opts, cb);
          })
        } else {
          billing.create(opts, cb);
        }
      };
      // if new billing creation was succesful, but no user was found with that email
      // *AND* there is no current session,
      // then we need to sign up a new user, and redirect to /account?paid

    }

    function showBillings (results, callback) {
      if(params.ajax === true) {
        return res.end('paid');
      }

      var count = results.length;

      function finish () {
        var _billing = results[0];
        if (count === 0) {
          callback(null);
        }
      };

      results.forEach(function(item){
        // item.destroy();
        billingForm(item, function (err, re){
          $('.billingForm').append(re);
          count--;
          finish();
        });
      });

    };

    $('.addPaymentOption').html(addPaymentOption());
    // console.log('getting params', params);
    // if new billing information was posted ( from  account page ), add it
    if (params.addCustomer) {
      params.amount = Number(params.amount);
      // console.log('adding new customer');
      // create a new customer based on email address
      stripe.customers.create(
        { email: params.email },
        function (err, customer) {
          if (err) {
            if (params.ajax) {
              return res.end(err.message);
            }
            // possible issue here with existing customers attempting to add new plans
            $('.status').html(err.message);
          }
          // console.log('new customer created', err, customer);
          $('.status').html('New billing informationed added!');

          // select plan based on user-selected value
          var _plan = "BASIC_HOSTING_PLAN";

          if (params.amount > 500) {
            _plan = _plan + "_" + (params.amount / 100);
          }

          createStripeSubscription(customer.id, {
             plan: _plan,
             source: params.stripeToken // source is the token created from checkout.js
           }, function(err, charge){
             if (err) {
               if (params.ajax) {
                 return res.end(err.message);
               }
               $('.status').addClass('error');
               $('.status').html(err.message);
               return callback(err, $.html());
             }

            createLocalBillings({
              owner: req.session.user, // TODO: better check here
              stripeID: customer.id,
              email: params.email,
              amount: params.amount,
              plan: _plan
            }, function (err, _billing) {
              // console.log('new billing created', err, _billing);
              if (err) {
                $('.status').html(err.message);
                return callback(null, err.message);
              }

               // console.log('added to plan', err, charge);
               $('.status').html('Billing Information Added! Thank you!');
               if (params.ajax) {
                 return res.end('paid');
               }
               billing.find({ owner: req.session.user }, function (err, results) {
                 if (err) {
                   $('.status').html(err.message);
                   return callback(err, $.html());
                 }
                 showBillings(results, function(){
                   callback(err, $.html());
                 });
               });
            });
          });
        }
      );
    } else {
      // not adding new billing data, just show existing
      if (!req.isAuthenticated()) {
        req.session.redirectTo = "/billing";
        return res.redirect('/');
      }
      billing.find({ owner: req.session.user }, function (err, results) {
        if (err) {
          return callback(null, err.message);
        }
        if (results.length > 0) {
          $('.noBilling').remove();
          var _billing = results[0];
          showBillings(results, function(){
            callback(null, $.html());
          });
        } else {
          // TODO: add copy on billing page for pricing options
          // $('.billingForm').html('<h3>No Billing Options Found!</h3>' + checkOut);
          callback(null, $.html());
        }
      });
      // callback(null, $.html());
     }
  });
};
