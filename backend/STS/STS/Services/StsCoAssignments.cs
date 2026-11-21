using Microsoft.EntityFrameworkCore;
using STS.Data;

namespace STS.Services
{
    public static class StsCoAssignments
    {
        // Above this many records, read the whole tenant's co-assignees instead of sending a
        // huge id list (SQL Server caps a statement at ~2100 parameters).
        private const int MaxIdFilter = 500;

        // SalesDataId -> co-assignee employee ids, in the order they were added.
        public static async Task<Dictionary<int, List<int>>> LoadAsync(AppDbContext context, int companyId, List<int> recordIds)
        {
            if (recordIds.Count == 0) return new Dictionary<int, List<int>>();

            var query = context.StsCoAssignees.AsNoTracking().Where(a => a.TenantCompanyId == companyId);
            if (recordIds.Count <= MaxIdFilter)
                query = query.Where(a => recordIds.Contains(a.SalesDataId));

            var rows = await query
                .OrderBy(a => a.Id)
                .Select(a => new { a.SalesDataId, a.EmployeeId })
                .ToListAsync();

            return rows
                .GroupBy(a => a.SalesDataId)
                .ToDictionary(g => g.Key, g => g.Select(a => a.EmployeeId).ToList());
        }

        public static Task<bool> IsCoAssigneeAsync(AppDbContext context, int salesDataId, int employeeId) =>
            context.StsCoAssignees.AnyAsync(a => a.SalesDataId == salesDataId && a.EmployeeId == employeeId);
    }
}
