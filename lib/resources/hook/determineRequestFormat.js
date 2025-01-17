var mergeParams = require('../../../view/mergeParams');

var view = require('view');
var _view;
 view.create({ path: __dirname + "/../../../view"}, function (err, v){
   if (err) {
     throw err;
   }
   _view = v;
});

module['exports'] = function determineRequestFormat (req, res, next) {
  
  var hook = require('./');
    var types = [];
    if (req.headers && req.headers.accept) {
      types = req.headers.accept.split(',');
    }
    req.resFormat = req.resFormat || "raw";
    return next(req, res);
    
    return;
    /* this was removed because it seems very wrong. i believe this will run the hook in the context of the server!
       it's possible that this has been going on for some time
       hopefully removing this won't break anything...we have a lot more tests now...
    if (types.indexOf('text/html') !== -1 && req.resFormat === "friendly") {
      //console.log('RENDERING FRIENDLY RESPONSE')
      mergeParams(req, res, function(){
        _view['hook'].present({
          gist: req.hook.gist,
          request: req,
          response: res
        }, function(err, html){
          res.end(html);
        });
      });
    } else {
      //
      // If the response should be rendered raw, write the response as the Hook dictates
      //
      // console.log('RENDERING RAW RESPONSE');
      // override format
      mergeParams(req, res, function(){
       //console.log('resource parsed', req.resource.params)
        req.resFormat = "raw";
      });
    }
    */
    

}