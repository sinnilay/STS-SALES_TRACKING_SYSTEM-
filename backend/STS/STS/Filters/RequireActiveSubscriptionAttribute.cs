using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using STS.Data;
using System.Security.Claims;

namespace STS.Filters
{
    // Marks an action as reachable even when the tenant's subscription has expired
    // (e.g. the endpoint the frontend polls to detect/display the expired state).
    [AttributeUsage(AttributeTargets.Method, AllowMultiple = false)]
    public class AllowExpiredSubscriptionAttribute : Attribute
    {
    }

    // Blocks Admin/Sales access to the API once their company's trial/subscription
    // has expired or the company has been deactivated. SuperAdmin is always exempt.
    public class RequireActiveSubscriptionAttribute : Attribute, IAsyncActionFilter
    {
        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            if (context.ActionDescriptor.EndpointMetadata.Any(m => m is AllowExpiredSubscriptionAttribute))
            {
                await next();
                return;
            }

            var user = context.HttpContext.User;
            var role = user.FindFirst(ClaimTypes.Role)?.Value;
            if (role == "SuperAdmin")
            {
                await next();
                return;
            }

            var companyIdClaim = user.FindFirst("CompanyId")?.Value;
            if (int.TryParse(companyIdClaim, out int companyId))
            {
                var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == companyId);

                if (company != null && (!company.IsActive || company.SubscriptionExpiry < DateTime.UtcNow))
                {
                    context.Result = new ObjectResult(new
                    {
                        message = "Your subscription has expired. Please contact your Super Admin to renew access.",
                        code = "SUBSCRIPTION_EXPIRED"
                    })
                    {
                        StatusCode = StatusCodes.Status403Forbidden
                    };
                    return;
                }
            }

            await next();
        }
    }
}
