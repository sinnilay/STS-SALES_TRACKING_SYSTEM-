using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using STS.Data;
using STS.Models;
using STS.Services;

namespace STS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "SuperAdmin")]
    public class SuperAdminController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IAuthService _authService;

        public SuperAdminController(AppDbContext context, IAuthService authService)
        {
            _context = context;
            _authService = authService;
        }

        [HttpGet("companies")]
        public async Task<ActionResult<IEnumerable<Company>>> GetCompanies()
        {
            return await _context.Companies.ToListAsync();
        }

        [HttpPost("companies")]
        public async Task<ActionResult<Company>> CreateCompany([FromBody] CreateCompanyRequestDto request)
        {
            // Validate Admin Email uniqueness before anything else
            if (!string.IsNullOrWhiteSpace(request.AdminEmail))
            {
                var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.AdminEmail);
                if (existingUser != null)
                {
                    return BadRequest(new { message = "The provided Admin Email is already in use by another account." });
                }
            }

            bool isTrialMode = request.AccountType == "Trial" || request.IsTrial;
            string accType = isTrialMode ? "Trial" : "Permanent";
            DateTime subExpiry = isTrialMode ? DateTime.UtcNow.AddDays(7) : (request.SubscriptionExpiry != default ? request.SubscriptionExpiry : DateTime.UtcNow.AddYears(1));

            var company = new Company
            {
                Name = request.Name,
                OwnerEmail = request.OwnerEmail,
                OwnerContact = request.OwnerContact,
                City = request.City,
                State = request.State,
                Country = request.Country,
                Address = request.Address,
                ZipCode = request.ZipCode,
                TaxId = request.TaxId,
                Website = request.Website,
                Industry = request.Industry,
                StaffLimit = request.StaffLimit,
                SubscriptionExpiry = subExpiry,
                IsTrial = isTrialMode,
                AccountType = accType,
                TrialEndDate = isTrialMode ? DateTime.UtcNow.AddDays(7) : null,
                IsActive = request.IsActive
            };

            _context.Companies.Add(company);
            await _context.SaveChangesAsync();

            // Create Admin User
            if (!string.IsNullOrWhiteSpace(request.AdminEmail) && !string.IsNullOrWhiteSpace(request.AdminPassword))
            {
                var adminUser = new User
                {
                    FullName = request.Name + " Admin",
                    Email = request.AdminEmail,
                    Role = "Admin",
                    CompanyId = company.Id,
                    PasswordHash = _authService.HashPassword(request.AdminPassword),
                    IsActive = true
                };
                _context.Users.Add(adminUser);
                await _context.SaveChangesAsync();
            }

            return CreatedAtAction(nameof(GetCompanies), new { id = company.Id }, company);
        }

        [HttpGet("companies/{id}")]
        public async Task<ActionResult<Company>> GetCompany(int id)
        {
            var company = await _context.Companies.FindAsync(id);
            if (company == null) return NotFound();
            return company;
        }

        [HttpPut("companies/{id}")]
        public async Task<IActionResult> UpdateCompany(int id, Company company)
        {
            if (id != company.Id) return BadRequest();

            _context.Entry(company).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!CompanyExists(id)) return NotFound();
                else throw;
            }

            return NoContent();
        }
        
        [HttpPost("companies/{companyId}/admin")]
        public async Task<ActionResult<User>> CreateCompanyAdmin(int companyId, [FromBody] AdminCreationDto dto)
        {
            var company = await _context.Companies.FindAsync(companyId);
            if (company == null) return NotFound("Company not found");
            
            var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);
            if(existingUser != null) return BadRequest("Email already in use");

            var admin = new User
            {
                FullName = dto.FullName,
                Email = dto.Email,
                Role = "Admin", // Company Admin
                CompanyId = companyId,
                PasswordHash = _authService.HashPassword(dto.Password),
                IsActive = true
            };
            
            _context.Users.Add(admin);
            await _context.SaveChangesAsync();
            
            return Ok(new { admin.Id, admin.Email, admin.FullName });
        }

        [HttpPut("companies/{id}/modules")]
        public async Task<IActionResult> UpdateCompanyModules(int id, [FromBody] UpdateCompanyModulesDto dto)
        {
            var company = await _context.Companies.FindAsync(id);
            if (company == null) return NotFound(new { message = "Company not found" });

            company.EnabledModules = dto.EnabledModules ?? "STS";
            await _context.SaveChangesAsync();

            return Ok(company);
        }

        [HttpPost("companies/{id}/renew")]
        public async Task<IActionResult> RenewSubscription(int id, [FromBody] RenewSubscriptionDto dto)
        {
            if (dto.Months <= 0)
            {
                return BadRequest(new { message = "Months must be a positive number." });
            }

            var company = await _context.Companies.FindAsync(id);
            if (company == null) return NotFound(new { message = "Company not found" });

            // Extend from the current expiry if it's still in the future, otherwise from today.
            var baseDate = company.SubscriptionExpiry > DateTime.UtcNow ? company.SubscriptionExpiry : DateTime.UtcNow;
            company.SubscriptionExpiry = baseDate.AddMonths(dto.Months);
            company.IsActive = true;

            // Renewing a trial converts it into a paid, permanent account.
            if (company.IsTrial || company.AccountType == "Trial")
            {
                company.IsTrial = false;
                company.AccountType = "Permanent";
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"Subscription renewed for {dto.Months} month(s).",
                company.Id,
                company.Name,
                company.AccountType,
                company.IsTrial,
                company.SubscriptionExpiry,
                company.IsActive
            });
        }

        [HttpPut("companies/{id}/status")]
        public async Task<IActionResult> UpdateCompanyStatus(int id, [FromBody] UpdateCompanyStatusDto dto)
        {
            var company = await _context.Companies.FindAsync(id);
            if (company == null) return NotFound(new { message = "Company not found" });

            company.IsActive = dto.IsActive;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = dto.IsActive
                    ? $"{company.Name} has been activated."
                    : $"{company.Name} has been suspended.",
                company.Id,
                company.IsActive
            });
        }

        [HttpGet("trial-requests")]
        public async Task<ActionResult<IEnumerable<TrialRequest>>> GetTrialRequests()
        {
            return await _context.TrialRequests
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();
        }

        [HttpPost("trial-requests/{id}/approve")]
        public async Task<IActionResult> ApproveTrialRequest(int id)
        {
            var req = await _context.TrialRequests.FindAsync(id);
            if (req == null) return NotFound(new { message = "Trial request not found." });

            if (req.Status == "Approved")
                return BadRequest(new { message = "This trial request has already been approved." });

            // Check if user already exists
            var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == req.OwnerEmail);
            if (existingUser != null)
            {
                return BadRequest(new { message = "An account with this email already exists." });
            }

            // Create Company as 7-Day Free Trial
            var company = new Company
            {
                Name = req.CompanyName,
                OwnerEmail = req.OwnerEmail,
                OwnerContact = req.OwnerContact,
                City = req.City,
                State = req.State,
                Country = req.Country,
                Industry = req.Industry,
                StaffLimit = req.StaffLimit > 0 ? req.StaffLimit : 10,
                IsTrial = true,
                AccountType = "Trial",
                TrialEndDate = DateTime.UtcNow.AddDays(7),
                SubscriptionExpiry = DateTime.UtcNow.AddDays(7),
                IsActive = true,
                EnabledModules = "STS",
                CreatedAt = DateTime.UtcNow
            };

            _context.Companies.Add(company);
            await _context.SaveChangesAsync();

            // Create Primary Admin User
            var adminUser = new User
            {
                FullName = string.IsNullOrWhiteSpace(req.OwnerName) ? req.CompanyName + " Admin" : req.OwnerName,
                Email = req.OwnerEmail,
                Role = "Admin",
                CompanyId = company.Id,
                PasswordHash = req.AdminPasswordHash,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            _context.Users.Add(adminUser);

            // Update Trial Request status
            req.Status = "Approved";
            req.ProcessedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Trial request approved successfully! 7-Day Free Trial property provisioned and Admin account created.",
                companyId = company.Id,
                companyName = company.Name,
                adminEmail = adminUser.Email
            });
        }

        [HttpPost("trial-requests/{id}/reject")]
        public async Task<IActionResult> RejectTrialRequest(int id, [FromBody] RejectTrialRequestDto dto)
        {
            var req = await _context.TrialRequests.FindAsync(id);
            if (req == null) return NotFound(new { message = "Trial request not found." });

            req.Status = "Rejected";
            req.RejectionReason = dto.Reason ?? "Not specified";
            req.ProcessedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Trial request rejected successfully." });
        }

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            var totalTenants = await _context.Companies.CountAsync();
            var activeTrials = await _context.Companies.CountAsync(c => c.IsTrial && c.SubscriptionExpiry > DateTime.UtcNow);
            var pendingRequests = await _context.TrialRequests.CountAsync(r => r.Status == "Pending");
            var expiringSoon = await _context.Companies.CountAsync(c => c.SubscriptionExpiry <= DateTime.UtcNow.AddDays(15));

            return Ok(new
            {
                totalTenants,
                activeTrials,
                pendingRequests,
                expiringSoon
            });
        }

        private bool CompanyExists(int id)
        {
            return _context.Companies.Any(e => e.Id == id);
        }
    }

    public class RejectTrialRequestDto
    {
        public string? Reason { get; set; }
    }

    public class UpdateCompanyModulesDto
    {
        public string EnabledModules { get; set; } = "STS";
    }

    public class RenewSubscriptionDto
    {
        public int Months { get; set; }
    }

    public class UpdateCompanyStatusDto
    {
        public bool IsActive { get; set; }
    }
    
    public class AdminCreationDto
    {
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class CreateCompanyRequestDto
    {
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
        
        public int StaffLimit { get; set; } = 10;
        public DateTime SubscriptionExpiry { get; set; }
        public bool IsTrial { get; set; }
        public string AccountType { get; set; } = "Permanent"; // "Trial" or "Permanent"
        public bool IsActive { get; set; } = true;

        public string AdminEmail { get; set; } = string.Empty;
        public string AdminPassword { get; set; } = string.Empty;
    }
}
