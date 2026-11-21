namespace STS.Services
{
    // IIS shuts an app pool down after 20 idle minutes by default, and the next request (usually a
    // login) then waits ~20s for a cold start. Pinging our own public health URL goes through IIS,
    // which counts as activity and keeps the process warm. Disabled when KeepAlive:Url is not set.
    public class KeepAliveService : BackgroundService
    {
        private static readonly TimeSpan Interval = TimeSpan.FromMinutes(5);

        private readonly IConfiguration _configuration;
        private readonly ILogger<KeepAliveService> _logger;

        public KeepAliveService(IConfiguration configuration, ILogger<KeepAliveService> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var url = _configuration["KeepAlive:Url"];
            if (string.IsNullOrWhiteSpace(url)) return;

            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
            using var timer = new PeriodicTimer(Interval);
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                try
                {
                    await client.GetAsync(url, stoppingToken);
                }
                catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
                {
                    _logger.LogWarning("Keep-alive ping to {Url} failed: {Message}", url, ex.Message);
                }
            }
        }
    }
}
