using System.Threading.Tasks;
using STS.Models;

namespace STS.Services
{
    public interface IEmailService
    {
        Task SendWelcomeEmailAsync(string toEmail, string fullName, string password);
        Task SendOtpEmailAsync(string toEmail, string otp);
        Task SendTrialRequestNotificationAsync(TrialRequest request);
    }
}
