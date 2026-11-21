using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using STS.Data;
using STS.Filters;
using STS.Models;
using STS.Services;

using System.Linq.Expressions;
using System.Security.Claims;

namespace STS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Admin,SubAdmin,SuperAdmin")]
    [RequireActiveSubscription]
    public partial class AdminController : ControllerBase
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
            int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out int currentUserId);
            // The company admin is the first Admin account created for the company (made at company setup).
            int? companyAdminId = await _context.Users
                .Where(u => u.CompanyId == companyId && u.Role == "Admin")
                .OrderBy(u => u.Id)
                .Select(u => (int?)u.Id)
                .FirstOrDefaultAsync();

            var employees = await _context.Users
                // Show every staff member (including founders/managers added later); hide SuperAdmin, the company admin and the logged-in user.
                .Where(u => u.CompanyId == companyId && u.Role != "SuperAdmin" && u.Id != currentUserId && u.Id != companyAdminId)
                .Select(u => new
                {
                    u.Id,
                    u.FullName,
                    u.Email,
                    u.PhoneNumber,
                    u.MobileNo,
                    u.Department,
                    u.EmployeeDept,
                    u.Address,
                    u.Role,
                    u.EmployeeRole,
                    u.Designation,
                    u.CityBranch,
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
                e.MobileNo,
                e.Department,
                e.EmployeeDept,
                e.Address,
                e.Role,
                e.EmployeeRole,
                e.Designation,
                e.CityBranch,
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
                user.BankName,
                user.BankBranch,
                user.AccountHolderName,
                user.AccountNumber,
                user.PanCardNo,
                user.LocalRefName,
                user.LocalRefRelation,
                user.LocalRefContact,
                HasAadhaarDoc = !string.IsNullOrEmpty(user.AadhaarDocPath),
                HasPanDoc = !string.IsNullOrEmpty(user.PanDocPath),
                CompanyName = user.Company?.Name,
                ProfilePictureUrl = profilePictureUrl
            });
        }

        private static readonly string[] AllowedDocExtensions = { ".jpg", ".jpeg", ".png", ".webp", ".pdf" };

        // Aadhaar / PAN scans are sensitive, so they live in a folder that is NOT served statically;
        // they can only be fetched through the authenticated download endpoint below.
        [HttpPost("employees/{id:int}/documents/{docType}")]
        [RequestSizeLimit(MaxImageSizeBytes)]
        public async Task<IActionResult> UploadEmployeeDocument(int id, string docType, IFormFile file)
        {
            docType = docType.ToLowerInvariant();
            if (docType != "aadhaar" && docType != "pan")
                return BadRequest(new { message = "Unknown document type." });
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "No file uploaded." });
            if (file.Length > MaxImageSizeBytes)
                return BadRequest(new { message = "File must be 5 MB or smaller." });

            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!AllowedDocExtensions.Contains(extension))
                return BadRequest(new { message = "Only JPG, PNG, WEBP or PDF files are allowed." });

            int companyId = GetCompanyId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id && u.CompanyId == companyId);
            if (user == null) return NotFound(new { message = "Employee not found." });

            var docsPath = Path.Combine(_env.ContentRootPath, "employeedocs");
            Directory.CreateDirectory(docsPath);

            var newFileName = $"{docType}_{id}_{Guid.NewGuid():N}{extension}";
            using (var stream = new FileStream(Path.Combine(docsPath, newFileName), FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var oldFileName = docType == "aadhaar" ? user.AadhaarDocPath : user.PanDocPath;
            if (docType == "aadhaar") user.AadhaarDocPath = newFileName; else user.PanDocPath = newFileName;
            await _context.SaveChangesAsync();

            if (!string.IsNullOrEmpty(oldFileName))
            {
                var oldPath = Path.Combine(docsPath, oldFileName);
                if (System.IO.File.Exists(oldPath))
                {
                    try { System.IO.File.Delete(oldPath); } catch { /* best-effort cleanup */ }
                }
            }

            return Ok(new { message = "Document uploaded successfully." });
        }

        [HttpGet("employees/{id:int}/documents/{docType}")]
        public async Task<IActionResult> DownloadEmployeeDocument(int id, string docType)
        {
            int companyId = GetCompanyId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id && u.CompanyId == companyId);
            if (user == null) return NotFound(new { message = "Employee not found." });

            var fileName = docType.ToLowerInvariant() switch
            {
                "aadhaar" => user.AadhaarDocPath,
                "pan" => user.PanDocPath,
                _ => null
            };
            if (string.IsNullOrEmpty(fileName)) return NotFound(new { message = "Document not uploaded." });

            var fullPath = Path.Combine(_env.ContentRootPath, "employeedocs", Path.GetFileName(fileName));
            if (!System.IO.File.Exists(fullPath)) return NotFound(new { message = "Document file missing." });

            var contentType = Path.GetExtension(fullPath).ToLowerInvariant() switch
            {
                ".pdf" => "application/pdf",
                ".png" => "image/png",
                ".webp" => "image/webp",
                _ => "image/jpeg"
            };
            return PhysicalFile(fullPath, contentType);
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
                BankName = request.BankName,
                BankBranch = request.BankBranch,
                AccountHolderName = request.AccountHolderName,
                AccountNumber = request.AccountNumber,
                PanCardNo = request.PanCardNo,
                LocalRefName = request.LocalRefName,
                LocalRefRelation = request.LocalRefRelation,
                LocalRefContact = request.LocalRefContact,
                IsActive = true
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            
            // Send welcome email in background (or inline), branded with the
            // employer's own logo rather than a generic one.
            var tenantCompany = await _context.Companies
                .Where(c => c.Id == user.CompanyId)
                .Select(c => new { c.Name, c.LogoUrl })
                .FirstOrDefaultAsync();
            // CC the company's admin(s) so they have a record of the credentials issued.
            var adminEmails = await _context.Users
                .Where(u => u.CompanyId == companyId && u.Role == "Admin" && u.IsActive)
                .Select(u => u.Email)
                .ToListAsync();
            await _emailService.SendWelcomeEmailAsync(
                user.Email, user.FullName, request.Password, tenantCompany?.LogoUrl, tenantCompany?.Name, adminEmails);

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
            user.Address = request.Address;
            // Fields the caller omitted (null) are left untouched rather than blanked out.
            user.CityBranch = request.CityBranch ?? user.CityBranch;
            user.FathersName = request.FathersName ?? user.FathersName;
            user.LocalAddress = request.LocalAddress ?? user.LocalAddress;
            user.PermanentAddress = request.PermanentAddress ?? user.PermanentAddress;
            user.ZipCode = request.ZipCode ?? user.ZipCode;
            user.Sex = request.Sex ?? user.Sex;
            user.Qualification = request.Qualification ?? user.Qualification;
            user.MobileNo = request.MobileNo ?? user.MobileNo;
            user.AlternateMobileNo = request.AlternateMobileNo ?? user.AlternateMobileNo;
            user.DateOfBirth = request.DateOfBirth ?? user.DateOfBirth;
            user.Role = request.Role;
            user.EmployeeRole = request.EmployeeRole;
            user.Permissions = request.Permissions ?? user.Permissions;
            user.BankName = request.BankName ?? user.BankName;
            user.BankBranch = request.BankBranch ?? user.BankBranch;
            user.AccountHolderName = request.AccountHolderName ?? user.AccountHolderName;
            user.AccountNumber = request.AccountNumber ?? user.AccountNumber;
            user.PanCardNo = request.PanCardNo ?? user.PanCardNo;
            user.LocalRefName = request.LocalRefName ?? user.LocalRefName;
            user.LocalRefRelation = request.LocalRefRelation ?? user.LocalRefRelation;
            user.LocalRefContact = request.LocalRefContact ?? user.LocalRefContact;
            user.JoiningDate = request.JoiningDate;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Employee updated successfully." });
        }

        // Permanent delete. Sales records cascade from their owner, so deleting an employee who has any
        // linked data would silently wipe that data (or fail on a foreign key). Block it and point to Disable.
        [HttpDelete("employees/{id:int}")]
        public async Task<IActionResult> DeleteEmployee(int id)
        {
            int companyId = GetCompanyId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id && u.CompanyId == companyId);
            if (user == null)
            {
                return NotFound(new { message = "Employee not found." });
            }

            if (User.FindFirst(ClaimTypes.NameIdentifier)?.Value == id.ToString())
            {
                return BadRequest(new { message = "You cannot delete your own account." });
            }

            if (user.Role == "Admin")
            {
                var adminCount = await _context.Users.CountAsync(u => u.CompanyId == companyId && u.Role == "Admin");
                if (adminCount <= 1)
                {
                    return BadRequest(new { message = "Cannot delete the only admin of the company." });
                }
            }

            var hasLinkedData =
                await _context.SalesRecords.AnyAsync(s => s.EmployeeId == id || s.AllocatedToId == id) ||
                await _context.StsCoAssignees.AnyAsync(a => a.EmployeeId == id) ||
                await _context.DsrEntries.AnyAsync(d => d.EmployeeId == id) ||
                await _context.SiteImages.AnyAsync(si => si.UploadedById == id) ||
                await _context.StsAllocationRequests.AnyAsync(r => r.RequestedById == id || r.ReviewedById == id);
            if (hasLinkedData)
            {
                return BadRequest(new { message = "This employee has STS records or activity history and cannot be deleted. Disable the employee instead." });
            }

            var pictureFile = user.ProfilePicturePath;
            var aadhaarFile = user.AadhaarDocPath;
            var panFile = user.PanDocPath;

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();

            // Best-effort cleanup of the employee's uploaded files.
            void TryDelete(string folder, string? fileName)
            {
                if (string.IsNullOrEmpty(fileName)) return;
                var path = Path.Combine(_env.ContentRootPath, folder, Path.GetFileName(fileName));
                try { if (System.IO.File.Exists(path)) System.IO.File.Delete(path); } catch { }
            }
            TryDelete("profilepics", pictureFile);
            TryDelete("employeedocs", aadhaarFile);
            TryDelete("employeedocs", panFile);

            return Ok(new { message = "Employee deleted successfully." });
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

        // Flat, join-free projection of an STS record. The list can hold tens of thousands of
        // rows, each with many nvarchar(max) columns; joining Users, running per-row DsrEntries
        // subqueries and sorting those wide rows in SQL makes SQL Server request a huge memory
        // grant, and on a memory-constrained server the query sits in RESOURCE_SEMAPHORE until
        // it times out. So rows are pulled flat and the small lookups are stitched in memory.
        private sealed class SalesRow
        {
            public int Id { get; set; }
            public string CompanyID { get; set; } = string.Empty;
            public string CompanyName { get; set; } = string.Empty;
            public string CityDistrict { get; set; } = string.Empty;
            public string Status { get; set; } = string.Empty;
            public string Title { get; set; } = string.Empty;
            public decimal Amount { get; set; }
            public string Description { get; set; } = string.Empty;
            public DateTime CreatedAt { get; set; }
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
            public string Country { get; set; } = string.Empty;
            public string LeadBy { get; set; } = string.Empty;
            public string BusinessDescription { get; set; } = string.Empty;
            public string OpeningComments { get; set; } = string.Empty;
            public string Priority { get; set; } = string.Empty;
            public int EmployeeId { get; set; }
            public int? AllocatedToId { get; set; }
            public int? TeleExecutiveId { get; set; }
            public int? MarketingExecutiveId { get; set; }
            public string? AllocatorComment { get; set; }
            public string Source { get; set; } = string.Empty;
            public DateTime? LastActionDate { get; set; }
            public DateTime? NextActionDate { get; set; }
        }

        private static readonly Expression<Func<SalesData, SalesRow>> ToSalesRow = s => new SalesRow
        {
            Id = s.Id,
            CompanyID = s.CompanyID,
            CompanyName = s.CompanyName,
            CityDistrict = s.CityDistrict,
            Status = s.Status,
            Title = s.Title,
            Amount = s.Amount,
            Description = s.Description,
            CreatedAt = s.CreatedAt,
            ContactPerson = s.ContactPerson,
            Designation = s.Designation,
            CompanyAddress = s.CompanyAddress,
            Address1 = s.Address1,
            Address2 = s.Address2,
            PhoneNumber = s.PhoneNumber,
            Mobile1 = s.Mobile1,
            Mobile2 = s.Mobile2,
            Fax = s.Fax,
            Website = s.Website,
            Email = s.Email,
            OwnerName = s.OwnerName,
            Pincode = s.Pincode,
            State = s.State,
            Country = s.Country,
            LeadBy = s.LeadBy,
            BusinessDescription = s.BusinessDescription,
            OpeningComments = s.OpeningComments,
            Priority = s.Priority,
            EmployeeId = s.EmployeeId,
            AllocatedToId = s.AllocatedToId,
            TeleExecutiveId = s.TeleExecutiveId,
            MarketingExecutiveId = s.MarketingExecutiveId,
            AllocatorComment = s.AllocatorComment,
            Source = s.Source,
            LastActionDate = s.LastActionDate,
            NextActionDate = s.NextActionDate
        };

        // Attaches creator/assignee names and the latest conversion to each row, keeping the
        // order of the rows passed in.
        private async Task<List<object>> ShapeSalesRowsAsync(int companyId, List<SalesRow> records)
        {
            var coAssignees = await StsCoAssignments.LoadAsync(_context, companyId, records.Select(r => r.Id).ToList());

            var userIds = records
                .SelectMany(r => new int?[] { r.EmployeeId, r.AllocatedToId, r.TeleExecutiveId, r.MarketingExecutiveId })
                .Where(id => id.HasValue)
                .Select(id => id!.Value)
                .Concat(coAssignees.Values.SelectMany(ids => ids))
                .Distinct()
                .ToList();

            var users = await _context.Users
                .AsNoTracking()
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.FullName, u.Email, u.Department, u.EmployeeRole })
                .ToDictionaryAsync(u => u.Id);

            // Service taken — read from the most recent converted status update logged
            // against each record; all null until the first conversion.
            var conversions = (await _context.DsrEntries
                    .AsNoTracking()
                    .Where(d => d.TenantCompanyId == companyId && d.ConvertedFor != null)
                    .Select(d => new { d.SalesDataId, d.ConvertedFor, d.ConvertedPrice, d.CreatedAt })
                    .ToListAsync())
                .GroupBy(d => d.SalesDataId)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(d => d.CreatedAt).First());

            return records
                .Select(s =>
                {
                    var employee = users.TryGetValue(s.EmployeeId, out var e) ? e : null;
                    var allocatedTo = s.AllocatedToId.HasValue && users.TryGetValue(s.AllocatedToId.Value, out var a) ? a : null;
                    var tele = s.TeleExecutiveId.HasValue && users.TryGetValue(s.TeleExecutiveId.Value, out var t) ? t : null;
                    var marketing = s.MarketingExecutiveId.HasValue && users.TryGetValue(s.MarketingExecutiveId.Value, out var m) ? m : null;
                    conversions.TryGetValue(s.Id, out var conversion);
                    var coIds = coAssignees.TryGetValue(s.Id, out var ids) ? ids : new List<int>();

                    return (object)new
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
                        Employee = employee != null ? new
                        {
                            employee.Id,
                            employee.FullName,
                            employee.Email,
                            employee.Department
                        } : null,
                        AllocatedTo = allocatedTo != null ? new
                        {
                            allocatedTo.Id,
                            allocatedTo.FullName,
                            allocatedTo.Email,
                            allocatedTo.Department,
                            allocatedTo.EmployeeRole
                        } : null,
                        TeleExecutive = tele != null ? new { tele.Id, tele.FullName } : null,
                        MarketingExecutive = marketing != null ? new { marketing.Id, marketing.FullName } : null,
                        CoAssignees = coIds
                            .Where(users.ContainsKey)
                            .Select(id => users[id])
                            .Select(u => new { u.Id, u.FullName, u.Email, u.Department, u.EmployeeRole })
                            .ToList(),
                        s.AllocatorComment,
                        s.Source,
                        s.LastActionDate,
                        s.NextActionDate,
                        ServiceTaken = conversion?.ConvertedFor,
                        ServicePrice = conversion?.ConvertedPrice,
                        ServiceDate = (DateTime?)conversion?.CreatedAt
                    };
                })
                .ToList();
        }

        // Full, unpaged list. Kept for API compatibility — the admin UI uses sales/query instead,
        // since shipping every record to the browser does not scale.
        [HttpGet("sales")]
        public async Task<IActionResult> GetSalesData()
        {
            int companyId = GetCompanyId();
            var records = await _context.SalesRecords
                .AsNoTracking()
                .Where(s => s.TenantCompanyId == companyId)
                .Select(ToSalesRow)
                .ToListAsync();

            records = records.OrderByDescending(s => s.CreatedAt).ThenByDescending(s => s.Id).ToList();
            return Ok(await ShapeSalesRowsAsync(companyId, records));
        }

        private static IQueryable<SalesData> ApplySalesFilters(IQueryable<SalesData> query, SalesQueryRequest request)
        {
            if (!string.IsNullOrWhiteSpace(request.ProfileType))
            {
                var prefix = request.ProfileType.Trim().ToUpperInvariant() + "-";
                query = query.Where(s => s.CompanyID.StartsWith(prefix));
            }

            // State only narrows the city list; once a city is picked, match on city alone,
            // since many imported records have a city but no state filled in.
            if (!string.IsNullOrWhiteSpace(request.City))
            {
                var city = request.City.Trim();
                query = query.Where(s => s.CityDistrict == city);
            }
            else if (!string.IsNullOrWhiteSpace(request.State))
            {
                var state = request.State.Trim();
                var stateCities = (request.StateCities ?? new List<string>())
                    .Where(c => !string.IsNullOrWhiteSpace(c))
                    .Select(c => c.Trim())
                    .Distinct()
                    .ToList();
                query = stateCities.Count > 0
                    ? query.Where(s => s.State == state || stateCities.Contains(s.CityDistrict))
                    : query.Where(s => s.State == state);
            }

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                var term = request.Search.Trim();
                query = request.SearchContacts
                    ? query.Where(s =>
                        s.CompanyName.Contains(term) ||
                        s.CompanyID.Contains(term) ||
                        s.Email.Contains(term) ||
                        s.Mobile1.Contains(term) ||
                        s.PhoneNumber.Contains(term) ||
                        s.CityDistrict.Contains(term) ||
                        s.ContactPerson.Contains(term))
                    : query.Where(s =>
                        s.CompanyName.Contains(term) ||
                        s.CompanyID.Contains(term) ||
                        (s.Employee != null && (s.Employee.FullName.Contains(term) || s.Employee.Email.Contains(term))));
            }

            return query;
        }

        // Server-side filtered + paged STS list. Only the requested page leaves the database;
        // `All = true` returns every match (used by CSV export).
        [HttpPost("sales/query")]
        public async Task<IActionResult> QuerySalesData([FromBody] SalesQueryRequest request)
        {
            int companyId = GetCompanyId();
            var baseQuery = _context.SalesRecords.AsNoTracking().Where(s => s.TenantCompanyId == companyId);
            var filtered = ApplySalesFilters(baseQuery, request);

            if (request.All)
            {
                var all = await filtered.Select(ToSalesRow).ToListAsync();
                all = all.OrderByDescending(s => s.CreatedAt).ThenByDescending(s => s.Id).ToList();
                return Ok(new { items = await ShapeSalesRowsAsync(companyId, all), total = all.Count });
            }

            var pageSize = Math.Clamp(request.PageSize, 1, 200);
            var total = await filtered.CountAsync();
            var grandTotal = request.HasFilters ? await baseQuery.CountAsync() : total;
            var totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize));
            var page = Math.Clamp(request.Page, 1, totalPages);

            // Sort and page on the narrow (Id, CreatedAt) pair only, then fetch the wide rows
            // for just that page — keeps the sort's memory grant tiny.
            var pageIds = await filtered
                .OrderByDescending(s => s.CreatedAt)
                .ThenByDescending(s => s.Id)
                .Select(s => s.Id)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var rows = await _context.SalesRecords
                .AsNoTracking()
                .Where(s => pageIds.Contains(s.Id))
                .Select(ToSalesRow)
                .ToListAsync();
            var position = pageIds.Select((id, index) => (id, index)).ToDictionary(x => x.id, x => x.index);
            rows = rows.OrderBy(r => position[r.Id]).ToList();

            return Ok(new
            {
                items = await ShapeSalesRowsAsync(companyId, rows),
                total,
                grandTotal,
                page,
                pageSize
            });
        }

        // Headline numbers for the admin dashboard, computed in SQL.
        [HttpGet("sales/stats")]
        public async Task<IActionResult> GetSalesStats()
        {
            int companyId = GetCompanyId();
            var query = _context.SalesRecords.Where(s => s.TenantCompanyId == companyId);
            var totalRecords = await query.CountAsync();
            // Revenue = price logged on every converted status update — the same definition
            // Employee Analytics uses, so the two screens agree. SalesData.Amount is not
            // filled in by the conversion flow, which left this card stuck at 0.
            // Grouped by status in SQL; the "is it a conversion" check runs in memory
            // because SQL Server rejects the IN-subquery EF emits inside an aggregate.
            var totalAmount = (await _context.DsrEntries
                    .AsNoTracking()
                    .Where(d => d.TenantCompanyId == companyId && d.ConvertedPrice != null)
                    .GroupBy(d => d.NewStatus)
                    .Select(g => new { Status = g.Key, Revenue = g.Sum(d => d.ConvertedPrice) })
                    .ToListAsync())
                .Where(x => StsPipeline.IsConvertedStatus(x.Status))
                .Sum(x => x.Revenue ?? 0m);
            return Ok(new { totalRecords, totalAmount });
        }

        // Slim rows for the bulk Assign / De-Assign pickers — just what they display and search on.
        [HttpGet("sales/lite")]
        public async Task<IActionResult> GetSalesLite([FromQuery] bool? allocated)
        {
            int companyId = GetCompanyId();
            var query = _context.SalesRecords.AsNoTracking().Where(s => s.TenantCompanyId == companyId);
            if (allocated == true)
                query = query.Where(s => s.AllocatedToId != null || s.TeleExecutiveId != null || s.MarketingExecutiveId != null
                    || _context.StsCoAssignees.Any(a => a.SalesDataId == s.Id));
            else if (allocated == false)
                query = query.Where(s => s.AllocatedToId == null && s.TeleExecutiveId == null && s.MarketingExecutiveId == null
                    && !_context.StsCoAssignees.Any(a => a.SalesDataId == s.Id));

            var records = await query
                .Select(s => new
                {
                    s.Id,
                    s.CompanyID,
                    s.CompanyName,
                    s.CityDistrict,
                    s.Status,
                    s.Email,
                    s.Mobile1,
                    s.CreatedAt,
                    s.AllocatedToId,
                    s.TeleExecutiveId,
                    s.MarketingExecutiveId
                })
                .ToListAsync();

            var coAssignees = await StsCoAssignments.LoadAsync(_context, companyId, records.Select(r => r.Id).ToList());

            var userIds = records
                .SelectMany(r => new int?[] { r.AllocatedToId, r.TeleExecutiveId, r.MarketingExecutiveId })
                .Where(id => id.HasValue)
                .Select(id => id!.Value)
                .Concat(coAssignees.Values.SelectMany(ids => ids))
                .Distinct()
                .ToList();
            var users = await _context.Users
                .AsNoTracking()
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.FullName })
                .ToDictionaryAsync(u => u.Id);

            var result = records
                .OrderByDescending(r => r.CreatedAt)
                .ThenByDescending(r => r.Id)
                .Select(r => new
                {
                    r.Id,
                    r.CompanyID,
                    r.CompanyName,
                    r.CityDistrict,
                    r.Status,
                    r.Email,
                    r.Mobile1,
                    r.CreatedAt, // drives the "STS Created Date" filter in the Assign / De-Assign pickers
                    AllocatedTo = r.AllocatedToId.HasValue && users.TryGetValue(r.AllocatedToId.Value, out var a) ? a : null,
                    TeleExecutive = r.TeleExecutiveId.HasValue && users.TryGetValue(r.TeleExecutiveId.Value, out var t) ? t : null,
                    MarketingExecutive = r.MarketingExecutiveId.HasValue && users.TryGetValue(r.MarketingExecutiveId.Value, out var m) ? m : null,
                    CoAssignees = coAssignees.TryGetValue(r.Id, out var coIds)
                        ? coIds.Where(users.ContainsKey).Select(id => users[id]).ToList()
                        : null
                });

            return Ok(result);
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
                    CoAssignees = _context.StsCoAssignees
                        .Where(a => a.SalesDataId == s.Id)
                        .OrderBy(a => a.Id)
                        .Select(a => new { a.Employee!.Id, a.Employee.FullName, a.Employee.Email, a.Employee.Department, a.Employee.EmployeeRole })
                        .ToList(),
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
                CompanyID = StsPipeline.NewProfileId(),
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
                var newId = StsPipeline.NewProfileId();
                
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
            _context.StsCoAssignees.RemoveRange(await _context.StsCoAssignees
                .Where(a => a.SalesDataId == id && a.EmployeeId == request.EmployeeId)
                .ToListAsync());

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

            // "Select all" can send thousands of ids, so update set-based in chunks (keeps each
            // statement under SQL Server's parameter limit) instead of loading every row.
            // Unowned records get the employee as their holder; records someone else already
            // holds keep that holder and gain the employee as a co-assignee, so both keep it.
            var distinctIds = request.SalesIds.Distinct().ToList();
            var now = DateTime.UtcNow;
            var comment = string.IsNullOrWhiteSpace(request.AllocatorComment) ? null : request.AllocatorComment;
            var employeeId = request.EmployeeId;
            int allotted = 0, shared = 0;

            await using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                foreach (var chunk in distinctIds.Chunk(BulkUpdateChunkSize))
                {
                    var inChunk = _context.SalesRecords.Where(s => chunk.Contains(s.Id) && s.TenantCompanyId == companyId);

                    var shareIds = await inChunk
                        .Where(s => s.AllocatedToId != null && s.AllocatedToId != employeeId
                            && !_context.StsCoAssignees.Any(a => a.SalesDataId == s.Id && a.EmployeeId == employeeId))
                        .Select(s => s.Id)
                        .ToListAsync();
                    if (shareIds.Count > 0)
                    {
                        _context.StsCoAssignees.AddRange(shareIds.Select(id => new StsCoAssignee
                        {
                            TenantCompanyId = companyId,
                            SalesDataId = id,
                            EmployeeId = employeeId,
                            AllocatorComment = comment,
                            AssignedAt = now
                        }));
                        await _context.SaveChangesAsync();
                        await _context.SalesRecords
                            .Where(s => shareIds.Contains(s.Id))
                            .ExecuteUpdateAsync(x => x.SetProperty(s => s.LastActionDate, (DateTime?)now));
                        shared += shareIds.Count;
                    }

                    var unowned = inChunk.Where(s => s.AllocatedToId == null
                        && !_context.StsCoAssignees.Any(a => a.SalesDataId == s.Id && a.EmployeeId == employeeId));
                    allotted += comment != null
                        ? await unowned.ExecuteUpdateAsync(x => x
                            .SetProperty(s => s.AllocatedToId, (int?)employeeId)
                            .SetProperty(s => s.AllocatorComment, comment)
                            .SetProperty(s => s.LastActionDate, (DateTime?)now))
                        : await unowned.ExecuteUpdateAsync(x => x
                            .SetProperty(s => s.AllocatedToId, (int?)employeeId)
                            .SetProperty(s => s.LastActionDate, (DateTime?)now));
                }
                await transaction.CommitAsync();
            }

            var count = allotted + shared;
            if (count == 0) return BadRequest(new { message = $"{employee.FullName} already has all the selected records." });

            var skipped = distinctIds.Count - count;
            var message = $"{count} record(s) allotted to {employee.FullName}";
            if (shared > 0) message += $" ({shared} shared with their current holder)";
            if (skipped > 0) message += $"; {skipped} skipped (already theirs)";
            return Ok(new { message = message + ".", count, shared, skipped });
        }

        private const int BulkUpdateChunkSize = 1000;

        // Reverse of bulk-allocate — free up records so they return to the unassigned pool.
        [HttpPut("sales/bulk-deallocate")]
        public async Task<IActionResult> BulkDeallocateSalesData([FromBody] BulkDeallocateSalesDataRequest request)
        {
            int companyId = GetCompanyId();

            if (request.SalesIds == null || request.SalesIds.Count == 0)
                return BadRequest(new { message = "Select at least one STS record to de-allocate." });

            var distinctIds = request.SalesIds.Distinct().ToList();
            var now = DateTime.UtcNow;
            var reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason;
            var employeeIds = (request.EmployeeIds ?? new List<int>()).Distinct().ToList();
            int count = 0;

            await using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                foreach (var chunk in distinctIds.Chunk(BulkUpdateChunkSize))
                {
                    var inChunk = _context.SalesRecords.Where(s => chunk.Contains(s.Id) && s.TenantCompanyId == companyId);

                    if (employeeIds.Count == 0)
                    {
                        await _context.StsCoAssignees
                            .Where(a => chunk.Contains(a.SalesDataId) && a.TenantCompanyId == companyId)
                            .ExecuteDeleteAsync();
                        count += await inChunk.ExecuteUpdateAsync(x => x
                            .SetProperty(s => s.AllocatedToId, (int?)null)
                            .SetProperty(s => s.TeleExecutiveId, (int?)null)
                            .SetProperty(s => s.MarketingExecutiveId, (int?)null)
                            .SetProperty(s => s.AllocatorComment, reason)
                            .SetProperty(s => s.LastActionDate, (DateTime?)now));
                        continue;
                    }

                    // Records that lose at least one of the chosen employees.
                    var touched = await inChunk
                        .Where(s => (s.AllocatedToId != null && employeeIds.Contains(s.AllocatedToId.Value))
                            || (s.TeleExecutiveId != null && employeeIds.Contains(s.TeleExecutiveId.Value))
                            || (s.MarketingExecutiveId != null && employeeIds.Contains(s.MarketingExecutiveId.Value))
                            || _context.StsCoAssignees.Any(a => a.SalesDataId == s.Id && employeeIds.Contains(a.EmployeeId)))
                        .Select(s => s.Id)
                        .ToListAsync();
                    if (touched.Count == 0) continue;

                    await _context.StsCoAssignees
                        .Where(a => touched.Contains(a.SalesDataId) && employeeIds.Contains(a.EmployeeId))
                        .ExecuteDeleteAsync();

                    // A removed primary holder hands the record to its oldest remaining co-assignee
                    // (null if none), and that co-assignee row is then dropped as redundant.
                    await _context.SalesRecords
                        .Where(s => touched.Contains(s.Id) && s.AllocatedToId != null && employeeIds.Contains(s.AllocatedToId.Value))
                        .ExecuteUpdateAsync(x => x.SetProperty(
                            s => s.AllocatedToId,
                            s => _context.StsCoAssignees
                                .Where(a => a.SalesDataId == s.Id)
                                .OrderBy(a => a.Id)
                                .Select(a => (int?)a.EmployeeId)
                                .FirstOrDefault()));
                    await _context.StsCoAssignees
                        .Where(a => touched.Contains(a.SalesDataId)
                            && _context.SalesRecords.Any(s => s.Id == a.SalesDataId && s.AllocatedToId == a.EmployeeId))
                        .ExecuteDeleteAsync();

                    await _context.SalesRecords
                        .Where(s => touched.Contains(s.Id) && s.TeleExecutiveId != null && employeeIds.Contains(s.TeleExecutiveId.Value))
                        .ExecuteUpdateAsync(x => x.SetProperty(s => s.TeleExecutiveId, (int?)null));
                    await _context.SalesRecords
                        .Where(s => touched.Contains(s.Id) && s.MarketingExecutiveId != null && employeeIds.Contains(s.MarketingExecutiveId.Value))
                        .ExecuteUpdateAsync(x => x.SetProperty(s => s.MarketingExecutiveId, (int?)null));

                    // Other holders may still be working these, so keep their allotment comment
                    // unless a reason was given.
                    var touchedRecords = _context.SalesRecords.Where(s => touched.Contains(s.Id));
                    count += reason != null
                        ? await touchedRecords.ExecuteUpdateAsync(x => x
                            .SetProperty(s => s.AllocatorComment, reason)
                            .SetProperty(s => s.LastActionDate, (DateTime?)now))
                        : await touchedRecords.ExecuteUpdateAsync(x => x
                            .SetProperty(s => s.LastActionDate, (DateTime?)now));
                }
                await transaction.CommitAsync();
            }

            if (count == 0) return NotFound(new { message = "No matching STS records found." });
            return Ok(new { message = $"{count} record(s) de-allocated.", count });
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
            string updatedByRole = User.FindFirst(ClaimTypes.Role)?.Value == "SubAdmin" ? "Sub-Admin" : "Admin";
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

            // A record is promoted from a New Contact (NC-) to an Existing Contact (EC-) only when
            // it is converted (a service is taken) — not on its first status update. The suffix is kept.
            // Older DSR lines are restamped so history stays searchable by the new ID.
            var promotedProfileId = StsPipeline.IsConvertedStatus(request.Status)
                ? StsPipeline.PromoteProfileId(salesData.CompanyID)
                : null;
            if (promotedProfileId != null)
            {
                var previousProfileId = salesData.CompanyID;
                salesData.CompanyID = promotedProfileId;
                await _context.DsrEntries
                    .Where(d => d.SalesDataId == salesData.Id && d.CompanyID == previousProfileId)
                    .ExecuteUpdateAsync(setters => setters.SetProperty(d => d.CompanyID, promotedProfileId));
            }

            var previousStatus = salesData.Status;
            salesData.Status = request.Status;
            salesData.Priority = request.Priority;
            salesData.LastActionDate = DateTime.UtcNow;
            salesData.NextActionDate = request.NextCallMeetingDate;
            // The meeting is fixed by the Call/Meeting date picked on this update: it drops into
            // Current/Past Meetings on that day. Stored at noon UTC so the calendar day is the same
            // in every timezone the team works from.
            salesData.MeetingScheduledAt = DateTime.SpecifyKind(request.CallMeetingDate!.Value.Date.AddHours(12), DateTimeKind.Utc);

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
                .Where(s => s.TenantCompanyId == companyId && s.MeetingScheduledAt != null
                    && (s.AllocatedToId == employeeId || _context.StsCoAssignees.Any(a => a.SalesDataId == s.Id && a.EmployeeId == employeeId)))
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

            var coAssignees = await _context.StsCoAssignees.Where(a => a.SalesDataId == id).ToListAsync();
            _context.StsCoAssignees.RemoveRange(coAssignees);

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
            // They now hold it directly, so any co-assignment of theirs is redundant.
            _context.StsCoAssignees.RemoveRange(await _context.StsCoAssignees
                .Where(a => a.SalesDataId == request.SalesDataId && a.EmployeeId == request.RequestedById)
                .ToListAsync());
            request.Status = "Approved";
            request.ReviewedById = adminId;
            request.ReviewedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            await StsRequestNotifier.NotifyAsync(_context, _emailService, HttpContext.RequestServices.GetRequiredService<Microsoft.Extensions.Configuration.IConfiguration>(), _logger, request.Id, StsRequestNotifier.Kind.Approved);
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

            await StsRequestNotifier.NotifyAsync(_context, _emailService, HttpContext.RequestServices.GetRequiredService<Microsoft.Extensions.Configuration.IConfiguration>(), _logger, stsRequest.Id, StsRequestNotifier.Kind.Rejected);
            return Ok(new { message = "Request rejected." });
        }

        private const int MaxSearchResults = 200;

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
                // A one-letter query can match nearly every record; cap it to the newest matches.
                .Take(MaxSearchResults)
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
        public string BankName { get; set; } = string.Empty;
        public string BankBranch { get; set; } = string.Empty;
        public string AccountHolderName { get; set; } = string.Empty;
        public string AccountNumber { get; set; } = string.Empty;
        public string PanCardNo { get; set; } = string.Empty;
        public string LocalRefName { get; set; } = string.Empty;
        public string LocalRefRelation { get; set; } = string.Empty;
        public string LocalRefContact { get; set; } = string.Empty;
    }

    public class UpdateEmployeeRequest
    {
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public string Department { get; set; } = string.Empty;
        public string EmployeeDept { get; set; } = string.Empty;
        public string Designation { get; set; } = string.Empty;
        public string? CityBranch { get; set; }
        public string? FathersName { get; set; }
        public string Address { get; set; } = string.Empty;
        public string? LocalAddress { get; set; }
        public string? PermanentAddress { get; set; }
        public string? ZipCode { get; set; }
        public string? Sex { get; set; }
        public string? Qualification { get; set; }
        public string? MobileNo { get; set; }
        public string? AlternateMobileNo { get; set; }
        public DateTime? DateOfBirth { get; set; }
        public string Role { get; set; } = "Sales";
        public string EmployeeRole { get; set; } = string.Empty;
        public string? Permissions { get; set; }
        public DateTime JoiningDate { get; set; } = DateTime.UtcNow;
        public string? BankName { get; set; }
        public string? BankBranch { get; set; }
        public string? AccountHolderName { get; set; }
        public string? AccountNumber { get; set; }
        public string? PanCardNo { get; set; }
        public string? LocalRefName { get; set; }
        public string? LocalRefRelation { get; set; }
        public string? LocalRefContact { get; set; }
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

    public class SalesQueryRequest
    {
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 25;
        public string? Search { get; set; }
        // Profile ID prefix, e.g. "NC" or "EC".
        public string? ProfileType { get; set; }
        public string? State { get; set; }
        // Cities of the selected state (the client owns the state→city list), so records with a
        // city but no state still match a state filter.
        public List<string>? StateCities { get; set; }
        public string? City { get; set; }
        // Search the record's contact fields (email, mobile, phone, city, contact person)
        // instead of the creating employee.
        public bool SearchContacts { get; set; }
        // Return every match instead of one page (CSV export).
        public bool All { get; set; }

        public bool HasFilters =>
            !string.IsNullOrWhiteSpace(Search) || !string.IsNullOrWhiteSpace(ProfileType) ||
            !string.IsNullOrWhiteSpace(State) || !string.IsNullOrWhiteSpace(City);
    }

    public class BulkDeallocateSalesDataRequest
    {
        public List<int> SalesIds { get; set; } = new();
        public string? Reason { get; set; }
        // When set, only these employees are taken off the records and any other holders
        // keep them. When empty, every holder is removed and the records go back to the pool.
        public List<int>? EmployeeIds { get; set; }
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
