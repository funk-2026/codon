package handlers

// IndianStates is the fixed list a student picks their state from. The app shows the same list.
var IndianStates = []string{
	"Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
	"Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
	"Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
	"Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
	"Ladakh", "Lakshadweep", "Puducherry",
}

func validState(s string) bool {
	for _, x := range IndianStates {
		if x == s {
			return true
		}
	}
	return false
}
