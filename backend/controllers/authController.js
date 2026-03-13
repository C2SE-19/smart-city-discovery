import bcrypt from "bcrypt";
import supabase from "../config/supabaseClient.js";



// ================= REGISTER =================

export const register = async (req, res) => {

  const { fullname, username, email, password } = req.body;

  try {

    // kiểm tra username tồn tại
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .single();

    if (existingUser) {
      return res.status(400).json({
        message: "Username already exists"
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
      return res.status(400).json({
        message: error.message
      });
    }

    res.json({
      message: "Register success",
      user: data
    });

  } catch (err) {

    res.status(500).json({
      message: err.message
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