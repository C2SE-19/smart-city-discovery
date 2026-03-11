const createModuleStub = require('../../shared/module-stub');

const register = createModuleStub('Auth register', 'Auth backend member');
const login = createModuleStub('Auth login', 'Auth backend member');
const getProfile = createModuleStub('Auth profile', 'Auth backend member');

module.exports = {
  register,
  login,
  getProfile
};