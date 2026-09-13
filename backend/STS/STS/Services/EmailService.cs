using System.Threading.Tasks;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;
using STS.Models;

namespace STS.Services
{
    public class EmailService : IEmailService
    {
        private readonly IConfiguration _config;
        private readonly ILogger<EmailService> _logger;

        public EmailService(IConfiguration config, ILogger<EmailService> logger)
        {
            _config = config;
            _logger = logger;
        }

        public async Task SendWelcomeEmailAsync(string toEmail, string fullName, string password)
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
                message.Subject = "Welcome to Ideas Promo Solution - STS Login Credentials";

                var bodyBuilder = new BodyBuilder();
                
                string logoHtml = "<img src='https://i.postimg.cc/SNJ5H9k4/logo.png' alt='Ideas Promo Solution Logo' style='max-height: 50px; display: block; margin: 0 auto;' />";

                bodyBuilder.HtmlBody = $@"
                    <div style='font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);'>
                        <div style='background-color: #2563eb; color: #fff; padding: 20px; text-align: center;'>
                            {logoHtml}
                            <h2 style='margin: 15px 0 0 0; font-size: 24px;'>Welcome to Ideas Promo Solution!</h2>
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
                            <a href='https://sts.ideaspromotion.com' style='display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold;'>Login to STS Portal</a>
                        </div>
                        <div style='background-color: #f1f5f9; padding: 15px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;'>
                            <p style='margin: 0;'>© {System.DateTime.Now.Year} Ideas Promo Solution. All rights reserved.</p>
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
                    SecureSocketOptions.Auto
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
                message.From.Add(new MailboxAddress("Ideas Promo Solution", emailSettings["SenderEmail"]));
                message.To.Add(new MailboxAddress("", toEmail));
                message.Subject = "Ideas Promo Solution - Email Verification OTP";

                var bodyBuilder = new BodyBuilder();
                string logoHtml = "<img src='https://i.postimg.cc/SNJ5H9k4/logo.png' alt='Ideas Promo Solution Logo' style='max-height: 50px; display: block; margin: 0 auto;' />";

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
                            &copy; {DateTime.UtcNow.Year} Ideas Promo Solution. All rights reserved.
                        </div>
                    </div>
                ";

                message.Body = bodyBuilder.ToMessageBody();

                using var client = new SmtpClient();
                // For development with self-signed certificates
                client.ServerCertificateValidationCallback = (s, c, h, e) => true;
                
                await client.ConnectAsync(emailSettings["SmtpServer"], int.Parse(emailSettings["SmtpPort"]!), SecureSocketOptions.Auto);
                await client.AuthenticateAsync(emailSettings["SenderEmail"], emailSettings["SenderPassword"]);
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
                string logoHtml = "<img src='https://i.postimg.cc/SNJ5H9k4/logo.png' alt='Ideas Promo Solution Logo' style='max-height: 50px; display: block; margin: 0 auto;' />";
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
                            <p style='margin: 0;'>© {System.DateTime.Now.Year} Ideas Promo Solution. All rights reserved.</p>
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
                    SecureSocketOptions.Auto
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
    }
}
