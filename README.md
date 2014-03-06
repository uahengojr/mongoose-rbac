# mongoose-rbac

Role-based access control for [mongoose](http://mongoosejs.com) apps.

[![Build Status](https://secure.travis-ci.org/bryandragon/mongoose-rbac.png)](http://travis-ci.org/bryandragon/mongoose-rbac)

## Requirements

* [mongoose](https://github.com/learnboost/mongoose/) 3.8.x

## Installation

```
npm install mongoose-rbac --save
```

## Usage

mongoose-rbac gives you the building blocks to lock down your app with role-based access control and gets out of your way.

Generally, you will want to do the following:

1. Create a `Permission` for each action you desire to control. A `Permission` consists of a `subject` and an `action`.
2. Create a `Role` for each role you wish to assign. A `Role` only requires a unique `name`.
3. Assign the desired set of permissions to each role.
4. Use the mongoose-rbac plugin in your user schema.

### Example

Following is a typical example. Let's imagine we are managing a blog with users, preferences, posts and comments. First, we will define our permissions and roles:

```javascript
// permissions.js

var rbac = require('mongoose-rbac')
  , Permission = rbac.Permission
  , Role = rbac.Role
  , permissions;

permissions = [
    { subject: 'Post', action: 'create' }
  , { subject: 'Post', action: 'read' }
  , { subject: 'Post', action: 'update' }
  , { subject: 'Post', action: 'delete' }
  , { subject: 'Comment', action: 'create' }
  , { subject: 'Comment', action: 'read' }
  , { subject: 'Comment', action: 'update' }
  , { subject: 'Comment', action: 'delete' }
  , { subject: 'Preference', action: 'create' }
  , { subject: 'Preference', action: 'read' }
  , { subject: 'Preference', action: 'update' }
  , { subject: 'Preference', action: 'delete' }
];

Permission.create(permissions, function (err) {
  var perms, admin, developer, readonly;

  perms = Array.prototype.slice.call(arguments, 1);

  admin = new Role({ name: 'admin' });
  admin.permissions = perms;
  admin.save(function (err, admin) {
    developer = new Role({ name: 'developer' });
    developer.permissions = perms.slice(0, 7);
    developer.save(function (err, developer) {
      readonly = new Role({ name: 'readonly' });
      readonly.permissions = [perms[1], perms[5], perms[9]];
      readonly.save(function (err, readonly) {
        // ...
      });
    });
  });
});
```

Alternatively we can use `init` to easily bootstrap roles and permissions:

```javascript
// permissions.js

var rbac = require('mongoose-rbac');

rbac.init({
  admin: [
    ['create', 'Post'],
    ['read', 'Post'],
    ['update', 'Post'],
    ['delete', 'Post']
  ],
  readonly: [
    // we can also specify permissions as an object
    { action: 'read', subject: 'Post' }
  ]
}, function (err, admin, readonly) {
  console.log(admin);
  /*
    { __v: 1,
      name: 'admin',
      _id: 513c14dbc90000d10100004e,
      permissions: [ 513c14dbc90000d101000044,
        513c14dbc90000d101000045,
        513c14dbc90000d101000046,
        513c14dbc90000d101000047 ] }
  */
  console.log(readonly);
  /*
    { __v: 1,
      name: 'readonly',
      _id: 513c14dbc90000d10100004f,
      permissions: [ 513c14dbc90000d101000045 ] }
  */
});
```

Next, we will enhance our user model with the mongoose-rbac plugin:

```javascript
// user.js

var mongoose = require('mongoose')
  , rbac = require('mongoose-rbac')
  , UserSchema
  , User;

UserSchema = mongoose.Schema({
  username: String,
  passwordHash: String
});

UserSchema.plugin(rbac.plugin);

module.exports = mongoose.model('User', UserSchema);
```

Finally, we can assign roles to our users and control their access to system resources:

```javascript
var User = require('user')
  , user;

user = new User({ username: 'hercules' });
user.save();

user.addRole('admin', function (err) {});

user.hasRole('admin', function (err, isAdmin) {
  console.log(isAdmin); // true
});

user.can('create', 'Post', function (err, can) {
  if (can) {
    // ok
  }
  else {
    // insufficient privileges
  }
});

user.canAny([['read', 'Post'], ['create', 'Post']], function (err, canReadOrCreate) {
  if (canReadOrCreate) {
    // ok
  }
  else {
    // insufficient privileges
  }
});

user.removeRole('admin', function (err) {});
```

## Model Plugin API

### `hasRole(role, callback)`

Check if the model has the given role.

* `role` String or Role
* `callback(err, bool)` Function

### `addRole(role, callback)`

Add the given role to the model.

* `role` String or Role
* `callback(err)` Function

### `removeRole(role, callback)`

Remove the given role from the model.

* `role` String or Role
* `callback(err)` Function

### `can(action, subject, callback)`

Check if the model has the given permisison.

* `action` String
* `subject` String
* `callback(err, bool)` Function

### `canAny(actionsAndSubjects, callback)`

Check if the model has _any_ of the given permissions.

* `actionsAndSubjects` Array (of `[String, String]`)
* `callback(err, bool)` Function

### `canAll(actionsAndSubjects, callback)`

Check if the model has _all_ of the given permissions.

* `actionsAndSubjects` Array (of [String, String])
* `callback(err, bool)` Function

## Running Tests

To run the tests, clone the repository and install the dev dependencies:

```bash
git clone git://github.com/bryandragon/mongoose-rbac.git
cd mongoose-rbac && npm install
make test
```

## License

MIT
