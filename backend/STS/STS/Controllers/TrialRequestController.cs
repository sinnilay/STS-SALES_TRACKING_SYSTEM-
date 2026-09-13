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
    public class TrialRequestController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IAuthService _authService;
        private readonly IEmailService _emailService;

        public TrialRequestController(AppDbContext context, IAuthService authService, IEmailService emailService)
        {
            _context = context;
            _authService = authService;
            _emailService = emailService;
        }

        // Public endpoint for potential clients to request a 7-day free trial
        [HttpPost("request")]
        [AllowAnonymous]
        public async Task<IActionResult> SubmitTrialRequest([FromBody] SubmitTrialRequestDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            // Check if OwnerEmail already exists in Users
            var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == dto.OwnerEmail.ToLower().Trim());
            if (existingUser != null)
            {
                return BadRequest(new { message = "An account with this email already exists." });
            }

            // Check if CompanyName already exists in Companies
            var existingCompany = await _context.Companies.FirstOrDefaultAsync(c => c.Name.ToLower() == dto.CompanyName.ToLower().Trim());
            if (existingCompany != null)
            {
                return BadRequest(new { message = "A property/company with this name is already registered." });
            }

            // Check if there is already a pending trial request for this email
            var pendingReq = await _context.TrialRequests.FirstOrDefaultAsync(r => r.OwnerEmail.ToLower() == dto.OwnerEmail.ToLower().Trim() && r.Status == "Pending");
            if (pendingReq != null)
            {
                return BadRequest(new { message = "A trial request for this email address is already pending approval." });
            }

            var request = new TrialRequest
            {
                CompanyName = dto.CompanyName.Trim(),
                OwnerName = dto.OwnerName.Trim(),
                OwnerEmail = dto.OwnerEmail.Trim(),
                OwnerContact = dto.OwnerContact.Trim(),
                City = dto.City.Trim(),
                State = dto.State.Trim(),
                Country = string.IsNullOrWhiteSpace(dto.Country) ? "India" : dto.Country.Trim(),
                Industry = dto.Industry?.Trim() ?? string.Empty,
                StaffLimit = dto.StaffLimit > 0 ? dto.StaffLimit : 10,
                AdminPasswordHash = _authService.HashPassword(dto.AdminPassword),
                Status = "Pending",
                CreatedAt = DateTime.UtcNow
            };

            _context.TrialRequests.Add(request);
            await _context.SaveChangesAsync();

            // Notify Super Admin so the trial request can be reviewed and approved
            await _emailService.SendTrialRequestNotificationAsync(request);

            return Ok(new
            {
                message = "Your 7-Day Free Trial request has been submitted successfully! Super Administrator will review and approve your request shortly.",
                requestId = request.Id
            });
        }
    }

    public class SubmitTrialRequestDto
    {
        public string CompanyName { get; set; } = string.Empty;
        public string OwnerName { get; set; } = string.Empty;
        public string OwnerEmail { get; set; } = string.Empty;
        public string OwnerContact { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public string Country { get; set; } = "India";
        public string? Industry { get; set; }
        public int StaffLimit { get; set; } = 10;
        public string AdminPassword { get; set; } = string.Empty;
    }
}
