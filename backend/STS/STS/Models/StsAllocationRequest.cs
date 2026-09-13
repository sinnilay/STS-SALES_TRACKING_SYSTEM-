namespace STS.Models
{
    // Raised when an employee finds an existing STS (via the "Check Duplicate" flow on Add
    // STS) and asks to be allotted it instead of creating a new one. Admin reviews it on the
    // "Employee STS Request" screen and approves (allocates) or rejects it.
    public class StsAllocationRequest
    {
        public int Id { get; set; }
        public int TenantCompanyId { get; set; }

        public int SalesDataId { get; set; }
        public SalesData? SalesData { get; set; }

        public int RequestedById { get; set; }
        public User? RequestedBy { get; set; }

        public string Status { get; set; } = "Pending"; // Pending, Approved, Rejected
        public string? Comment { get; set; }
        public string? ReviewComment { get; set; }

        public int? ReviewedById { get; set; }
        public User? ReviewedBy { get; set; }
        public DateTime? ReviewedAt { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
