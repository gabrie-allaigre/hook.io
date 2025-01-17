var events = require('../../resources/events');

var checkRoleAccess = require('./checkRoleAccess');
var config = require('../../../config');

var redis = require("redis"),
    client = redis.createClient(config.redis.port, config.redis.host);

// TODO: better error handling and client setup/teardown
client.on("error", function (err) {
  console.log("Error " + err);
});

module['exports'] = function handleHookEvents (req, res) {

  var key = "/user/" + req.params.owner + "/events"; // wrong amount of / keys?

  var h = { isPrivate: true, owner: req.params.owner };
  req.hook = h;

  checkRoleAccess({ req: req, res: res, role: "events::read" }, function (err, hasPermission) {

    if (!hasPermission) {
      return res.end(config.messages.unauthorizedRoleAccess(req, "events::read"));
    }

    if (req.jsonResponse) {
      res.writeHead(200, {
        'Content-Type': 'text/json'
      });
    } else {
      res.writeHead(200, {
        'Content-Type': 'text/plain'
      });
    }


    // TODO: browser HTML view should show recent events as static html
    // later, we can add an ajax gateway to populate events in real-time using eventSubcriberClient
    // TODO: in html view give checkbox for enabling auto-refresh of events

    if (req.headers['accept'] === "*/*") {
      // Remark: for */* user agent ( such as curl or other applications ),
      // we use eventSubcriberClient to create a streaming event endpoint
      var eventsSubcriberClient = redis.createClient(config.redis.port, config.redis.host);
      eventsSubcriberClient.on("pmessage", function (pattern, channel, message) {
        res.write(message + '\n');
      })
      renderEvents(true);
      console.log('subcribing to', key)
      eventsSubcriberClient.psubscribe(key);
    } else if (req.headers['accept'] === "text/plain") {
      renderEvents(false);
    }
    else {
      if (!req.jsonResponse) {
        // TODO: create a View class for event rendering
        res.write('System Events for ' + req.params.owner + '\n');
        res.write('Streaming System Events can be accessed by running: curl -N https://hook.io/' + req.params.owner + "/events" + '\n\n');
      }
      renderEvents(false);
    }

    function renderEvents (isStreaming) {

      events.recent("/" + req.params.owner, function(err, entries){
        if (err) {
          return res.end(err.message);
        }

        if (req.jsonResponse) {
          res.write(JSON.stringify(entries, true, 2));
        } else {
          entries.forEach(function(entry){
            var str;
            str = JSON.stringify(entry) + '\n';
            res.write(str);
          });
        }

        if (!isStreaming) {
          res.end();
        }
      });
    };
  });

}
