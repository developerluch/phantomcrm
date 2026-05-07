package db

import "strings"

// SanitizeLike escapes special characters in LIKE pattern inputs
// to prevent SQL injection via wildcard characters.
func SanitizeLike(input string) string {
	input = strings.ReplaceAll(input, "\\", "\\\\")
	input = strings.ReplaceAll(input, "%", "\\%")
	input = strings.ReplaceAll(input, "_", "\\_")
	return input
}
