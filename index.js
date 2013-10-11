
var mongooseRedisCache
  , redis = require("redis")
  , _ = require("lodash");

mongooseRedisCache = function(mongoose, options, callback) {
  var client, host, pass, port, redisOptions;
  if (options == null) {
    options = {};
  }
  host = options.host || "";
  port = options.port || "";
  pass = options.pass || "";
  redisOptions = options.options || {};

  connectToRedis();

  function connectToRedis() {
    mongoose.redisClient = client = redis.createClient(port, host, redisOptions);
    if (pass.length > 0) {
      client.auth(pass, function(err) {
        if (callback) {
          return callback(err);
        }
      });
    }

    client.on("connect", function () {
      //console.log('Succesfully connected to Redis!')
    });

    // override default mongoose select query
    overloadMongoose();

    // skip caching if redis dies
    client.on("error", function (err) {
      //console.log("Warning: Redis connection died." + err);

      // close dead connection
      client.end();

      // restore original mongoose find method
      mongoose.Query.prototype.execFind = mongoose.Query.prototype._execFind;

      //console.log('Retry Redis connection in 5 seconds...');

      setTimeout(function() {
        //console.log('Reconnecting to Redis...');
        connectToRedis();
      }, 5000);

    });
  }

  function overloadMongoose() {

    mongoose.Query.prototype._execFind = mongoose.Query.prototype.execFind;
    mongoose.Query.prototype.execFind = function(callback) {
      var cb, expires, fields, key, model, query, schemaOptions, self;
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
      cb = function(err, result) {
        var docs;
        if (err) {
          return callback(err);
        }
        if (!result) {
          //console.log('Redis result not found... looking up in mongo.');
          return mongoose.Query.prototype._execFind.call(self, function(err, docs) {
            var str;
            if (err) {
              return callback(err);
            }
            str = JSON.stringify(docs);
            client.set(key, str);
            client.expire(key, expires);
            return callback(null, docs);
          });
        } else {
          //console.log('Redis result found. Returning from cache.');
          docs = JSON.parse(result);
          return callback(null, docs);
        }
      };
      client.get(key, cb);
      return this;
    };
  };

};

module.exports = mongooseRedisCache;
