# mongoose-rbac

Role-based access control for mongoose apps.

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

Let's imagine we are managing a blog with users, preferences, posts and comments. First, we will define our permissions and roles. The recommended approach is to bootstrap roles and permissions using `rbac.init`:

```javascript
// permissions.js

var rbac = require('mongoose-rbac');

rbac.init({
  admin: {
    Post: ['create', 'read', 'update', 'delete'],
    Comment: ['create', 'read', 'update', 'delete'],
    Preference: ['create', 'read', 'update', 'delete']
  },
  developer: {
    Post: ['create', 'read', 'update', 'delete'],
    Comment: ['create', 'read', 'update', 'delete']
  },
  readonly: {
    Post: 'read',
    Comment: 'read'
  }
}, function (err, admin, developer, readonly) {
  // ...
});
```

`rbac.init` supports three syntaxes for mapping roles to permissions:

```javascript
// Subject-actions object
rbac.init({
  admin: {
    Post: ['create', 'read'],
    Comment: ['create', 'read']
  }
});

// Array of action/subject arrays
rbac.init({
  admin: [
    ['create', 'Post'],
    ['read', 'Post'],
    ['create', 'Comment'],
    ['read', 'Comment']
  ]
});

// Array of action/subject objects
rbac.init({
  admin: [
    {action: 'create', subject: 'Post'},
    {action: 'read', subject: 'Post'},
    {action: 'create', subject: 'Comment'},
    {action: 'read', subject: 'Comment'}
  ]
});
```

You may, however, choose to work with permissions and roles at a more granular level:

```javascript
// permissions.js

var rbac = require('mongoose-rbac');

var permissions = [
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

rbac.Permission.create(permissions, function (err) {
  var perms, admin, developer, readonly;

  perms = Array.prototype.slice.call(arguments, 1);

  admin = new rbac.Role({name: 'admin'});
  admin.permissions = perms;
  admin.save(function (err, admin) {
    developer = new rbac.Role({name: 'developer'});
    developer.permissions = perms.slice(0, 7);
    developer.save(function (err, developer) {
      readonly = new rbac.Role({name: 'readonly'});
      readonly.permissions = [perms[1], perms[5], perms[9]];
      readonly.save(function (err, readonly) {
        // ...
      });
    });
  });
});
```

Next, we will enhance our `User` model with the mongoose-rbac plugin:

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

user.canAny('read:Post create:Post', function (err, canReadOrCreate) {
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

* `actionsAndSubjects` ✝
* `callback(err, bool)` Function

### `canAll(actionsAndSubjects, callback)`

Check if the model has _all_ of the given permissions.

* `actionsAndSubjects` ✝
* `callback(err, bool)` Function

✝ `actionsAndSubjects` may take any of the following forms:
* `[['read', 'Post'], ['create', 'Post']]`
* `[{action: 'read', subject: 'Post'}, {action: 'create', subject: 'Post'}]`
* `{Post: ['read', 'create']}`
* `'read:Post create:Post'`

## Running Tests

To run the tests, clone the repository and install the dev dependencies:

```bash
git clone git://github.com/bryandragon/mongoose-rbac.git
cd mongoose-rbac && npm install
make test
```

## License

Copyright (c) 2013 Bryan Dragon

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
