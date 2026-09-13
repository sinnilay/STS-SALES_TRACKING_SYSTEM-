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

            if (request.PhoneNumber != null) user.PhoneNumber = request.PhoneNumber.Trim();
            if (request.MobileNo != null) user.MobileNo = request.MobileNo.Trim();
            if (request.AlternateMobileNo != null) user.AlternateMobileNo = request.AlternateMobileNo.Trim();
            if (request.LocalAddress != null) user.LocalAddress = request.LocalAddress.Trim();

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
    }
}
