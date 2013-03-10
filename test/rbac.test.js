var expect = require('expect.js')
  , rbac = require('../')
  , common = require('./common')
  , Permission = rbac.Permission
  , Role = rbac.Role
  , User = common.User;

before(function (next) {
  common.setup('mongodb://localhost/rbac_test', next);
});

describe('roles and permissions', function () {
  var henry;

  beforeEach(function (next) {
    common.loadFixtures(function (err) {
      if (err) return next(err);
      User.findOne({ username: 'henry' }, function (err, user) {
        if (err) return next(err);
        henry = user;
        next();
      })
    });
  });

  afterEach(function (next) {
    common.reset(next);
  });

  describe('initialization', function () {
    it('should batch create roles and permissions', function (next) {
      rbac.init({
        admin: [
          ['create', 'Post'],
          ['read', 'Post'],
          ['update', 'Post'],
          ['delete', 'Post']
        ],
        readonly: [
          ['read', 'Post']
        ],
        content: [
          ['read', 'Post'],
          ['update', 'Post']
        ]
      }, function (err, admin, readonly, content) {
        expect(err).to.not.exist;
        expect(admin.permissions).to.have.length(4);
        expect(readonly.permissions).to.have.length(1);
        expect(content.permissions).to.have.length(2);
        next();
      });
    });
  });

  it('should add a role to a model', function (next) {
    henry.addRole('admin', function (err) {
      expect(err).not.to.exist;
      expect(henry.roles).to.have.length(1);
      Role.findOne({ name: 'admin' }, function (err, role) {
        expect(henry.roles[0].toString()).to.equal(role.id);
        next();
      });
    });
  });

  it('should remove a role from a model', function (next) {
    henry.addRole('admin', function (err) {
      henry.removeRole('admin', function (err) {
        expect(err).to.not.exist;
        expect(henry.roles).to.be.empty;
        next();
      })
    });
  });

  it('should indicate whether a model has a given role', function (next) {
    expect(henry.roles).to.be.empty;
    henry.hasRole('admin', function (err, hasAdminRole) {
      expect(err).to.not.exist;
      expect(hasAdminRole).to.be(false);
      henry.addRole('admin', function (err) {
        henry.hasRole('admin', function (err, hasAdminRole) {
          expect(err).to.not.exist;
          expect(hasAdminRole).to.be(true);
          next();
        });
      });
    });
  });

  it('should indicate whether a model has a given permission', function (next) {
    henry.addRole('readonly', function (err) {
      henry.can('read', 'Post', function (err, canReadPost) {
        expect(err).to.not.exist;
        expect(canReadPost).to.be(true);
        henry.can('create', 'Post', function (err, canCreatePost) {
          expect(err).to.not.exist;
          expect(canCreatePost).to.be(false);
          next();
        });
      });
    });
  });

  it('should indicate whether a model has all of a given set of permissions', function (next) {
    henry.addRole('readonly', function (err) {
      henry.canAll([['read', 'Post'], ['read', 'Comment']], function (err, canRead) {
        expect(err).to.not.exist;
        expect(canRead).to.be(true);
        henry.canAll([['read', 'Post'], ['create', 'Post']], function (err, canReadAndCreate) {
          expect(err).to.not.exist;
          expect(canReadAndCreate).to.be(false);
          next();
        });
      });
    });
  });

  it('should indicate whether a model has any of a given set of permissions', function (next) {
    henry.addRole('readonly', function (err) {
      henry.canAny([['read', 'Post'], ['create', 'Post']], function (err, canReadOrCreate) {
        expect(err).to.not.exist;
        expect(canReadOrCreate).to.be.true;
        next();
      });
    });
  });
});