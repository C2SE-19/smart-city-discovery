const { supabaseClient } = require('../../lib/supabase');

const getUserById = async (userId) => {
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Database error:', error);
    return null;
  }
};

const getUserByUsername = async (username) => {
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      console.error('Error fetching user:', error);
    }

    return data || null;
  } catch (error) {
    console.error('Database error:', error);
    return null;
  }
};

const getUserByEmail = async (email) => {
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user:', error);
    }

    return data || null;
  } catch (error) {
    console.error('Database error:', error);
    return null;
  }
};

const updateUser = async (userId, updateData) => {
  try {
    const payload = {
      updated_at: new Date().toISOString(),
    };

    if (typeof updateData.fullname !== 'undefined') payload.fullname = updateData.fullname;
    if (typeof updateData.email !== 'undefined') payload.email = updateData.email;
    if (typeof updateData.phone !== 'undefined') payload.phone = updateData.phone;
    if (typeof updateData.birthDate !== 'undefined') payload.birthDate = updateData.birthDate;
    if (typeof updateData.address !== 'undefined') payload.address = updateData.address;
    if (typeof updateData.gender !== 'undefined') payload.gender = updateData.gender;
    if (typeof updateData.bio !== 'undefined') payload.bio = updateData.bio;
    if (typeof updateData.role !== 'undefined') payload.role = updateData.role;
    if (typeof updateData.status !== 'undefined') payload.status = updateData.status;
    if (typeof updateData.pauseUntil !== 'undefined') payload.pause_until = updateData.pauseUntil;
    if (typeof updateData.blockedReason !== 'undefined') payload.blocked_reason = updateData.blockedReason;

    const { data, error } = await supabaseClient
      .from('users')
      .update(payload)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to update user');
  }
};

const createUser = async (userData) => {
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .insert([{
        username: userData.username,
        email: userData.email,
        fullname: userData.fullname,
        password_hash: userData.password_hash,
        role: userData.role || 'user',
        status: userData.status || 'active',
        pause_until: userData.pauseUntil || null,
        blocked_reason: userData.blockedReason || null
      }])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to create user');
  }
};

const getAllUsers = async () => {
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Database error:', error);
    return [];
  }
};

const deleteUser = async (userId) => {
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .delete()
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to delete user');
  }
};

module.exports = {
  getUserById,
  getUserByUsername,
  getUserByEmail,
  updateUser,
  createUser,
  getAllUsers,
  deleteUser
};
