var log = require('../../resources/log');
var hook = require('../../resources/hook');

var checkRoleAccess = require('./checkRoleAccess');
var config = require('../../../config');

var redis = require("redis"),
    client = redis.createClient(config.redis.port, config.redis.host);

// TODO: better error handling and client setup/teardown
client.on("error", function (err) {
    console.log("Error " + err);
});

module['exports'] = function handleHookLogs (req, res) {

  var key = "/hook/" + req.params.owner + "/" + req.params.hook + "/logs";

  // lookup hook based on owner and name, we need to do this in order to check if it's private or not
  var h = { isPrivate: true, owner: req.params.owner };

  req.hook = h;

  var params = req.resource.params;
  var query = { owner: req.params.owner, name: req.params.hook };

  return hook.find(query, function(err, result){

    if (err) {
      return res.end(err.message);
    }
    if (result.length === 0) {
      return res.end('No Hook Found!');
    }

    req.hook = result[0];

    if (params.flush) {
      return checkRoleAccess({ req: req, res: res, role: "hook::logs::write" }, function (err, hasPermission) {
        if (!hasPermission) {
          return res.end(config.messages.unauthorizedRoleAccess(req, "hook::logs::write"));
        }
        return log.flush('/' + req.params.owner + '/' + req.params.hook, function (err, r) {
          if (err) {
            return res.end(err.message)
          }
          res.json(r);
        })
      })
    }

    checkRoleAccess({ req: req, res: res, role: "hook::logs::read" }, function (err, hasPermission) {

      // only protect source of private services
      if (req.hook.isPrivate !== true) {
        hasPermission = true;
      }

      if (!hasPermission) {
        return res.end(config.messages.unauthorizedRoleAccess(req, "hook::logs::read"));
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

      // TODO: browser HTML view should show recent logs as static html
      // later, we can add an ajax gateway to populate logs in real-time using logSubcriberClient
      // TODO: in html view give checkbox for enabling auto-refresh of logs

      if (req.headers['accept'] === "*/*") {
        // Remark: for */* user agent ( such as curl or other applications ),
        // we use logSubcriberClient to create a streaming log endpoint
        var logSubcriberClient = redis.createClient(config.redis.port, config.redis.host);
        logSubcriberClient.on("pmessage", function (pattern, channel, message) {
          res.write(message + '\n');
        })
        renderLogs(true);
        logSubcriberClient.psubscribe(key);
      } else if (req.headers['accept'] === "text/plain") {
        renderLogs(false);
      }
      else {
        // TODO: create a View class for log rendering
        if (!req.jsonResponse) {
          res.write('Logs for ' + req.params.owner + "/" + req.params.hook + '\n');
          res.write('Streaming logs can be accessed by running: curl -N https://hook.io/' + req.params.owner + "/" + req.params.hook + "/logs" + '\n\n');
        }
        renderLogs(false);
      }

      function renderLogs (isStreaming) {
        log.recent("/" + req.params.owner + "/" + req.params.hook, function(err, entries){
          if (err) {
            return res.end(err.message);
          }
          if (req.jsonResponse) {
            res.write(JSON.stringify(entries, true, 2));
          } else {
            entries.forEach(function(entry){
              entry = JSON.parse(entry);
              var str;
              if (req.jsonResponse) {
                str = JSON.stringify(entry) + '\n';
              } else {
                str = new Date(entry.time) + ', ' + entry.data + '\n';
              }
              res.write(str);
            });
          }
          if (!isStreaming) {
            res.end();
          }
        });
      };
    });
  });


}
