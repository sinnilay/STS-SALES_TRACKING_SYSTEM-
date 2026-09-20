using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using STS.Data;
using STS.Filters;
using STS.Models;
using STS.Services;

using System.Security.Claims;

namespace STS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Admin,SuperAdmin")]
    [RequireActiveSubscription]
    public class AdminController : ControllerBase
    {
        private static readonly string[] AllowedImageExtensions = { ".jpg", ".jpeg", ".png", ".webp" };
        private const long MaxImageSizeBytes = 5 * 1024 * 1024; // 5 MB

        private readonly AppDbContext _context;
        private readonly IAuthService _authService;
        private readonly IEmailService _emailService;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<AdminController> _logger;

        public AdminController(AppDbContext context, IAuthService authService, IEmailService emailService, IWebHostEnvironment env, ILogger<AdminController> logger)
        {
            _context = context;
            _authService = authService;
            _emailService = emailService;
            _env = env;
            _logger = logger;
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

        [HttpGet("my-company")]
        [AllowExpiredSubscription]
        public async Task<IActionResult> GetMyCompany()
        {
            int companyId = GetCompanyId();
            var company = await _context.Companies.FindAsync(companyId);
            if (company == null)
            {
                company = await _context.Companies.FirstOrDefaultAsync();
            }
            if (company == null) return NotFound(new { message = "Company not found" });
            return Ok(new { 
                company.Id, 
                company.Name, 
                company.LogoUrl,
                company.OwnerEmail,
                company.OwnerContact,
                company.Website,
                company.City,
                company.State,
                company.Country,
                company.Address,
                company.ZipCode,
                company.EnabledModules, 
                company.IsTrial, 
                company.AccountType, 
                company.SubscriptionExpiry, 
                company.TrialEndDate, 
                company.IsActive 
            });
        }

        [HttpPost("company-logo")]
        public async Task<IActionResult> UploadCompanyLogo([FromForm] IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "Please select an image file to upload." });

            var allowedExtensions = new[] { ".png", ".jpg", ".jpeg", ".webp", ".svg" };
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(extension))
                return BadRequest(new { message = "Only PNG, JPG, JPEG, WEBP, and SVG images are supported." });

            if (file.Length > MaxImageSizeBytes)
                return BadRequest(new { message = "File size exceeds the 5 MB limit." });

            int companyId = GetCompanyId();
            var company = await _context.Companies.FindAsync(companyId);
            if (company == null)
            {
                company = await _context.Companies.FirstOrDefaultAsync();
            }
            if (company == null) return NotFound(new { message = "Company not found." });

            var logosFolder = Path.Combine(_env.ContentRootPath, "companylogos");
            Directory.CreateDirectory(logosFolder);

            var newFileName = $"company_{company.Id}_{Guid.NewGuid():N}{extension}";
            var newFilePath = Path.Combine(logosFolder, newFileName);

            using (var stream = new FileStream(newFilePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Clean up old local logo if one exists
            if (!string.IsNullOrWhiteSpace(company.LogoUrl) && company.LogoUrl.Contains("/companylogos/"))
            {
                try
                {
                    var oldFileName = Path.GetFileName(new Uri(company.LogoUrl).LocalPath);
                    var oldFilePath = Path.Combine(logosFolder, oldFileName);
                    if (System.IO.File.Exists(oldFilePath))
                    {
                        System.IO.File.Delete(oldFilePath);
                    }
                }
                catch { /* Ignore cleanup errors */ }
            }

            company.LogoUrl = $"{Request.Scheme}://{Request.Host}/companylogos/{newFileName}";
            await _context.SaveChangesAsync();

            return Ok(new
            {
                logoUrl = company.LogoUrl,
                message = "Company logo uploaded successfully."
            });
        }

        [HttpDelete("company-logo")]
        public async Task<IActionResult> RemoveCompanyLogo()
        {
            int companyId = GetCompanyId();
            var company = await _context.Companies.FindAsync(companyId);
            if (company == null)
            {
                company = await _context.Companies.FirstOrDefaultAsync();
            }
            if (company == null) return NotFound(new { message = "Company not found." });

            var logosFolder = Path.Combine(_env.ContentRootPath, "companylogos");
            if (!string.IsNullOrWhiteSpace(company.LogoUrl) && company.LogoUrl.Contains("/companylogos/"))
            {
                try
                {
                    var oldFileName = Path.GetFileName(new Uri(company.LogoUrl).LocalPath);
                    var oldFilePath = Path.Combine(logosFolder, oldFileName);
                    if (System.IO.File.Exists(oldFilePath))
                    {
                        System.IO.File.Delete(oldFilePath);
                    }
                }
                catch { /* Ignore cleanup errors */ }
            }

            company.LogoUrl = null;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Company logo removed successfully." });
        }

        // --- GPS Tracking Module ---

        // Matches the frontend's own recency window — kept in sync so a fresh page load and
        // the live SignalR view never disagree about whether someone still counts as online.
        private static readonly TimeSpan OnlineThreshold = TimeSpan.FromSeconds(75);

        // Employee login status + last known position, for the Admin's GPS Tracking screen.
        [HttpGet("gps/employees")]
        public async Task<IActionResult> GetGpsEmployees()
        {
            int companyId = GetCompanyId();

            var company = await _context.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == companyId);
            var enabledModules = (company?.EnabledModules ?? string.Empty).Split(',').Select(m => m.Trim());
            if (!enabledModules.Contains("GPS"))
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "GPS Tracking is not enabled for your workspace." });

            var cutoff = DateTime.UtcNow - OnlineThreshold;
            var employees = await _context.Users
                .Where(u => u.CompanyId == companyId && u.Role == "Sales")
                .Select(u => new
                {
                    u.Id,
                    u.FullName,
                    u.Email,
                    u.EmployeeRole,
                    u.EmployeeDept,
                    u.IsActive,
                    u.LastLatitude,
                    u.LastLongitude,
                    u.LastLocationAt,
                    u.LastSeenAt,
                })
                .ToListAsync();

            var result = employees.Select(e => new
            {
                e.Id,
                e.FullName,
                e.Email,
                e.EmployeeRole,
                e.EmployeeDept,
                e.IsActive,
                e.LastLatitude,
                e.LastLongitude,
                e.LastLocationAt,
                e.LastSeenAt,
                IsOnline = e.LastSeenAt.HasValue && e.LastSeenAt.Value >= cutoff
            });

            return Ok(result);
        }

        // --- Employees Management ---

        [HttpGet("employees")]
        public async Task<IActionResult> GetEmployees()
        {
            int companyId = GetCompanyId();
            var employees = await _context.Users
                // The Employees list is for staff the admin manages, not admin/owner accounts themselves.
                .Where(u => u.CompanyId == companyId && u.Role != "Admin" && u.Role != "SuperAdmin")
                .Select(u => new
                {
                    u.Id,
                    u.FullName,
                    u.Email,
                    u.PhoneNumber,
                    u.Department,
                    u.EmployeeDept,
                    u.Address,
                    u.Role,
                    u.EmployeeRole,
                    u.Designation,
                    u.Permissions,
                    u.JoiningDate,
                    u.IsActive,
                    u.CreatedAt,
                    u.ProfilePicturePath
                })
                .ToListAsync();

            var result = employees.Select(e => new
            {
                e.Id,
                e.FullName,
                e.Email,
                e.PhoneNumber,
                e.Department,
                e.EmployeeDept,
                e.Address,
                e.Role,
                e.EmployeeRole,
                e.Designation,
                e.Permissions,
                e.JoiningDate,
                e.IsActive,
                e.CreatedAt,
                ProfilePictureUrl = BuildProfilePictureUrl(e.ProfilePicturePath)
            });

            return Ok(result);
        }

        private string? BuildProfilePictureUrl(string? fileName)
        {
            if (string.IsNullOrEmpty(fileName)) return null;
            return $"{Request.Scheme}://{Request.Host}/profilepics/{fileName}";
        }

        [HttpPost("employees/{id:int}/picture")]
        [RequestSizeLimit(MaxImageSizeBytes)]
        public async Task<IActionResult> UploadEmployeePicture(int id, IFormFile file)
        {
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

            int companyId = GetCompanyId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id && u.CompanyId == companyId);
            if (user == null) return NotFound(new { message = "Employee not found." });

            var profilePicsPath = Path.Combine(_env.ContentRootPath, "profilepics");
            Directory.CreateDirectory(profilePicsPath);

            var newFileName = $"user_{id}_{Guid.NewGuid():N}{extension}";
            var newFilePath = Path.Combine(profilePicsPath, newFileName);

            using (var stream = new FileStream(newFilePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var oldFileName = user.ProfilePicturePath;
            user.ProfilePicturePath = newFileName;
            await _context.SaveChangesAsync();

            if (!string.IsNullOrEmpty(oldFileName))
            {
                var oldFilePath = Path.Combine(profilePicsPath, oldFileName);
                if (System.IO.File.Exists(oldFilePath))
                {
                    try { System.IO.File.Delete(oldFilePath); } catch { /* best-effort cleanup */ }
                }
            }

            return Ok(new { message = "Profile picture updated successfully.", profilePictureUrl = BuildProfilePictureUrl(newFileName) });
        }

        [HttpGet("employees/{id:int}")]
        public async Task<IActionResult> GetEmployeeById(int id)
        {
            int companyId = GetCompanyId();
            var user = await _context.Users.Include(u => u.Company).FirstOrDefaultAsync(u => u.Id == id && u.CompanyId == companyId);
            if (user == null)
            {
                return NotFound(new { message = "Employee not found." });
            }

            var profilePictureUrl = string.IsNullOrEmpty(user.ProfilePicturePath)
                ? null
                : $"{Request.Scheme}://{Request.Host}/profilepics/{user.ProfilePicturePath}";

            return Ok(new
            {
                user.Id,
                user.FullName,
                user.Email,
                user.PhoneNumber,
                user.MobileNo,
                user.AlternateMobileNo,
                user.Department,
                user.EmployeeDept,
                user.Designation,
                user.CityBranch,
                user.FathersName,
                user.Address,
                user.LocalAddress,
                user.PermanentAddress,
                user.ZipCode,
                user.Sex,
                user.Qualification,
                user.DateOfBirth,
                user.Role,
                user.EmployeeRole,
                user.Permissions,
                user.JoiningDate,
                user.IsActive,
                user.CreatedAt,
                CompanyName = user.Company?.Name,
                ProfilePictureUrl = profilePictureUrl
            });
        }

        [HttpPost("employees")]
        public async Task<IActionResult> AddEmployee([FromBody] AddEmployeeRequest request)
        {
            if (await _context.Users.AnyAsync(u => u.Email == request.Email))
            {
                return BadRequest(new { message = "Email already in use." });
            }

            int companyId = GetCompanyId();

            var user = new User
            {
                CompanyId = companyId,
                FullName = request.FullName,
                Email = request.Email,
                PhoneNumber = request.PhoneNumber,
                PasswordHash = _authService.HashPassword(request.Password),
                Department = request.Department,
                EmployeeDept = request.EmployeeDept,
                Designation = request.Designation,
                CityBranch = request.CityBranch,
                FathersName = request.FathersName,
                Address = request.Address,
                LocalAddress = request.LocalAddress,
                PermanentAddress = request.PermanentAddress,
                ZipCode = request.ZipCode,
                Sex = request.Sex,
                Qualification = request.Qualification,
                MobileNo = request.MobileNo,
                AlternateMobileNo = request.AlternateMobileNo,
                DateOfBirth = request.DateOfBirth,
                Role = request.Role,
                EmployeeRole = request.EmployeeRole,
                Permissions = request.Permissions,
                JoiningDate = request.JoiningDate,
                IsActive = true
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            
            // Send welcome email in background (or inline)
            await _emailService.SendWelcomeEmailAsync(user.Email, user.FullName, request.Password);

            return Ok(new { message = "Employee created successfully.", id = user.Id });
        }

        [HttpPut("employees/{id}/toggle-status")]
        public async Task<IActionResult> ToggleEmployeeStatus(int id)
        {
            int companyId = GetCompanyId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id && u.CompanyId == companyId);
            if (user == null)
            {
                return NotFound(new { message = "Employee not found." });
            }

            // Cannot disable oneself to prevent lockout
            var currentUserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (currentUserId == id.ToString())
            {
                return BadRequest(new { message = "You cannot change your own status." });
            }

            user.IsActive = !user.IsActive;
            await _context.SaveChangesAsync();

            return Ok(new { message = $"Employee status updated to {(user.IsActive ? "Active" : "Inactive")}.", isActive = user.IsActive });
        }

        [HttpPut("employees/{id}")]
        public async Task<IActionResult> UpdateEmployee(int id, [FromBody] UpdateEmployeeRequest request)
        {
            int companyId = GetCompanyId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id && u.CompanyId == companyId);
            if (user == null)
            {
                return NotFound(new { message = "Employee not found." });
            }

            // Check email uniqueness if changed
            if (user.Email != request.Email && await _context.Users.AnyAsync(u => u.Email == request.Email))
            {
                return BadRequest(new { message = "Email already in use." });
            }

            user.FullName = request.FullName;
            user.Email = request.Email;
            user.PhoneNumber = request.PhoneNumber;
            user.Department = request.Department;
            user.EmployeeDept = request.EmployeeDept;
            user.Designation = request.Designation;
            user.CityBranch = request.CityBranch;
            user.FathersName = request.FathersName;
            user.Address = request.Address;
            user.LocalAddress = request.LocalAddress;
            user.PermanentAddress = request.PermanentAddress;
            user.ZipCode = request.ZipCode;
            user.Sex = request.Sex;
            user.Qualification = request.Qualification;
            user.MobileNo = request.MobileNo;
            user.AlternateMobileNo = request.AlternateMobileNo;
            user.DateOfBirth = request.DateOfBirth;
            user.Role = request.Role;
            user.EmployeeRole = request.EmployeeRole;
            user.Permissions = request.Permissions;
            user.JoiningDate = request.JoiningDate;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Employee updated successfully." });
        }

        [HttpPut("employees/{id}/reset-password")]
        public async Task<IActionResult> ResetPassword(int id, [FromBody] ResetPasswordRequest request)
        {
            int companyId = GetCompanyId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id && u.CompanyId == companyId);
            if (user == null)
            {
                return NotFound(new { message = "Employee not found." });
            }

            user.PasswordHash = _authService.HashPassword(request.NewPassword);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Password reset successfully." });
        }

        [HttpPut("employees/{id}/permissions")]
        public async Task<IActionResult> UpdateEmployeePermissions(int id, [FromBody] UpdatePermissionsRequest request)
        {
            int companyId = GetCompanyId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id && u.CompanyId == companyId);
            if (user == null)
            {
                return NotFound(new { message = "Employee not found." });
            }

            user.Permissions = request.Permissions;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Employee permissions updated successfully." });
        }

        // --- STS Sales Data Management ---

        [HttpGet("sales")]
        public async Task<IActionResult> GetSalesData()
        {
            int companyId = GetCompanyId();
            var sales = await _context.SalesRecords
                .Where(s => s.TenantCompanyId == companyId)
                .Include(s => s.Employee)
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
                    Employee = new
                    {
                        s.Employee!.Id,
                        s.Employee.FullName,
                        s.Employee.Email,
                        s.Employee.Department
                    },
                    AllocatedTo = s.AllocatedTo != null ? new
                    {
                        s.AllocatedTo.Id,
                        s.AllocatedTo.FullName,
                        s.AllocatedTo.Email,
                        s.AllocatedTo.Department,
                        s.AllocatedTo.EmployeeRole
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
                .OrderByDescending(s => s.CreatedAt)
                .ToListAsync();

            return Ok(sales);
        }

        [HttpGet("sales/{id:int}")]
        public async Task<IActionResult> GetSalesDataById(int id)
        {
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
                        s.AllocatedTo.Department,
                        s.AllocatedTo.EmployeeRole
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

            return Ok(sales);
        }

        [HttpGet("sales/{id:int}/history")]
        public async Task<IActionResult> GetSalesHistory(int id)
        {
            int companyId = GetCompanyId();
            var exists = await _context.SalesRecords.AnyAsync(s => s.Id == id && s.TenantCompanyId == companyId);
            if (!exists) return NotFound(new { message = "Sales record not found." });

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
                    d.ConvertedFor,
                    d.ConvertedPrice,
                    d.OtherStatusText,
                    d.UpdatedAsAdmin,
                    d.CreatedAt,
                    Employee = d.Employee != null ? new { d.Employee.Id, d.Employee.FullName, d.Employee.Email } : null
                })
                .ToListAsync();

            return Ok(history);
        }

        [HttpPost("sales")]
        public async Task<IActionResult> AddSalesData([FromBody] AddSalesDataRequest request)
        {
            var currentUserIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(currentUserIdStr, out int employeeId))
            {
                return Unauthorized(new { message = "Invalid user session." });
            }

            var employeeExists = await _context.Users.AnyAsync(u => u.Id == employeeId);
            if (!employeeExists)
            {
                return BadRequest(new { message = "Invalid Employee." });
            }

            int companyId = GetCompanyId();
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
                AllocatedToId = request.AllocatedToId,
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

        [HttpPost("sales/bulk")]
        public async Task<IActionResult> AddBulkSalesData([FromBody] List<AddSalesDataRequest> requests)
        {
            var userIdString = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdString, out int userId))
            {
                return Unauthorized(new { message = "Invalid user claims." });
            }

            int companyId = GetCompanyId();
            var salesRecords = new List<SalesData>();
            foreach (var request in requests)
            {
                var newId = "STS-" + Guid.NewGuid().ToString("N").Substring(0, 8).ToUpper();
                
                salesRecords.Add(new SalesData
                {
                    TenantCompanyId = companyId,
                    CompanyID = newId,
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
                    Country = string.IsNullOrWhiteSpace(request.Country) ? "India" : request.Country,
                    LeadBy = request.LeadBy,
                    BusinessDescription = request.BusinessDescription,
                    OpeningComments = request.OpeningComments,
                    Priority = string.IsNullOrWhiteSpace(request.Priority) ? "Highest" : request.Priority,
                    Source = string.IsNullOrWhiteSpace(request.Source) ? "Yellow Page" : request.Source,

                    Title = request.Title,
                    Amount = request.Amount,
                    Description = request.Description,
                    EmployeeId = userId,
                    Status = "New",
                    CreatedAt = DateTime.UtcNow
                });
            }

            _context.SalesRecords.AddRange(salesRecords);
            await _context.SaveChangesAsync();

            return Ok(new { message = $"{salesRecords.Count} records imported successfully." });
        }

        [HttpPut("sales/{id}/allocate")]
        public async Task<IActionResult> AllocateSalesData(int id, [FromBody] AllocateSalesDataRequest request)
        {
            int companyId = GetCompanyId();
            var salesData = await _context.SalesRecords.FirstOrDefaultAsync(s => s.Id == id && s.TenantCompanyId == companyId);
            if (salesData == null) return NotFound(new { message = "Sales record not found." });

            var employeeExists = await _context.Users.AnyAsync(u => u.Id == request.EmployeeId);
            if (!employeeExists) return BadRequest(new { message = "Invalid Employee." });

            salesData.AllocatedToId = request.EmployeeId;

            await _context.SaveChangesAsync();
            return Ok(new { message = "Sales record allocated successfully." });
        }

        // Full-detail edit of an STS record. Status/pipeline history is intentionally
        // left to the dedicated "Log STS Update" flow — this only touches profile fields.
        [HttpPut("sales/{id:int}")]
        public async Task<IActionResult> UpdateSalesData(int id, [FromBody] UpdateSalesDataRequest request)
        {
            int companyId = GetCompanyId();
            var salesData = await _context.SalesRecords.FirstOrDefaultAsync(s => s.Id == id && s.TenantCompanyId == companyId);
            if (salesData == null) return NotFound(new { message = "Sales record not found." });

            if (string.IsNullOrWhiteSpace(request.CompanyName))
                return BadRequest(new { message = "STS / Company name is required." });

            salesData.CompanyName = request.CompanyName.Trim();
            salesData.ContactPerson = request.ContactPerson ?? string.Empty;
            salesData.Designation = request.Designation ?? string.Empty;
            salesData.CompanyAddress = request.CompanyAddress ?? string.Empty;
            salesData.Address1 = request.Address1 ?? string.Empty;
            salesData.Address2 = request.Address2 ?? string.Empty;
            salesData.PhoneNumber = request.PhoneNumber ?? string.Empty;
            salesData.Mobile1 = request.Mobile1 ?? string.Empty;
            salesData.Mobile2 = request.Mobile2 ?? string.Empty;
            salesData.Fax = request.Fax ?? string.Empty;
            salesData.Website = request.Website ?? string.Empty;
            salesData.Email = request.Email ?? string.Empty;
            salesData.OwnerName = request.OwnerName ?? string.Empty;
            salesData.Pincode = request.Pincode ?? string.Empty;
            salesData.State = request.State ?? string.Empty;
            salesData.CityDistrict = request.CityDistrict ?? string.Empty;
            salesData.Country = string.IsNullOrWhiteSpace(request.Country) ? "India" : request.Country.Trim();
            salesData.LeadBy = request.LeadBy ?? string.Empty;
            salesData.BusinessDescription = request.BusinessDescription ?? string.Empty;
            salesData.OpeningComments = request.OpeningComments ?? string.Empty;
            if (!string.IsNullOrWhiteSpace(request.Priority)) salesData.Priority = request.Priority;
            if (!string.IsNullOrWhiteSpace(request.Source)) salesData.Source = request.Source;

            await _context.SaveChangesAsync();
            return Ok(new { message = "STS record updated successfully." });
        }

        // Allot many STS records to a single employee in one action (STS Assign screen).
        [HttpPut("sales/bulk-allocate")]
        public async Task<IActionResult> BulkAllocateSalesData([FromBody] BulkAllocateSalesDataRequest request)
        {
            int companyId = GetCompanyId();

            if (request.SalesIds == null || request.SalesIds.Count == 0)
                return BadRequest(new { message = "Select at least one STS record to allot." });

            var employee = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.EmployeeId && u.CompanyId == companyId);
            if (employee == null) return BadRequest(new { message = "Invalid employee selected." });

            var distinctIds = request.SalesIds.Distinct().ToList();
            var records = await _context.SalesRecords
                .Where(s => distinctIds.Contains(s.Id) && s.TenantCompanyId == companyId)
                .ToListAsync();

            if (records.Count == 0) return NotFound(new { message = "No matching STS records found." });

            foreach (var record in records)
            {
                record.AllocatedToId = request.EmployeeId;
                if (!string.IsNullOrWhiteSpace(request.AllocatorComment))
                    record.AllocatorComment = request.AllocatorComment;
                record.LastActionDate = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = $"{records.Count} record(s) allotted to {employee.FullName}.", count = records.Count });
        }

        // Reverse of bulk-allocate — free up records so they return to the unassigned pool.
        [HttpPut("sales/bulk-deallocate")]
        public async Task<IActionResult> BulkDeallocateSalesData([FromBody] BulkDeallocateSalesDataRequest request)
        {
            int companyId = GetCompanyId();

            if (request.SalesIds == null || request.SalesIds.Count == 0)
                return BadRequest(new { message = "Select at least one STS record to de-allocate." });

            var distinctIds = request.SalesIds.Distinct().ToList();
            var records = await _context.SalesRecords
                .Where(s => distinctIds.Contains(s.Id) && s.TenantCompanyId == companyId)
                .ToListAsync();

            if (records.Count == 0) return NotFound(new { message = "No matching STS records found." });

            foreach (var record in records)
            {
                record.AllocatedToId = null;
                record.TeleExecutiveId = null;
                record.MarketingExecutiveId = null;
                record.AllocatorComment = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason;
                record.LastActionDate = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = $"{records.Count} record(s) de-allocated.", count = records.Count });
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

            if (!StsPipeline.IsValidStatus(request.Status)) return BadRequest(new { message = "Invalid status." });

            if (string.IsNullOrWhiteSpace(request.Priority)) return BadRequest(new { message = "Priority is required." });
            if (request.CallMeetingDate == null) return BadRequest(new { message = "Call/Meeting date is required." });
            if (string.IsNullOrWhiteSpace(request.Subject)) return BadRequest(new { message = "Subject is required." });
            if (string.IsNullOrWhiteSpace(request.Comment))
            {
                return BadRequest(new { message = "A comment is required to update the status." });
            }
            if (StsPipeline.IsConvertedStatus(request.Status))
            {
                if (string.IsNullOrWhiteSpace(request.ConvertedFor)) return BadRequest(new { message = "Converted For is required for a converted status." });
                if (request.ConvertedPrice == null) return BadRequest(new { message = "Price is required for a converted status." });
            }
            if (request.Status == "OTHER" && string.IsNullOrWhiteSpace(request.OtherStatusText))
            {
                return BadRequest(new { message = "Please describe the custom status." });
            }

            // Admin can log this update on behalf of a specific employee, or under
            // their own identity — default to the admin's own identity.
            int entryEmployeeId = userId;
            bool updatedAsAdmin = true;
            string updatedByName = "Admin";
            string updatedByRole = "Admin";
            if (request.EmployeeId.HasValue && !request.UpdatedAsAdmin)
            {
                var targetEmployee = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.EmployeeId.Value && u.CompanyId == companyId);
                if (targetEmployee == null) return BadRequest(new { message = "Invalid employee selected." });
                entryEmployeeId = targetEmployee.Id;
                updatedAsAdmin = false;
                updatedByName = targetEmployee.FullName;
                updatedByRole = !string.IsNullOrWhiteSpace(targetEmployee.EmployeeRole)
                    ? targetEmployee.EmployeeRole
                    : (!string.IsNullOrWhiteSpace(targetEmployee.Designation) ? targetEmployee.Designation : "Employee");
            }
            else
            {
                var admin = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
                if (admin != null && !string.IsNullOrWhiteSpace(admin.FullName)) updatedByName = admin.FullName;
            }

            var previousStatus = salesData.Status;
            salesData.Status = request.Status;
            salesData.Priority = request.Priority;
            salesData.LastActionDate = DateTime.UtcNow;
            salesData.NextActionDate = request.NextCallMeetingDate;

            string finalSubject = !string.IsNullOrWhiteSpace(request.Subject)
                ? request.Subject
                : EmailService.BuildStsUpdateSubject(new StsUpdateNotificationData
                {
                    UpdatedByName = updatedByName,
                    UpdatedByRole = updatedByRole,
                    CompanyName = salesData.CompanyName,
                    CompanyID = salesData.CompanyID,
                    CityDistrict = salesData.CityDistrict,
                    NewStatus = request.Status,
                    OtherStatusText = request.OtherStatusText
                });

            _context.DsrEntries.Add(new DsrEntry
            {
                TenantCompanyId = companyId,
                SalesDataId = salesData.Id,
                EmployeeId = entryEmployeeId,
                CompanyID = salesData.CompanyID,
                CompanyName = salesData.CompanyName,
                PreviousStatus = previousStatus,
                NewStatus = request.Status,
                Comment = request.Comment,
                Priority = request.Priority,
                CallMeetingDate = request.CallMeetingDate,
                NextCallMeetingDate = request.NextCallMeetingDate,
                CcTo = request.CcTo,
                Subject = finalSubject,
                ConvertedFor = request.ConvertedFor,
                ConvertedPrice = request.ConvertedPrice,
                OtherStatusText = request.OtherStatusText,
                UpdatedAsAdmin = updatedAsAdmin,
                ReportDate = DateTime.UtcNow.Date,
                CreatedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            await StsUpdateNotifier.NotifyAsync(
                _context, _emailService, _logger, companyId, salesData,
                previousStatus, request.Status, request.Priority,
                request.CallMeetingDate, request.NextCallMeetingDate, request.CcTo,
                finalSubject, request.Comment ?? string.Empty, request.OtherStatusText,
                request.ConvertedFor, request.ConvertedPrice,
                updatedByName, updatedByRole
            );

            return Ok(new { message = "Status updated successfully." });
        }

        // --- Daily Sales Report (DSR) ---

        [HttpGet("dsr")]
        public async Task<IActionResult> GetDsrEntries([FromQuery] string? date, [FromQuery] string? dateFrom, [FromQuery] string? dateTo, [FromQuery] int? employeeId, [FromQuery] string? search)
        {
            int companyId = GetCompanyId();
            var queryable = _context.DsrEntries
                .Where(d => d.TenantCompanyId == companyId)
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

            if (employeeId.HasValue)
            {
                queryable = queryable.Where(d => d.EmployeeId == employeeId.Value);
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

        // --- Employee Meetings (Current & Past) ---
        // Mirrors what the employee sees on their own "Current/Past Meetings" pages
        // (Employee/sales, filtered to records with a MeetingScheduledAt) — scoped by
        // Admin to whichever employee they pick, read-only.
        [HttpGet("employees/{employeeId:int}/meetings")]
        public async Task<IActionResult> GetEmployeeMeetings(int employeeId)
        {
            int companyId = GetCompanyId();

            var employeeExists = await _context.Users.AnyAsync(u => u.Id == employeeId && u.CompanyId == companyId);
            if (!employeeExists) return NotFound(new { message = "Employee not found." });

            var meetings = await _context.SalesRecords
                .Where(s => s.TenantCompanyId == companyId && s.AllocatedToId == employeeId && s.MeetingScheduledAt != null)
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
                    s.Priority,
                })
                .OrderByDescending(s => s.MeetingScheduledAt)
                .ToListAsync();

            return Ok(meetings);
        }

        [HttpDelete("sales/{id:int}")]
        public async Task<IActionResult> DeleteSalesData(int id)
        {
            int companyId = GetCompanyId();
            var salesData = await _context.SalesRecords.FirstOrDefaultAsync(s => s.Id == id && s.TenantCompanyId == companyId);
            if (salesData == null) return NotFound(new { message = "Sales record not found." });

            // SiteImage/DsrEntry -> SalesData is Restrict, not Cascade, so the FK would
            // otherwise reject the delete — clear the dependents (and their files) first.
            var siteImages = await _context.SiteImages.Where(si => si.SalesDataId == id).ToListAsync();
            var siteImagesPath = Path.Combine(_env.ContentRootPath, "siteimages");
            foreach (var image in siteImages)
            {
                var filePath = Path.Combine(siteImagesPath, image.FileName);
                try { System.IO.File.Delete(filePath); } catch { /* best-effort cleanup */ }
            }
            _context.SiteImages.RemoveRange(siteImages);

            var dsrEntries = await _context.DsrEntries.Where(d => d.SalesDataId == id).ToListAsync();
            _context.DsrEntries.RemoveRange(dsrEntries);

            var allocationRequests = await _context.StsAllocationRequests.Where(r => r.SalesDataId == id).ToListAsync();
            _context.StsAllocationRequests.RemoveRange(allocationRequests);

            _context.SalesRecords.Remove(salesData);
            await _context.SaveChangesAsync();

            return Ok(new { message = "STS record deleted successfully." });
        }

        // Employee STS Request queue — an employee found a duplicate on Add STS and asked to
        // be allotted it. Admin reviews and either allocates it to them or rejects the ask.
        [HttpGet("sts-requests")]
        public async Task<IActionResult> GetStsRequests([FromQuery] string? status = "Pending")
        {
            int companyId = GetCompanyId();
            var query = _context.StsAllocationRequests.Where(r => r.TenantCompanyId == companyId);
            if (!string.IsNullOrWhiteSpace(status) && status != "All")
            {
                query = query.Where(r => r.Status == status);
            }

            var requests = await query
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => new
                {
                    r.Id,
                    r.Status,
                    r.Comment,
                    r.ReviewComment,
                    r.CreatedAt,
                    r.ReviewedAt,
                    RequestedBy = r.RequestedBy == null ? null : new
                    {
                        r.RequestedBy.Id,
                        r.RequestedBy.FullName,
                        r.RequestedBy.Email,
                        r.RequestedBy.EmployeeRole,
                        r.RequestedBy.EmployeeDept,
                        r.RequestedBy.Designation,
                    },
                    ReviewedBy = r.ReviewedBy == null ? null : new { r.ReviewedBy.Id, r.ReviewedBy.FullName },
                    SalesData = r.SalesData == null ? null : new
                    {
                        r.SalesData.Id,
                        r.SalesData.CompanyID,
                        r.SalesData.CompanyName,
                        r.SalesData.CityDistrict,
                        r.SalesData.Status,
                        r.SalesData.Source,
                        r.SalesData.CreatedAt,
                        AllocatedTo = r.SalesData.AllocatedTo == null ? null : new { r.SalesData.AllocatedTo.Id, r.SalesData.AllocatedTo.FullName },
                    },
                })
                .ToListAsync();

            return Ok(requests);
        }

        [HttpPut("sts-requests/{id:int}/approve")]
        public async Task<IActionResult> ApproveStsRequest(int id)
        {
            var userIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int.TryParse(userIdString, out int adminId);

            int companyId = GetCompanyId();
            var request = await _context.StsAllocationRequests
                .Include(r => r.SalesData)
                .FirstOrDefaultAsync(r => r.Id == id && r.TenantCompanyId == companyId);
            if (request == null) return NotFound(new { message = "Request not found." });
            if (request.Status != "Pending") return BadRequest(new { message = "This request has already been reviewed." });
            if (request.SalesData == null) return NotFound(new { message = "Sales record not found." });

            request.SalesData.AllocatedToId = request.RequestedById;
            request.Status = "Approved";
            request.ReviewedById = adminId;
            request.ReviewedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(new { message = "Request approved — record allocated to the employee." });
        }

        [HttpPut("sts-requests/{id:int}/reject")]
        public async Task<IActionResult> RejectStsRequest(int id, [FromBody] ReviewStsRequestRequest request)
        {
            var userIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int.TryParse(userIdString, out int adminId);

            int companyId = GetCompanyId();
            var stsRequest = await _context.StsAllocationRequests.FirstOrDefaultAsync(r => r.Id == id && r.TenantCompanyId == companyId);
            if (stsRequest == null) return NotFound(new { message = "Request not found." });
            if (stsRequest.Status != "Pending") return BadRequest(new { message = "This request has already been reviewed." });

            stsRequest.Status = "Rejected";
            stsRequest.ReviewComment = request?.Comment;
            stsRequest.ReviewedById = adminId;
            stsRequest.ReviewedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(new { message = "Request rejected." });
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
                    AllocatedTo = s.AllocatedTo != null ? new
                    {
                        s.AllocatedTo.Id,
                        s.AllocatedTo.FullName,
                        s.AllocatedTo.Email,
                        s.AllocatedTo.Department,
                        s.AllocatedTo.EmployeeRole
                    } : null,
                    TeleExecutive = s.TeleExecutive != null ? new { s.TeleExecutive.Id, s.TeleExecutive.FullName } : null,
                    MarketingExecutive = s.MarketingExecutive != null ? new { s.MarketingExecutive.Id, s.MarketingExecutive.FullName } : null,
                })
                .OrderByDescending(s => s.CreatedAt)
                .ToListAsync();

            return Ok(results);
        }

        // Flat feed of every site-visit photo across the company — the frontend groups these
        // by SalesDataId into one gallery card per meeting.
        [HttpGet("site-images")]
        public async Task<IActionResult> GetAllSiteImages()
        {
            int companyId = GetCompanyId();

            var images = await _context.SiteImages
                .Where(si => si.TenantCompanyId == companyId)
                .Include(si => si.SalesData)
                .Include(si => si.UploadedBy)
                .OrderByDescending(si => si.CapturedAt)
                .Select(si => new
                {
                    si.Id,
                    si.SalesDataId,
                    si.UploadMethod,
                    si.CapturedAt,
                    ImageUrl = Request.Scheme + "://" + Request.Host + "/siteimages/" + si.FileName,
                    CompanyName = si.SalesData != null ? si.SalesData.CompanyName : null,
                    CompanyID = si.SalesData != null ? si.SalesData.CompanyID : null,
                    CityDistrict = si.SalesData != null ? si.SalesData.CityDistrict : null,
                    Status = si.SalesData != null ? si.SalesData.Status : null,
                    UploadedBy = si.UploadedBy != null ? new { si.UploadedBy.Id, si.UploadedBy.FullName, si.UploadedBy.Email } : null
                })
                .ToListAsync();

            return Ok(images);
        }
    }

    public class AddEmployeeRequest
    {
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string Department { get; set; } = string.Empty;
        public string EmployeeDept { get; set; } = string.Empty;
        public string Designation { get; set; } = string.Empty;
        public string CityBranch { get; set; } = string.Empty;
        public string FathersName { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string LocalAddress { get; set; } = string.Empty;
        public string PermanentAddress { get; set; } = string.Empty;
        public string ZipCode { get; set; } = string.Empty;
        public string Sex { get; set; } = string.Empty;
        public string Qualification { get; set; } = string.Empty;
        public string MobileNo { get; set; } = string.Empty;
        public string AlternateMobileNo { get; set; } = string.Empty;
        public DateTime? DateOfBirth { get; set; }
        public string Role { get; set; } = "Sales";
        public string EmployeeRole { get; set; } = string.Empty;
        public string Permissions { get; set; } = "[]";
        public DateTime JoiningDate { get; set; } = DateTime.UtcNow;
    }

    public class UpdateEmployeeRequest
    {
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public string Department { get; set; } = string.Empty;
        public string EmployeeDept { get; set; } = string.Empty;
        public string Designation { get; set; } = string.Empty;
        public string CityBranch { get; set; } = string.Empty;
        public string FathersName { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string LocalAddress { get; set; } = string.Empty;
        public string PermanentAddress { get; set; } = string.Empty;
        public string ZipCode { get; set; } = string.Empty;
        public string Sex { get; set; } = string.Empty;
        public string Qualification { get; set; } = string.Empty;
        public string MobileNo { get; set; } = string.Empty;
        public string AlternateMobileNo { get; set; } = string.Empty;
        public DateTime? DateOfBirth { get; set; }
        public string Role { get; set; } = "Sales";
        public string EmployeeRole { get; set; } = string.Empty;
        public string Permissions { get; set; } = "[]";
        public DateTime JoiningDate { get; set; } = DateTime.UtcNow;
    }

    public class ResetPasswordRequest
    {
        public string NewPassword { get; set; } = string.Empty;
    }

    public class AddSalesDataRequest
    {
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
        
        public int? AllocatedToId { get; set; }
        public string LeadBy { get; set; } = string.Empty;
        public string BusinessDescription { get; set; } = string.Empty;
        public string OpeningComments { get; set; } = string.Empty;
        public string Priority { get; set; } = "Highest";
        public string Source { get; set; } = "Yellow Page";
        
        public string Title { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string Description { get; set; } = string.Empty;
        public int EmployeeId { get; set; }
    }

    public class AllocateSalesDataRequest
    {
        public int EmployeeId { get; set; }
    }

    public class BulkAllocateSalesDataRequest
    {
        public int EmployeeId { get; set; }
        public List<int> SalesIds { get; set; } = new();
        public string? AllocatorComment { get; set; }
    }

    public class BulkDeallocateSalesDataRequest
    {
        public List<int> SalesIds { get; set; } = new();
        public string? Reason { get; set; }
    }

    public class UpdateSalesDataRequest
    {
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
        public string LeadBy { get; set; } = string.Empty;
        public string BusinessDescription { get; set; } = string.Empty;
        public string OpeningComments { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public string Source { get; set; } = string.Empty;
    }

    public class UpdatePermissionsRequest
    {
        public string Permissions { get; set; } = "[]";
    }

    public class UpdateSalesStatusRequest
    {
        public string Status { get; set; } = string.Empty;
        public string? Comment { get; set; }
        public string Priority { get; set; } = string.Empty;
        public DateTime? CallMeetingDate { get; set; }
        public DateTime? NextCallMeetingDate { get; set; }
        public string? CcTo { get; set; }
        public string? Subject { get; set; }

        // Required when Status is one of StsPipeline.ConvertedStatuses.
        public string? ConvertedFor { get; set; }
        public decimal? ConvertedPrice { get; set; }

        // Required when Status == "OTHER" — the custom status text.
        public string? OtherStatusText { get; set; }

        // Admin-only: log this update on behalf of a specific employee instead
        // of the logged-in admin. Ignored by the employee-facing endpoint.
        public int? EmployeeId { get; set; }

        // Admin-only: explicitly log the update under the admin's own identity.
        public bool UpdatedAsAdmin { get; set; }
    }

    public class ReviewStsRequestRequest
    {
        public string? Comment { get; set; }
    }
}
