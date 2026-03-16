const usersService = require('./users.service');

const getProfile = async (req, res) => {
  try {
    const userId = req.user?.id || 1; // Get from token or use default
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
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const { fullname, email, phone, birthDate, address, gender, bio } = req.body;

    // Validation
    if (!fullname || !email) {
      return res.status(400).json({ 
        success: false,
        message: 'Name and email are required' 
      });
    }

    const updatedUser = await usersService.updateUser(userId, {
      fullname,
      email,
      phone,
      birthDate,
      address,
      gender,
      bio
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        fullname: updatedUser.fullname,
        email: updatedUser.email,
        phone: updatedUser.phone || '',
        birthDate: updatedUser.birthDate || '',
        address: updatedUser.address || '',
        gender: updatedUser.gender || 'Nam',
        bio: updatedUser.bio || '',
        role: updatedUser.role
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

module.exports = {
  getProfile,
  updateProfile
};
