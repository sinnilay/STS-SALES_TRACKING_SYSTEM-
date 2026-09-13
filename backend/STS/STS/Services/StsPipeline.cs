namespace STS.Services
{
    // STS call-outcome status codes, matching the legacy STS report's Status dropdown.
    // Selecting one of these logs a call/meeting update against a record — there is no
    // forward-only pipeline any more, any code can be selected at any time.
    // Keep in sync with frontend/src/constants/stsPipeline.jsx (STS_STATUS_OPTIONS).
    public static class StsPipeline
    {
        public static readonly string[] ValidStatuses =
        {
            "N_O", "W_N", "CPNA", "C_B", "C_C", "APPMT", "DMUPIFC", "PGIFC", "PGIFU",
            "DMUPIFU1", "DMUPIFU2", "DMUPIFU3", "SERV", "JUNK", "NI", "NI_PH", "NI_FC", "NI_FU", "CNVT"
        };

        public static bool IsValidStatus(string status) => ValidStatuses.Contains(status);
    }
}
