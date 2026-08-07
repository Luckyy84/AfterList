using System.Net.Http.Headers;
using System.Net.Http.Json;
using Jellyfin.Data.Enums;
using Jellyfin.Database.Implementations.Entities;
using MediaBrowser.Controller.Dto;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Session;
using MediaBrowser.Model.Entities;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.AfterList;

public sealed class AfterListSyncService : BackgroundService
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(20) };
    private readonly ILibraryManager _libraryManager;
    private readonly IUserDataManager _userDataManager;
    private readonly IUserManager _userManager;
    private readonly ISessionManager _sessionManager;
    private readonly ILogger<AfterListSyncService> _logger;

    public AfterListSyncService(
        ILibraryManager libraryManager,
        IUserDataManager userDataManager,
        IUserManager userManager,
        ISessionManager sessionManager,
        ILogger<AfterListSyncService> logger)
    {
        _libraryManager = libraryManager;
        _userDataManager = userDataManager;
        _userManager = userManager;
        _sessionManager = sessionManager;
        _logger = logger;
    }

    public override Task StartAsync(CancellationToken cancellationToken)
    {
        _sessionManager.PlaybackStopped += PlaybackStopped;
        _userDataManager.UserDataSaved += UserDataSaved;
        return base.StartAsync(cancellationToken);
    }

    public override Task StopAsync(CancellationToken cancellationToken)
    {
        _sessionManager.PlaybackStopped -= PlaybackStopped;
        _userDataManager.UserDataSaved -= UserDataSaved;
        return base.StopAsync(cancellationToken);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Reconcile(stoppingToken).ConfigureAwait(false);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                _logger.LogWarning(exception, "AfterList reconciliation failed");
            }

            var hours = Math.Clamp(Plugin.Instance?.Configuration.ReconciliationHours ?? 6, 1, 168);
            await Task.Delay(TimeSpan.FromHours(hours), stoppingToken).ConfigureAwait(false);
        }
    }

    private async void PlaybackStopped(object? sender, PlaybackStopEventArgs eventArgs)
    {
        foreach (var user in eventArgs.Users.Where(IsConfiguredUser))
        {
            await SyncItem(eventArgs.Item, user, CancellationToken.None).ConfigureAwait(false);
        }
    }

    private async void UserDataSaved(object? sender, UserDataSaveEventArgs eventArgs)
    {
        if (eventArgs.SaveReason is UserDataSaveReason.PlaybackStart or UserDataSaveReason.PlaybackProgress
            || !IsConfiguredUser(eventArgs.UserId)) return;
        var user = _userManager.GetUserById(eventArgs.UserId);
        if (user is not null) await SyncItem(eventArgs.Item, user, CancellationToken.None).ConfigureAwait(false);
    }

    private bool IsConfiguredUser(User user) => IsConfiguredUser(user.Id);

    private static bool IsConfiguredUser(Guid id)
        => Guid.TryParse(Plugin.Instance?.Configuration.JellyfinUserId, out var configured) && configured == id;

    private async Task Reconcile(CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(Plugin.Instance?.Configuration.JellyfinUserId, out var userId)) return;
        var user = _userManager.GetUserById(userId);
        if (user is null) return;

        var items = _libraryManager.GetItemList(new InternalItemsQuery(user)
        {
            IncludeItemTypes = [BaseItemKind.Movie, BaseItemKind.Series],
            IsVirtualItem = false,
            DtoOptions = new DtoOptions(false) { EnableImages = false }
        });

        foreach (var item in items)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (IsRelevant(item, user)) await SyncItem(item, user, cancellationToken).ConfigureAwait(false);
        }
    }

    private bool IsRelevant(BaseItem item, User user)
    {
        var data = _userDataManager.GetUserData(user, item);
        if (data?.Played == true || data?.PlaybackPositionTicks > 0 || data?.IsFavorite == true) return true;
        if (item is not Series series) return false;
        return CountEpisodes(series, user, true) > 0;
    }

    private async Task SyncItem(BaseItem item, User user, CancellationToken cancellationToken)
    {
        try
        {
            var media = item is Episode episode ? episode.Series : item;
            if (media is not Movie && media is not Series) return;
            if (!media.TryGetProviderId(MetadataProvider.Tmdb, out var tmdbId)) return;

            var data = _userDataManager.GetUserData(user, media);
            var totalEpisodes = media is Series series ? CountEpisodes(series, user, null) : (int?)null;
            var watchedEpisodes = media is Series watchedSeries ? CountEpisodes(watchedSeries, user, true) : 0;
            var status = media is Movie
                ? data?.Played == true ? "Watched" : data?.PlaybackPositionTicks > 0 ? "Watching" : "Planned"
                : totalEpisodes > 0 && watchedEpisodes >= totalEpisodes ? "Watched" : watchedEpisodes > 0 ? "Watching" : "Planned";

            var payload = new
            {
                source = "tmdb",
                externalId = $"{(media is Movie ? "movie" : "tv")}:{tmdbId}",
                title = media.Name,
                type = media is Movie ? "Movie" : "TV Series",
                status,
                year = media.ProductionYear?.ToString(System.Globalization.CultureInfo.InvariantCulture),
                currentEpisode = media is Series ? watchedEpisodes : 0,
                totalEpisodes,
                runtimeMinutes = media.RunTimeTicks is long ticks ? Math.Max(1, (int)TimeSpan.FromTicks(ticks).TotalMinutes) : (int?)null,
                personalRating = data?.Rating is double rating ? Math.Clamp((int)Math.Round(rating), 1, 10) : (int?)null,
                isFavorite = data?.IsFavorite == true,
                progress = media is Series ? $"{watchedEpisodes}/{totalEpisodes ?? 0} episodes" : status,
                updatedAt = DateTimeOffset.UtcNow
            };

            var config = Plugin.Instance?.Configuration;
            if (string.IsNullOrWhiteSpace(config?.ApiUrl) || string.IsNullOrWhiteSpace(config.ApiToken)) return;
            using var request = new HttpRequestMessage(HttpMethod.Put, $"{config.ApiUrl.TrimEnd('/')}/api/v1/watchlist")
            {
                Content = JsonContent.Create(payload)
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", config.ApiToken);
            using var response = await Http.SendAsync(request, cancellationToken).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
                _logger.LogWarning("AfterList rejected {Title} with HTTP {StatusCode}", media.Name, (int)response.StatusCode);
        }
        catch (Exception exception)
        {
            _logger.LogWarning(exception, "Could not sync {Item} to AfterList", item.Name);
        }
    }

    private int CountEpisodes(Series series, User user, bool? played)
        => _libraryManager.GetCount(new InternalItemsQuery(user)
        {
            SeriesPresentationUniqueKey = series.PresentationUniqueKey,
            IncludeItemTypes = [BaseItemKind.Episode],
            IsPlayed = played,
            IsVirtualItem = false,
            Limit = 0,
            DtoOptions = new DtoOptions(false) { EnableImages = false }
        });
}
