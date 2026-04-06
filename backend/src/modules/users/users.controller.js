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
        avatarUrl: user.avatar_url || user.avatarUrl || '',
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
        avatarUrl: updatedUser.avatar_url || updatedUser.avatarUrl || '',
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

const getAllUsers = async (req, res) => {
  try {
    const users = await usersService.getAllUsers();

    res.json({
      success: true,
      users: users.map((user) => ({
        id: user.id,
        fullname: user.fullname,
        username: user.username,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
        updated_at: user.updated_at
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const updateUserById = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { fullname, email, role } = req.body;

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    if (!fullname || !email || !role) {
      return res.status(400).json({ success: false, message: 'fullname, email, and role are required' });
    }

    const updatedUser = await usersService.updateUser(userId, { fullname, email, role });

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: updatedUser.id,
        fullname: updatedUser.fullname,
        username: updatedUser.username,
        email: updatedUser.email,
        role: updatedUser.role,
        updated_at: updatedUser.updated_at
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    const deleted = await usersService.deleteUser(userId);

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getAllUsers,
  updateUserById,
  deleteUser
};
