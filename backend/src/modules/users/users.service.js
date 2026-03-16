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
    const { data, error } = await supabaseClient
      .from('users')
      .update({
        fullname: updateData.fullname,
        email: updateData.email,
        phone: updateData.phone,
        birthDate: updateData.birthDate,
        address: updateData.address,
        gender: updateData.gender,
        bio: updateData.bio,
        updated_at: new Date().toISOString()
      })
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
        role: userData.role || 'user'
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
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Database error:', error);
    return [];
  }
};

module.exports = {
  getUserById,
  getUserByUsername,
  getUserByEmail,
  updateUser,
  createUser,
  getAllUsers
};
