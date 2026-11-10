export const MAX_NAME_LENGTH = 100;
export const PHONE_PREFIXES = ['03', '05', '08', '09'];
export const VIETNAM_PHONE_REGEX = /^(03|05|08|09)\d{8}$/;
export const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const normalizePhoneInput = (value) => value.replace(/\D/g, '').slice(0, 10);

export const normalizeNameInput = (value) => value.slice(0, MAX_NAME_LENGTH);

export const isValidVietnamPhone = (value) => VIETNAM_PHONE_REGEX.test(value.trim());
export const isStrongPassword = (value) => STRONG_PASSWORD_REGEX.test(value);

export const PHONE_VALIDATION_MESSAGE = 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 03, 05, 08 hoặc 09.';
export const NAME_VALIDATION_MESSAGE = `Tên không được vượt quá ${MAX_NAME_LENGTH} ký tự.`;
export const PASSWORD_VALIDATION_MESSAGE = 'Mật khẩu phải có tối thiểu 8 ký tự, gồm ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số và 1 ký tự đặc biệt.';

export const getPasswordValidationState = (password = '') => {
  const str = String(password || '');
  const hasLength = str.length >= 8;
  const hasUpper = /[A-Z]/.test(str);
  const hasLower = /[a-z]/.test(str);
  const hasDigit = /\d/.test(str);
  const hasSpecial = /[^A-Za-z0-9]/.test(str);
  return {
    hasLength,
    hasUpper,
    hasLower,
    hasDigit,
    hasSpecial,
    isValid: hasLength && hasUpper && hasLower && hasDigit && hasSpecial
  };
};

export const validateBirthYear18Plus = (birthYear) => {
  const currentYear = new Date().getFullYear();
  const minYear = currentYear - 100;
  const maxValidYear = currentYear - 18;

  if (birthYear === undefined || birthYear === null || String(birthYear).trim() === '') {
    return { isValid: false, message: 'Năm sinh là bắt buộc.' };
  }
  const yearNum = Number(birthYear);
  if (!Number.isInteger(yearNum) || yearNum < minYear || yearNum > currentYear) {
    return { isValid: false, message: `Năm sinh không hợp lệ (hợp lệ từ năm ${minYear} đến ${currentYear}).` };
  }
  if (yearNum > maxValidYear) {
    const age = currentYear - yearNum;
    return {
      isValid: false,
      age,
      message: `Nhân sự phải đủ ít nhất 18 tuổi (sinh năm ${maxValidYear} trở về trước, hiện tại ${age} tuổi).`
    };
  }
  return { isValid: true, age: currentYear - yearNum, message: '' };
};

export const normalizeAuthErrorMessage = (errorOrMessage) => {
  const msg = typeof errorOrMessage === 'string'
    ? errorOrMessage
    : (errorOrMessage?.message || errorOrMessage?.error || '');
  const lower = String(msg || '').toLowerCase();

  if (
    lower.includes('email is already verified') ||
    lower.includes('email is already registered') ||
    lower.includes('đã được xác thực') ||
    lower.includes('đã được kích hoạt')
  ) {
    return 'Email này đã tồn tại và đã được kích hoạt trong hệ thống. Vui lòng sử dụng email khác.';
  }
  if (
    lower.includes('email đã được sử dụng') ||
    lower.includes('email already exists') ||
    lower.includes('email is already used') ||
    lower.includes('email đã tồn tại')
  ) {
    return 'Email này đã tồn tại trong hệ thống. Vui lòng sử dụng email khác.';
  }
  if (lower.includes('user not found') || lower.includes('không tìm thấy')) {
    return 'Không tìm thấy tài khoản với email này.';
  }
  return msg || 'Đã có lỗi xảy ra. Vui lòng thử lại.';
};
