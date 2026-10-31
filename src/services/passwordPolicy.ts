export function validateNewPassword(password: string) {
  if (password.length < 12 || password.length > 1024) throw new Error('Use a unique password between 12 and 1024 characters.')
}
