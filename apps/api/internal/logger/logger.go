package logger

import "log"

// Info logs an informational message with severity prefix.
func Info(format string, args ...any) {
	log.Printf("INFO  "+format, args...)
}

// Warn logs a warning message with severity prefix.
func Warn(format string, args ...any) {
	log.Printf("WARN  "+format, args...)
}

// Error logs an error message with severity prefix.
func Error(format string, args ...any) {
	log.Printf("ERROR "+format, args...)
}
