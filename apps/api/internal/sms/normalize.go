package sms

import "strings"

// NormalizePhone strips non-digit characters and ensures a +1 prefix for US numbers.
func NormalizePhone(phone string) string {
	var digits strings.Builder
	for _, c := range phone {
		if c >= '0' && c <= '9' {
			digits.WriteRune(c)
		}
	}
	d := digits.String()
	if d == "" {
		return ""
	}
	if len(d) == 10 {
		return "+1" + d
	}
	if len(d) == 11 && d[0] == '1' {
		return "+" + d
	}
	if !strings.HasPrefix(phone, "+") {
		return "+" + d
	}
	return phone
}
