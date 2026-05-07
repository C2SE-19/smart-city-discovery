const crypto = require('crypto');
const { supabaseAdmin } = require('../lib/supabase');
const { pool } = require('../config/database');

const USE_PG = Boolean(process.env.DB_HOST || process.env.DB_NAME);

// Generate a secure reset token
const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Store reset token in database
const storeResetToken = async (userId, email, token, expiresIn = 3600) => {
  try {
    const expiresAtUtc = new Date(Date.now() + expiresIn * 1000).toISOString();
    const expiresAtLocal = new Date(Date.now() + expiresIn * 1000);

    if (USE_PG) {
      const result = await pool.query(
        `
          INSERT INTO password_reset_tokens (user_id, email, token, expires_at, used)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `,
        [userId, email, token, expiresAtLocal, false]
      );

      return result.rows[0] || null;
    }

    const { data, error } = await supabaseAdmin
      .from('password_reset_tokens')
      .insert([
        {
          user_id: userId,
          email: email,
          token: token,
          expires_at: expiresAtUtc,
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
    if (USE_PG) {
      const result = await pool.query(
        `
          SELECT * FROM password_reset_tokens
          WHERE token = $1 AND used = false
          LIMIT 1
        `,
        [token]
      );

      const data = result.rows[0];

      if (!data) {
        return { valid: false, message: 'Invalid or expired token' };
      }

      const now = new Date();
      const expiresAt = new Date(data.expires_at);

      if (expiresAt < now) {
        return { valid: false, message: 'Token has expired' };
      }

      return { valid: true, data };
    }

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
    if (USE_PG) {
      const result = await pool.query(
        `
          UPDATE password_reset_tokens
          SET used = true
          WHERE token = $1
          RETURNING *
        `,
        [token]
      );

      return result.rows[0] || null;
    }

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
    const nowUtc = new Date().toISOString();
    const nowLocal = new Date();

    if (USE_PG) {
      await pool.query('DELETE FROM password_reset_tokens WHERE expires_at < $1', [nowLocal]);
      console.log('Expired tokens cleaned up');
      return;
    }

    const { error } = await supabaseAdmin
      .from('password_reset_tokens')
      .delete()
  .lt('expires_at', nowUtc);

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
