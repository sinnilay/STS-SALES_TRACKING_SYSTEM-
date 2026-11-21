namespace STS.Models
{
    // An extra holder of an STS record alongside SalesData.AllocatedToId — e.g. a record
    // with a Field Sales owner can also be allotted to a Tele Sales employee, and both keep
    // working it. Co-assignees see it in their lists and can update it like the primary holder.
    public class StsCoAssignee
    {
        public int Id { get; set; }

        public int? TenantCompanyId { get; set; }

        public int SalesDataId { get; set; }
        public SalesData? SalesData { get; set; }

        public int EmployeeId { get; set; }
        public User? Employee { get; set; }

        public string? AllocatorComment { get; set; }
        public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
    }
}
