using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using STS.Data;
using System.Security.Claims;

namespace STS.Hubs
{
    // GPS Tracking module: employees push their position while the app is open,
    // and admins of the same company receive live updates for the map/status list.
    [Authorize]
    public class GpsHub : Hub
    {
        private readonly AppDbContext _context;

        public GpsHub(AppDbContext context)
        {
            _context = context;
        }

        private int? GetCompanyId()
        {
            var claim = Context.User?.FindFirst("CompanyId")?.Value;
            return int.TryParse(claim, out int companyId) ? companyId : null;
        }

        private int GetUserId()
        {
            var claim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(claim, out int userId) ? userId : 0;
        }

        private bool IsEmployee() => Context.User?.FindFirst(ClaimTypes.Role)?.Value == "Sales";

        private static string CompanyGroup(int companyId) => $"company-{companyId}";

        public override async Task OnConnectedAsync()
        {
            var companyId = GetCompanyId();
            if (companyId.HasValue)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, CompanyGroup(companyId.Value));
            }

            if (IsEmployee() && companyId.HasValue)
            {
                var userId = GetUserId();
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
                if (user != null)
                {
                    user.LastSeenAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();

                    await Clients.OthersInGroup(CompanyGroup(companyId.Value)).SendAsync("PresenceChanged", new
                    {
                        userId,
                        isOnline = true,
                        lastSeenAt = user.LastSeenAt
                    });
                }
            }

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var companyId = GetCompanyId();
            if (IsEmployee() && companyId.HasValue)
            {
                var userId = GetUserId();
                await Clients.OthersInGroup(CompanyGroup(companyId.Value)).SendAsync("PresenceChanged", new
                {
                    userId,
                    isOnline = false,
                    lastSeenAt = DateTime.UtcNow
                });
            }

            await base.OnDisconnectedAsync(exception);
        }

        // Called by the employee's browser every ~25-30s while a GPS fix is available.
        public async Task UpdateLocation(double latitude, double longitude)
        {
            if (!IsEmployee()) return;
            var companyId = GetCompanyId();
            if (!companyId.HasValue) return;

            var userId = GetUserId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return;

            user.LastLatitude = latitude;
            user.LastLongitude = longitude;
            user.LastLocationAt = DateTime.UtcNow;
            user.LastSeenAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            await Clients.Group(CompanyGroup(companyId.Value)).SendAsync("LocationUpdated", new
            {
                userId,
                fullName = user.FullName,
                latitude,
                longitude,
                recordedAt = user.LastLocationAt,
                isOnline = true
            });
        }

        // Lightweight keep-alive when a fresh GPS fix isn't available yet, so "online" status stays accurate.
        public async Task Heartbeat()
        {
            if (!IsEmployee()) return;
            var companyId = GetCompanyId();
            if (!companyId.HasValue) return;

            var userId = GetUserId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return;

            user.LastSeenAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            await Clients.OthersInGroup(CompanyGroup(companyId.Value)).SendAsync("PresenceChanged", new
            {
                userId,
                isOnline = true,
                lastSeenAt = user.LastSeenAt
            });
        }
    }
}
