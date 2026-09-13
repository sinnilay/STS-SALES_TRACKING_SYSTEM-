namespace STS.Models
{
    public class SalesData
    {
        public int Id { get; set; }
        
        // Multi-tenant tracking
        public int? TenantCompanyId { get; set; }
        public Company? TenantCompany { get; set; }

        // New Company Lead Fields
        public string CompanyID { get; set; } = string.Empty;
        public string CompanyName { get; set; } = string.Empty;
        public string ContactPerson { get; set; } = string.Empty;
        public string Designation { get; set; } = string.Empty;
        public string CompanyAddress { get; set; } = string.Empty;
        public string Address1 { get; set; } = string.Empty;
        public string Address2 { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public string Mobile1 { get; set; } = string.Empty;
        public string Mobile2 { get; set; } = string.Empty;
        public string Fax { get; set; } = string.Empty;
        public string Website { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string OwnerName { get; set; } = string.Empty;
        public string Pincode { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public string CityDistrict { get; set; } = string.Empty;
        public string Country { get; set; } = "India";
        public string Status { get; set; } = "New";

        // Legacy Fields
        public string Title { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string Description { get; set; } = string.Empty;
        
        public int EmployeeId { get; set; }
        public User? Employee { get; set; }

        // Pipeline and Allocation Fields
        public int? AllocatedToId { get; set; }
        public User? AllocatedTo { get; set; }
        public string? AllocatorComment { get; set; }
        
        public int? TeleExecutiveId { get; set; }
        public User? TeleExecutive { get; set; }
        public int? MarketingExecutiveId { get; set; }
        public User? MarketingExecutive { get; set; }

        public string LeadBy { get; set; } = string.Empty;
        public string BusinessDescription { get; set; } = string.Empty;
        public string OpeningComments { get; set; } = string.Empty;
        public string Priority { get; set; } = "Highest";
        public string Source { get; set; } = "Yellow Page";
        
        public DateTime? LastActionDate { get; set; }
        public DateTime? MeetingScheduledAt { get; set; }
        public string? MeetingMode { get; set; }
        public DateTime? NextActionDate { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
