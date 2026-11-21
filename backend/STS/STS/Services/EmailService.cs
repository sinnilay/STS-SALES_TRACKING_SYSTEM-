using System.Threading.Tasks;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;
using MimeKit.Utils;
using Microsoft.AspNetCore.Hosting;
using STS.Models;

namespace STS.Services
{
    public class EmailService : IEmailService
    {
        private readonly IConfiguration _config;
        private readonly ILogger<EmailService> _logger;
        private readonly IWebHostEnvironment _env;

        public EmailService(IConfiguration config, ILogger<EmailService> logger, IWebHostEnvironment env)
        {
            _config = config;
            _logger = logger;
            _env = env;
        }

        // A company logo is stored as an absolute URL pointing back at this server
        // (http://localhost:5100/companylogos/... in dev, and anything not publicly
        // reachable in a self-hosted setup), and no mail client can load that — which is
        // why the header image arrived broken. When the file is one of ours on disk we
        // attach it inline and reference it by cid:, which renders everywhere; a logo
        // hosted somewhere else is still linked by URL.
        private string BuildCompanyLogoHtml(BodyBuilder bodyBuilder, string? logoUrl, string? companyName)
        {
            var name = System.Net.WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(companyName) ? "ERP SYSTEM" : companyName);
            string? src = null;

            if (!string.IsNullOrWhiteSpace(logoUrl))
            {
                src = logoUrl;
                var localPath = TryResolveLocalLogoPath(logoUrl);
                if (localPath != null)
                {
                    try
                    {
                        var resource = bodyBuilder.LinkedResources.Add(localPath);
                        resource.ContentId = MimeUtils.GenerateMessageId();
                        src = $"cid:{resource.ContentId}";
                    }
                    catch (System.Exception ex)
                    {
                        _logger.LogWarning(ex, "Could not embed company logo {path}; falling back to its URL.", localPath);
                    }
                }
            }

            // With no logo to show, a wordmark beats an <img> that renders as a broken
            // icon — which is what the old hard-coded image host was doing.
            if (src == null)
            {
                return $"<div style='font-size: 20px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;'>{name}</div>";
            }

            return $"<img src='{System.Net.WebUtility.HtmlEncode(src)}' alt='{name} Logo' style='max-height: 48px; max-width: 180px; object-fit: contain; display: block; margin: 0 auto;' />";
        }

        // Maps an uploaded-logo URL back to the file this server serves it from,
        // or null when the URL points at someone else's host.
        private string? TryResolveLocalLogoPath(string logoUrl)
        {
            const string segment = "/companylogos/";
            var index = logoUrl.IndexOf(segment, System.StringComparison.OrdinalIgnoreCase);
            if (index < 0) return null;

            var fileName = Path.GetFileName(logoUrl.Substring(index + segment.Length).Split('?')[0]);
            if (string.IsNullOrWhiteSpace(fileName)) return null;

            var path = Path.Combine(_env.ContentRootPath, "companylogos", fileName);
            return File.Exists(path) ? path : null;
        }

        // Port 465 is implicit TLS; port 25/587 with EnableSsl means STARTTLS.
        // Auto lets MailKit negotiate, which fails on some servers that
        // advertise STARTTLS incorrectly, so we pick explicitly instead.
        private static SecureSocketOptions GetSecureSocketOptions(Microsoft.Extensions.Configuration.IConfigurationSection emailSettings)
        {
            var port = int.Parse(emailSettings["Port"]);
            var enableSsl = bool.TryParse(emailSettings["EnableSsl"], out var parsed) ? parsed : true;

            if (!enableSsl) return SecureSocketOptions.None;
            return port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls;
        }

        public async Task SendWelcomeEmailAsync(string toEmail, string fullName, string password, string? companyLogoUrl = null, string? companyName = null, IEnumerable<string>? ccEmails = null)
        {
            try
            {
                var emailSettings = _config.GetSection("EmailSettings");

                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(
                    emailSettings["SenderName"], 
                    emailSettings["SenderEmail"]
                ));
                message.To.Add(new MailboxAddress(fullName, toEmail));
                foreach (var cc in (ccEmails ?? Enumerable.Empty<string>())
                    .Where(e => !string.IsNullOrWhiteSpace(e) && !string.Equals(e, toEmail, StringComparison.OrdinalIgnoreCase))
                    .Distinct(StringComparer.OrdinalIgnoreCase))
                {
                    message.Cc.Add(MailboxAddress.Parse(cc));
                }
                message.Subject = "Welcome to ERP SYSTEM - STS Login Credentials";

                var bodyBuilder = new BodyBuilder();
                
                string logoHtml = BuildCompanyLogoHtml(bodyBuilder, companyLogoUrl, companyName);

                bodyBuilder.HtmlBody = $@"
                    <div style='font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);'>
                        <div style='background-color: #2563eb; color: #fff; padding: 20px; text-align: center;'>
                            {logoHtml}
                            <h2 style='margin: 15px 0 0 0; font-size: 24px;'>Welcome to ERP SYSTEM!</h2>
                        </div>
                        <div style='padding: 30px; background-color: #fafafa;'>
                            <p style='font-size: 16px; margin-bottom: 20px;'>Hi <strong>{fullName}</strong>,</p>
                            <p style='font-size: 16px; margin-bottom: 20px;'>
                                We are thrilled to welcome you to our team! Your account for the <strong>STS (Sales Tracking System)</strong> has been successfully created.
                            </p>
                            <div style='background-color: #fff; border: 1px solid #eee; padding: 20px; border-radius: 6px; margin-bottom: 20px;'>
                                <h3 style='margin-top: 0; color: #2563eb; font-size: 18px;'>Your Login Credentials</h3>
                                <p style='margin: 10px 0;'><strong>User ID (Email):</strong> {toEmail}</p>
                                <p style='margin: 10px 0;'><strong>Password:</strong> {password}</p>
                            </div>
                            <p style='font-size: 14px; color: #666;'>
                                Please log in to the portal and ensure you keep these credentials secure. We recommend changing your password after your first login if the system permits.
                            </p>
                            <a href='https://weberp.ideaspromotion.com/login' style='display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold;'>Login to STS Portal</a>
                        </div>
                        <div style='background-color: #f1f5f9; padding: 15px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;'>
                            <p style='margin: 0;'>© {System.DateTime.Now.Year} ERP SYSTEM. All rights reserved.</p>
                            <p style='margin: 5px 0 0 0;'>This is an automated message, please do not reply.</p>
                        </div>
                    </div>
                ";

                message.Body = bodyBuilder.ToMessageBody();

                using var client = new SmtpClient();

                // For development/debugging if cert is invalid, we bypass the validation:
                client.ServerCertificateValidationCallback = (s, c, h, e) => true;

                await client.ConnectAsync(
                    emailSettings["SmtpServer"],
                    int.Parse(emailSettings["Port"]),
                    GetSecureSocketOptions(emailSettings)
                );

                await client.AuthenticateAsync(
                    emailSettings["SenderEmail"],
                    emailSettings["Password"]
                );

                await client.SendAsync(message);
                await client.DisconnectAsync(true);

                _logger.LogInformation("Welcome email sent successfully to {email}", toEmail);
            }
            catch (System.Exception ex)
            {
                _logger.LogError(ex, "Failed to send welcome email to {email}", toEmail);
                // We don't throw so it doesn't break the user creation flow
            }
        }

        public async Task SendOtpEmailAsync(string toEmail, string otp)
        {
            try
            {
                var emailSettings = _config.GetSection("EmailSettings");
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress("ERP SYSTEM", emailSettings["SenderEmail"]));
                message.To.Add(new MailboxAddress("", toEmail));
                message.Subject = "ERP SYSTEM - Email Verification OTP";

                var bodyBuilder = new BodyBuilder();
                string logoHtml = BuildCompanyLogoHtml(bodyBuilder, null, null);

                bodyBuilder.HtmlBody = $@"
                    <div style='font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);'>
                        <div style='background-color: #2563eb; color: #fff; padding: 20px; text-align: center;'>
                            {logoHtml}
                            <h2 style='margin: 15px 0 0 0; font-size: 24px;'>Email Verification OTP</h2>
                        </div>
                        <div style='padding: 30px; background-color: #fafafa;'>
                            <p style='font-size: 16px; margin-bottom: 20px;'>Hello,</p>
                            <p style='font-size: 16px; margin-bottom: 20px;'>
                                You requested to change your email address. Please use the following 4-digit OTP to verify your new email:
                            </p>
                            <div style='background-color: #fff; padding: 15px; border-left: 4px solid #2563eb; margin-bottom: 20px; font-size: 28px; font-weight: bold; letter-spacing: 5px; text-align: center;'>
                                {otp}
                            </div>
                            <p style='font-size: 14px; color: #666;'>
                                If you did not request this change, please ignore this email or contact support. This OTP will expire in 15 minutes.
                            </p>
                        </div>
                        <div style='background-color: #eee; color: #888; text-align: center; padding: 15px; font-size: 12px;'>
                            &copy; {DateTime.UtcNow.Year} ERP SYSTEM. All rights reserved.
                        </div>
                    </div>
                ";

                message.Body = bodyBuilder.ToMessageBody();

                using var client = new SmtpClient();
                // For development with self-signed certificates
                client.ServerCertificateValidationCallback = (s, c, h, e) => true;

                await client.ConnectAsync(
                    emailSettings["SmtpServer"],
                    int.Parse(emailSettings["Port"]),
                    GetSecureSocketOptions(emailSettings)
                );
                await client.AuthenticateAsync(emailSettings["SenderEmail"], emailSettings["Password"]);
                await client.SendAsync(message);
                await client.DisconnectAsync(true);
            }
            catch (System.Exception ex)
            {
                _logger.LogError(ex, "Failed to send OTP email to {email}", toEmail);
                throw new ApplicationException("Could not send OTP email. Please try again later.");
            }
        }

        public async Task SendTrialRequestNotificationAsync(TrialRequest request)
        {
            try
            {
                var emailSettings = _config.GetSection("EmailSettings");
                var superAdminEmail = _config["Superadminmailid"];

                if (string.IsNullOrWhiteSpace(superAdminEmail))
                {
                    _logger.LogWarning("Superadminmailid is not configured. Skipping trial request notification email.");
                    return;
                }

                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(
                    emailSettings["SenderName"],
                    emailSettings["SenderEmail"]
                ));
                message.To.Add(new MailboxAddress("Super Admin", superAdminEmail));
                message.Subject = $"New 7-Day Free Trial Request — {request.CompanyName}";

                var bodyBuilder = new BodyBuilder();
                string logoHtml = BuildCompanyLogoHtml(bodyBuilder, null, null);
                string portalUrl = _config["FrontendBaseUrl"] ?? "https://sts.ideaspromotion.com";
                string approveUrl = $"{portalUrl.TrimEnd('/')}/superadmin/trial-requests";

                string Row(string label, string value) => $@"
                    <tr>
                        <td style='padding: 10px 0; border-bottom: 1px solid #eef0f3; font-size: 14px; color: #64748b; width: 40%;'>{label}</td>
                        <td style='padding: 10px 0; border-bottom: 1px solid #eef0f3; font-size: 14px; color: #0f172a; font-weight: 600;'>{value}</td>
                    </tr>";

                bodyBuilder.HtmlBody = $@"
                    <div style='font-family: Segoe UI, Arial, sans-serif; color: #333; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 6px 16px rgba(15,23,42,0.08);'>
                        <div style='background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; padding: 28px 20px; text-align: center;'>
                            {logoHtml}
                            <p style='margin: 16px 0 4px 0; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.85;'>7-Day Free Trial</p>
                            <h2 style='margin: 0; font-size: 22px;'>New Trial Request Awaiting Approval</h2>
                        </div>
                        <div style='padding: 30px; background-color: #ffffff;'>
                            <p style='font-size: 15px; margin: 0 0 20px 0;'>Hello Super Admin,</p>
                            <p style='font-size: 15px; margin: 0 0 24px 0; color: #334155;'>
                                A new company has requested a <strong>7-Day Free Trial</strong> on the STS platform. Please review the details below and approve or reject the request from the Super Admin portal.
                            </p>
                            <table style='width: 100%; border-collapse: collapse; background-color: #f8fafc; border: 1px solid #eef0f3; border-radius: 8px; padding: 4px 16px;' cellpadding='0' cellspacing='0'>
                                <tbody>
                                    {Row("Company / Property", request.CompanyName)}
                                    {Row("Owner / Manager", request.OwnerName)}
                                    {Row("Work Email", request.OwnerEmail)}
                                    {Row("Mobile Contact", request.OwnerContact)}
                                    {Row("Industry Sector", string.IsNullOrWhiteSpace(request.Industry) ? "Not specified" : request.Industry)}
                                    {Row("Location", $"{request.City}, {request.State}, {request.Country}")}
                                    {Row("Staff Member Limit", request.StaffLimit.ToString())}
                                    {Row("Submitted On", request.CreatedAt.ToString("dd MMM yyyy, hh:mm tt") + " UTC")}
                                </tbody>
                            </table>
                            <div style='text-align: center; margin-top: 30px;'>
                                <a href='{approveUrl}' style='display: inline-block; padding: 13px 32px; background-color: #4f46e5; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;'>Review &amp; Approve Request</a>
                            </div>
                            <p style='font-size: 13px; color: #94a3b8; margin-top: 24px; text-align: center;'>
                                Approving this request will instantly provision a 7-day trial workspace and create the admin login for {request.OwnerEmail}.
                            </p>
                        </div>
                        <div style='background-color: #f1f5f9; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;'>
                            <p style='margin: 0;'>© {System.DateTime.Now.Year} ERP SYSTEM. All rights reserved.</p>
                            <p style='margin: 5px 0 0 0;'>This is an automated notification, please do not reply.</p>
                        </div>
                    </div>
                ";

                message.Body = bodyBuilder.ToMessageBody();

                using var client = new SmtpClient();
                client.ServerCertificateValidationCallback = (s, c, h, e) => true;

                await client.ConnectAsync(
                    emailSettings["SmtpServer"],
                    int.Parse(emailSettings["Port"]),
                    GetSecureSocketOptions(emailSettings)
                );

                await client.AuthenticateAsync(
                    emailSettings["SenderEmail"],
                    emailSettings["Password"]
                );

                await client.SendAsync(message);
                await client.DisconnectAsync(true);

                _logger.LogInformation("Trial request notification email sent to Super Admin for company {company}", request.CompanyName);
            }
            catch (System.Exception ex)
            {
                _logger.LogError(ex, "Failed to send trial request notification email for company {company}", request.CompanyName);
                // We don't throw so it doesn't break the trial request submission flow
            }
        }

        public async Task SendStsUpdateNotificationAsync(StsUpdateNotificationData data)
        {
            if (data.ToEmails.Count == 0)
            {
                _logger.LogWarning("No admin email on file — skipping STS update notification for company {company}", data.CompanyName);
                return;
            }

            try
            {
                var emailSettings = _config.GetSection("EmailSettings");

                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(emailSettings["SenderName"], emailSettings["SenderEmail"]));
                foreach (var to in data.ToEmails) message.To.Add(MailboxAddress.Parse(to));
                foreach (var cc in data.CcEmails) message.Cc.Add(MailboxAddress.Parse(cc));

                // Short status codes only (e.g. C_B) — the full-form label is intentionally not shown.
                var previousLabel = string.IsNullOrWhiteSpace(data.PreviousStatus) ? "New" : data.PreviousStatus;
                var newLabel = data.NewStatus == "OTHER" && !string.IsNullOrWhiteSpace(data.OtherStatusText)
                    ? data.OtherStatusText
                    : data.NewStatus;

                message.Subject = !string.IsNullOrWhiteSpace(data.Subject)
                    ? data.Subject
                    : BuildStsUpdateSubject(data);

                bool isConverted = StsPipeline.IsConvertedStatus(data.NewStatus);
                string statusColor = isConverted ? "#059669" : "#4f46e5";

                string Row(string label, string? value) => string.IsNullOrWhiteSpace(value) ? "" : $@"
                    <tr>
                        <td style='padding: 9px 0; border-bottom: 1px solid #eef0f3; font-size: 13px; color: #64748b; width: 38%; vertical-align: top;'>{label}</td>
                        <td style='padding: 9px 0; border-bottom: 1px solid #eef0f3; font-size: 13px; color: #0f172a; font-weight: 600;'>{System.Net.WebUtility.HtmlEncode(value)}</td>
                    </tr>";

                string contactLine = string.Join(", ", new[] { data.CityDistrict, data.State, data.Country }.Where(s => !string.IsNullOrWhiteSpace(s)));
                // Just one phone number — same priority the STS details drawer uses
                // (Mobile1 first, falling back to the landline PhoneNumber), not
                // every number slash-joined and not the first one that happens to
                // be populated in a different field order.
                string phone = new[] { data.Mobile1, data.PhoneNumber, data.Mobile2 }.FirstOrDefault(s => !string.IsNullOrWhiteSpace(s)) ?? "";

                // No logo in the status-update email — client asked for it to be removed.
                var bodyBuilder = new BodyBuilder();

                bodyBuilder.HtmlBody = $@"
                    <div style='font-family: Segoe UI, Arial, sans-serif; color: #333; max-width: 640px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 6px 16px rgba(15,23,42,0.08);'>
                        <div style='background: linear-gradient(135deg, {statusColor}, #4338ca); color: #fff; padding: 26px 20px; text-align: center;'>
                            <p style='margin: 0 0 4px 0; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.85;'>{System.Net.WebUtility.HtmlEncode(data.TenantCompanyName)} · STS</p>
                            <h2 style='margin: 0; font-size: 21px;'>Status Update Logged</h2>
                        </div>
                        <div style='padding: 28px 30px; background-color: #ffffff;'>
                            <p style='font-size: 15px; margin: 0 0 6px 0;'>
                                <strong>{System.Net.WebUtility.HtmlEncode(data.UpdatedByName)}</strong>
                                {(string.IsNullOrWhiteSpace(data.UpdatedByRole) ? "" : $"<span style='color:#64748b;'>({System.Net.WebUtility.HtmlEncode(data.UpdatedByRole)})</span>")}
                                logged a new STS update for:
                            </p>
                            <h3 style='margin: 4px 0 20px 0; font-size: 19px; color: #0f172a;'>
                                {System.Net.WebUtility.HtmlEncode(data.CompanyName)}
                                <span style='font-weight: 400; color: #94a3b8; font-size: 14px;'>({data.CompanyID})</span>
                            </h3>

                            <div style='display: flex; align-items: center; gap: 10px; margin-bottom: 22px; flex-wrap: wrap;'>
                                <span style='padding: 6px 14px; border-radius: 999px; background: #f1f5f9; color: #475569; font-size: 13px; font-weight: 600;'>{System.Net.WebUtility.HtmlEncode(previousLabel)}</span>
                                <span style='color: #94a3b8; font-size: 15px;'>&rarr;</span>
                                <span style='padding: 6px 14px; border-radius: 999px; background: {statusColor}1a; color: {statusColor}; font-size: 13px; font-weight: 700;'>{System.Net.WebUtility.HtmlEncode(newLabel)}</span>
                            </div>

                            <div style='margin-bottom: 20px; padding: 16px 18px; background-color: #f8fafc; border-left: 4px solid {statusColor}; border-radius: 6px;'>
                                <p style='margin: 0 0 4px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b;'>Comments</p>
                                <p style='margin: 0; font-size: 14px; color: #334155; white-space: pre-wrap;'>{System.Net.WebUtility.HtmlEncode(data.Comment)}</p>
                            </div>

                            <table style='width: 100%; border-collapse: collapse; background-color: #f8fafc; border: 1px solid #eef0f3; border-radius: 8px; padding: 4px 16px;' cellpadding='0' cellspacing='0'>
                                <tbody>
                                    {Row("Priority", data.Priority)}
                                    {Row("Call / Meeting Date", data.CallMeetingDate?.ToString("dd MMM yyyy"))}
                                    {Row("Next Call / Meeting Date", data.NextCallMeetingDate?.ToString("dd MMM yyyy"))}
                                    {Row("Subject", data.Subject)}
                                    {(isConverted ? Row("Converted For", data.ConvertedFor) : "")}
                                    {(isConverted ? Row("Price", data.ConvertedPrice?.ToString("N2")) : "")}
                                    {Row("Contact Person", data.ContactPerson)}
                                    {Row("Phone", phone)}
                                    {Row("Location", contactLine)}
                                </tbody>
                            </table>
                        </div>
                        <div style='background-color: #f1f5f9; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;'>
                            <p style='margin: 0;'>This is an automated notification, please do not reply.</p>
                        </div>
                    </div>
                    ";

                message.Body = bodyBuilder.ToMessageBody();

                using var client = new SmtpClient();
                client.ServerCertificateValidationCallback = (s, c, h, e) => true;

                await client.ConnectAsync(
                    emailSettings["SmtpServer"],
                    int.Parse(emailSettings["Port"]),
                    GetSecureSocketOptions(emailSettings)
                );

                await client.AuthenticateAsync(
                    emailSettings["SenderEmail"],
                    emailSettings["Password"]
                );

                await client.SendAsync(message);
                await client.DisconnectAsync(true);

                _logger.LogInformation("STS update notification email sent for company {company}", data.CompanyName);
            }
            catch (System.Exception ex)
            {
                _logger.LogError(ex, "Failed to send STS update notification email for company {company}", data.CompanyName);
                // We don't throw so it doesn't break the status update flow
            }
        }

        public async Task SendTrialApprovedEmailAsync(TrialRequest request, string? loginPassword, string loginUrl)
        {
            try
            {
                var emailSettings = _config.GetSection("EmailSettings");

                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(emailSettings["SenderName"], emailSettings["SenderEmail"]));
                message.To.Add(new MailboxAddress(request.OwnerName, request.OwnerEmail));
                message.Subject = $"You're approved! Your 7-Day Free Trial is ready — {request.CompanyName}";

                var bodyBuilder = new BodyBuilder();
                string logoHtml = BuildCompanyLogoHtml(bodyBuilder, null, null);

                string credentialsBlock = !string.IsNullOrWhiteSpace(loginPassword)
                    ? $@"
                        <p style='margin: 10px 0;'><strong>User ID (Email):</strong> {System.Net.WebUtility.HtmlEncode(request.OwnerEmail)}</p>
                        <p style='margin: 10px 0;'><strong>Password:</strong> {System.Net.WebUtility.HtmlEncode(loginPassword)}</p>"
                    : $@"
                        <p style='margin: 10px 0;'><strong>User ID (Email):</strong> {System.Net.WebUtility.HtmlEncode(request.OwnerEmail)}</p>
                        <p style='margin: 10px 0; color: #64748b;'>Use the password you set when you requested the trial.</p>";

                bodyBuilder.HtmlBody = $@"
                    <div style='font-family: Segoe UI, Arial, sans-serif; color: #333; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 6px 16px rgba(15,23,42,0.08);'>
                        <div style='background: linear-gradient(135deg, #059669, #10b981); color: #fff; padding: 28px 20px; text-align: center;'>
                            {logoHtml}
                            <p style='margin: 16px 0 4px 0; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.85;'>7-Day Free Trial</p>
                            <h2 style='margin: 0; font-size: 22px;'>Your Trial Workspace Is Live!</h2>
                        </div>
                        <div style='padding: 30px; background-color: #ffffff;'>
                            <p style='font-size: 15px; margin: 0 0 20px 0;'>Hi <strong>{System.Net.WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(request.OwnerName) ? request.CompanyName : request.OwnerName)}</strong>,</p>
                            <p style='font-size: 15px; margin: 0 0 20px 0; color: #334155;'>
                                Great news — your request for <strong>{System.Net.WebUtility.HtmlEncode(request.CompanyName)}</strong> has been approved.
                                Your 7-Day Free Trial workspace on the STS platform is provisioned and ready to use.
                            </p>
                            <div style='background-color: #fff; border: 1px solid #eee; padding: 20px; border-radius: 6px; margin-bottom: 20px;'>
                                <h3 style='margin-top: 0; color: #059669; font-size: 18px;'>Your Login Credentials</h3>
                                {credentialsBlock}
                            </div>
                            <p style='font-size: 13px; color: #94a3b8; margin: 0 0 24px 0;'>
                                Your trial is active until <strong>{DateTime.UtcNow.AddDays(7):dd MMM yyyy}</strong>. Reach out to us any time before then if you'd like to continue on a full plan.
                            </p>
                            <div style='text-align: center;'>
                                <a href='{loginUrl}' style='display: inline-block; padding: 13px 32px; background-color: #059669; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;'>Log In to STS Portal</a>
                            </div>
                        </div>
                        <div style='background-color: #f1f5f9; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;'>
                            <p style='margin: 0;'>© {DateTime.Now.Year} ERP SYSTEM. All rights reserved.</p>
                            <p style='margin: 5px 0 0 0;'>This is an automated message, please do not reply.</p>
                        </div>
                    </div>
                ";

                message.Body = bodyBuilder.ToMessageBody();

                using var client = new SmtpClient();
                client.ServerCertificateValidationCallback = (s, c, h, e) => true;

                await client.ConnectAsync(emailSettings["SmtpServer"], int.Parse(emailSettings["Port"]), GetSecureSocketOptions(emailSettings));
                await client.AuthenticateAsync(emailSettings["SenderEmail"], emailSettings["Password"]);
                await client.SendAsync(message);
                await client.DisconnectAsync(true);

                _logger.LogInformation("Trial approval email sent to {email} for company {company}", request.OwnerEmail, request.CompanyName);
            }
            catch (System.Exception ex)
            {
                _logger.LogError(ex, "Failed to send trial approval email for company {company}", request.CompanyName);
                // We don't throw so it doesn't break the approval flow — the account is already provisioned
            }
        }

        public async Task SendTrialRejectedEmailAsync(TrialRequest request)
        {
            try
            {
                var emailSettings = _config.GetSection("EmailSettings");

                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(emailSettings["SenderName"], emailSettings["SenderEmail"]));
                message.To.Add(new MailboxAddress(request.OwnerName, request.OwnerEmail));
                message.Subject = $"Update on your 7-Day Free Trial request — {request.CompanyName}";

                var bodyBuilder = new BodyBuilder();
                string logoHtml = BuildCompanyLogoHtml(bodyBuilder, null, null);
                string reason = string.IsNullOrWhiteSpace(request.RejectionReason) ? "Not specified" : request.RejectionReason;

                bodyBuilder.HtmlBody = $@"
                    <div style='font-family: Segoe UI, Arial, sans-serif; color: #333; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 6px 16px rgba(15,23,42,0.08);'>
                        <div style='background: linear-gradient(135deg, #64748b, #475569); color: #fff; padding: 28px 20px; text-align: center;'>
                            {logoHtml}
                            <p style='margin: 16px 0 4px 0; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.85;'>7-Day Free Trial</p>
                            <h2 style='margin: 0; font-size: 22px;'>Trial Request Update</h2>
                        </div>
                        <div style='padding: 30px; background-color: #ffffff;'>
                            <p style='font-size: 15px; margin: 0 0 20px 0;'>Hi <strong>{System.Net.WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(request.OwnerName) ? request.CompanyName : request.OwnerName)}</strong>,</p>
                            <p style='font-size: 15px; margin: 0 0 20px 0; color: #334155;'>
                                Thank you for your interest in the STS platform. After review, we're unable to approve your 7-Day Free Trial request for
                                <strong>{System.Net.WebUtility.HtmlEncode(request.CompanyName)}</strong> at this time.
                            </p>
                            <div style='background-color: #f8fafc; border-left: 4px solid #64748b; padding: 16px 18px; border-radius: 6px; margin-bottom: 20px;'>
                                <p style='margin: 0 0 4px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b;'>Reason</p>
                                <p style='margin: 0; font-size: 14px; color: #334155;'>{System.Net.WebUtility.HtmlEncode(reason)}</p>
                            </div>
                            <p style='font-size: 14px; color: #666;'>
                                If you believe this was a mistake or would like to provide more details, feel free to reach out to us or submit a new request.
                            </p>
                        </div>
                        <div style='background-color: #f1f5f9; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;'>
                            <p style='margin: 0;'>© {DateTime.Now.Year} ERP SYSTEM. All rights reserved.</p>
                            <p style='margin: 5px 0 0 0;'>This is an automated message, please do not reply.</p>
                        </div>
                    </div>
                ";

                message.Body = bodyBuilder.ToMessageBody();

                using var client = new SmtpClient();
                client.ServerCertificateValidationCallback = (s, c, h, e) => true;

                await client.ConnectAsync(emailSettings["SmtpServer"], int.Parse(emailSettings["Port"]), GetSecureSocketOptions(emailSettings));
                await client.AuthenticateAsync(emailSettings["SenderEmail"], emailSettings["Password"]);
                await client.SendAsync(message);
                await client.DisconnectAsync(true);

                _logger.LogInformation("Trial rejection email sent to {email} for company {company}", request.OwnerEmail, request.CompanyName);
            }
            catch (System.Exception ex)
            {
                _logger.LogError(ex, "Failed to send trial rejection email for company {company}", request.CompanyName);
                // We don't throw so it doesn't break the rejection flow
            }
        }

        public static string BuildStsUpdateSubject(StsUpdateNotificationData data)
        {
            string firstName = string.Empty;
            if (!string.IsNullOrWhiteSpace(data.UpdatedByName))
            {
                var titles = new[] { "mr", "mrs", "ms", "miss", "dr", "shri", "smt", "sri", "er", "prof" };
                var nameParts = data.UpdatedByName.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
                firstName = nameParts.FirstOrDefault(w => !titles.Contains(w.Replace(".", "").ToLowerInvariant())) ?? nameParts.FirstOrDefault() ?? string.Empty;
            }

            string role = data.UpdatedByRole ?? string.Empty;
            string prefix;

            if (role.Equals("Field Sales", StringComparison.OrdinalIgnoreCase))
            {
                prefix = $"Field Sales: {firstName}";
            }
            else if (role.Equals("Tele Sales", StringComparison.OrdinalIgnoreCase))
            {
                prefix = $"Telesales: {firstName}";
            }
            else if (role.Equals("Sub-Admin", StringComparison.OrdinalIgnoreCase) || role.Equals("SubAdmin", StringComparison.OrdinalIgnoreCase))
            {
                prefix = $"Sub-Admin: {firstName}";
            }
            else if (role.Equals("Admin", StringComparison.OrdinalIgnoreCase) || role.Equals("Administrator", StringComparison.OrdinalIgnoreCase))
            {
                prefix = $"Admin: {(string.IsNullOrWhiteSpace(firstName) ? "Admin" : firstName)}";
            }
            else
            {
                prefix = $"{role}: {firstName}";
            }

            string city = string.IsNullOrWhiteSpace(data.CityDistrict) ? string.Empty : $" {data.CityDistrict.Trim()}";
            string companyBlock = $"[ {data.CompanyName} {data.CompanyID}{city} ]";

            string statusText = data.NewStatus == "OTHER"
                ? (string.IsNullOrWhiteSpace(data.OtherStatusText) ? "OTHER" : $"OTHER ({data.OtherStatusText})")
                : data.NewStatus;

            return $"{prefix} {companyBlock} Status: {statusText}".Trim();
        }

        // ── STS allocation request emails ──────────────────────────────────────────

        public Task SendStsRequestSubmittedEmailAsync(StsRequestEmailData data)
        {
            string body = $@"
                <p style='font-size: 15px; margin: 0 0 14px 0;'>Dear Admin,</p>
                <p style='font-size: 14px; line-height: 1.6; margin: 0 0 22px 0; color: #334155;'>
                    <strong>{Enc(data.EmployeeName)}</strong> has requested allocation of an existing STS record that was flagged as a duplicate while adding a new STS.
                    Please review the details below and approve or reject the request.
                </p>"
                + StsRequestSection("Employee Details", new (string, string?)[]
                {
                    ("Name", data.EmployeeName),
                    ("Employee ID", data.EmployeeId.ToString()),
                    ("Email", data.EmployeeEmail),
                    ("Mobile", data.EmployeeMobile),
                    ("Designation", data.EmployeeDesignation),
                    ("Department", data.EmployeeDepartment),
                    ("Role", data.EmployeeRole),
                    ("City / Branch", data.EmployeeCityBranch),
                })
                + StsRecordSection(data)
                + StsRequestSection("Request Details", new (string, string?)[]
                {
                    ("Requested On", FormatIst(data.RequestedAt)),
                    ("Employee Comment", data.RequestComment),
                })
                + @"<p style='font-size: 14px; line-height: 1.6; margin: 22px 0 0 0; color: #334155;'>
                        Please log in to the STS Portal and go to <strong>STS &rsaquo; STS Request</strong> to take the necessary action.
                     </p>";

            return SendStsRequestEmailAsync(
                data,
                subject: $"STS Allocation Request: {data.CompanyName} ({data.CompanyID}) - {data.EmployeeName}",
                accentColor: "#2563eb",
                heading: "STS Allocation Request - Action Required",
                bodyHtml: body,
                logContext: "submitted");
        }

        public Task SendStsRequestApprovedEmailAsync(StsRequestEmailData data)
        {
            string body = $@"
                <p style='font-size: 15px; margin: 0 0 14px 0;'>Dear <strong>{Enc(data.EmployeeName)}</strong>,</p>
                <p style='font-size: 14px; line-height: 1.6; margin: 0 0 22px 0; color: #334155;'>
                    We are pleased to inform you that your request for allocation of the STS record below has been
                    <strong style='color: #059669;'>approved</strong>. The record is now assigned to you and is available under
                    <strong>My STS Records</strong>.
                </p>"
                + StsRecordSection(data)
                + StsRequestSection("Review Details", new (string, string?)[]
                {
                    ("Approved By", data.ReviewedByName),
                    ("Approved On", data.ReviewedAt.HasValue ? FormatIst(data.ReviewedAt.Value) : null),
                })
                + @"<p style='font-size: 14px; line-height: 1.6; margin: 22px 0 0 0; color: #334155;'>
                        Please log in to the STS Portal to begin follow-up on this record.
                     </p>";

            return SendStsRequestEmailAsync(
                data,
                subject: $"Approved: STS Allocation Request for {data.CompanyName} ({data.CompanyID})",
                accentColor: "#059669",
                heading: "STS Allocation Request Approved",
                bodyHtml: body,
                logContext: "approved");
        }

        public Task SendStsRequestRejectedEmailAsync(StsRequestEmailData data)
        {
            string body = $@"
                <p style='font-size: 15px; margin: 0 0 14px 0;'>Dear <strong>{Enc(data.EmployeeName)}</strong>,</p>
                <p style='font-size: 14px; line-height: 1.6; margin: 0 0 22px 0; color: #334155;'>
                    Thank you for your request. After careful review, we regret to inform you that your request for allocation of the STS record below has been
                    <strong style='color: #dc2626;'>declined</strong>.
                </p>"
                + StsRecordSection(data)
                + StsRequestSection("Review Details", new (string, string?)[]
                {
                    ("Reviewed By", data.ReviewedByName),
                    ("Reviewed On", data.ReviewedAt.HasValue ? FormatIst(data.ReviewedAt.Value) : null),
                    ("Reason", string.IsNullOrWhiteSpace(data.ReviewComment) ? "No reason provided" : data.ReviewComment),
                })
                + @"<p style='font-size: 14px; line-height: 1.6; margin: 22px 0 0 0; color: #334155;'>
                        If you have any questions regarding this decision, please contact your Admin.
                     </p>";

            return SendStsRequestEmailAsync(
                data,
                subject: $"Declined: STS Allocation Request for {data.CompanyName} ({data.CompanyID})",
                accentColor: "#dc2626",
                heading: "STS Allocation Request Declined",
                bodyHtml: body,
                logContext: "rejected");
        }

        private static string Enc(string? value) => System.Net.WebUtility.HtmlEncode(value ?? string.Empty);

        // Stored timestamps are UTC; the business runs on IST (UTC+5:30).
        private static string FormatIst(DateTime utc)
        {
            var asUtc = DateTime.SpecifyKind(utc, DateTimeKind.Utc);
            return asUtc.AddMinutes(330).ToString("dd MMM yyyy, hh:mm tt") + " IST";
        }

        private static string StsRequestSection(string title, IEnumerable<(string Label, string? Value)> rows)
        {
            var rowHtml = string.Concat(rows
                .Where(r => !string.IsNullOrWhiteSpace(r.Value))
                .Select(r => $@"
                    <tr>
                        <td style='padding: 9px 14px; border-bottom: 1px solid #eef0f3; font-size: 13px; color: #64748b; width: 38%; vertical-align: top;'>{Enc(r.Label)}</td>
                        <td style='padding: 9px 14px; border-bottom: 1px solid #eef0f3; font-size: 13px; color: #0f172a; font-weight: 600; white-space: pre-wrap;'>{Enc(r.Value)}</td>
                    </tr>"));
            if (rowHtml.Length == 0) return string.Empty;

            return $@"
                <p style='margin: 0 0 8px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #475569;'>{Enc(title)}</p>
                <table style='width: 100%; border-collapse: collapse; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px;' cellpadding='0' cellspacing='0'>
                    <tbody>{rowHtml}</tbody>
                </table>";
        }

        private static string StsRecordSection(StsRequestEmailData d) => StsRequestSection("STS Details", new (string, string?)[]
        {
            ("Profile ID", d.CompanyID),
            ("Company Name", d.CompanyName),
            ("Contact Person", d.ContactPerson),
            ("Phone", d.Phone),
            ("Email", d.Email),
            ("City", d.CityDistrict),
            ("State", d.State),
            ("Country", d.Country),
            ("Source", d.Source),
            ("Priority", d.Priority),
            ("Current Status", d.Status),
            ("Created On", d.RecordCreatedAt.HasValue ? FormatIst(d.RecordCreatedAt.Value) : null),
            ("Currently Allotted To", d.CurrentlyAllocatedTo ?? "Unassigned"),
        });

        private async Task SendStsRequestEmailAsync(StsRequestEmailData data, string subject, string accentColor, string heading, string bodyHtml, string logContext)
        {
            try
            {
                var emailSettings = _config.GetSection("EmailSettings");

                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(emailSettings["SenderName"], emailSettings["SenderEmail"]));
                foreach (var to in data.ToEmails.Distinct(StringComparer.OrdinalIgnoreCase)) message.To.Add(MailboxAddress.Parse(to));
                message.Subject = subject;

                var bodyBuilder = new BodyBuilder();
                string logoHtml = BuildCompanyLogoHtml(bodyBuilder, data.TenantCompanyLogoUrl, data.TenantCompanyName);

                bodyBuilder.HtmlBody = $@"
                    <div style='background-color: #f1f5f9; padding: 24px 12px;'>
                    <div style='font-family: Segoe UI, Arial, sans-serif; color: #333; max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 6px 16px rgba(15,23,42,0.08);'>
                        <div style='background-color: {accentColor}; color: #ffffff; padding: 24px 20px; text-align: center;'>
                            {logoHtml}
                            <p style='margin: 14px 0 4px 0; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.9;'>{Enc(data.TenantCompanyName)} &middot; Sales Tracking System</p>
                            <h2 style='margin: 0; font-size: 21px;'>{Enc(heading)}</h2>
                        </div>
                        <div style='padding: 28px 30px;'>
                            {bodyHtml}
                            <div style='text-align: center; margin-top: 26px;'>
                                <a href='{Enc(data.PortalUrl)}' style='display: inline-block; padding: 12px 28px; background-color: {accentColor}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;'>Login to STS Portal</a>
                                <p style='margin: 10px 0 0 0; font-size: 12px; color: #94a3b8;'><a href='{Enc(data.PortalUrl)}' style='color: #64748b;'>{Enc(data.PortalUrl)}</a></p>
                            </div>
                            <p style='font-size: 14px; margin: 26px 0 0 0; color: #334155;'>Regards,<br/><strong>{Enc(data.TenantCompanyName)}</strong></p>
                        </div>
                        <div style='background-color: #f8fafc; padding: 15px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;'>
                            <p style='margin: 0;'>&copy; {DateTime.Now.Year} {Enc(data.TenantCompanyName)}. All rights reserved.</p>
                            <p style='margin: 5px 0 0 0;'>This is an automated message, please do not reply.</p>
                        </div>
                    </div>
                    </div>";

                message.Body = bodyBuilder.ToMessageBody();

                using var client = new SmtpClient();
                client.ServerCertificateValidationCallback = (s, c, h, e) => true;

                await client.ConnectAsync(emailSettings["SmtpServer"], int.Parse(emailSettings["Port"]), GetSecureSocketOptions(emailSettings));
                await client.AuthenticateAsync(emailSettings["SenderEmail"], emailSettings["Password"]);
                await client.SendAsync(message);
                await client.DisconnectAsync(true);

                _logger.LogInformation("STS request {kind} email sent to {to} for {company}", logContext, string.Join(", ", data.ToEmails), data.CompanyName);
            }
            catch (System.Exception ex)
            {
                _logger.LogError(ex, "Failed to send STS request {kind} email for {company}", logContext, data.CompanyName);
                // Never break the request / review flow over an email.
            }
        }
    }
}
