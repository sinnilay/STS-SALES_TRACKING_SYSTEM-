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

        public DateTime ReportDate { get; set; } = DateTime.UtcNow.Date;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
