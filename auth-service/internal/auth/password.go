package auth

import "golang.org/x/crypto/bcrypt"

// HashPassword returns a bcrypt hash of the password (salt + cost embedded).
// Cost of 10 is a good default; you can tune it based on performance and security requirements.
func HashPassword(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// CheckPassword returns nil if plain matches the stored hash, otherwise an error.
// bcrypt caps input at 72 bytes; worth remembering if you ever deal with long passwords.
func CheckPassword(plain, hash string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain))
}
