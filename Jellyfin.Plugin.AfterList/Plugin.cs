using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;
using Jellyfin.Plugin.AfterList.Configuration;

namespace Jellyfin.Plugin.AfterList;

public sealed class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer) => Instance = this;

    public static Plugin? Instance { get; private set; }

    public override string Name => "AfterList";

    public override Guid Id => Guid.Parse("4ab88325-e76c-44ed-9d84-a83746ad1266");

    public IEnumerable<PluginPageInfo> GetPages() =>
    [
        new PluginPageInfo
        {
            Name = Name,
            EmbeddedResourcePath = $"{GetType().Namespace}.Configuration.configPage.html"
        }
    ];
}
