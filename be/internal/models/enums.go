package models

// Valid reports whether s is a known review/publish status.
func (s ContentStatus) Valid() bool {
	switch s {
	case StatusDraft, StatusPendingReview, StatusApproved, StatusRejected, StatusPublished:
		return true
	}
	return false
}

// Valid reports whether r is a known role.
func (r UserRole) Valid() bool { return r == RoleStudent || r == RoleTeacher || r == RoleAdmin }

// Valid reports whether s is a known KYC status.
func (s KYCStatus) Valid() bool {
	switch s {
	case KYCNotRequired, KYCPending, KYCApproved, KYCRejected:
		return true
	}
	return false
}

// Valid reports whether m is a known test module type.
func (m ModuleType) Valid() bool {
	switch m {
	case ModuleQBank, ModuleTestSeries, ModulePractice, ModuleCustom:
		return true
	}
	return false
}
