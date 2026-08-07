# AfterList for Jellyfin

Development plugin for Jellyfin 10.11.x. It syncs watched/in-progress movies and series plus favourites on playback stop or relevant user-data changes. A reconciliation runs every six hours by default.

## Build

```powershell
& "$env:LOCALAPPDATA\AfterList\dotnet\dotnet.exe" build -c Release
```

Copy `bin/Release/net9.0/Jellyfin.Plugin.AfterList.dll` into a new folder under Jellyfin's plugins directory, restart Jellyfin, then configure the AfterList URL, integration token, and Jellyfin user ID in Dashboard → Plugins → AfterList.
