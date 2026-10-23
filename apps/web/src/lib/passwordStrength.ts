export type PasswordStrength = 'very-weak' | 'weak' | 'fair' | 'strong' | 'very-strong'

/**
 * A minimal, fully local heuristic — NOT a comprehensive breach-corpus or
 * entropy analysis (e.g. zxcvbn). It only estimates length and character
 * variety so the create-vault screen can give basic feedback without a
 * network call or a large dependency. The password is never transmitted
 * or logged anywhere by this function or its caller.
 */
export function estimatePasswordStrength(password: string): PasswordStrength {
  if (password.length === 0) return 'very-weak'
  if (password.length < 8) return 'very-weak'

  let variety = 0
  if (/[a-z]/.test(password)) variety += 1
  if (/[A-Z]/.test(password)) variety += 1
  if (/[0-9]/.test(password)) variety += 1
  if (/[^a-zA-Z0-9]/.test(password)) variety += 1

  const lengthScore = password.length >= 20 ? 3 : password.length >= 14 ? 2 : password.length >= 10 ? 1 : 0
  const score = lengthScore + (variety >= 3 ? 1 : 0)

  if (score <= 1) return 'weak'
  if (score === 2) return 'fair'
  if (score === 3) return 'strong'
  return 'very-strong'
}
