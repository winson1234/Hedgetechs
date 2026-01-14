package main

import (
	"fmt"
	"regexp"
)

func main() {
	regex := `^\+[1-9]\d{1,14}$`
	tests := []string{
		"+14155552671",
		"+60123456789",
		"0123456789",
		"14155552671",
		"+",
		"+1",                // Valid short
		"+1234567890123456", // Too long (16 digits after +)
		"+INVALID",
	}

	for _, phone := range tests {
		matched, _ := regexp.MatchString(regex, phone)
		fmt.Printf("Phone: %-20s Valid: %v\n", phone, matched)
	}
}
