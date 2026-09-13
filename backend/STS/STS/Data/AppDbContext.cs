using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using STS.Models;

namespace STS.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<Company> Companies { get; set; }
        public DbSet<SalesData> SalesRecords { get; set; }
        public DbSet<EmployeeDepartment> EmployeeDepartments { get; set; }
        public DbSet<EmployeeDesignation> EmployeeDesignations { get; set; }
        public DbSet<EmployeeRole> EmployeeRoles { get; set; }
        public DbSet<TrialRequest> TrialRequests { get; set; }
        public DbSet<DsrEntry> DsrEntries { get; set; }
        public DbSet<SiteImage> SiteImages { get; set; }
        public DbSet<StsAllocationRequest> StsAllocationRequests { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure entity mappings if necessary
            modelBuilder.Entity<User>()
                .HasIndex(u => u.Email)
                .IsUnique();

            modelBuilder.Entity<SalesData>()
                .HasOne(s => s.Employee)
                .WithMany()
                .HasForeignKey(s => s.EmployeeId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<SalesData>()
                .HasOne(s => s.AllocatedTo)
                .WithMany()
                .HasForeignKey(s => s.AllocatedToId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<DsrEntry>()
                .HasOne(d => d.SalesData)
                .WithMany()
                .HasForeignKey(d => d.SalesDataId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<DsrEntry>()
                .HasOne(d => d.Employee)
                .WithMany()
                .HasForeignKey(d => d.EmployeeId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<DsrEntry>()
                .HasOne(d => d.TenantCompany)
                .WithMany()
                .HasForeignKey(d => d.TenantCompanyId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<SiteImage>()
                .HasOne(si => si.SalesData)
                .WithMany()
                .HasForeignKey(si => si.SalesDataId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<SiteImage>()
                .HasOne(si => si.UploadedBy)
                .WithMany()
                .HasForeignKey(si => si.UploadedById)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<StsAllocationRequest>()
                .HasOne(r => r.SalesData)
                .WithMany()
                .HasForeignKey(r => r.SalesDataId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<StsAllocationRequest>()
                .HasOne(r => r.RequestedBy)
                .WithMany()
                .HasForeignKey(r => r.RequestedById)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<StsAllocationRequest>()
                .HasOne(r => r.ReviewedBy)
                .WithMany()
                .HasForeignKey(r => r.ReviewedById)
                .OnDelete(DeleteBehavior.Restrict);

            // SQL Server's datetime2 columns don't store timezone info, so EF Core reads
            // every value back with Kind=Unspecified — even though every DateTime in this
            // app is written as DateTime.UtcNow. Without a Kind of Utc, System.Text.Json
            // serializes timestamps without a trailing "Z", and the browser's `new Date(...)`
            // then reads them as local time instead of converting from UTC, showing the raw
            // UTC clock time to users instead of their actual local time. Tag every DateTime
            // column as Utc on the way out of the database so serialization is correct.
            var utcConverter = new ValueConverter<DateTime, DateTime>(
                v => v,
                v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

            var nullableUtcConverter = new ValueConverter<DateTime?, DateTime?>(
                v => v,
                v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);

            foreach (var entityType in modelBuilder.Model.GetEntityTypes())
            {
                foreach (var property in entityType.GetProperties())
                {
                    if (property.ClrType == typeof(DateTime))
                    {
                        property.SetValueConverter(utcConverter);
                    }
                    else if (property.ClrType == typeof(DateTime?))
                    {
                        property.SetValueConverter(nullableUtcConverter);
                    }
                }
            }
        }
    }
}
