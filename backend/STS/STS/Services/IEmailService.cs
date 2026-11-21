using System.Threading.Tasks;
using STS.Models;

namespace STS.Services
{
    public interface IEmailService
    {
        Task SendWelcomeEmailAsync(string toEmail, string fullName, string password, string? companyLogoUrl = null, string? companyName = null, IEnumerable<string>? ccEmails = null);
        Task SendOtpEmailAsync(string toEmail, string otp);
        Task SendTrialRequestNotificationAsync(TrialRequest request);
        Task SendStsUpdateNotificationAsync(StsUpdateNotificationData data);
        Task SendTrialApprovedEmailAsync(TrialRequest request, string? loginPassword, string loginUrl);
        Task SendTrialRejectedEmailAsync(TrialRequest request);
        Task SendStsRequestSubmittedEmailAsync(StsRequestEmailData data);
        Task SendStsRequestApprovedEmailAsync(StsRequestEmailData data);
        Task SendStsRequestRejectedEmailAsync(StsRequestEmailData data);
    }
}
