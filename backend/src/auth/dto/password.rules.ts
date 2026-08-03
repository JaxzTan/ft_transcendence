// password policy shared by RegisterDto and ResetPasswordDto
//  Mirrored client-side in frontend/src/validatePassword.ts.
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 72; // bcrypt ignores bytes past 72
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
export const PASSWORD_MESSAGE =
  'password must be 12+ characters with an uppercase letter, a lowercase letter, a number, and a special character';
