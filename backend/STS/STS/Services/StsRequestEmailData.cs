namespace STS.Services
{
    // Everything the STS allocation-request emails (submitted / approved / rejected) need,
    // flattened so EmailService never touches the DbContext.
    public class StsRequestEmailData
    {
        public List<string> ToEmails { get; set; } = new();

        public string TenantCompanyName { get; set; } = "STS";
        public string? TenantCompanyLogoUrl { get; set; }
        public string PortalUrl { get; set; } = "https://weberp.ideaspromotion.com/";

        // Requesting employee
        public int EmployeeId { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public string EmployeeEmail { get; set; } = string.Empty;
        public string? EmployeeMobile { get; set; }
        public string? EmployeeDesignation { get; set; }
        public string? EmployeeDepartment { get; set; }
        public string? EmployeeRole { get; set; }
        public string? EmployeeCityBranch { get; set; }

        // STS record
        public string CompanyID { get; set; } = string.Empty;
        public string CompanyName { get; set; } = string.Empty;
        public string? ContactPerson { get; set; }
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public string? CityDistrict { get; set; }
        public string? State { get; set; }
        public string? Country { get; set; }
        public string? Source { get; set; }
        public string? Priority { get; set; }
        public string? Status { get; set; }
        public DateTime? RecordCreatedAt { get; set; }
        public string? CurrentlyAllocatedTo { get; set; }

        // Request / review
        public string? RequestComment { get; set; }
        public DateTime RequestedAt { get; set; }
        public string? ReviewedByName { get; set; }
        public string? ReviewComment { get; set; }
        public DateTime? ReviewedAt { get; set; }
    }
}
