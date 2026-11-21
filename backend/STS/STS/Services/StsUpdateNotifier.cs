using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using STS.Data;
using STS.Models;

namespace STS.Services
{
    // Shared by AdminController and EmployeeController's "update STS status"
    // endpoints: whenever anyone logs an update, only the company Admin (Role = "Admin", not "SubAdmin") gets
    // notified by email (via IEmailService), CC'd to whatever the "CC To"
    // field on the update form was set to.
    public static class StsUpdateNotifier
    {
        public static async Task NotifyAsync(
            AppDbContext context,
            IEmailService emailService,
            ILogger logger,
            int companyId,
            SalesData salesData,
            string previousStatus,
            string newStatus,
            string priority,
            DateTime? callMeetingDate,
            DateTime? nextCallMeetingDate,
            string? ccTo,
            string subject,
            string comment,
            string? otherStatusText,
            string? convertedFor,
            decimal? convertedPrice,
            string updatedByName,
            string updatedByRole)
        {
            try
            {
                var adminEmails = await context.Users
                    .Where(u => u.CompanyId == companyId && u.Role == "Admin" && u.IsActive && u.Email != "")
                    .Select(u => u.Email)
                    .ToListAsync();

                if (adminEmails.Count == 0)
                {
                    logger.LogWarning("No active Admin found for company {companyId} — skipping STS update notification.", companyId);
                    return;
                }

                var tenantCompany = await context.Companies
                    .Where(c => c.Id == companyId)
                    .Select(c => new { c.Name, c.LogoUrl })
                    .FirstOrDefaultAsync();

                var tenantCompanyName = tenantCompany?.Name ?? "STS";
                var tenantCompanyLogoUrl = tenantCompany?.LogoUrl;

                var ccEmails = (ccTo ?? string.Empty)
                    .Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
                    .Select(e => e.Trim())
                    .Where(e => e.Length > 0)
                    .ToList();

                var address = string.Join(", ", new[] { salesData.Address1, salesData.Address2, salesData.CompanyAddress }
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .Distinct());

                var data = new StsUpdateNotificationData
                {
                    ToEmails = adminEmails,
                    CcEmails = ccEmails,
                    TenantCompanyName = tenantCompanyName,
                    TenantCompanyLogoUrl = tenantCompanyLogoUrl,
                    UpdatedByName = updatedByName,
                    UpdatedByRole = updatedByRole,
                    CompanyName = salesData.CompanyName,
                    CompanyID = salesData.CompanyID,
                    ContactPerson = salesData.ContactPerson,
                    Email = salesData.Email,
                    PhoneNumber = salesData.PhoneNumber,
                    Mobile1 = salesData.Mobile1,
                    Mobile2 = salesData.Mobile2,
                    Address = address,
                    CityDistrict = salesData.CityDistrict,
                    State = salesData.State,
                    Country = salesData.Country,
                    PreviousStatus = previousStatus,
                    NewStatus = newStatus,
                    Priority = priority,
                    CallMeetingDate = callMeetingDate,
                    NextCallMeetingDate = nextCallMeetingDate,
                    Subject = subject,
                    Comment = comment,
                    OtherStatusText = otherStatusText,
                    ConvertedFor = convertedFor,
                    ConvertedPrice = convertedPrice,
                };

                await emailService.SendStsUpdateNotificationAsync(data);
            }
            catch (Exception ex)
            {
                // Never let a notification failure break the status update itself.
                logger.LogError(ex, "Failed to prepare STS update notification email for company {company}", salesData.CompanyName);
            }
        }
    }
}
