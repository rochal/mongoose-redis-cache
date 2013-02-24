// Generated by CoffeeScript 1.4.0
var mongooseRedisCache, redis, _;

redis = require("redis");

_ = require("underscore");

mongooseRedisCache = function(mongoose, options) {
  var client, host, pass, port, redisOptions;
  if (options == null) {
    options = {};
  }
  host = options.host || "";
  port = options.port || "";
  pass = options.pass || "";
  redisOptions = options.options || {};
  mongoose.redisClient = client = redis.createClient(host, port, redisOptions);
  if (pass.length > 0) {
    client.auth(pass);
  }
  mongoose.Query.prototype._execFind = mongoose.Query.prototype.execFind;
  mongoose.Query.prototype.execFind = function(callback) {
    var arr, cb, expires, fields, key, model, query, schemaOptions, self;
    self = this;
    model = this.model;
    query = this._conditions;
    options = this._optionsForExec(model);
    fields = _.clone(this._fields);
    schemaOptions = model.schema.options;
    expires = schemaOptions.expires || 60;
    if (!schemaOptions.redisCache && options.lean) {
      return mongoose.Query.prototype._execFind.apply(self, arguments);
    }
    key = JSON.stringify(query) + JSON.stringify(options) + JSON.stringify(fields);
    arr = [];
    cb = function(err, result) {
      var docs;
      if (!result) {
        return mongoose.Query.prototype._execFind.call(self, function(err, docs) {
          var str;
          if (err) {
            return callback(err);
          }
          str = JSON.stringify(docs);
          client.set(key, str);
          client.expire(key, expires);
          return callback(null, arr);
        });
      } else {
        docs = JSON.parse(result);
        return callback(null, arr);
      }
    };
    client.get(key, cb);
    return this;
  };
};

module.exports = mongooseRedisCache;