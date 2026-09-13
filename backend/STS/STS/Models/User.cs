namespace STS.Models
{
    public class User
    {
        public int Id { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public string Department { get; set; } = string.Empty;
        public string EmployeeDept { get; set; } = string.Empty;
        public string Designation { get; set; } = string.Empty;
        public string CityBranch { get; set; } = string.Empty;
        public string FathersName { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string LocalAddress { get; set; } = string.Empty;
        public string PermanentAddress { get; set; } = string.Empty;
        public string ZipCode { get; set; } = string.Empty;
        public string Sex { get; set; } = string.Empty;
        public string Qualification { get; set; } = string.Empty;
        public string MobileNo { get; set; } = string.Empty;
        public string AlternateMobileNo { get; set; } = string.Empty;
        public DateTime? DateOfBirth { get; set; }
        public string? ProfilePicturePath { get; set; } // Relative filename stored under the server's profilepics folder

        public int? CompanyId { get; set; } // Null for SuperAdmin
        public Company? Company { get; set; }

        public string Role { get; set; } = "Sales"; // "SuperAdmin", "Admin" (Company Admin), or "Sales"
        public string EmployeeRole { get; set; } = string.Empty;
        public string Permissions { get; set; } = "[]"; // JSON array of allowed permissions
        
        // Admin Settings OTP Flow
        public string? PendingEmail { get; set; }
        public string? EmailOtp { get; set; }
        public DateTime? OtpExpiry { get; set; }

        public DateTime JoiningDate { get; set; } = DateTime.UtcNow;
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // GPS Tracking module — last known position pushed by the employee's browser over SignalR.
        public double? LastLatitude { get; set; }
        public double? LastLongitude { get; set; }
        public DateTime? LastLocationAt { get; set; }
        // Refreshed on every location ping / heartbeat; drives the "online now" badge (no live connection tracking needed).
        public DateTime? LastSeenAt { get; set; }
    }
}
