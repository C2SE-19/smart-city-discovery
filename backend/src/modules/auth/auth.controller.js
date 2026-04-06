const usersService = require('../users/users.service');

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validation
    if (!username || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Username and password are required' 
      });
    }

    // Find user by username
    const user = await usersService.getUserByUsername(username);
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid username or password' 
      });
    }

    // Verify password (in production use bcrypt)
    // TODO: implement proper password verification with bcrypt
    if (user.password_hash !== password) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid username or password' 
      });
    }

    // Check account status
    const status = (user.status || 'active').toLowerCase();

    if (status === 'blocked') {
      const reason = user.blocked_reason || 'Vi phạm điều khoản sử dụng.';
      return res.status(403).json({
        success: false,
        message: `Tài khoản đã bị khóa vĩnh viễn: ${reason}`
      });
    }

    if (status === 'paused') {
      const pauseUntil = user.pause_until ? new Date(user.pause_until) : null;
      const now = new Date();

      if (pauseUntil && pauseUntil > now) {
        return res.status(403).json({
          success: false,
          message: `Tài khoản đang bị tạm dừng đến ${pauseUntil.toLocaleString()}. Vui lòng liên hệ quản trị để mở sớm hơn.`
        });
      }

      // Auto-activate if pause window has expired.
      if (!pauseUntil || pauseUntil <= now) {
        await usersService.updateUser(user.id, {
          status: 'active',
          pauseUntil: null,
          blockedReason: null
        });
      }
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullname: user.fullname,
        email: user.email,
        role: user.role
      },
      token: `token-${user.id}-${Date.now()}`
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const user = await usersService.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullname: user.fullname,
        email: user.email,
        phone: user.phone || '',
        birthDate: user.birthDate || '',
        address: user.address || '',
        gender: user.gender || 'Nam',
        bio: user.bio || '',
        avatarUrl: user.avatar_url || user.avatarUrl || '',
        role: user.role
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

const register = async (req, res) => {
  try {
    const { fullname, username, email, password } = req.body;
    const errors = [];

    // Validate input
    if (!fullname || !username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
        details: ['Fullname, username, email, and password are required']
      });
    }

    // Check username exists
    const existingUsername = await usersService.getUserByUsername(username);
    if (existingUsername) {
      errors.push('Username already exists');
    }

    // Check email exists
    const existingEmail = await usersService.getUserByEmail(email);
    if (existingEmail) {
      errors.push('Email already exists');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: errors
      });
    }

    // Create new user
    const newUser = await usersService.createUser({
      fullname,
      username,
      email,
      password_hash: password // In production, use bcrypt
    });

    res.json({
      success: true,
      message: 'Register success',
      user: {
        id: newUser.id,
        username: newUser.username,
        fullname: newUser.fullname,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const checkUsername = async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username is required'
      });
    }

    const existingUser = await usersService.getUserByUsername(username);
    
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Username already exists',
        exists: true
      });
    }

    res.json({
      success: true,
      message: 'Username is available',
      exists: false
    });
  } catch (error) {
    console.error('Check username error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const checkEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const existingEmail = await usersService.getUserByEmail(email);
    
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists',
        exists: true
      });
    }

    res.json({
      success: true,
      message: 'Email is available',
      exists: false
    });
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  login,
  getProfile,
  register,
  checkUsername,
  checkEmail
};
