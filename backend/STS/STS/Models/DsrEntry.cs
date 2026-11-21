namespace STS.Models
{
    // Daily Sales Report entry - an immutable audit log line written every time
    // an STS record's status changes. Viewed by the company admin.
    public class DsrEntry
    {
        public int Id { get; set; }

        public int TenantCompanyId { get; set; }
        public Company? TenantCompany { get; set; }

        public int SalesDataId { get; set; }
        public SalesData? SalesData { get; set; }

        public int EmployeeId { get; set; }
        public User? Employee { get; set; }

        public string CompanyID { get; set; } = string.Empty;
        public string CompanyName { get; set; } = string.Empty;
        public string PreviousStatus { get; set; } = string.Empty;
        public string NewStatus { get; set; } = string.Empty;
        public string? Comment { get; set; }

        // STS call-log fields captured on every status update, mirroring the STS report form.
        public string Priority { get; set; } = string.Empty;
        public DateTime? CallMeetingDate { get; set; }
        public DateTime? NextCallMeetingDate { get; set; }
        public string? CcTo { get; set; }
        public string? Subject { get; set; }

        // Captured only when NewStatus is one of StsPipeline.ConvertedStatuses.
        public string? ConvertedFor { get; set; }
        public decimal? ConvertedPrice { get; set; }

        // Captured only when NewStatus == "OTHER" — the free-text status the
        // updater typed in place of picking one of the fixed codes.
        public string? OtherStatusText { get; set; }

        // True when a company admin logged this update using their own admin
        // identity rather than on behalf of one of the selected employees.
        public bool UpdatedAsAdmin { get; set; }

        public DateTime ReportDate { get; set; } = DateTime.UtcNow.Date;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
