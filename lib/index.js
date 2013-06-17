var mongoose = require('mongoose')
  , async = require('async')
  , CAN_ALL = 'all'
  , CAN_ANY = 'any'
  , PermissionSchema
  , Permission
  , RoleSchema
  , Role;

PermissionSchema = mongoose.Schema({
  subject: { type: String, required: true },
  action: { type: String, required: true },
  displayName: String,
  description: String
});

PermissionSchema.statics.findOrCreate = function (params, callback) {
  var that = this;

  function findOrCreateOne(params, callback) {
    that.findOne(params, function (err, permission) {
      if (err) return callback(err);
      if (permission) return callback(null, permission);
      that.create(params, callback);
    });
  }

  if (Array.isArray(params)) {
    var permissions = [];
    async.forEachSeries(params, function (param, next) {
      findOrCreateOne(param, function (err, permission) {
        permissions.push(permission);
        next(err);
      });
    }, function (err) {
      callback.apply(null, [err].concat(permissions));
    });
  }
  else {
    findOrCreateOne(params, callback);
  }
};

RoleSchema = mongoose.Schema({
  name: { type: String, required: true },
  displayName: String,
  description: String,
  permissions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Permission' }]
});

RoleSchema.methods.can = function (action, subject, done) {
  mongoose.model('Role').findById(this.id, function (err, role) {
    if (err) return done(err);
    doCan.call(role, CAN_ALL, [[action, subject]], done);
  });
};

RoleSchema.methods.canAll = function (actionsAndSubjects, done) {
  mongoose.model('Role').findById(this.id, function (err, role) {
    if (err) return done(err);
    doCan.call(role, CAN_ALL, actionsAndSubjects, done);
  });
};

RoleSchema.methods.canAny = function (actionsAndSubjects, done) {
  mongoose.model('Role').findById(this.id, function (err, role) {
    if (err) return done(err);
    doCan.call(role, CAN_ANY, actionsAndSubjects, done);
  });
};

RoleSchema.pre('save', function (done) {
  var that = this;
  mongoose.model('Role').findOne({ name: that.name }, function (err, role) {
    if (err) {
      done(err);
    }
    else if (role && that.id !== role.id) {
      that.invalidate('name', 'name must be unique');
      done(new Error('Role name must be unique'));
    }
    else {
      done();
    }
  });
});

function doCan(type, actionsAndSubjects, done) {
  var role = this;
  role.populate('permissions', function (err, role) {
    if (err) return done(err);
    var count = 0, hasAll = false;
    if (role.permissions) {
      actionsAndSubjects.forEach(function (as) {
        var has = false;
        role.permissions.forEach(function (p) {
          if (p.action === as[0] && p.subject === as[1]) has = true;
        });
        if (has) count++;
      });
    }
    if (type === CAN_ANY) {
      hasAll = (count > 0);
    }
    else {
      hasAll = (count === actionsAndSubjects.length);
    }
    done(null, hasAll);
  });
}

function resolveRole(role, done) {
  if (typeof role === 'string') {
    mongoose.model('Role').findOne({ name: role }, function (err, role) {
      if (err) return done(err);
      if (!role) return done(new Error("Unknown role"));
      done(null, role);
    });
  }
  else {
    done(null, role);
  }
}

function plugin(schema, options) {
  schema.add({
    roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }]
  });

  schema.methods.hasRole = function (role, done) {
    var obj = this;
    resolveRole(role, function (err, role) {
      if (err) return done(err);
      obj.populate('roles', function (err, obj) {
        if (err) return done(err);
        var hasRole = false;
        if (obj.roles) {
          obj.roles.forEach(function (r) {
            if (r.id === role.id) hasRole = true;
          });
        }
        done(null, hasRole);
      });
    });
  };

  schema.methods.addRole = function (role, done) {
    var obj = this;
    resolveRole(role, function (err, role) {
      if (err) return done(err);
      obj.hasRole(role, function (err, has) {
        if (err) return done(err);
        if (has) return done(null, obj);
        obj.roles.push(role._id);
        obj.save(done);
      });
    });
  };

  schema.methods.removeRole = function (role, done) {
    var obj = this;
    resolveRole(role, function (err, role) {
      obj.hasRole(role.name, function (err, has) {
        if (err) return done(err);
        if (!has) return done(null);
        var index = obj.roles.indexOf(role._id);
        obj.roles.splice(index, 1);
        obj.save(done);
      });
    });
  };

  schema.methods.can = function (action, subject, done) {
    var obj = this;
    obj.populate('roles', function (err, obj) {
      if (err) return done(err);
      var hasPerm = false;
      if (obj.roles) {
        async.forEachSeries(obj.roles, function (role, next) {
          role.can(action, subject, function (err, has) {
            if (err) return next(err);
            if (has) hasPerm = true;
            next();
          });
        }, function (err) {
          done(err, hasPerm);
        });
      }
      else {
        done(null, hasPerm);
      }
    });
  };

  schema.methods.canAll = function (actionsAndSubjects, done) {
    var obj = this;
    obj.populate('roles', function (err, obj) {
      if (err) return done(err);
      var count = 0, hasAll = false;
      if (obj.roles) {
        async.forEachSeries(actionsAndSubjects, function (as, nextPerm) {
          var found = false;
          async.forEachSeries(obj.roles, function (role, nextRole) {
            role.can(as[0], as[1], function (err, has) {
              if (err) return nextRole(err);
              if (!found && has) {
                found = true;
                count++;
              }
              nextRole();
            });
          }, function (err) {
            nextPerm(err);
          });
        }, function (err) {
          hasAll = (count === actionsAndSubjects.length);
          done(err, hasAll);
        });
      }
      else {
        done(null, hasAll);
      }
    });
  };

  schema.methods.canAny = function (actionsAndSubjects, done) {
    var obj = this;
    obj.populate('roles', function (err, obj) {
      if (err) return done(err);
      var hasAny = false;
      if (obj.roles) {
        var iter = 0;
        async.until(
          function () {
            return hasAny || iter === obj.roles.length;
          },
          function (callback) {
            obj.roles[iter].canAny(actionsAndSubjects, function (err, has) {
              if (err) return callback(err);
              if (has) hasAny = true;
              iter++;
              callback();
            });
          },
          function (err) {
            done(err, hasAny);
          });
      }
      else {
        done(null, hasAll);
      }
    });
  };
};

function init(rolesAndPermissions, done) {
  var count = Object.keys(rolesAndPermissions).length
    , roles = []
    , promise = new mongoose.Promise(done);
  for (var name in rolesAndPermissions) {
    var len, role;
    // Convert [action, subject] arrays to objects
    len = rolesAndPermissions[name].length;
    for (var i = 0; i < len; i++) {
      if (Array.isArray(rolesAndPermissions[name][i])) {
        rolesAndPermissions[name][i] = {
          action: rolesAndPermissions[name][i][0],
          subject: rolesAndPermissions[name][i][1]
        };
      }
    }
    // Create role
    role = new Role({ name: name });
    roles.push(role);
    role.save(function (err, role) {
      if (err) return promise.error(err);
      // Create role's permissions if they do not exist
      Permission.findOrCreate(rolesAndPermissions[role.name], function (err) {
        if (err) return promise.error(err);
        // Add permissions to role
        role.permissions = Array.prototype.slice.call(arguments, 1);
        // Save role
        role.save(function (err, role) {
          if (err) return promise.error(err);
          --count || done.apply(null, [err].concat(roles));
        });
      });
    });
  }
}

module.exports.Permission = Permission = mongoose.model('Permission', PermissionSchema);
module.exports.Role = Role = mongoose.model('Role', RoleSchema);
module.exports.plugin = plugin;
module.exports.init = init;