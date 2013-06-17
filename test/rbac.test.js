var expect = require('chai').expect
  , rbac = require('../')
  , common = require('./common')
  , Permission = rbac.Permission
  , Role = rbac.Role
  , User = common.User;

before(function (next) {
  common.setup('mongodb://localhost/rbac_test', next);
});

describe('roles and permissions:', function () {
  var henry;

  beforeEach(function (next) {
    common.loadFixtures(function (err) {
      if (err) return next(err);
      User
        .findOne({ username: 'henry' })
        .populate('roles')
        .exec(function (err, user) {
          if (err) return next(err);
          henry = user;
          next();
        });
    });
  });

  afterEach(function (next) {
    common.reset(next);
  });

  describe('initialization:', function () {
    it('should batch create roles and permissions', function (next) {
      rbac.init({
        role1: {
          // subject-actions syntax
          Post: ['create', 'read', 'update', 'delete']
        },
        role2: {
          // subject-action syntax
          Post: 'read'
        },
        role3: [
          // array list syntax
          ['read', 'Post'],
          ['update', 'Post']
        ],
        role4: [
          // object list syntax
          {action: 'read', subject: 'Post'},
          {action: 'create', subject: 'Post'}
        ]
      }, function (err, role1, role2, role3, role4) {
        expect(err).not.to.exist;
        expect(role1.permissions).to.have.length(4);
        expect(role2.permissions).to.have.length(1);
        expect(role3.permissions).to.have.length(2);
        expect(role4.permissions).to.have.length(2);
        next();
      });
    });
  });

  it('should require a unique role name', function (next) {
    Role.create({ name: 'admin' }, function (err, role) {
      expect(err.message).to.equal('Role name must be unique');
      next();
    });
  });

  it('should add a role to a model', function (next) {
    henry.addRole('admin', function (err) {
      expect(err).not.to.exist;
      expect(henry.roles).to.have.length(1);
      Role.findOne({ name: 'admin' }, function (err, role) {
        expect(henry.roles[0].id).to.equal(role.id);
        next();
      });
    });
  });

  it('should remove a role from a model', function (next) {
    henry.addRole('admin', function (err) {
      expect(err).not.to.exist;
      henry.removeRole('admin', function (err) {
        expect(err).not.to.exist;
        expect(henry.roles).to.be.empty;
        next();
      })
    });
  });

  it('should indicate whether a model has a given role', function (next) {
    expect(henry.roles).to.be.empty;
    henry.hasRole('admin', function (err, hasAdminRole) {
      expect(err).not.to.exist;
      expect(hasAdminRole).to.equal(false);
      henry.addRole('admin', function (err) {
        expect(err).not.to.exist;
        henry.hasRole('admin', function (err, hasAdminRole) {
          expect(err).not.to.exist;
          expect(hasAdminRole).to.equal(true);
          next();
        });
      });
    });
  });

  // EXACTLY ONE

  it('should indicate whether a model has a given permission', function (next) {
    henry.addRole('readonly', function (err) {
      expect(err).not.to.exist;
      henry.can('read', 'Post', function (err, canReadPost) {
        expect(err).not.to.exist;
        expect(canReadPost).to.equal(true);
        henry.can('create', 'Post', function (err, canCreatePost) {
          expect(err).not.to.exist;
          expect(canCreatePost).to.equal(false);
          next();
        });
      });
    });
  });

  // ALL

  it('should indicate whether a model has all of a given ' +
     'set of permissions (array list syntax)', function (next) {
    henry.addRole('readonly', function (err) {
      henry.canAll([['read', 'Post'], ['read', 'Comment']],
        function (err, canRead) {
          expect(err).not.to.exist;
          expect(canRead).to.equal(true);
          henry.canAll([['read', 'Post'], ['create', 'Post']],
            function (err, canReadAndCreate) {
              expect(err).not.to.exist;
              expect(canReadAndCreate).to.equal(false);
              next();
            });
        });
    });
  });

  it('should indicate whether a model has all of a given ' +
     'set of permissions (object list syntax)', function (next) {
    henry.addRole('readonly', function (err) {
      henry.canAll([
          {action: 'read', subject: 'Post'},
          {action: 'read', subject: 'Comment'}
        ],
        function (err, canRead) {
          expect(err).not.to.exist;
          expect(canRead).to.equal(true);
          henry.canAll([
              {action: 'read', subject: 'Post'},
              {action: 'create', subject: 'Post'}
            ],
            function (err, canReadAndCreate) {
              expect(err).not.to.exist;
              expect(canReadAndCreate).to.equal(false);
              next();
            });
        });
    });
  });

  it('should indicate whether a model has all of a given ' +
     'set of permissions (subject-actions object syntax)', function (next) {
    henry.addRole('readonly', function (err) {
      henry.canAll({Post: 'read', Comment: 'read'},
        function (err, canRead) {
          expect(err).not.to.exist;
          expect(canRead).to.equal(true);
          henry.canAll({Post: ['read', 'create']},
            function (err, canReadAndCreate) {
              expect(err).not.to.exist;
              expect(canReadAndCreate).to.equal(false);
              next();
            });
        });
    });
  });

  it('should indicate whether a model has all of a given ' +
     'set of permissions (string syntax)', function (next) {
    henry.addRole('readonly', function (err) {
      expect(err).not.to.exist;
      henry.canAll('read:Post read:Comment', function (err, canRead) {
        expect(err).not.to.exist;
        expect(canRead).to.equal(true);
        henry.canAll('read:Post create:Post', function (err, canReadAndCreate) {
          expect(err).not.to.exist;
          expect(canReadAndCreate).to.equal(false);
          next();
        });
      });
    });
  });

  // ANY

  it('should indicate whether a model has any of a given ' +
     'set of permissions (array list syntax)', function (next) {
    henry.addRole('readonly', function (err) {
      expect(err).not.to.exist;
      henry.canAny([['read', 'Post'], ['create', 'Post']],
        function (err, canReadOrCreate) {
          expect(err).not.to.exist;
          expect(canReadOrCreate).to.equal(true);
          next();
        });
      });
  });

  it('should indicate whether a model has any of a given ' +
     'set of permissions (object list syntax)', function (next) {
    henry.addRole('readonly', function (err) {
      expect(err).not.to.exist;
      henry.canAny([
          {action: 'read', subject: 'Post'},
          {action: 'create', subject: 'Post'}
        ],
        function (err, canReadOrCreate) {
          expect(err).not.to.exist;
          expect(canReadOrCreate).to.equal(true);
          next();
        });
      });
  });

  it('should indicate whether a model has any of a given ' +
     'set of permissions (subject-actions object syntax)', function (next) {
    henry.addRole('readonly', function (err) {
      expect(err).not.to.exist;
      henry.canAny({Post: ['read', 'create']},
        function (err, canReadOrCreate) {
          expect(err).not.to.exist;
          expect(canReadOrCreate).to.equal(true);
          next();
        });
      });
  });

  it('should indicate whether a model has any of a given ' +
     'set of permissions (string syntax)', function (next) {
    henry.addRole('readonly', function (err) {
      expect(err).not.to.exist;
      henry.canAny('read:Post create:Post',
        function (err, canReadOrCreate) {
          expect(err).not.to.exist;
          expect(canReadOrCreate).to.equal(true);
          next();
        });
      });
  });
});