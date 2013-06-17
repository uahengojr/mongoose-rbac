var mongoose = require('mongoose')
  , async = require('async')
  , CAN_ALL = 'all'
  , CAN_ANY = 'any'
  , SEPARATOR = ':'
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
      that.invalidate('name', 'must be unique');
      done(new Error('Role name must be unique'));
    }
    else {
      done();
    }
  });
});

/**
 * Determines whether a Role has the given permissions. Permissions are
 * passed in as `actionsAndSubjects`; `type` is one of:
 *   - 'any'
 *   - 'all'
 * and determines how the check is performed. This function's scope should be
 * bound to the Role that is being checked.
 */
function doCan(type, actionsAndSubjects, done) {
  var role = this, actionsAndSubjects = parsePermissions(actionsAndSubjects);
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

/**
 * Find Role with name == `role` if `role` is String; otherwise, just
 * returns `role`.
 */
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

/**
 * Parse actions and subjects from various input formats:
 *
 *   * 'action1:Subject1 action2:Subject1'
 *   * {Subject1: ['action1', 'action2']}
 *   * {Subject1: 'action1'}
 *   * [{action: 'action1', subject: 'Subject1'}, ...]
 *   * [['action1', 'Subject1'], ...]
 *
 * and return as an array of arrays:
 *
 *   * [['action1', 'Subject1'], ...]
 */
function parsePermissions(actionsAndSubjects) {
  var out = [];
  if ('object' === typeof actionsAndSubjects &&
      !Array.isArray(actionsAndSubjects)) {
    if (2 === Object.keys(actionsAndSubjects).length &&
        actionsAndSubjects.hasOwnProperty('action') &&
        actionsAndSubjects.hasOwnProperty('subject')) {
      actionsAndSubjects = [[actionsAndSubjects.action, actionsAndSubjects.subject]];
    }
    else {
      var tmp = [];
      for (var subject in actionsAndSubjects) {
        if (Array.isArray(actionsAndSubjects[subject])) {
          actionsAndSubjects[subject].forEach(function (action) {
            tmp.push([action, subject]);
          });
        }
        else if ('string' === typeof actionsAndSubjects[subject]) {
          tmp.push([actionsAndSubjects[subject], subject]);
        }
      }
    }
    actionsAndSubjects = tmp;
  }
  else if ('string' === typeof actionsAndSubjects) {
    actionsAndSubjects = actionsAndSubjects.split(' ');
  }
  if (Array.isArray(actionsAndSubjects)) {
    actionsAndSubjects.forEach(function (perm) {
      if (Array.isArray(perm) && 2 === perm.length) {
        out.push(perm);
      }
      else if ('string' === typeof perm) {
        out.push(perm.split(SEPARATOR));
      }
      else if ('object' === typeof perm) {
        out.push([perm.action, perm.subject]);
      }
    });
  }
  return out;
}

/**
 * mongoose Schema plugin.
 */
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
    var obj = this, actionsAndSubjects = parsePermissions(actionsAndSubjects);
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
    var obj = this, actionsAndSubjects = parsePermissions(actionsAndSubjects);
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
    rolesAndPermissions[name] = parsePermissions(rolesAndPermissions[name]);
    // Convert [action, subject] arrays to {action, subject} objects
    rolesAndPermissions[name].forEach(function (perm, i) {
      rolesAndPermissions[name][i] = {action: perm[0], subject: perm[1]};
    });

    // Create role
    var role = new Role({ name: name });
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