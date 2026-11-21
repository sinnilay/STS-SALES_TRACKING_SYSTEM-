namespace STS.Models
{
    public class EmployeeQualification
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public int? CompanyId { get; set; }
        public Company? Company { get; set; }
    }
}
