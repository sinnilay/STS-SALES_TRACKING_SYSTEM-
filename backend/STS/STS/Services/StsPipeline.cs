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
            "DMUPIFU1", "DMUPIFU2", "DMUPIFU3", "SERV", "JUNK", "NI", "NI_PH", "NI_FC", "NI_FU",
            "CNVT", "A_CNVT", "CNVT_PH", "CNVT_FC", "CNVT_FU", "OTHER"
        };

        // Statuses that represent a conversion — selecting one requires the extra
        // "Converted For" / "Price" details captured on the update form.
        public static readonly string[] ConvertedStatuses =
        {
            "CNVT", "A_CNVT", "CNVT_PH", "CNVT_FC", "CNVT_FU"
        };

        public static bool IsValidStatus(string status) => ValidStatuses.Contains(status);

        public static bool IsConvertedStatus(string status) => ConvertedStatuses.Contains(status);

        // Human-readable labels for the status codes above — kept in sync with
        // frontend/src/constants/stsPipeline.jsx (STS_STATUS_OPTIONS), used to
        // render status update notification emails.
        private static readonly Dictionary<string, string> StatusLabels = new()
        {
            ["N_O"] = "Company Profile Not Open",
            ["W_N"] = "Wrong No.",
            ["CPNA"] = "Call Person Not Available",
            ["C_B"] = "Call Back",
            ["C_C"] = "Cold Call",
            ["APPMT"] = "Appointment Fix",
            ["DMUPIFC"] = "Decision Making Unit Presentation In Fresh Call",
            ["PGIFC"] = "Prospect Generated in Fresh Call",
            ["PGIFU"] = "Prospect Generated in Follow Up",
            ["DMUPIFU1"] = "Decision Making Unit Presentation In Follow Up First Time",
            ["DMUPIFU2"] = "Decision Making Unit Presentation In Follow Up Second Time",
            ["DMUPIFU3"] = "Decision Making Unit Presentation In Follow Up Third Time",
            ["SERV"] = "Only Service Meeting",
            ["JUNK"] = "All Information of Company are Wrong",
            ["NI"] = "Not Interested",
            ["NI_PH"] = "Not Interested over Phone",
            ["NI_FC"] = "Not Interested in First Meeting",
            ["NI_FU"] = "Not Interested in Follow Up",
            ["CNVT"] = "Converted",
            ["A_CNVT"] = "Already Converted",
            ["CNVT_PH"] = "Converted Over Phone",
            ["CNVT_FC"] = "Converted in First Call",
            ["CNVT_FU"] = "Converted in Follow-up",
            ["OTHER"] = "Other",
        };

        public static string GetStatusLabel(string? status)
        {
            if (string.IsNullOrWhiteSpace(status)) return "New";
            return StatusLabels.TryGetValue(status, out var label) ? label : status;
        }
    }
}
