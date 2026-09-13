namespace STS.Models
{
    public class SiteImage
    {
        public int Id { get; set; }

        public int SalesDataId { get; set; }
        public SalesData? SalesData { get; set; }

        public int UploadedById { get; set; }
        public User? UploadedBy { get; set; }

        public int? TenantCompanyId { get; set; }

        public string FileName { get; set; } = string.Empty;

        // "Camera Capture" or "Manual Upload"
        public string UploadMethod { get; set; } = "Manual Upload";

        public DateTime CapturedAt { get; set; } = DateTime.UtcNow;
    }
}
