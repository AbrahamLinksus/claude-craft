import type { AnyCommandHandler } from "@craft/protocol";
import type { SettingsService } from "./settings-service.ts";

/** Commands owned by the store module, registered by `main.ts`. */
export function commands(settings: SettingsService): AnyCommandHandler[] {
  return [
    {
      name: "settings.set",
      run: async (args) => {
        await settings.set(args.path, args.value);
        return settings.get();
      },
    },
  ];
}
