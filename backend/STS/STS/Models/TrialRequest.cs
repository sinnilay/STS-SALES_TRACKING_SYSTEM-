namespace STS.Models
{
    public class TrialRequest
    {
        public int Id { get; set; }
        public string CompanyName { get; set; } = string.Empty;
        public string OwnerName { get; set; } = string.Empty;
        public string OwnerEmail { get; set; } = string.Empty;
        public string OwnerContact { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public string Country { get; set; } = "India";
        public string Industry { get; set; } = string.Empty;
        public int StaffLimit { get; set; } = 10;
        public string AdminPasswordHash { get; set; } = string.Empty;

        // The plaintext password the owner chose at signup, kept only until the
        // request is approved or rejected so the approval email can hand it back
        // to them (they can't recall a password they never saw hashed). Cleared
        // (set to null) as soon as it's been used or is no longer needed.
        public string? PendingPassword { get; set; }

        public string Status { get; set; } = "Pending"; // Pending, Approved, Rejected
        public string? RejectionReason { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ProcessedAt { get; set; }
    }
}
