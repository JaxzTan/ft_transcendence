// Client-side mirror of the backend password policy (backend
// dto/password.rules.ts). Instant feedback only — the server always re-checks.
// Returns an error message, or null when the password is acceptable.
export function passwordError(pw: string): string | null {
  if (pw.length < 12) return 'Password must be at least 12 characters'
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(pw))
    return 'Password needs an uppercase letter, a lowercase letter, a number, and a special character'
  return null
}
