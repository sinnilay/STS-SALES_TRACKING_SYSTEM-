using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using STS.Data;

namespace STS.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class HealthController : ControllerBase
    {
        private readonly AppDbContext _context;

        public HealthController(AppDbContext context)
        {
            _context = context;
        }

        // Cheap anonymous ping. The login page calls it on load and KeepAliveService calls it on a
        // timer, so a cold start (process boot, EF model build, first SQL connection, login query
        // compile) is paid before the user clicks Sign In instead of during the login request.
        [HttpGet]
        public async Task<IActionResult> Get()
        {
            await _context.Users.AsNoTracking().AnyAsync(u => u.Email == "");
            return Ok(new { status = "ok" });
        }
    }
}
