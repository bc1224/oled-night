globalThis.oledChatStartupSurface = matchMedia("(prefers-color-scheme: dark)").matches ? "#000" : null;
globalThis.applyOledChatStartup?.();
