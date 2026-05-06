const crypto = require('crypto');
const { supabaseAdmin } = require('../lib/supabase');

// Generate a secure reset token
const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Store reset token in database
const storeResetToken = async (userId, email, token, expiresIn = 3600) => {
  try {
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from('password_reset_tokens')
      .insert([
        {
          user_id: userId,
          email: email,
          token: token,
          expires_at: expiresAt,
          used: false,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error storing reset token:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to store reset token');
  }
};

// Verify reset token
const verifyResetToken = async (token) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .single();

    if (error || !data) {
      return { valid: false, message: 'Invalid or expired token' };
    }

    const now = new Date();
    const expiresAt = new Date(data.expires_at);

    if (expiresAt < now) {
      return { valid: false, message: 'Token has expired' };
    }

    return { valid: true, data };
  } catch (error) {
    console.error('Error verifying token:', error);
    return { valid: false, message: 'Error verifying token' };
  }
};

// Mark token as used
const markTokenAsUsed = async (token) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('token', token)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error marking token as used:', error);
    throw new Error('Failed to mark token as used');
  }
};

// Clean up expired tokens (can be run as a scheduled job)
const cleanupExpiredTokens = async () => {
  try {
    const now = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from('password_reset_tokens')
      .delete()
      .lt('expires_at', now);

    if (error) {
      throw error;
    }

    console.log('Expired tokens cleaned up');
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error);
  }
};

module.exports = {
  generateResetToken,
  storeResetToken,
  verifyResetToken,
  markTokenAsUsed,
  cleanupExpiredTokens,
};
