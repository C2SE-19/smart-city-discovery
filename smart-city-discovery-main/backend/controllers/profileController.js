export const updateProfile = async (req, res) => {
  try {
    const { fullName, email, gender, phone, birthDate, address } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        fullName,
        email,
        gender,
        phone,
        birthDate,
        address
      },
      { new: true }
    );

    res.json({
      message: "Cập nhật thành công",
      user
    });

  } catch (error) {
    res.status(500).json({
      message: "Server error"
    });
  }
};