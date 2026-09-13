using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using STS.Data;
using STS.Services;

namespace STS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IAuthService _authService;
        private readonly IEmailService _emailService;

        public AuthController(AppDbContext context, IAuthService authService, IEmailService emailService)
        {
            _context = context;
            _authService = authService;
            _emailService = emailService;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            var user = await _context.Users.Include(u => u.Company).SingleOrDefaultAsync(u => u.Email == request.Email);
            
            if (user == null || !_authService.VerifyPassword(request.Password, user.PasswordHash))
            {
                return Unauthorized(new { message = "Invalid email or password" });
            }

            if (!user.IsActive)
            {
                return Unauthorized(new { message = "Your account is disabled. Please contact the admin." });
            }

            if (user.Role != "SuperAdmin" && user.Company != null && !user.Company.IsActive)
            {
                return Unauthorized(new { message = "Your account has been suspended. Please contact the support team." });
            }

            var token = _authService.GenerateJwtToken(user);
            var companyName = user.Company?.Name ?? (await _context.Companies.Select(c => c.Name).FirstOrDefaultAsync()) ?? "";
            var enabledModules = user.Company?.EnabledModules ?? "STS";
            return Ok(new
            {
                token,
                role = user.Role,
                id = user.Id,
                permissions = user.Permissions,
                companyId = user.CompanyId,
                companyName,
                enabledModules,
                isTrial = user.Company?.IsTrial ?? false,
                accountType = user.Company?.AccountType,
                subscriptionExpiry = user.Company?.SubscriptionExpiry,
                trialEndDate = user.Company?.TrialEndDate,
                companyIsActive = user.Company?.IsActive ?? true
            });
        }

        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
        {
            var user = await _context.Users.SingleOrDefaultAsync(u => u.Email == request.Email);
            if (user == null || !_authService.VerifyPassword(request.OldPassword, user.PasswordHash))
            {
                return BadRequest(new { message = "Invalid current password." });
            }

            user.PasswordHash = _authService.HashPassword(request.NewPassword);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Password updated successfully." });
        }

        [HttpPost("request-email-change")]
        public async Task<IActionResult> RequestEmailChange([FromBody] RequestEmailChangeRequest request)
        {
            var user = await _context.Users.SingleOrDefaultAsync(u => u.Email == request.CurrentEmail);
            if (user == null)
            {
                return NotFound(new { message = "User not found." });
            }

            // Generate 4 digit OTP
            var otp = new Random().Next(1000, 9999).ToString();
            user.PendingEmail = request.NewEmail;
            user.EmailOtp = otp;
            user.OtpExpiry = DateTime.UtcNow.AddMinutes(15);
            
            await _context.SaveChangesAsync();

            // Send OTP email (We repurpose the welcome email or use raw MailKit. For now we will create a method in IEmailService or send it directly. Since IEmailService only has SendWelcomeEmail, let's just use raw MailKit or add a new method. Wait, let's update IEmailService first)
            await _emailService.SendOtpEmailAsync(request.NewEmail, otp);

            return Ok(new { message = "OTP sent to new email address." });
        }

        [HttpPost("verify-email-change")]
        public async Task<IActionResult> VerifyEmailChange([FromBody] VerifyEmailChangeRequest request)
        {
            var user = await _context.Users.SingleOrDefaultAsync(u => u.Email == request.CurrentEmail);
            if (user == null)
            {
                return NotFound(new { message = "User not found." });
            }

            if (user.EmailOtp != request.Otp || user.OtpExpiry < DateTime.UtcNow)
            {
                return BadRequest(new { message = "Invalid or expired OTP." });
            }

            user.Email = user.PendingEmail!;
            user.PendingEmail = null;
            user.EmailOtp = null;
            user.OtpExpiry = null;
            
            await _context.SaveChangesAsync();

            return Ok(new { message = "Email updated successfully." });
        }
    }

    public class LoginRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class ChangePasswordRequest
    {
        public string Email { get; set; } = string.Empty;
        public string OldPassword { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
    }

    public class RequestEmailChangeRequest
    {
        public string CurrentEmail { get; set; } = string.Empty;
        public string NewEmail { get; set; } = string.Empty;
    }

    public class VerifyEmailChangeRequest
    {
        public string CurrentEmail { get; set; } = string.Empty;
        public string Otp { get; set; } = string.Empty;
    }
}
