using System.Windows.Forms;

namespace Snappy.Input;

/// <summary>Key sets for the input layer. Only keys in the chosen presets (plus extra keys) are ever looked at.</summary>
public static class InputPresets
{
    public sealed record Preset(string Id, string Name, Keys[] Keys);

    public static readonly Preset[] BuiltIn =
    {
        new("shooter", "Shooter", new[]
        {
            Keys.W, Keys.A, Keys.S, Keys.D, Keys.Q, Keys.E, Keys.R, Keys.C,
            Keys.ShiftKey, Keys.ControlKey, Keys.Space,
        }),
        new("moba", "League / MOBA", new[] { Keys.Q, Keys.W, Keys.E, Keys.R, Keys.D, Keys.F }),
    };

    public static HashSet<int> KeysFor(IEnumerable<string> presetIds, IEnumerable<int> extraKeys)
    {
        var ids = presetIds.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var keys = BuiltIn.Where(p => ids.Contains(p.Id)).SelectMany(p => p.Keys).Select(k => (int)k).ToHashSet();
        keys.UnionWith(extraKeys);
        return keys;
    }
}
