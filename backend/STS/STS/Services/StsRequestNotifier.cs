using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using STS.Data;

namespace STS.Services
{
    // Emails around the "request allocation" flow on Add STS → Check Duplicate:
    //   submitted → the company Admin(s), with employee + STS details
    //   approved / rejected → the requesting employee
    // Failures are logged and swallowed so they never break the request/review itself.
    public static class StsRequestNotifier
    {
        public enum Kind { Submitted, Approved, Rejected }

        public static async Task NotifyAsync(
            AppDbContext context,
            IEmailService emailService,
            IConfiguration config,
            ILogger logger,
            int requestId,
            Kind kind)
        {
            try
            {
                var r = await context.StsAllocationRequests
                    .AsNoTracking()
                    .Include(x => x.RequestedBy)
                    .Include(x => x.ReviewedBy)
                    .Include(x => x.SalesData).ThenInclude(s => s!.AllocatedTo)
                    .FirstOrDefaultAsync(x => x.Id == requestId);

                if (r?.SalesData == null || r.RequestedBy == null)
                {
                    logger.LogWarning("STS request {id} is missing its record or employee — skipping {kind} email.", requestId, kind);
                    return;
                }

                List<string> toEmails;
                if (kind == Kind.Submitted)
                {
                    toEmails = await context.Users
                        .Where(u => u.CompanyId == r.TenantCompanyId && u.Role == "Admin" && u.IsActive && u.Email != "")
                        .Select(u => u.Email)
                        .ToListAsync();
                }
                else
                {
                    toEmails = string.IsNullOrWhiteSpace(r.RequestedBy.Email)
                        ? new List<string>()
                        : new List<string> { r.RequestedBy.Email };
                }

                if (toEmails.Count == 0)
                {
                    logger.LogWarning("No recipient for STS request {id} {kind} email — skipping.", requestId, kind);
                    return;
                }

                var tenant = await context.Companies
                    .Where(c => c.Id == r.TenantCompanyId)
                    .Select(c => new { c.Name, c.LogoUrl })
                    .FirstOrDefaultAsync();

                var portalUrl = (config["FrontendUrl"] ?? "https://weberp.ideaspromotion.com").TrimEnd('/') + "/";
                var s = r.SalesData;
                var e = r.RequestedBy;

                var data = new StsRequestEmailData
                {
                    ToEmails = toEmails,
                    TenantCompanyName = tenant?.Name ?? "STS",
                    TenantCompanyLogoUrl = tenant?.LogoUrl,
                    PortalUrl = portalUrl,

                    EmployeeId = e.Id,
                    EmployeeName = e.FullName,
                    EmployeeEmail = e.Email,
                    EmployeeMobile = e.MobileNo,
                    EmployeeDesignation = e.Designation,
                    EmployeeDepartment = string.IsNullOrWhiteSpace(e.EmployeeDept) ? e.Department : e.EmployeeDept,
                    EmployeeRole = e.EmployeeRole,
                    EmployeeCityBranch = e.CityBranch,

                    CompanyID = s.CompanyID,
                    CompanyName = s.CompanyName,
                    ContactPerson = s.ContactPerson,
                    Phone = new[] { s.Mobile1, s.PhoneNumber, s.Mobile2 }.FirstOrDefault(p => !string.IsNullOrWhiteSpace(p)),
                    Email = s.Email,
                    CityDistrict = s.CityDistrict,
                    State = s.State,
                    Country = s.Country,
                    Source = s.Source,
                    Priority = s.Priority,
                    Status = string.IsNullOrWhiteSpace(s.Status) ? "New" : s.Status,
                    RecordCreatedAt = s.CreatedAt,
                    CurrentlyAllocatedTo = s.AllocatedTo?.FullName,

                    RequestComment = r.Comment,
                    RequestedAt = r.CreatedAt,
                    ReviewedByName = r.ReviewedBy?.FullName,
                    ReviewComment = r.ReviewComment,
                    ReviewedAt = r.ReviewedAt,
                };

                switch (kind)
                {
                    case Kind.Submitted: await emailService.SendStsRequestSubmittedEmailAsync(data); break;
                    case Kind.Approved: await emailService.SendStsRequestApprovedEmailAsync(data); break;
                    case Kind.Rejected: await emailService.SendStsRequestRejectedEmailAsync(data); break;
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to prepare STS request {kind} email for request {id}", kind, requestId);
            }
        }
    }
}
