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

module.exports = {
  login,
  getProfile
};