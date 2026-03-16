import bcrypt from "bcrypt";
import supabase from "../config/supabaseClient.js";



// ================= REGISTER =================

export const register = async (req, res) => {

  const { fullname, username, email, password } = req.body;

  try {
    const errors = [];

    // Kiểm tra dữ liệu đầu vào
    if (!fullname || !username || !email || !password) {
      return res.status(400).json({
        message: "Please fill in all fields",
        details: ["All fields are required"]
      });
    }

    // Kiểm tra username tồn tại
    const { data: existingUsername } = await supabase
      .from("users")
      .select("username")
      .eq("username", username)
      .single();

    if (existingUsername) {
      errors.push("Username already exists");
    }

    // Kiểm tra email tồn tại
    const { data: existingEmail } = await supabase
      .from("users")
      .select("email")
      .eq("email", email)
      .single();

    if (existingEmail) {
      errors.push("Email already exists");
    }

    // Nếu có lỗi validation, trả về ngay
    if (errors.length > 0) {
      return res.status(400).json({
        message: "Validation error",
        details: errors
      });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // insert user
    const { data, error } = await supabase
      .from("users")
      .insert([
        {
          fullname,
          username,
          email,
          password: hashedPassword
        }
      ])
      .select();

    if (error) {
      // Kiểm tra lỗi constraints từ database
      if (error.code === '23505') { // Duplicate key error
        let errorDetail = "Duplicate data";
        if (error.message.includes('username')) {
          errorDetail = "Username already exists";
        } else if (error.message.includes('email')) {
          errorDetail = "Email already exists";
        }
        return res.status(400).json({
          message: "Registration failed",
          details: [errorDetail]
        });
      }
      
      return res.status(400).json({
        message: error.message,
        details: [error.message]
      });
    }

    res.json({
      message: "Register success",
      user: data
    });

  } catch (err) {

    res.status(500).json({
      message: err.message,
      details: [err.message]
    });

  }

};



// ================= LOGIN =================

export const login = async (req, res) => {

  const { username, password } = req.body;

  try {

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .single();

    if (error || !data) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const match = await bcrypt.compare(
      password,
      data.password
    );

    if (!match) {
      return res.status(400).json({
        message: "Wrong password"
      });
    }

    res.json({
      message: "Login success",
      user: {
        id: data.id,
        fullname: data.fullname,
        username: data.username,
        email: data.email
      }
    });

  } catch (err) {

    res.status(500).json({
      message: err.message
    });

  }

};



// ================= CHECK USERNAME =================

export const checkUsername = async (req, res) => {
  const { username } = req.body;

  try {
    if (!username) {
      return res.status(400).json({
        message: "Username is required"
      });
    }

    const { data } = await supabase
      .from("users")
      .select("username")
      .eq("username", username)
      .single();

    if (data) {
      return res.status(409).json({
        message: "Username already exists",
        exists: true
      });
    }

    res.json({
      message: "Username is available",
      exists: false
    });

  } catch (err) {
    // Nếu không tìm thấy user (lỗi PGRST116), username có sẵn
    if (err.code === 'PGRST116' || err.message?.includes('No rows')) {
      return res.json({
        message: "Username is available",
        exists: false
      });
    }

    res.status(500).json({
      message: err.message
    });
  }
};



// ================= CHECK EMAIL =================

export const checkEmail = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({
        message: "Email is required"
      });
    }

    const { data } = await supabase
      .from("users")
      .select("email")
      .eq("email", email)
      .single();

    if (data) {
      return res.status(409).json({
        message: "Email already exists",
        exists: true
      });
    }

    res.json({
      message: "Email is available",
      exists: false
    });

  } catch (err) {
    // Nếu không tìm thấy user (lỗi PGRST116), email có sẵn
    if (err.code === 'PGRST116' || err.message?.includes('No rows')) {
      return res.json({
        message: "Email is available",
        exists: false
      });
    }

    res.status(500).json({
      message: err.message
    });
  }
};