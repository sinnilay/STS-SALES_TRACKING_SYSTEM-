using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using STS.Data;
using STS.Hubs;
using STS.Services;
using System.Text;
using Scalar.AspNetCore;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.ResponseCompression;
using System.IO.Compression;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();

// JSON list responses (STS records, reports) compress ~10x; this matters most in production
// where every byte crosses the internet.
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
});
builder.Services.Configure<BrotliCompressionProviderOptions>(options => options.Level = CompressionLevel.Fastest);
builder.Services.Configure<GzipCompressionProviderOptions>(options => options.Level = CompressionLevel.Fastest);
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddEndpointsApiExplorer();

// CORS: only the configured frontend origins may call the API. Credentials are allowed
// because the SignalR GPS hub needs them, which rules out a wildcard origin.
var frontendUrl = (builder.Configuration["FrontendUrl"] ?? "https://stserp.ideaspromotion.com").TrimEnd('/');
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                     ?? new[] { frontendUrl };
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            policy.WithOrigins(allowedOrigins)
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .AllowCredentials();
        });
});

// The API sits behind a reverse proxy / IIS in production; trust its forwarded headers
// so HTTPS redirection and client IPs see the original request.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// Database connection
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Authentication Service
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IEmailService, EmailService>();

// Keeps the IIS app pool from idling out so logins don't hit a ~20s cold start.
builder.Services.AddHostedService<KeepAliveService>();

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
                WHERE object_id = OBJECT_ID(N'[Companies]') 
                AND name = 'LogoUrl'
            )
            BEGIN
                ALTER TABLE [Companies] ADD [LogoUrl] nvarchar(max) NULL;
            END

            IF NOT EXISTS (
                SELECT * FROM sys.columns
                WHERE object_id = OBJECT_ID(N'[Users]')
                AND name = 'ProfilePicturePath'
            )
            BEGIN
                ALTER TABLE [Users] ADD [ProfilePicturePath] nvarchar(max) NULL;
            END

            IF OBJECT_ID(N'[EmployeeQualifications]', N'U') IS NULL
            BEGIN
                CREATE TABLE [EmployeeQualifications] (
                    [Id] int NOT NULL IDENTITY(1,1) PRIMARY KEY,
                    [Name] nvarchar(max) NOT NULL,
                    [CompanyId] int NULL
                );
            END

            IF COL_LENGTH('Users', 'BankName') IS NULL ALTER TABLE [Users] ADD [BankName] nvarchar(max) NOT NULL DEFAULT N'';
            IF COL_LENGTH('Users', 'BankBranch') IS NULL ALTER TABLE [Users] ADD [BankBranch] nvarchar(max) NOT NULL DEFAULT N'';
            IF COL_LENGTH('Users', 'AccountHolderName') IS NULL ALTER TABLE [Users] ADD [AccountHolderName] nvarchar(max) NOT NULL DEFAULT N'';
            IF COL_LENGTH('Users', 'AccountNumber') IS NULL ALTER TABLE [Users] ADD [AccountNumber] nvarchar(max) NOT NULL DEFAULT N'';
            IF COL_LENGTH('Users', 'PanCardNo') IS NULL ALTER TABLE [Users] ADD [PanCardNo] nvarchar(max) NOT NULL DEFAULT N'';
            IF COL_LENGTH('Users', 'LocalRefName') IS NULL ALTER TABLE [Users] ADD [LocalRefName] nvarchar(max) NOT NULL DEFAULT N'';
            IF COL_LENGTH('Users', 'LocalRefRelation') IS NULL ALTER TABLE [Users] ADD [LocalRefRelation] nvarchar(max) NOT NULL DEFAULT N'';
            IF COL_LENGTH('Users', 'LocalRefContact') IS NULL ALTER TABLE [Users] ADD [LocalRefContact] nvarchar(max) NOT NULL DEFAULT N'';
            IF COL_LENGTH('Users', 'AadhaarDocPath') IS NULL ALTER TABLE [Users] ADD [AadhaarDocPath] nvarchar(max) NULL;
            IF COL_LENGTH('Users', 'PanDocPath') IS NULL ALTER TABLE [Users] ADD [PanDocPath] nvarchar(max) NULL;

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

            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID(N'[DsrEntries]') 
                AND name = 'ConvertedFor'
            )
            BEGIN
                ALTER TABLE [DsrEntries] ADD [ConvertedFor] nvarchar(max) NULL;
            END

            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID(N'[DsrEntries]') 
                AND name = 'ConvertedPrice'
            )
            BEGIN
                ALTER TABLE [DsrEntries] ADD [ConvertedPrice] decimal(18,2) NULL;
            END

            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID(N'[DsrEntries]') 
                AND name = 'OtherStatusText'
            )
            BEGIN
                ALTER TABLE [DsrEntries] ADD [OtherStatusText] nvarchar(max) NULL;
            END

            IF NOT EXISTS (
                SELECT * FROM sys.columns
                WHERE object_id = OBJECT_ID(N'[DsrEntries]')
                AND name = 'UpdatedAsAdmin'
            )
            BEGIN
                ALTER TABLE [DsrEntries] ADD [UpdatedAsAdmin] bit NOT NULL DEFAULT 0;
            END

            IF NOT EXISTS (
                SELECT * FROM sys.columns
                WHERE object_id = OBJECT_ID(N'[TrialRequests]')
                AND name = 'PendingPassword'
            )
            BEGIN
                ALTER TABLE [TrialRequests] ADD [PendingPassword] nvarchar(max) NULL;
            END
        ");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Database Migration Check Notice: {ex.Message}");
    }

    // The paged STS list filters by tenant and sorts newest-first; this index serves that
    // directly instead of scanning and sorting every record.
    try
    {
        context.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS (
                SELECT * FROM sys.indexes
                WHERE name = N'IX_SalesRecords_TenantCompanyId_CreatedAt'
                AND object_id = OBJECT_ID(N'[SalesRecords]')
            )
            BEGIN
                CREATE INDEX [IX_SalesRecords_TenantCompanyId_CreatedAt]
                    ON [SalesRecords] ([TenantCompanyId], [CreatedAt] DESC, [Id] DESC);
            END
        ");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Database Index Check Notice: {ex.Message}");
    }

    // Extra holders of an STS record beyond AllocatedToId (e.g. Field Sales + Tele Sales).
    try
    {
        context.Database.ExecuteSqlRaw(@"
            IF OBJECT_ID(N'[StsCoAssignees]', N'U') IS NULL
            BEGIN
                CREATE TABLE [StsCoAssignees] (
                    [Id] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [TenantCompanyId] int NULL,
                    [SalesDataId] int NOT NULL,
                    [EmployeeId] int NOT NULL,
                    [AllocatorComment] nvarchar(max) NULL,
                    [AssignedAt] datetime2 NOT NULL,
                    CONSTRAINT [FK_StsCoAssignees_SalesRecords_SalesDataId] FOREIGN KEY ([SalesDataId]) REFERENCES [SalesRecords] ([Id]),
                    CONSTRAINT [FK_StsCoAssignees_Users_EmployeeId] FOREIGN KEY ([EmployeeId]) REFERENCES [Users] ([Id])
                );
                CREATE UNIQUE INDEX [IX_StsCoAssignees_SalesDataId_EmployeeId] ON [StsCoAssignees] ([SalesDataId], [EmployeeId]);
                CREATE INDEX [IX_StsCoAssignees_EmployeeId_SalesDataId] ON [StsCoAssignees] ([EmployeeId], [SalesDataId]);
            END
        ");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Database Co-Assignee Table Notice: {ex.Message}");
    }

    // Composite indexes behind Employee Analytics (and the DSR / site-visit views). Without them
    // every per-tenant, per-employee or per-period aggregate scans the wide SalesRecords /
    // DsrEntries tables, which gets very slow once production data grows. The first run can
    // take a while on large tables, so it gets a longer timeout than normal queries.
    var previousTimeout = context.Database.GetCommandTimeout();
    try
    {
        context.Database.SetCommandTimeout(TimeSpan.FromMinutes(10));
        context.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_DsrEntries_Tenant_Employee_CreatedAt' AND object_id = OBJECT_ID(N'[DsrEntries]'))
                CREATE INDEX [IX_DsrEntries_Tenant_Employee_CreatedAt]
                    ON [DsrEntries] ([TenantCompanyId], [EmployeeId], [CreatedAt])
                    INCLUDE ([SalesDataId], [NewStatus], [ConvertedPrice]);

            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_DsrEntries_Tenant_CreatedAt' AND object_id = OBJECT_ID(N'[DsrEntries]'))
                CREATE INDEX [IX_DsrEntries_Tenant_CreatedAt]
                    ON [DsrEntries] ([TenantCompanyId], [CreatedAt])
                    INCLUDE ([EmployeeId], [SalesDataId], [NewStatus], [ConvertedPrice]);

            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_DsrEntries_SalesDataId_EmployeeId' AND object_id = OBJECT_ID(N'[DsrEntries]'))
                CREATE INDEX [IX_DsrEntries_SalesDataId_EmployeeId]
                    ON [DsrEntries] ([SalesDataId], [EmployeeId]);

            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_SalesRecords_Tenant_AllocatedToId' AND object_id = OBJECT_ID(N'[SalesRecords]'))
                CREATE INDEX [IX_SalesRecords_Tenant_AllocatedToId]
                    ON [SalesRecords] ([TenantCompanyId], [AllocatedToId]);

            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_SalesRecords_Tenant_EmployeeId_CreatedAt' AND object_id = OBJECT_ID(N'[SalesRecords]'))
                CREATE INDEX [IX_SalesRecords_Tenant_EmployeeId_CreatedAt]
                    ON [SalesRecords] ([TenantCompanyId], [EmployeeId], [CreatedAt]);

            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_StsCoAssignees_Tenant_EmployeeId' AND object_id = OBJECT_ID(N'[StsCoAssignees]'))
                CREATE INDEX [IX_StsCoAssignees_Tenant_EmployeeId]
                    ON [StsCoAssignees] ([TenantCompanyId], [EmployeeId])
                    INCLUDE ([SalesDataId]);

            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_SiteImages_Tenant_UploadedBy_CapturedAt' AND object_id = OBJECT_ID(N'[SiteImages]'))
                CREATE INDEX [IX_SiteImages_Tenant_UploadedBy_CapturedAt]
                    ON [SiteImages] ([TenantCompanyId], [UploadedById], [CapturedAt]);

            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_StsAllocationRequests_Tenant_RequestedBy' AND object_id = OBJECT_ID(N'[StsAllocationRequests]'))
                CREATE INDEX [IX_StsAllocationRequests_Tenant_RequestedBy]
                    ON [StsAllocationRequests] ([TenantCompanyId], [RequestedById])
                    INCLUDE ([Status]);
        ");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Database Analytics Index Notice: {ex.Message}");
    }
    finally
    {
        context.Database.SetCommandTimeout(previousTimeout);
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
app.UseForwardedHeaders();
app.UseResponseCompression();

// API docs (Scalar at /scalar/v1) stay available in production as well.
app.MapOpenApi();
app.MapScalarApiReference();

// The API has no UI of its own — send anyone hitting the root to the frontend.
app.MapGet("/", () => Results.Redirect(frontendUrl)).ExcludeFromDescription();

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

// Serve uploaded company logos from a dedicated folder in the backend project
var companyLogosPath = Path.Combine(app.Environment.ContentRootPath, "companylogos");
Directory.CreateDirectory(companyLogosPath);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(companyLogosPath),
    RequestPath = "/companylogos"
});

app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<GpsHub>("/hubs/gps");

app.Run();
