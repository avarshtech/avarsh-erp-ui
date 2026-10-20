// Mirrors iam/security/PasswordPolicy on the API: checked when a password is set, never at login.
// The API also caps a password at 72 bytes (BCrypt); 72 characters is the same for ASCII.
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 72;

export const NEW_PASSWORD_RULES = [
  { min: PASSWORD_MIN_LENGTH, message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` },
  { max: PASSWORD_MAX_LENGTH, message: `Password must be at most ${PASSWORD_MAX_LENGTH} characters` },
];
