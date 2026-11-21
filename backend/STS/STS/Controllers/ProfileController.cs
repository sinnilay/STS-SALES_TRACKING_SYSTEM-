using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using STS.Data;
using System.Security.Claims;

namespace STS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ProfileController : ControllerBase
    {
        private static readonly string[] AllowedImageExtensions = { ".jpg", ".jpeg", ".png", ".webp" };
        private const long MaxImageSizeBytes = 5 * 1024 * 1024; // 5 MB

        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;

        public ProfileController(AppDbContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        private int GetCurrentUserId()
        {
            var userIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdString, out int userId))
            {
                throw new UnauthorizedAccessException("Invalid user session.");
            }
            return userId;
        }

        private string? BuildProfilePictureUrl(string? fileName)
        {
            if (string.IsNullOrEmpty(fileName)) return null;
            var request = HttpContext.Request;
            return $"{request.Scheme}://{request.Host}/profilepics/{fileName}";
        }

        [HttpGet("me")]
        public async Task<IActionResult> GetMyProfile()
        {
            var userId = GetCurrentUserId();

            var user = await _context.Users.Include(u => u.Company).FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return NotFound(new { message = "User not found." });

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
                user.JoiningDate,
                user.IsActive,
                user.CreatedAt,
                user.BankName,
                user.BankBranch,
                user.AccountHolderName,
                user.AccountNumber,
                user.PanCardNo,
                CompanyName = user.Company?.Name,
                ProfilePictureUrl = BuildProfilePictureUrl(user.ProfilePicturePath)
            });
        }

        [HttpPut("me")]
        public async Task<IActionResult> UpdateMyProfile([FromBody] UpdateMyProfileRequest request)
        {
            var userId = GetCurrentUserId();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return NotFound(new { message = "User not found." });

            // A null field is left untouched; an empty string clears it (where the field is optional).
            if (request.PhoneNumber != null)
            {
                var v = request.PhoneNumber.Trim();
                if (v.Length > 0 && !Regex.IsMatch(v, @"^\d{10}$")) return BadRequest(new { message = "Phone number must be exactly 10 digits." });
                user.PhoneNumber = v;
            }
            if (request.MobileNo != null)
            {
                var v = request.MobileNo.Trim();
                if (!Regex.IsMatch(v, @"^\d{10}$")) return BadRequest(new { message = "Mobile number must be exactly 10 digits." });
                user.MobileNo = v;
            }
            if (request.AlternateMobileNo != null)
            {
                var v = request.AlternateMobileNo.Trim();
                if (v.Length > 0 && !Regex.IsMatch(v, @"^\d{10}$")) return BadRequest(new { message = "Alternate mobile number must be exactly 10 digits." });
                user.AlternateMobileNo = v;
            }
            if (request.LocalAddress != null) user.LocalAddress = request.LocalAddress.Trim();
            if (request.PermanentAddress != null)
            {
                var v = request.PermanentAddress.Trim();
                if (v.Length == 0) return BadRequest(new { message = "Permanent address is required." });
                user.PermanentAddress = v;
            }
            if (request.ZipCode != null)
            {
                var v = request.ZipCode.Trim();
                if (v.Length == 0 || !Regex.IsMatch(v, @"^[A-Za-z0-9 -]{3,12}$")) return BadRequest(new { message = "Enter a valid zip code." });
                user.ZipCode = v;
            }
            if (request.FathersName != null)
            {
                var v = request.FathersName.Trim();
                if (v.Length == 0) return BadRequest(new { message = "Father's name is required." });
                user.FathersName = v;
            }
            if (request.Sex != null)
            {
                var v = request.Sex.Trim();
                if (v != "Male" && v != "Female" && v != "Other") return BadRequest(new { message = "Sex must be Male, Female or Other." });
                user.Sex = v;
            }
            if (request.Qualification != null)
            {
                var v = request.Qualification.Trim();
                if (v.Length == 0) return BadRequest(new { message = "Qualification is required." });
                user.Qualification = v;
            }
            if (request.DateOfBirth != null)
            {
                var dob = request.DateOfBirth.Value.Date;
                if (dob > DateTime.UtcNow.Date) return BadRequest(new { message = "Date of birth cannot be in the future." });
                user.DateOfBirth = dob;
            }
            if (request.BankName != null) user.BankName = request.BankName.Trim();
            if (request.BankBranch != null) user.BankBranch = request.BankBranch.Trim();
            if (request.AccountHolderName != null) user.AccountHolderName = request.AccountHolderName.Trim();
            if (request.AccountNumber != null)
            {
                var v = request.AccountNumber.Trim();
                if (v.Length > 0 && !Regex.IsMatch(v, @"^\d{6,20}$")) return BadRequest(new { message = "Enter a valid account number (6-20 digits)." });
                user.AccountNumber = v;
            }
            if (request.PanCardNo != null)
            {
                var v = request.PanCardNo.Trim().ToUpperInvariant();
                if (v.Length > 0 && !Regex.IsMatch(v, @"^[A-Z]{5}[0-9]{4}[A-Z]$")) return BadRequest(new { message = "Invalid PAN format (e.g. ABCDE1234F)." });
                user.PanCardNo = v;
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "Profile updated successfully." });
        }

        [HttpPost("me/picture")]
        [RequestSizeLimit(MaxImageSizeBytes)]
        public async Task<IActionResult> UploadMyProfilePicture(IFormFile file)
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

            var userId = GetCurrentUserId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return NotFound(new { message = "User not found." });

            var profilePicsPath = Path.Combine(_env.ContentRootPath, "profilepics");
            Directory.CreateDirectory(profilePicsPath);

            var newFileName = $"user_{userId}_{Guid.NewGuid():N}{extension}";
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
    }

    public class UpdateMyProfileRequest
    {
        public string? PhoneNumber { get; set; }
        public string? MobileNo { get; set; }
        public string? AlternateMobileNo { get; set; }
        public string? LocalAddress { get; set; }
        public string? PermanentAddress { get; set; }
        public string? ZipCode { get; set; }
        public string? FathersName { get; set; }
        public string? Sex { get; set; }
        public string? Qualification { get; set; }
        public DateTime? DateOfBirth { get; set; }
        public string? BankName { get; set; }
        public string? BankBranch { get; set; }
        public string? AccountHolderName { get; set; }
        public string? AccountNumber { get; set; }
        public string? PanCardNo { get; set; }
    }
}
