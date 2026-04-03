// Password validation: 8+ characters with at least 1 uppercase letter and 1 special character
export const validatePassword = (password, language = 'en') => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};:'",.<>?\/\\|`~]/.test(password);
  
  const errors = [];
  
  // Vietnamese messages
  const viMessages = {
    minLength: `Mật khẩu phải có ít nhất ${minLength} ký tự`,
    hasUpperCase: 'Mật khẩu phải chứa ít nhất 1 chữ cái viết hoa (A-Z)',
    hasSpecialChar: 'Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt (!@#$%^&*...)'
  };
  
  // English messages
  const enMessages = {
    minLength: `Password must have at least ${minLength} characters`,
    hasUpperCase: 'Password must contain at least 1 uppercase letter (A-Z)',
    hasSpecialChar: 'Password must contain at least 1 special character (!@#$%^&*...)'
  };
  
  const messages = language === 'vi' ? viMessages : enMessages;
  
  if (password.length < minLength) {
    errors.push(messages.minLength);
  }
  
  if (!hasUpperCase) {
    errors.push(messages.hasUpperCase);
  }
  
  if (!hasSpecialChar) {
    errors.push(messages.hasSpecialChar);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Email validation
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Username validation
export const validateUsername = (username) => {
  return username.length >= 3;
};
