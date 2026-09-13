namespace STS.Models
{
    public class Company
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string OwnerEmail { get; set; } = string.Empty;
        public string OwnerContact { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public string Country { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string ZipCode { get; set; } = string.Empty;
        public string TaxId { get; set; } = string.Empty;
        public string Website { get; set; } = string.Empty;
        public string Industry { get; set; } = string.Empty;
        
        
        public DateTime SubscriptionExpiry { get; set; }
        public bool IsTrial { get; set; } = false;
        public string AccountType { get; set; } = "Permanent"; // "Trial" or "Permanent"
        public DateTime? TrialEndDate { get; set; }
        
        public int StaffLimit { get; set; } = 10; // Default limit
        
        public string EnabledModules { get; set; } = "STS"; // Comma-separated list of enabled modules, e.g. "STS,CRM,Invoices"
        
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
