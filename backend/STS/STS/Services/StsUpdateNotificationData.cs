using System;
using System.Collections.Generic;

namespace STS.Services
{
    // Everything the "STS status updated" notification email needs to render —
    // built by the controller from the SalesData record, the DsrEntry just
    // saved, and whoever (admin or employee) logged the update.
    public class StsUpdateNotificationData
    {
        public List<string> ToEmails { get; set; } = new();
        public List<string> CcEmails { get; set; } = new();

        public string TenantCompanyName { get; set; } = string.Empty;
        public string? TenantCompanyLogoUrl { get; set; }

        // Who logged this update
        public string UpdatedByName { get; set; } = string.Empty;
        public string UpdatedByRole { get; set; } = string.Empty; // e.g. "Administrator" or a designation like "Telesales"

        // The prospect/company the STS record is about
        public string CompanyName { get; set; } = string.Empty;
        public string CompanyID { get; set; } = string.Empty;
        public string ContactPerson { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public string Mobile1 { get; set; } = string.Empty;
        public string Mobile2 { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string CityDistrict { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public string Country { get; set; } = string.Empty;

        // The update itself
        public string PreviousStatus { get; set; } = string.Empty;
        public string NewStatus { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public DateTime? CallMeetingDate { get; set; }
        public DateTime? NextCallMeetingDate { get; set; }
        public string Subject { get; set; } = string.Empty;
        public string Comment { get; set; } = string.Empty;
        public string? OtherStatusText { get; set; }
        public string? ConvertedFor { get; set; }
        public decimal? ConvertedPrice { get; set; }
    }
}
