using Snappy.Platform;

namespace Snappy.Studio;

/// <summary>
/// Picks the scene for the game being played. A linked app has to stay in front for a moment before its scene is
/// used, and the scene then stays while that app keeps running, so alt-tabbing to Discord doesn't flip scenes back
/// and forth.
/// </summary>
internal sealed class SceneTracker
{
    private const int TicksToSwitch = 2;

    private string? _sceneId;
    private int _pid;
    private string _process = "";
    private string? _candidateId;
    private int _candidateTicks;

    public StudioScene? Update(StudioSetup setup)
    {
        var front = ForegroundApp.Current();
        var match = front is { } f ? setup.SceneForApp(f.Name) : null;

        if (match != null && front is { } app)
        {
            if (match.Id == _sceneId)
            {
                (_pid, _process, _candidateId) = (app.Pid, app.Name, null);
            }
            else if (match.Id != _candidateId)
            {
                (_candidateId, _candidateTicks) = (match.Id, 1);
            }
            else if (++_candidateTicks >= TicksToSwitch)
            {
                (_sceneId, _pid, _process, _candidateId) = (match.Id, app.Pid, app.Name, null);
            }
        }
        else
        {
            _candidateId = null;
            if (_sceneId != null && !ForegroundApp.IsRunning(_pid, _process)) _sceneId = null;
        }

        var scene = _sceneId == null ? null : setup.Scenes.FirstOrDefault(s => s.Id == _sceneId);
        // The game was unlinked from the scene while it was still running.
        if (scene != null && !scene.Apps.Any(a => string.Equals(a.Exe, _process, StringComparison.OrdinalIgnoreCase)))
        {
            _sceneId = null;
            scene = null;
        }
        return scene;
    }
}
