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

            // Tele Sales / Field Sales used to be hardcoded in the UI. Store them as
            // real rows for a company with no roles so they can be deleted like any other.
            if (roles.Count == 0)
            {
                roles = new List<EmployeeRole>
                {
                    new EmployeeRole { Name = "Tele Sales", CompanyId = companyId },
                    new EmployeeRole { Name = "Field Sales", CompanyId = companyId }
                };
                _context.EmployeeRoles.AddRange(roles);
                await _context.SaveChangesAsync();
            }

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

        [HttpGet("qualifications")]
        public async Task<IActionResult> GetQualifications()
        {
            int companyId = GetCompanyId();
            var items = await _context.EmployeeQualifications.Where(q => q.CompanyId == companyId).ToListAsync();

            // The four original hardcoded options are stored as real rows the first time,
            // so they can be deleted like any other entry.
            if (items.Count == 0)
            {
                items = new[] { "High School", "Intermediate", "Graduate", "Post Graduate" }
                    .Select(n => new EmployeeQualification { Name = n, CompanyId = companyId })
                    .ToList();
                _context.EmployeeQualifications.AddRange(items);
                await _context.SaveChangesAsync();
            }

            return Ok(items);
        }

        [HttpPost("qualifications")]
        public async Task<IActionResult> AddQualification([FromBody] AddSettingRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest(new { message = "Name is required." });

            int companyId = GetCompanyId();
            var name = request.Name.Trim();

            if (await _context.EmployeeQualifications.AnyAsync(q => q.Name == name && q.CompanyId == companyId))
                return BadRequest(new { message = "Qualification already exists." });

            var item = new EmployeeQualification { Name = name, CompanyId = companyId };
            _context.EmployeeQualifications.Add(item);
            await _context.SaveChangesAsync();

            return Ok(item);
        }

        [HttpDelete("qualifications/{id}")]
        public async Task<IActionResult> DeleteQualification(int id)
        {
            int companyId = GetCompanyId();
            var item = await _context.EmployeeQualifications.FirstOrDefaultAsync(q => q.Id == id && q.CompanyId == companyId);
            if (item == null)
                return NotFound(new { message = "Qualification not found." });

            _context.EmployeeQualifications.Remove(item);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Qualification deleted." });
        }

        // Existing employees keep the name they were saved with, so deleting a
        // list entry only removes it from the dropdown options.
        [HttpDelete("departments/{id}")]
        public async Task<IActionResult> DeleteDepartment(int id)
        {
            int companyId = GetCompanyId();
            var dept = await _context.EmployeeDepartments.FirstOrDefaultAsync(d => d.Id == id && d.CompanyId == companyId);
            if (dept == null)
                return NotFound(new { message = "Department not found." });

            _context.EmployeeDepartments.Remove(dept);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Department deleted." });
        }

        [HttpDelete("designations/{id}")]
        public async Task<IActionResult> DeleteDesignation(int id)
        {
            int companyId = GetCompanyId();
            var desig = await _context.EmployeeDesignations.FirstOrDefaultAsync(d => d.Id == id && d.CompanyId == companyId);
            if (desig == null)
                return NotFound(new { message = "Designation not found." });

            _context.EmployeeDesignations.Remove(desig);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Designation deleted." });
        }

        [HttpDelete("employee-roles/{id}")]
        public async Task<IActionResult> DeleteEmployeeRole(int id)
        {
            int companyId = GetCompanyId();
            var role = await _context.EmployeeRoles.FirstOrDefaultAsync(r => r.Id == id && r.CompanyId == companyId);
            if (role == null)
                return NotFound(new { message = "Role not found." });

            _context.EmployeeRoles.Remove(role);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Role deleted." });
        }
    }

    public class AddSettingRequest
    {
        public string Name { get; set; } = string.Empty;
    }
}
