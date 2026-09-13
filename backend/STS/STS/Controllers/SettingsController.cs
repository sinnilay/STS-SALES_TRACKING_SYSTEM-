using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using STS.Data;
using STS.Filters;
using STS.Models;

using System.Security.Claims;

namespace STS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    [RequireActiveSubscription]
    public class SettingsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SettingsController(AppDbContext context)
        {
            _context = context;
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

        [HttpGet("departments")]
        public async Task<IActionResult> GetDepartments()
        {
            int companyId = GetCompanyId();
            var departments = await _context.EmployeeDepartments.Where(d => d.CompanyId == companyId).ToListAsync();
            return Ok(departments);
        }

        [HttpPost("departments")]
        public async Task<IActionResult> AddDepartment([FromBody] AddSettingRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest(new { message = "Name is required." });

            int companyId = GetCompanyId();

            if (await _context.EmployeeDepartments.AnyAsync(d => d.Name == request.Name && d.CompanyId == companyId))
                return BadRequest(new { message = "Department already exists." });

            var dept = new EmployeeDepartment { Name = request.Name, CompanyId = companyId };
            _context.EmployeeDepartments.Add(dept);
            await _context.SaveChangesAsync();

            return Ok(dept);
        }

        [HttpGet("designations")]
        public async Task<IActionResult> GetDesignations()
        {
            int companyId = GetCompanyId();
            var designations = await _context.EmployeeDesignations.Where(d => d.CompanyId == companyId).ToListAsync();
            return Ok(designations);
        }

        [HttpPost("designations")]
        public async Task<IActionResult> AddDesignation([FromBody] AddSettingRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest(new { message = "Name is required." });

            int companyId = GetCompanyId();

            if (await _context.EmployeeDesignations.AnyAsync(d => d.Name == request.Name && d.CompanyId == companyId))
                return BadRequest(new { message = "Designation already exists." });

            var desig = new EmployeeDesignation { Name = request.Name, CompanyId = companyId };
            _context.EmployeeDesignations.Add(desig);
            await _context.SaveChangesAsync();

            return Ok(desig);
        }

        [HttpGet("employee-roles")]
        public async Task<IActionResult> GetEmployeeRoles()
        {
            int companyId = GetCompanyId();
            var roles = await _context.EmployeeRoles.Where(r => r.CompanyId == companyId).ToListAsync();
            return Ok(roles);
        }

        [HttpPost("employee-roles")]
        public async Task<IActionResult> AddEmployeeRole([FromBody] AddSettingRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest(new { message = "Name is required." });

            int companyId = GetCompanyId();

            if (await _context.EmployeeRoles.AnyAsync(r => r.Name == request.Name && r.CompanyId == companyId))
                return BadRequest(new { message = "Role already exists." });

            var role = new EmployeeRole { Name = request.Name, CompanyId = companyId };
            _context.EmployeeRoles.Add(role);
            await _context.SaveChangesAsync();

            return Ok(role);
        }
    }

    public class AddSettingRequest
    {
        public string Name { get; set; } = string.Empty;
    }
}
