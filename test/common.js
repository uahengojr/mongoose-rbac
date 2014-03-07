var mongoose = require('mongoose')
  , rbac = require('../')
  , Permission = rbac.Permission
  , Role = rbac.Role
  , UserSchema
  , User;

process.env.NODE_ENV = 'test';

function setup(uri, callback) {
  mongoose.connect(uri);
  mongoose.connection.on('err', function () {
    callback(new Error("connection error"));
  });
  mongoose.connection.once('open', function () {
    reset(callback);
  });
}

function empty(callback) {
  User.remove({});
  Role.remove({});
  Permission.remove({});
  callback();
}

function reset(callback) {
  for (var name in mongoose.connection.collections) {
    mongoose.connection.collections[name].drop();
  }
  callback();
}

function loadFixtures(callback) {
  empty(function (err) {
    if (err) return callback(err);

    var permissions = [
        { subject: 'Post', action: 'create' },
        { subject: 'Post', action: 'read' },
        { subject: 'Post', action: 'update' },
        { subject: 'Post', action: 'delete' },
        { subject: 'Comment', action: 'create' },
        { subject: 'Comment', action: 'read' },
        { subject: 'Comment', action: 'update' },
        { subject: 'Comment', action: 'delete' }
      ];

    var user = new User({ username: 'henry' });
    user.save();

    Permission.create(permissions, function (err) {
      if (err) return callback(err);

      var perms, admin, readonly;

      perms = Array.prototype.slice.call(arguments, 1);
      admin = new Role({ name: 'admin' });
      admin.permissions = perms;
      admin.save(function (err) {
        if (err) return callback(err);
        readonly = new Role({ name: 'readonly' });
        readonly.permissions = [perms[1], perms[5]];
        readonly.save(function (err) {
          callback(err);
        });
      });
    });
  });
}

UserSchema = mongoose.Schema({ username: String });
UserSchema.plugin(rbac.plugin);
User = mongoose.model('User', UserSchema);

module.exports.User = User;
module.exports.setup = setup;
module.exports.empty = empty;
module.exports.reset = reset;
module.exports.loadFixtures = loadFixtures;
