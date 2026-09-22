# OLED Night Chrome Theme

**[Download oled-night-theme.zip](https://github.com/bc1224/oled-night/releases/latest/download/oled-night-theme.zip)**

A companion Chrome theme with a true-black tab strip, inactive tabs and new-tab page. The active tab and toolbar use subtle charcoal (#202024) so tab boundaries remain visible. The OLED Night extension recolors websites, but no extension can change Chrome's own window. A theme can, so the two are made to be used together.

**Install:** download `oled-night-theme.zip` from the [latest release](https://github.com/bc1224/oled-night/releases/latest), unzip it into a folder you'll keep, open `chrome://extensions`, turn on Developer mode, and click **Load unpacked** on that folder. To go back to the default look, open Chrome **Settings → Appearance → Theme** and choose **Reset to default**.

Chrome ignores themes on a few surfaces it draws with the operating system, such as some menus, dialogs and incognito windows.

## Tab separation (1.0.2)
Chrome derives tab dividers from the toolbar color, and derives the active-tab outline from the toolbar/frame contrast. Themes cannot set those lines independently. The toolbar and active tab therefore use #202024 while the frame and inactive tabs stay #000. This avoids making all inactive tabs charcoal. Native separator visibility still depends on Chrome's hover, selection and layout behavior.
