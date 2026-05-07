const { supabaseAdmin } = require('../../lib/supabase');
const { pool } = require('../../config/database');

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const USE_PG = Boolean(process.env.DB_HOST || process.env.DB_NAME);

function isMissingColumnError(error, columnName) {
  const haystack = [
    error?.message,
    error?.details,
    error?.hint,
    error?.code
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(String(columnName || '').toLowerCase()) && (
    haystack.includes('column') ||
    haystack.includes('schema cache') ||
    haystack.includes('does not exist') ||
    haystack.includes('pgrst')
  );
}

async function getUserByIdPg(userId) {
  const result = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [userId]);
  return result.rows[0] || null;
}

async function getUserByUsernamePg(username) {
  const result = await pool.query('SELECT * FROM users WHERE username = $1 LIMIT 1', [username]);
  return result.rows[0] || null;
}

async function getUserByEmailPg(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const result = await pool.query(
    'SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
    [normalizedEmail]
  );
  return result.rows[0] || null;
}

async function updateUserPg(userId, updateData) {
  const fieldMap = {
    fullname: 'fullname',
    email: 'email',
    phone: 'phone',
    birthDate: 'birth_date',
    address: 'address',
    gender: 'gender',
    bio: 'bio',
    role: 'role',
    status: 'status',
    pauseUntil: 'pause_until',
    blockedReason: 'blocked_reason',
    password: 'password_hash'
  };

  const sets = [];
  const values = [];
  let index = 1;

  Object.entries(fieldMap).forEach(([key, column]) => {
    if (typeof updateData[key] !== 'undefined') {
      sets.push(`${column} = $${index}`);
      values.push(updateData[key]);
      index += 1;
    }
  });

  sets.push(`updated_at = NOW()`);

  const query = `UPDATE users SET ${sets.join(', ')} WHERE id = $${index} RETURNING *`;
  values.push(userId);

  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

async function updateUserPasswordPg(userId, passwordValue) {
  const columnsToTry = ['password_hash', 'password'];
  let lastError = null;

  for (const column of columnsToTry) {
    try {
      const result = await pool.query(
        `UPDATE users SET ${column} = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [passwordValue, userId]
      );

      return result.rows[0] || null;
    } catch (error) {
      if (!isMissingColumnError(error, column)) {
        throw error;
      }

      lastError = error;
    }
  }

  throw lastError || new Error('No supported password column found on users table');
}

async function createUserPg(userData) {
  const result = await pool.query(
    `
      INSERT INTO users (username, email, fullname, password_hash, role, status, pause_until, blocked_reason)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      userData.username,
      userData.email,
      userData.fullname,
      userData.password_hash,
      userData.role || 'user',
      userData.status || 'active',
      userData.pauseUntil || null,
      userData.blockedReason || null
    ]
  );

  return result.rows[0] || null;
}

async function getAllUsersPg() {
  const result = await pool.query('SELECT * FROM users ORDER BY updated_at DESC');
  return result.rows || [];
}

async function deleteUserPg(userId) {
  const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [userId]);
  return result.rows[0] || null;
}

const getUserById = async (userId) => {
  try {
    if (USE_PG) {
      return await getUserByIdPg(userId);
    }

    const { data, error } = await supabaseAdmin
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
    if (USE_PG) {
      return await getUserByUsernamePg(username);
    }

    const { data, error } = await supabaseAdmin
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
    if (USE_PG) {
      return await getUserByEmailPg(email);
    }

    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return null;
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .ilike('email', normalizedEmail)
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
    if (USE_PG) {
      return await updateUserPg(userId, updateData);
    }

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
    if (typeof updateData.password !== 'undefined') payload.password_hash = updateData.password;

    const { data, error } = await supabaseAdmin
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

const updateUserPassword = async (userId, passwordValue) => {
  try {
    if (USE_PG) {
      return await updateUserPasswordPg(userId, passwordValue);
    }

    const columnsToTry = ['password_hash', 'password'];
    let lastError = null;

    for (const column of columnsToTry) {
      const payload = {
        updated_at: new Date().toISOString(),
        [column]: passwordValue
      };

      const { data, error } = await supabaseAdmin
        .from('users')
        .update(payload)
        .eq('id', userId)
        .select()
        .single();

      if (!error) {
        return data;
      }

      if (!isMissingColumnError(error, column)) {
        throw error;
      }

      lastError = error;
    }

    throw lastError || new Error('No supported password column found on users table');
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to update user password');
  }
};

const createUser = async (userData) => {
  try {
    if (USE_PG) {
      return await createUserPg(userData);
    }

    const { data, error } = await supabaseAdmin
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
    if (USE_PG) {
      return await getAllUsersPg();
    }

    const { data, error } = await supabaseAdmin
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
    if (USE_PG) {
      return await deleteUserPg(userId);
    }

    const { data, error } = await supabaseAdmin
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
  updateUserPassword,
  createUser,
  getAllUsers,
  deleteUser
};
