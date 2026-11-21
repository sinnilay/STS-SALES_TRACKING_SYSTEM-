using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using STS.Models;
using STS.Services;

namespace STS.Controllers
{
    // --- Employee Analytics (STS > Employee Analytics) ---
    // A team-wide overview of what every employee holds and has worked on, plus a drill-down
    // into one employee. An employee "holds" a record when they are its primary holder
    // (SalesData.AllocatedToId) or a co-assignee. A held record is "touched" once that
    // employee has logged at least one status update (DSR entry) against it; the rest are
    // "untouched". Holdings / touched / untouched describe the current state; the activity
    // numbers (updates, conversions, records created, site photos) honour the from/to range.
    public partial class AdminController
    {
        private sealed class AnalyticsStaffRow
        {
            public int Id { get; set; }
            public string FullName { get; set; } = string.Empty;
            public string Email { get; set; } = string.Empty;
            public string Department { get; set; } = string.Empty;
            public string EmployeeRole { get; set; } = string.Empty;
            public string Designation { get; set; } = string.Empty;
            public string CityBranch { get; set; } = string.Empty;
            public bool IsActive { get; set; }
            public string? ProfilePicturePath { get; set; }
            public DateTime? LastSeenAt { get; set; }
        }

        // Inclusive calendar-day range; null ends are open.
        private static (DateTime? from, DateTime? toExclusive) ParseAnalyticsRange(string? from, string? to)
        {
            DateTime? start = DateTime.TryParse(from, CultureInfo.InvariantCulture, DateTimeStyles.None, out var f) ? f.Date : null;
            DateTime? end = DateTime.TryParse(to, CultureInfo.InvariantCulture, DateTimeStyles.None, out var t) ? t.Date.AddDays(1) : null;
            return (start, end);
        }

        // Same people the Employee List shows: everyone in the company except SuperAdmin,
        // the company admin and the signed-in user.
        private async Task<IQueryable<User>> AnalyticsStaffQueryAsync(int companyId)
        {
            int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out int currentUserId);
            int? companyAdminId = await _context.Users
                .Where(u => u.CompanyId == companyId && u.Role == "Admin")
                .OrderBy(u => u.Id)
                .Select(u => (int?)u.Id)
                .FirstOrDefaultAsync();

            return _context.Users
                .AsNoTracking()
                .Where(u => u.CompanyId == companyId && u.Role != "SuperAdmin" && u.Id != currentUserId && u.Id != companyAdminId);
        }

        private static readonly System.Linq.Expressions.Expression<Func<User, AnalyticsStaffRow>> ToAnalyticsStaffRow = u => new AnalyticsStaffRow
        {
            Id = u.Id,
            FullName = u.FullName,
            Email = u.Email,
            Department = u.Department,
            EmployeeRole = u.EmployeeRole,
            Designation = u.Designation,
            CityBranch = u.CityBranch,
            IsActive = u.IsActive,
            ProfilePicturePath = u.ProfilePicturePath,
            LastSeenAt = u.LastSeenAt
        };

        private IQueryable<SalesData> HeldBy(int companyId, int employeeId) =>
            _context.SalesRecords.AsNoTracking().Where(s => s.TenantCompanyId == companyId
                && (s.AllocatedToId == employeeId || _context.StsCoAssignees.Any(a => a.SalesDataId == s.Id && a.EmployeeId == employeeId)));

        [HttpGet("employee-analytics")]
        public async Task<IActionResult> GetEmployeeAnalyticsOverview([FromQuery] string? from, [FromQuery] string? to)
        {
            int companyId = GetCompanyId();
            var (start, end) = ParseAnalyticsRange(from, to);

            var staff = await (await AnalyticsStaffQueryAsync(companyId)).Select(ToAnalyticsStaffRow).ToListAsync();

            var records = _context.SalesRecords.AsNoTracking().Where(s => s.TenantCompanyId == companyId);
            var coAssignees = _context.StsCoAssignees.AsNoTracking().Where(a => a.TenantCompanyId == companyId);

            // Holdings — primary and shared are disjoint (a primary holder never keeps a co-assignee row).
            var heldPrimary = await records.Where(s => s.AllocatedToId != null)
                .GroupBy(s => s.AllocatedToId)
                .Select(g => new { EmployeeId = g.Key!.Value, Count = g.Count() })
                .ToDictionaryAsync(x => x.EmployeeId, x => x.Count);
            var touchedPrimary = await records
                .Where(s => s.AllocatedToId != null && _context.DsrEntries.Any(d => d.SalesDataId == s.Id && d.EmployeeId == s.AllocatedToId))
                .GroupBy(s => s.AllocatedToId)
                .Select(g => new { EmployeeId = g.Key!.Value, Count = g.Count() })
                .ToDictionaryAsync(x => x.EmployeeId, x => x.Count);
            var heldShared = await coAssignees
                .GroupBy(a => a.EmployeeId)
                .Select(g => new { EmployeeId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.EmployeeId, x => x.Count);
            var touchedShared = await coAssignees
                .Where(a => _context.DsrEntries.Any(d => d.SalesDataId == a.SalesDataId && d.EmployeeId == a.EmployeeId))
                .GroupBy(a => a.EmployeeId)
                .Select(g => new { EmployeeId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.EmployeeId, x => x.Count);

            var dsr = _context.DsrEntries.AsNoTracking().Where(d => d.TenantCompanyId == companyId);
            var lastActivity = await dsr
                .GroupBy(d => d.EmployeeId)
                .Select(g => new { EmployeeId = g.Key, Last = g.Max(d => d.CreatedAt) })
                .ToDictionaryAsync(x => x.EmployeeId, x => x.Last);

            var dsrInRange = dsr;
            if (start.HasValue) dsrInRange = dsrInRange.Where(d => d.CreatedAt >= start.Value);
            if (end.HasValue) dsrInRange = dsrInRange.Where(d => d.CreatedAt < end.Value);
            // Grouped per (employee, status) so the "is it a conversion" check runs in memory —
            // SQL Server won't take the IN-subquery EF emits for a list inside an aggregate.
            var activity = (await dsrInRange
                    .GroupBy(d => new { d.EmployeeId, d.NewStatus })
                    .Select(g => new { g.Key.EmployeeId, g.Key.NewStatus, Count = g.Count(), Revenue = g.Sum(d => d.ConvertedPrice) })
                    .ToListAsync())
                .GroupBy(x => x.EmployeeId)
                .ToDictionary(g => g.Key, g => new
                {
                    Updates = g.Sum(x => x.Count),
                    Conversions = g.Where(x => StsPipeline.IsConvertedStatus(x.NewStatus)).Sum(x => x.Count),
                    Revenue = g.Where(x => StsPipeline.IsConvertedStatus(x.NewStatus)).Sum(x => x.Revenue ?? 0m)
                });
            var recordsWorked = await dsrInRange
                .GroupBy(d => d.EmployeeId)
                .Select(g => new { EmployeeId = g.Key, Count = g.Select(d => d.SalesDataId).Distinct().Count() })
                .ToDictionaryAsync(x => x.EmployeeId, x => x.Count);

            var createdQuery = records;
            if (start.HasValue) createdQuery = createdQuery.Where(s => s.CreatedAt >= start.Value);
            if (end.HasValue) createdQuery = createdQuery.Where(s => s.CreatedAt < end.Value);
            var created = await createdQuery
                .GroupBy(s => s.EmployeeId)
                .Select(g => new { EmployeeId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.EmployeeId, x => x.Count);

            var totalRecords = await records.CountAsync();
            var allocatedRecords = await records.CountAsync(s => s.AllocatedToId != null);

            var employees = staff.Select(e =>
            {
                int primary = heldPrimary.GetValueOrDefault(e.Id);
                int shared = heldShared.GetValueOrDefault(e.Id);
                int held = primary + shared;
                int touched = touchedPrimary.GetValueOrDefault(e.Id) + touchedShared.GetValueOrDefault(e.Id);
                activity.TryGetValue(e.Id, out var act);
                return new
                {
                    e.Id,
                    e.FullName,
                    e.Email,
                    e.Department,
                    e.EmployeeRole,
                    e.Designation,
                    e.CityBranch,
                    e.IsActive,
                    e.LastSeenAt,
                    ProfilePictureUrl = BuildProfilePictureUrl(e.ProfilePicturePath),
                    Held = held,
                    HeldPrimary = primary,
                    HeldShared = shared,
                    Touched = touched,
                    Untouched = held - touched,
                    Coverage = held > 0 ? Math.Round(touched * 100.0 / held, 1) : 0,
                    Updates = act?.Updates ?? 0,
                    RecordsWorked = recordsWorked.GetValueOrDefault(e.Id),
                    Conversions = act?.Conversions ?? 0,
                    Revenue = act?.Revenue ?? 0m,
                    Created = created.GetValueOrDefault(e.Id),
                    LastActivityAt = lastActivity.TryGetValue(e.Id, out var last) ? (DateTime?)last : null
                };
            })
            .OrderByDescending(e => e.Updates)
            .ThenByDescending(e => e.Held)
            .ThenBy(e => e.FullName)
            .ToList();

            return Ok(new
            {
                totals = new
                {
                    totalRecords,
                    allocatedRecords,
                    unallocatedRecords = totalRecords - allocatedRecords,
                    employees = employees.Count,
                    activeEmployees = employees.Count(e => e.IsActive),
                    held = employees.Sum(e => e.Held),
                    touched = employees.Sum(e => e.Touched),
                    untouched = employees.Sum(e => e.Untouched),
                    updates = employees.Sum(e => e.Updates),
                    conversions = employees.Sum(e => e.Conversions),
                    revenue = employees.Sum(e => e.Revenue),
                    created = employees.Sum(e => e.Created)
                },
                employees
            });
        }

        [HttpGet("employee-analytics/{id:int}")]
        public async Task<IActionResult> GetEmployeeAnalytics(int id, [FromQuery] string? from, [FromQuery] string? to)
        {
            int companyId = GetCompanyId();
            var (start, end) = ParseAnalyticsRange(from, to);

            var employee = await _context.Users.AsNoTracking()
                .Where(u => u.Id == id && u.CompanyId == companyId)
                .Select(u => new
                {
                    u.Id,
                    u.FullName,
                    u.Email,
                    u.PhoneNumber,
                    u.MobileNo,
                    u.Department,
                    u.EmployeeRole,
                    u.Designation,
                    u.CityBranch,
                    u.JoiningDate,
                    u.IsActive,
                    u.LastSeenAt,
                    u.ProfilePicturePath
                })
                .FirstOrDefaultAsync();
            if (employee == null) return NotFound(new { message = "Employee not found." });

            var today = DateTime.UtcNow.Date;

            // Everything they currently hold — narrow columns only, aggregated in memory.
            var held = await HeldBy(companyId, id)
                .Select(s => new
                {
                    s.Id,
                    s.Status,
                    s.Source,
                    s.CityDistrict,
                    s.Priority,
                    s.NextActionDate,
                    s.MeetingScheduledAt,
                    IsPrimary = s.AllocatedToId == id
                })
                .ToListAsync();

            // Every record this employee has ever logged an update on.
            var workedIds = (await _context.DsrEntries.AsNoTracking()
                    .Where(d => d.TenantCompanyId == companyId && d.EmployeeId == id)
                    .Select(d => d.SalesDataId)
                    .Distinct()
                    .ToListAsync())
                .ToHashSet();

            var heldIds = held.Select(h => h.Id).ToHashSet();
            int touched = held.Count(h => workedIds.Contains(h.Id));

            // Their status updates in the selected period.
            var dsrQuery = _context.DsrEntries.AsNoTracking().Where(d => d.TenantCompanyId == companyId && d.EmployeeId == id);
            if (start.HasValue) dsrQuery = dsrQuery.Where(d => d.CreatedAt >= start.Value);
            if (end.HasValue) dsrQuery = dsrQuery.Where(d => d.CreatedAt < end.Value);
            var updates = await dsrQuery
                .Select(d => new { d.SalesDataId, d.NewStatus, d.ConvertedPrice, d.CreatedAt })
                .ToListAsync();

            var conversions = updates.Where(u => StsPipeline.IsConvertedStatus(u.NewStatus)).ToList();
            var activeDays = updates.Select(u => u.CreatedAt.Date).Distinct().Count();

            // Activity trend — daily for ranges up to ~3 months, monthly beyond that.
            var trendStart = start ?? (updates.Count > 0 ? updates.Min(u => u.CreatedAt).Date : today);
            var trendEnd = (end ?? today.AddDays(1)).AddDays(-1);
            if (trendEnd < trendStart) trendEnd = trendStart;
            bool monthly = (trendEnd - trendStart).TotalDays > 92;
            var trend = new List<object>();
            if (monthly)
            {
                var byMonth = updates.GroupBy(u => new DateTime(u.CreatedAt.Year, u.CreatedAt.Month, 1))
                    .ToDictionary(g => g.Key, g => g.ToList());
                for (var m = new DateTime(trendStart.Year, trendStart.Month, 1); m <= trendEnd; m = m.AddMonths(1))
                {
                    var bucket = byMonth.GetValueOrDefault(m) ?? new();
                    trend.Add(new { date = m.ToString("yyyy-MM-dd"), updates = bucket.Count, conversions = bucket.Count(u => StsPipeline.IsConvertedStatus(u.NewStatus)) });
                }
            }
            else
            {
                var byDay = updates.GroupBy(u => u.CreatedAt.Date).ToDictionary(g => g.Key, g => g.ToList());
                for (var d = trendStart; d <= trendEnd; d = d.AddDays(1))
                {
                    var bucket = byDay.GetValueOrDefault(d) ?? new();
                    trend.Add(new { date = d.ToString("yyyy-MM-dd"), updates = bucket.Count, conversions = bucket.Count(u => StsPipeline.IsConvertedStatus(u.NewStatus)) });
                }
            }

            var weekdays = Enumerable.Range(0, 7)
                .Select(i => (DayOfWeek)((i + 1) % 7)) // Monday first
                .Select(day => new { day = day.ToString().Substring(0, 3), updates = updates.Count(u => u.CreatedAt.DayOfWeek == day) })
                .ToList();

            var createdQuery = _context.SalesRecords.AsNoTracking().Where(s => s.TenantCompanyId == companyId && s.EmployeeId == id);
            if (start.HasValue) createdQuery = createdQuery.Where(s => s.CreatedAt >= start.Value);
            if (end.HasValue) createdQuery = createdQuery.Where(s => s.CreatedAt < end.Value);
            var createdCount = await createdQuery.CountAsync();

            var imagesQuery = _context.SiteImages.AsNoTracking().Where(i => i.TenantCompanyId == companyId && i.UploadedById == id);
            if (start.HasValue) imagesQuery = imagesQuery.Where(i => i.CapturedAt >= start.Value);
            if (end.HasValue) imagesQuery = imagesQuery.Where(i => i.CapturedAt < end.Value);
            var siteImages = await imagesQuery.CountAsync();

            var requests = await _context.StsAllocationRequests.AsNoTracking()
                .Where(r => r.TenantCompanyId == companyId && r.RequestedById == id)
                .GroupBy(r => r.Status)
                .Select(g => new { Status = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Status, x => x.Count);

            var recent = await _context.DsrEntries.AsNoTracking()
                .Where(d => d.TenantCompanyId == companyId && d.EmployeeId == id)
                .OrderByDescending(d => d.CreatedAt)
                .Take(15)
                .Select(d => new
                {
                    d.Id,
                    d.SalesDataId,
                    d.CompanyID,
                    d.CompanyName,
                    d.PreviousStatus,
                    d.NewStatus,
                    d.OtherStatusText,
                    d.Comment,
                    d.ConvertedFor,
                    d.ConvertedPrice,
                    d.UpdatedAsAdmin,
                    d.CreatedAt
                })
                .ToListAsync();

            static List<object> Breakdown<T>(IEnumerable<T> items, Func<T, string?> key, int take = int.MaxValue) =>
                items.GroupBy(i => string.IsNullOrWhiteSpace(key(i)) ? "Unspecified" : key(i)!.Trim(), StringComparer.OrdinalIgnoreCase)
                    .Select(g => new { name = g.Key, count = g.Count() })
                    .OrderByDescending(x => x.count)
                    .Take(take)
                    .Cast<object>()
                    .ToList();

            return Ok(new
            {
                employee = new
                {
                    employee.Id,
                    employee.FullName,
                    employee.Email,
                    employee.PhoneNumber,
                    employee.MobileNo,
                    employee.Department,
                    employee.EmployeeRole,
                    employee.Designation,
                    employee.CityBranch,
                    employee.JoiningDate,
                    employee.IsActive,
                    employee.LastSeenAt,
                    ProfilePictureUrl = BuildProfilePictureUrl(employee.ProfilePicturePath)
                },
                holdings = new
                {
                    held = held.Count,
                    primary = held.Count(h => h.IsPrimary),
                    shared = held.Count(h => !h.IsPrimary),
                    touched,
                    untouched = held.Count - touched,
                    coverage = held.Count > 0 ? Math.Round(touched * 100.0 / held.Count, 1) : 0,
                    // Records they updated but no longer (or never) held — e.g. since re-allotted.
                    workedNotHeld = workedIds.Count(w => !heldIds.Contains(w)),
                    overdueFollowUps = held.Count(h => h.NextActionDate.HasValue && h.NextActionDate.Value.Date < today),
                    upcomingFollowUps = held.Count(h => h.NextActionDate.HasValue && h.NextActionDate.Value.Date >= today && h.NextActionDate.Value.Date < today.AddDays(7)),
                    meetingsFixed = held.Count(h => h.MeetingScheduledAt.HasValue),
                    byStatus = Breakdown(held, h => h.Status),
                    bySource = Breakdown(held, h => h.Source),
                    byCity = Breakdown(held, h => h.CityDistrict, 8),
                    byPriority = Breakdown(held, h => h.Priority)
                },
                activity = new
                {
                    updates = updates.Count,
                    recordsWorked = updates.Select(u => u.SalesDataId).Distinct().Count(),
                    conversions = conversions.Count,
                    revenue = conversions.Sum(c => c.ConvertedPrice ?? 0m),
                    activeDays,
                    avgPerActiveDay = activeDays > 0 ? Math.Round(updates.Count / (double)activeDays, 1) : 0,
                    conversionRate = updates.Count > 0
                        ? Math.Round(conversions.Select(c => c.SalesDataId).Distinct().Count() * 100.0 / updates.Select(u => u.SalesDataId).Distinct().Count(), 1)
                        : 0,
                    recordsCreated = createdCount,
                    siteImages,
                    lastActivityAt = recent.Count > 0 ? (DateTime?)recent[0].CreatedAt : null,
                    byOutcome = Breakdown(updates, u => u.NewStatus),
                    trendGranularity = monthly ? "month" : "day",
                    trend,
                    weekdays
                },
                requests = new
                {
                    pending = requests.GetValueOrDefault("Pending"),
                    approved = requests.GetValueOrDefault("Approved"),
                    rejected = requests.GetValueOrDefault("Rejected")
                },
                recent
            });
        }

        // Paged list behind the drill-down tabs: view = untouched | touched | overdue | all.
        [HttpGet("employee-analytics/{id:int}/records")]
        public async Task<IActionResult> GetEmployeeAnalyticsRecords(
            int id,
            [FromQuery] string? view = "untouched",
            [FromQuery] string? search = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            int companyId = GetCompanyId();
            if (!await _context.Users.AnyAsync(u => u.Id == id && u.CompanyId == companyId))
                return NotFound(new { message = "Employee not found." });

            var today = DateTime.UtcNow.Date;
            var query = HeldBy(companyId, id);

            switch ((view ?? "untouched").ToLowerInvariant())
            {
                case "touched":
                    query = query.Where(s => _context.DsrEntries.Any(d => d.SalesDataId == s.Id && d.EmployeeId == id));
                    break;
                case "overdue":
                    query = query.Where(s => s.NextActionDate != null && s.NextActionDate < today);
                    break;
                case "all":
                    break;
                default:
                    query = query.Where(s => !_context.DsrEntries.Any(d => d.SalesDataId == s.Id && d.EmployeeId == id));
                    break;
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim();
                query = query.Where(s => s.CompanyName.Contains(term) || s.CompanyID.Contains(term) || s.CityDistrict.Contains(term));
            }

            pageSize = Math.Clamp(pageSize, 1, 100);
            var total = await query.CountAsync();
            var totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize));
            page = Math.Clamp(page, 1, totalPages);

            // Page on ids first (narrow sort), then fetch just those rows.
            var ordered = (view ?? "").ToLowerInvariant() == "overdue"
                ? query.OrderBy(s => s.NextActionDate).ThenBy(s => s.Id)
                : query.OrderByDescending(s => s.LastActionDate ?? s.CreatedAt).ThenByDescending(s => s.Id);
            var pageIds = await ordered.Select(s => s.Id).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

            var rows = await _context.SalesRecords.AsNoTracking()
                .Where(s => pageIds.Contains(s.Id))
                .Select(s => new
                {
                    s.Id,
                    s.CompanyID,
                    s.CompanyName,
                    s.CityDistrict,
                    s.State,
                    s.Status,
                    s.Source,
                    s.Priority,
                    s.CreatedAt,
                    s.LastActionDate,
                    s.NextActionDate,
                    IsPrimary = s.AllocatedToId == id
                })
                .ToListAsync();

            var mine = await _context.DsrEntries.AsNoTracking()
                .Where(d => d.EmployeeId == id && pageIds.Contains(d.SalesDataId))
                .GroupBy(d => d.SalesDataId)
                .Select(g => new { SalesDataId = g.Key, Count = g.Count(), Last = g.Max(d => d.CreatedAt) })
                .ToDictionaryAsync(x => x.SalesDataId);

            var position = pageIds.Select((rid, index) => (rid, index)).ToDictionary(x => x.rid, x => x.index);
            var items = rows
                .OrderBy(r => position[r.Id])
                .Select(r =>
                {
                    mine.TryGetValue(r.Id, out var m);
                    return new
                    {
                        r.Id,
                        r.CompanyID,
                        r.CompanyName,
                        r.CityDistrict,
                        r.State,
                        r.Status,
                        r.Source,
                        r.Priority,
                        r.CreatedAt,
                        r.LastActionDate,
                        r.NextActionDate,
                        r.IsPrimary,
                        MyUpdates = m?.Count ?? 0,
                        MyLastUpdateAt = m != null ? (DateTime?)m.Last : null,
                        IsOverdue = r.NextActionDate.HasValue && r.NextActionDate.Value.Date < today
                    };
                })
                .ToList();

            return Ok(new { items, total, page, pageSize });
        }
    }
}
