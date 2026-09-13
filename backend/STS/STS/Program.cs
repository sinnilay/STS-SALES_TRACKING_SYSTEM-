using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using STS.Data;
using STS.Hubs;
using STS.Services;
using System.Text;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddEndpointsApiExplorer();

// CORS configuration
//builder.Services.AddCors(options =>
//{
//    options.AddPolicy("AllowFrontend",
//        policy =>
//        {
//            policy.WithOrigins("http://localhost:5173")
//                  .AllowAnyMethod()
//                  .AllowAnyHeader()
//                  .AllowCredentials();
//        });
//});
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        policy =>
        {
            policy.AllowAnyOrigin()
                  .AllowAnyMethod()
                  .AllowAnyHeader();
        });
});
// Database connection
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Authentication Service
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IEmailService, EmailService>();

// GPS Tracking module — lightweight SignalR hub for live location/presence updates
builder.Services.AddSignalR();

// JWT Authentication Configuration
var jwtSettings = builder.Configuration.GetSection("Jwt");
var key = Encoding.ASCII.GetBytes(jwtSettings["Key"] ?? throw new InvalidOperationException("JWT Key is missing"));

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidateAudience = true,
        ValidAudience = jwtSettings["Audience"],
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };

    // Browsers can't set an Authorization header on the WebSocket handshake, so
    // SignalR clients pass the JWT as a query string param for the hub path only.
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/gps"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

var app = builder.Build();

// Seed initial admin user
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var authService = scope.ServiceProvider.GetRequiredService<IAuthService>();
    
    // Auto-migrate schema for EnabledModules column if missing in SQL database
    try
    {
        context.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID(N'[Companies]') 
                AND name = 'EnabledModules'
            )
            BEGIN
                ALTER TABLE [Companies] ADD [EnabledModules] nvarchar(max) NOT NULL DEFAULT N'STS';
            END

            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID(N'[Companies]') 
                AND name = 'AccountType'
            )
            BEGIN
                ALTER TABLE [Companies] ADD [AccountType] nvarchar(max) NOT NULL DEFAULT N'Permanent';
            END

            IF NOT EXISTS (
                SELECT * FROM sys.columns
                WHERE object_id = OBJECT_ID(N'[Users]')
                AND name = 'ProfilePicturePath'
            )
            BEGIN
                ALTER TABLE [Users] ADD [ProfilePicturePath] nvarchar(max) NULL;
            END

            IF NOT EXISTS (
                SELECT * FROM sys.columns
                WHERE object_id = OBJECT_ID(N'[SalesRecords]')
                AND name = 'MeetingScheduledAt'
            )
            BEGIN
                ALTER TABLE [SalesRecords] ADD [MeetingScheduledAt] datetime2 NULL;
            END

            IF NOT EXISTS (
                SELECT * FROM sys.columns
                WHERE object_id = OBJECT_ID(N'[SalesRecords]')
                AND name = 'MeetingMode'
            )
            BEGIN
                ALTER TABLE [SalesRecords] ADD [MeetingMode] nvarchar(20) NULL;
            END

            IF NOT EXISTS (
                SELECT * FROM sys.tables
                WHERE name = N'SiteImages'
            )
            BEGIN
                CREATE TABLE [SiteImages] (
                    [Id] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [SalesDataId] int NOT NULL,
                    [UploadedById] int NOT NULL,
                    [TenantCompanyId] int NULL,
                    [FileName] nvarchar(max) NOT NULL,
                    [UploadMethod] nvarchar(max) NOT NULL DEFAULT N'Manual Upload',
                    [CapturedAt] datetime2 NOT NULL
                );
            END

            IF NOT EXISTS (
                SELECT * FROM sys.columns
                WHERE object_id = OBJECT_ID(N'[Users]')
                AND name = 'LastLatitude'
            )
            BEGIN
                ALTER TABLE [Users] ADD [LastLatitude] float NULL;
            END

            IF NOT EXISTS (
                SELECT * FROM sys.columns
                WHERE object_id = OBJECT_ID(N'[Users]')
                AND name = 'LastLongitude'
            )
            BEGIN
                ALTER TABLE [Users] ADD [LastLongitude] float NULL;
            END

            IF NOT EXISTS (
                SELECT * FROM sys.columns
                WHERE object_id = OBJECT_ID(N'[Users]')
                AND name = 'LastLocationAt'
            )
            BEGIN
                ALTER TABLE [Users] ADD [LastLocationAt] datetime2 NULL;
            END

            IF NOT EXISTS (
                SELECT * FROM sys.columns
                WHERE object_id = OBJECT_ID(N'[Users]')
                AND name = 'LastSeenAt'
            )
            BEGIN
                ALTER TABLE [Users] ADD [LastSeenAt] datetime2 NULL;
            END

            IF NOT EXISTS (
                SELECT * FROM sys.tables
                WHERE name = N'TrialRequests'
            )
            BEGIN
                CREATE TABLE [TrialRequests] (
                    [Id] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [CompanyName] nvarchar(max) NOT NULL,
                    [OwnerName] nvarchar(max) NOT NULL,
                    [OwnerEmail] nvarchar(max) NOT NULL,
                    [OwnerContact] nvarchar(max) NOT NULL,
                    [City] nvarchar(max) NOT NULL,
                    [State] nvarchar(max) NOT NULL,
                    [Country] nvarchar(max) NOT NULL,
                    [Industry] nvarchar(max) NULL,
                    [StaffLimit] int NOT NULL DEFAULT 10,
                    [AdminPasswordHash] nvarchar(max) NOT NULL,
                    [Status] nvarchar(max) NOT NULL DEFAULT N'Pending',
                    [RejectionReason] nvarchar(max) NULL,
                    [CreatedAt] datetime2 NOT NULL,
                    [ProcessedAt] datetime2 NULL
                );
            END
        ");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Database Migration Check Notice: {ex.Message}");
    }

    if (!context.Users.Any(u => u.Email == "stsadmin@gmail.com"))
    {
        context.Users.Add(new STS.Models.User
        {
            Email = "stsadmin@gmail.com",
            PasswordHash = authService.HashPassword("Admin@123"),
            Role = "Admin",
            Department = "System Admin",
            Address = "Headquarters",
            IsActive = true
        });
        context.SaveChanges();
    }

    if (!context.Users.Any(u => u.Email == "superadmin@sts.com"))
    {
        context.Users.Add(new STS.Models.User
        {
            Email = "superadmin@sts.com",
            PasswordHash = authService.HashPassword("SuperAdmin@123"),
            Role = "SuperAdmin",
            Department = "Global HQ",
            Address = "Global HQ",
            IsActive = true
        });
        context.SaveChanges();
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseHttpsRedirection();

// Serve uploaded employee profile pictures from a dedicated folder in the backend project
var profilePicsPath = Path.Combine(app.Environment.ContentRootPath, "profilepics");
Directory.CreateDirectory(profilePicsPath);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(profilePicsPath),
    RequestPath = "/profilepics"
});

// Serve Field Sales site-visit photos from a dedicated folder in the backend project
var siteImagesPath = Path.Combine(app.Environment.ContentRootPath, "siteimages");
Directory.CreateDirectory(siteImagesPath);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(siteImagesPath),
    RequestPath = "/siteimages"
});

//app.UseCors("AllowFrontend");
app.UseCors("AllowAll");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<GpsHub>("/hubs/gps");

app.Run();
