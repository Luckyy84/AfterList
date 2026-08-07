using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.AfterList.Configuration;

public sealed class PluginConfiguration : BasePluginConfiguration
{
    public string ApiUrl { get; set; } = string.Empty;

    public string ApiToken { get; set; } = string.Empty;

    public string JellyfinUserId { get; set; } = string.Empty;

    public int ReconciliationHours { get; set; } = 6;
}
