# Customize a project icon

T3 Code selects a project icon automatically. It checks `t3.json`, common favicon and app icon
paths, and icon links in project HTML files.

To choose a different icon:

1. Open **Settings** and select **Projects**.
2. Select the project.
3. Under **Appearance**, select **Choose a project file**.
4. Search for an image file and select it.

T3 Code supports SVG, PNG, ICO, JPEG, GIF, AVIF, and WebP files. The selected path applies to
each checkout in the project group and appears on your connected clients.

To use automatic detection again, select **Automatic**.

## Open pull requests in Graphite

For projects hosted on GitHub.com, T3 Code can use Graphite as the default place to open and copy
pull request links:

1. Open **Settings** and select **Projects**.
2. Select the project.
3. Under **Pull requests**, enable **Open in Graphite**.

GitHub remains the source-control host and stays available from pull request menus.

If the repository uses Graphite's merge queue, enable **Graphite merge queue** and enter the exact
GitHub label configured in Graphite. The primary pull request action then adds that label to the
queue, or removes it when the pull request is already queued. Direct GitHub merge methods remain
available from the pull request actions menu.
