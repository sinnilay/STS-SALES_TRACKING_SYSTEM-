using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using STS.Data;
using STS.Filters;
using STS.Models;
using STS.Services;
using System.Security.Claims;
using System.Linq;

namespace STS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Sales")]
    [RequireActiveSubscription]
    public class EmployeeController : ControllerBase
    {
        private static readonly string[] AllowedImageExtensions = { ".jpg", ".jpeg", ".png", ".webp" };
        private const long MaxImageSizeBytes = 5 * 1024 * 1024; // 5 MB
        private const int MaxSiteImagesPerRecord = 4;

        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;

        public EmployeeController(AppDbContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        private int GetCompanyId()
        {
            var companyIdClaim = User.FindFirst("CompanyId")?.Value;
            if (int.TryParse(companyIdClaim, out int companyId))
                return companyId;

            var role = User.FindFirst(ClaimTypes.Role)?.Value 
                    ?? User.FindFirst("role")?.Value 
                    ?? User.FindFirst("http://schemas.microsoft.com/ws/2008/06/identity/claims/role")?.Value;

            if (role == "SuperAdmin" || User.IsInRole("SuperAdmin"))
            {
                var firstCompany = _context.Companies.FirstOrDefault();
                return firstCompany?.Id ?? 0;
            }

            var defaultCompany = _context.Companies.FirstOrDefault();
            if (defaultCompany != null)
            {
                return defaultCompany.Id;
            }

            throw new UnauthorizedAccessException("Company ID not found in token.");
        }

        // Lets an employee's layout refresh which modules (STS/GPS) are currently enabled and
        // whether the subscription is still active, mirroring Admin's /Admin/my-company for their role.
        [HttpGet("my-company")]
        [AllowExpiredSubscription]
        public async Task<IActionResult> GetMyCompany()
        {
            int companyId = GetCompanyId();
            var company = await _context.Companies.FindAsync(companyId);
            if (company == null) return NotFound(new { message = "Company not found" });
            return Ok(new { company.Id, company.Name, company.EnabledModules, company.IsTrial, company.AccountType, company.SubscriptionExpiry, company.TrialEndDate, company.IsActive });
        }

        [HttpGet("employees")]
        public async Task<IActionResult> GetCompanyEmployees()
        {
            int companyId = GetCompanyId();
            var employees = await _context.Users
                // Only Sales staff belong in an allocation/assignment picker — Admin accounts aren't allottable.
                .Where(u => u.CompanyId == companyId && u.IsActive && u.Role == "Sales")
                .Select(u => new
                {
                    u.Id,
                    u.FullName,
                    u.Email,
                    u.EmployeeDept,
                    u.EmployeeRole,
                    u.Designation,
                    u.IsActive
                })
                .ToListAsync();

            return Ok(employees);
        }

        [HttpPut("sales/{id:int}/allocate")]
        public async Task<IActionResult> AllocateToFieldSales(int id, [FromBody] AllocateSalesDataRequest request)
        {
            var userIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdString, out int userId))
            {
                return Unauthorized(new { message = "Invalid user session." });
            }

            var caller = await _context.Users.FindAsync(userId);
            if (caller == null || caller.EmployeeRole != "Tele Sales")
            {
                return Forbid();
            }

            int companyId = GetCompanyId();
            var salesData = await _context.SalesRecords.FirstOrDefaultAsync(s => s.Id == id && s.TenantCompanyId == companyId);
            if (salesData == null) return NotFound(new { message = "Sales record not found." });

            // Tele Sales can only hand off records that are currently their own.
            if (salesData.AllocatedToId != userId)
            {
                return Forbid();
            }

            var targetEmployee = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.EmployeeId && u.CompanyId == companyId && u.IsActive);
            if (targetEmployee == null) return BadRequest(new { message = "Invalid employee." });
            if (targetEmployee.EmployeeRole != "Field Sales")
            {
                return BadRequest(new { message = "Records can only be allotted to a Field Sales employee." });
            }

            // Remember the Tele Sales owner permanently (separate from AllocatedToId, which is
            // about to move to the Field Sales employee) so this record keeps showing up in
            // their STS Report — and so they can still view it — after the handoff.
            salesData.TeleExecutiveId = userId;
            salesData.AllocatedToId = targetEmployee.Id;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Record allotted to Field Sales successfully." });
        }

        // Field Sales stamps a record with "Meeting Scheduled" from their own assigned list —
        // that timestamp is what drives the Current/Past Meetings boards, keyed off the date
        // this button was clicked rather than the record's own creation/last-action date.
        private static readonly string[] AllowedMeetingModes = { "Online", "Offline" };

        [HttpPut("sales/{id:int}/schedule-meeting")]
        public async Task<IActionResult> ScheduleMeeting(int id, [FromBody] ScheduleMeetingRequest request)
        {
            var userIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdString, out int userId))
            {
                return Unauthorized(new { message = "Invalid user session." });
            }

            var caller = await _context.Users.FindAsync(userId);
            if (caller == null || (caller.EmployeeRole != "Field Sales" && caller.EmployeeRole != "Tele Sales"))
            {
                return Forbid();
            }

            if (!AllowedMeetingModes.Contains(request.MeetingMode))
            {
                return BadRequest(new { message = "Meeting mode must be Online or Offline." });
            }

            int companyId = GetCompanyId();
            var salesData = await _context.SalesRecords.FirstOrDefaultAsync(s => s.Id == id && s.TenantCompanyId == companyId);
            if (salesData == null) return NotFound(new { message = "Sales record not found." });

            if (salesData.AllocatedToId != userId)
            {
                return Forbid();
            }

            salesData.MeetingScheduledAt = DateTime.UtcNow;
            salesData.MeetingMode = request.MeetingMode;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Meeting scheduled.", meetingScheduledAt = salesData.MeetingScheduledAt, meetingMode = salesData.MeetingMode });
        }

        private string? BuildSiteImageUrl(string fileName)
        {
            if (string.IsNullOrEmpty(fileName)) return null;
            return $"{Request.Scheme}://{Request.Host}/siteimages/{fileName}";
        }

        [HttpGet("sales/{id:int}/site-images")]
        public async Task<IActionResult> GetSiteImages(int id)
        {
            var userIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdString, out int userId))
            {
                return Unauthorized(new { message = "Invalid user session." });
            }

            int companyId = GetCompanyId();
            var salesData = await _context.SalesRecords.FirstOrDefaultAsync(s => s.Id == id && s.TenantCompanyId == companyId);
            if (salesData == null) return NotFound(new { message = "Sales record not found." });

            if (salesData.AllocatedToId != userId && salesData.EmployeeId != userId && salesData.TeleExecutiveId != userId)
            {
                return Forbid();
            }

            var images = await _context.SiteImages
                .Where(si => si.SalesDataId == id)
                .OrderByDescending(si => si.CapturedAt)
                .Select(si => new
                {
                    si.Id,
                    si.UploadMethod,
                    si.CapturedAt,
                    ImageUrl = Request.Scheme + "://" + Request.Host + "/siteimages/" + si.FileName,
                    UploadedBy = si.UploadedBy != null ? new { si.UploadedBy.Id, si.UploadedBy.FullName } : null
                })
                .ToListAsync();

            return Ok(new { images, remainingSlots = Math.Max(0, MaxSiteImagesPerRecord - images.Count) });
        }

        [HttpPost("sales/{id:int}/site-images")]
        [RequestSizeLimit(MaxImageSizeBytes)]
        public async Task<IActionResult> UploadSiteImage(int id, IFormFile file, [FromForm] string uploadMethod = "Manual Upload")
        {
            var userIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdString, out int userId))
            {
                return Unauthorized(new { message = "Invalid user session." });
            }

            var caller = await _context.Users.FindAsync(userId);
            if (caller == null || caller.EmployeeRole != "Field Sales")
            {
                return Forbid();
            }

            int companyId = GetCompanyId();
            var salesData = await _context.SalesRecords.FirstOrDefaultAsync(s => s.Id == id && s.TenantCompanyId == companyId);
            if (salesData == null) return NotFound(new { message = "Sales record not found." });

            if (salesData.AllocatedToId != userId)
            {
                return Forbid();
            }

            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "No file uploaded." });
            }

            if (file.Length > MaxImageSizeBytes)
            {
                return BadRequest(new { message = "Image must be 5 MB or smaller." });
            }

            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!AllowedImageExtensions.Contains(extension))
            {
                return BadRequest(new { message = "Only JPG, PNG, or WEBP images are allowed." });
            }

            var existingCount = await _context.SiteImages.CountAsync(si => si.SalesDataId == id);
            if (existingCount >= MaxSiteImagesPerRecord)
            {
                return BadRequest(new { message = $"Maximum of {MaxSiteImagesPerRecord} site images per meeting reached." });
            }

            var normalizedMethod = uploadMethod == "Camera Capture" ? "Camera Capture" : "Manual Upload";

            var siteImagesPath = Path.Combine(_env.ContentRootPath, "siteimages");
            Directory.CreateDirectory(siteImagesPath);

            var newFileName = $"sts{id}_{Guid.NewGuid():N}{extension}";
            var newFilePath = Path.Combine(siteImagesPath, newFileName);

            using (var stream = new FileStream(newFilePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var siteImage = new SiteImage
            {
                SalesDataId = id,
                UploadedById = userId,
                TenantCompanyId = companyId,
                FileName = newFileName,
                UploadMethod = normalizedMethod,
                CapturedAt = DateTime.UtcNow
            };
            _context.SiteImages.Add(siteImage);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Site image uploaded successfully.",
                image = new
                {
                    siteImage.Id,
                    siteImage.UploadMethod,
                    siteImage.CapturedAt,
                    ImageUrl = BuildSiteImageUrl(siteImage.FileName),
                    UploadedBy = new { caller.Id, caller.FullName }
                }
            });
        }

        // --- My Daily Sales Report (DSR) ---

        [HttpGet("my-dsr")]
        public async Task<IActionResult> GetMyDsrEntries([FromQuery] string? date, [FromQuery] string? dateFrom, [FromQuery] string? dateTo, [FromQuery] string? search)
        {
            var userIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdString, out int userId))
            {
                return Unauthorized(new { message = "Invalid user session." });
            }

            int companyId = GetCompanyId();
            var queryable = _context.DsrEntries
                .Where(d => d.TenantCompanyId == companyId && d.EmployeeId == userId)
                .Include(d => d.Employee)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(date) && DateTime.TryParse(date, out var parsedDate))
            {
                var day = parsedDate.Date;
                queryable = queryable.Where(d => d.ReportDate == day);
            }
            else
            {
                if (!string.IsNullOrWhiteSpace(dateFrom) && DateTime.TryParse(dateFrom, out var parsedFrom))
                {
                    var from = parsedFrom.Date;
                    queryable = queryable.Where(d => d.ReportDate >= from);
                }

                if (!string.IsNullOrWhiteSpace(dateTo) && DateTime.TryParse(dateTo, out var parsedTo))
                {
                    var to = parsedTo.Date;
                    queryable = queryable.Where(d => d.ReportDate <= to);
                }
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                queryable = queryable.Where(d => d.CompanyName.Contains(search) || d.CompanyID.Contains(search));
            }

            var entries = await queryable
                .OrderByDescending(d => d.CreatedAt)
                .Select(d => new
                {
                    d.Id,
                    d.SalesDataId,
                    d.CompanyID,
                    d.CompanyName,
                    d.PreviousStatus,
                    d.NewStatus,
                    d.Comment,
                    d.ReportDate,
                    d.CreatedAt,
                    Employee = d.Employee != null ? new
                    {
                        d.Employee.Id,
                        d.Employee.FullName,
                        d.Employee.Email,
                        d.Employee.Department
                    } : null
                })
                .ToListAsync();

            return Ok(entries);
        }

        [HttpGet("sales")]
        public async Task<IActionResult> GetAssignedSales()
        {
            var userIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdString, out int userId))
            {
                return Unauthorized(new { message = "Invalid user claims." });
            }

            int companyId = GetCompanyId();

            var sales = await _context.SalesRecords
                .Where(s => s.AllocatedToId == userId && s.TenantCompanyId == companyId)
                .Select(s => new
                {
                    s.Id,
                    s.CompanyID,
                    s.CompanyName,
                    s.CityDistrict,
                    s.Status,
                    s.CreatedAt,
                    s.LastActionDate,
                    s.MeetingScheduledAt,
                    s.MeetingMode,
                    s.NextActionDate,
                    s.AllocatorComment,
                    s.ContactPerson,
                    s.Designation,
                    s.CompanyAddress,
                    s.Address1,
                    s.Address2,
                    s.PhoneNumber,
                    s.Mobile1,
                    s.Mobile2,
                    s.Fax,
                    s.Website,
                    s.Email,
                    s.OwnerName,
                    s.Pincode,
                    s.State,
                    s.Country,
                    s.LeadBy,
                    s.BusinessDescription,
                    s.OpeningComments,
                    s.Priority,
                    Employee = s.Employee != null ? new
                    {
                        s.Employee.FullName,
                        s.Employee.Email,
                        s.Employee.Department
                    } : null,
                    AllocatedTo = s.AllocatedTo != null ? new
                    {
                        s.AllocatedTo.Id,
                        s.AllocatedTo.FullName,
                        s.AllocatedTo.Email,
                        s.AllocatedTo.Department
                    } : null,
                    TeleExecutive = s.TeleExecutive != null ? new
                    {
                        s.TeleExecutive.Id,
                        s.TeleExecutive.FullName
                    } : null,
                    MarketingExecutive = s.MarketingExecutive != null ? new
                    {
                        s.MarketingExecutive.Id,
                        s.MarketingExecutive.FullName
                    } : null
                })
                .OrderByDescending(s => s.CreatedAt)
                .ToListAsync();

            return Ok(sales);
        }

        // The full report for a Tele Sales employee: everything they created themselves,
        // everything currently allocated to them, PLUS everything they personally allotted
        // onward to a Field Sales employee (tracked via TeleExecutiveId at allotment time) —
        // unlike "My STS Records" (GetAssignedSales, scoped to AllocatedToId only), a record
        // handed off to Field Sales stays visible here so they can keep tracking its status.
        [HttpGet("sales/report")]
        public async Task<IActionResult> GetStsReport()
        {
            var userIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdString, out int userId))
            {
                return Unauthorized(new { message = "Invalid user claims." });
            }

            int companyId = GetCompanyId();

            var sales = await _context.SalesRecords
                .Where(s => s.TenantCompanyId == companyId && (s.EmployeeId == userId || s.AllocatedToId == userId || s.TeleExecutiveId == userId))
                .Select(s => new
                {
                    s.Id,
                    s.CompanyID,
                    s.CompanyName,
                    s.CityDistrict,
                    s.Status,
                    s.CreatedAt,
                    s.LastActionDate,
                    s.MeetingScheduledAt,
                    s.MeetingMode,
                    s.NextActionDate,
                    s.AllocatorComment,
                    s.ContactPerson,
                    s.Designation,
                    s.CompanyAddress,
                    s.Address1,
                    s.Address2,
                    s.PhoneNumber,
                    s.Mobile1,
                    s.Mobile2,
                    s.Fax,
                    s.Website,
                    s.Email,
                    s.OwnerName,
                    s.Pincode,
                    s.State,
                    s.Country,
                    s.LeadBy,
                    s.BusinessDescription,
                    s.OpeningComments,
                    s.Priority,
                    Employee = s.Employee != null ? new
                    {
                        s.Employee.FullName,
                        s.Employee.Email,
                        s.Employee.Department
                    } : null,
                    AllocatedTo = s.AllocatedTo != null ? new
                    {
                        s.AllocatedTo.Id,
                        s.AllocatedTo.FullName,
                        s.AllocatedTo.Email,
                        s.AllocatedTo.Department
                    } : null,
                    TeleExecutive = s.TeleExecutive != null ? new
                    {
                        s.TeleExecutive.Id,
                        s.TeleExecutive.FullName
                    } : null,
                    MarketingExecutive = s.MarketingExecutive != null ? new
                    {
                        s.MarketingExecutive.Id,
                        s.MarketingExecutive.FullName
                    } : null
                })
                .OrderByDescending(s => s.CreatedAt)
                .ToListAsync();

            return Ok(sales);
        }

        [HttpGet("sales/{id:int}")]
        public async Task<IActionResult> GetSalesDataById(int id)
        {
            var userIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdString, out int userId))
            {
                return Unauthorized(new { message = "Invalid user claims." });
            }

            int companyId = GetCompanyId();

            var sales = await _context.SalesRecords
                .Where(s => s.Id == id && s.TenantCompanyId == companyId)
                .Select(s => new
                {
                    s.Id,
                    s.CompanyID,
                    s.CompanyName,
                    s.CityDistrict,
                    s.Status,
                    s.Title,
                    s.Amount,
                    s.Description,
                    s.CreatedAt,
                    s.ContactPerson,
                    s.Designation,
                    s.CompanyAddress,
                    s.Address1,
                    s.Address2,
                    s.PhoneNumber,
                    s.Mobile1,
                    s.Mobile2,
                    s.Fax,
                    s.Website,
                    s.Email,
                    s.OwnerName,
                    s.Pincode,
                    s.State,
                    s.Country,
                    s.LeadBy,
                    s.BusinessDescription,
                    s.OpeningComments,
                    s.Priority,
                    s.EmployeeId,
                    s.AllocatedToId,
                    s.TeleExecutiveId,
                    Employee = s.Employee != null ? new
                    {
                        s.Employee.Id,
                        s.Employee.FullName,
                        s.Employee.Email,
                        s.Employee.Department
                    } : null,
                    AllocatedTo = s.AllocatedTo != null ? new
                    {
                        s.AllocatedTo.Id,
                        s.AllocatedTo.FullName,
                        s.AllocatedTo.Email,
                        s.AllocatedTo.Department
                    } : null,
                    TeleExecutive = s.TeleExecutive != null ? new
                    {
                        s.TeleExecutive.Id,
                        s.TeleExecutive.FullName
                    } : null,
                    MarketingExecutive = s.MarketingExecutive != null ? new
                    {
                        s.MarketingExecutive.Id,
                        s.MarketingExecutive.FullName
                    } : null,
                    s.AllocatorComment,
                    s.Source,
                    s.LastActionDate,
                    s.NextActionDate
                })
                .FirstOrDefaultAsync();

            if (sales == null) return NotFound(new { message = "Sales record not found." });

            if (sales.AllocatedToId != userId && sales.EmployeeId != userId && sales.TeleExecutiveId != userId)
            {
                return Forbid();
            }

            return Ok(sales);
        }

        [HttpGet("sales/{id:int}/history")]
        public async Task<IActionResult> GetSalesHistory(int id)
        {
            var userIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdString, out int userId))
            {
                return Unauthorized(new { message = "Invalid user claims." });
            }

            int companyId = GetCompanyId();

            var salesData = await _context.SalesRecords.FirstOrDefaultAsync(s => s.Id == id && s.TenantCompanyId == companyId);
            if (salesData == null) return NotFound(new { message = "Sales record not found." });

            // Allow the record's original creator, and the Tele Sales employee who allotted it
            // onward to Field Sales, to keep viewing its history — not just whoever it's
            // currently allocated to.
            if (salesData.AllocatedToId != userId && salesData.EmployeeId != userId && salesData.TeleExecutiveId != userId)
            {
                return Forbid();
            }

            var history = await _context.DsrEntries
                .Where(d => d.SalesDataId == id && d.TenantCompanyId == companyId)
                .OrderBy(d => d.CreatedAt)
                .Select(d => new
                {
                    d.Id,
                    d.PreviousStatus,
                    d.NewStatus,
                    d.Comment,
                    d.Priority,
                    d.CallMeetingDate,
                    d.NextCallMeetingDate,
                    d.CcTo,
                    d.Subject,
                    d.CreatedAt,
                    Employee = d.Employee != null ? new { d.Employee.Id, d.Employee.FullName, d.Employee.Email } : null
                })
                .ToListAsync();

            return Ok(history);
        }

        [HttpPut("sales/{id}/status")]
        public async Task<IActionResult> UpdateSalesStatus(int id, [FromBody] UpdateSalesStatusRequest request)
        {
            var userIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdString, out int userId))
            {
                return Unauthorized(new { message = "Invalid user claims." });
            }

            int companyId = GetCompanyId();

            var salesData = await _context.SalesRecords.FirstOrDefaultAsync(s => s.Id == id && s.TenantCompanyId == companyId);
            if (salesData == null) return NotFound(new { message = "Sales record not found." });

            // Ensure they can only update their own assigned records
            if (salesData.AllocatedToId != userId)
            {
                return Forbid();
            }

            if (!StsPipeline.IsValidStatus(request.Status)) return BadRequest(new { message = "Invalid status." });

            if (string.IsNullOrWhiteSpace(request.Priority)) return BadRequest(new { message = "Priority is required." });
            if (request.CallMeetingDate == null) return BadRequest(new { message = "Call/Meeting date is required." });
            if (string.IsNullOrWhiteSpace(request.Subject)) return BadRequest(new { message = "Subject is required." });
            if (string.IsNullOrWhiteSpace(request.Comment))
            {
                return BadRequest(new { message = "A comment is required to update the status." });
            }

            var previousStatus = salesData.Status;
            salesData.Status = request.Status;
            salesData.Priority = request.Priority;
            salesData.LastActionDate = DateTime.UtcNow;
            salesData.NextActionDate = request.NextCallMeetingDate;

            _context.DsrEntries.Add(new DsrEntry
            {
                TenantCompanyId = companyId,
                SalesDataId = salesData.Id,
                EmployeeId = userId,
                CompanyID = salesData.CompanyID,
                CompanyName = salesData.CompanyName,
                PreviousStatus = previousStatus,
                NewStatus = request.Status,
                Comment = request.Comment,
                Priority = request.Priority,
                CallMeetingDate = request.CallMeetingDate,
                NextCallMeetingDate = request.NextCallMeetingDate,
                CcTo = request.CcTo,
                Subject = request.Subject,
                ReportDate = DateTime.UtcNow.Date,
                CreatedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return Ok(new { message = "Status updated successfully." });
        }

        [HttpGet("sales/search")]
        public async Task<IActionResult> SearchSalesData([FromQuery] string searchBy, [FromQuery] string query)
        {
            if (string.IsNullOrWhiteSpace(query)) return BadRequest(new { message = "Search query is required." });

            int companyId = GetCompanyId();
            var queryable = _context.SalesRecords
                .Where(s => s.TenantCompanyId == companyId)
                .Include(s => s.Employee).AsQueryable();

            if (searchBy == "Email")
            {
                queryable = queryable.Where(s => s.Email.Contains(query));
            }
            else if (searchBy == "Name")
            {
                queryable = queryable.Where(s => s.CompanyName.Contains(query));
            }
            else if (searchBy == "Mobile")
            {
                queryable = queryable.Where(s => s.Mobile1.Contains(query) || s.Mobile2.Contains(query) || s.PhoneNumber.Contains(query));
            }

            var results = await queryable
                .Select(s => new
                {
                    s.Id,
                    s.CompanyID,
                    s.CompanyName,
                    s.CityDistrict,
                    s.Status,
                    s.CreatedAt,
                    s.Source,
                    s.LastActionDate,
                    s.ContactPerson,
                    s.Designation,
                    s.Email,
                    s.Mobile1,
                    s.Mobile2,
                    s.PhoneNumber,
                    s.Website,
                    s.Address1,
                    s.Address2,
                    s.State,
                    s.Pincode,
                    s.Country,
                    s.Priority,
                    s.LeadBy,
                    s.BusinessDescription,
                    s.OpeningComments,
                    AllocatedTo = s.AllocatedTo != null ? new { s.AllocatedTo.Id, s.AllocatedTo.FullName } : null,
                    TeleExecutive = s.TeleExecutive != null ? new { s.TeleExecutive.Id, s.TeleExecutive.FullName } : null,
                    MarketingExecutive = s.MarketingExecutive != null ? new { s.MarketingExecutive.Id, s.MarketingExecutive.FullName } : null,
                })
                .OrderByDescending(s => s.CreatedAt)
                .ToListAsync();

            return Ok(results);
        }

        [HttpPost("sales")]
        public async Task<IActionResult> AddSalesData([FromBody] AddSalesDataRequest request)
        {
            var currentUserIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(currentUserIdStr, out int employeeId))
            {
                return Unauthorized(new { message = "Invalid user session." });
            }

            var employee = await _context.Users.FindAsync(employeeId);
            if (employee == null)
            {
                return BadRequest(new { message = "Invalid Employee." });
            }

            // Check if Sales user has the 'addSts' permission
            var permsArray = string.IsNullOrEmpty(employee.Permissions) ? Array.Empty<string>() : System.Text.Json.JsonSerializer.Deserialize<string[]>(employee.Permissions);
            if (permsArray == null || !permsArray.Contains("addSts"))
            {
                return Forbid();
            }

            int companyId = GetCompanyId();

            // A record an employee creates themselves belongs to them by default — no Admin
            // hand-off step needed. Tele Sales can still route a fresh record straight to a
            // teammate (e.g. a Field Sales colleague) by picking someone at creation time;
            // everyone else (including Field Sales, who get no picker in the UI) is always
            // allocated to themselves.
            int? allocatedToId = (employee.EmployeeRole == "Tele Sales" && request.AllocatedToId.HasValue)
                ? request.AllocatedToId
                : employeeId;

            var salesData = new SalesData
            {
                TenantCompanyId = companyId,
                CompanyID = "STS-" + Guid.NewGuid().ToString("N").Substring(0, 8).ToUpper(),
                CompanyName = request.CompanyName,
                ContactPerson = request.ContactPerson,
                Designation = request.Designation,
                CompanyAddress = request.CompanyAddress,
                Address1 = request.Address1,
                Address2 = request.Address2,
                PhoneNumber = request.PhoneNumber,
                Mobile1 = request.Mobile1,
                Mobile2 = request.Mobile2,
                Fax = request.Fax,
                Website = request.Website,
                Email = request.Email,
                OwnerName = request.OwnerName,
                Pincode = request.Pincode,
                State = request.State,
                CityDistrict = request.CityDistrict,
                Country = request.Country,
                Status = "New",
                AllocatedToId = allocatedToId,
                LeadBy = request.LeadBy,
                BusinessDescription = request.BusinessDescription,
                OpeningComments = request.OpeningComments,
                Priority = request.Priority,
                Source = request.Source,
                Title = request.Title,
                Amount = request.Amount,
                Description = request.Description,
                EmployeeId = employeeId,
                LastActionDate = DateTime.UtcNow
            };

            _context.SalesRecords.Add(salesData);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Sales data added successfully.", id = salesData.Id });
        }

        // Raised from the "Check Duplicate" step on Add STS — an employee found an existing
        // record and wants it handed to them instead of creating a fresh one. Lands on the
        // Admin's "Employee STS Request" screen for approval.
        [HttpPost("sales/{id:int}/request-allocation")]
        public async Task<IActionResult> RequestStsAllocation(int id, [FromBody] RequestStsAllocationRequest request)
        {
            var userIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdString, out int userId))
            {
                return Unauthorized(new { message = "Invalid user session." });
            }

            int companyId = GetCompanyId();
            var salesData = await _context.SalesRecords.FirstOrDefaultAsync(s => s.Id == id && s.TenantCompanyId == companyId);
            if (salesData == null) return NotFound(new { message = "Sales record not found." });

            if (salesData.AllocatedToId == userId)
                return BadRequest(new { message = "This record is already allocated to you." });

            var existingPending = await _context.StsAllocationRequests
                .AnyAsync(r => r.SalesDataId == id && r.RequestedById == userId && r.Status == "Pending");
            if (existingPending)
                return BadRequest(new { message = "You already have a pending request for this record." });

            _context.StsAllocationRequests.Add(new StsAllocationRequest
            {
                TenantCompanyId = companyId,
                SalesDataId = id,
                RequestedById = userId,
                Comment = request?.Comment,
            });
            await _context.SaveChangesAsync();

            return Ok(new { message = "Request sent to Admin for approval." });
        }
    }

    public class ScheduleMeetingRequest
    {
        public string MeetingMode { get; set; } = string.Empty;
    }

    public class RequestStsAllocationRequest
    {
        public string? Comment { get; set; }
    }
}
