import {
  ChevronDownIcon,
  DownloadIcon,
  GitBranchPlusIcon,
  MonitorIcon,
  RefreshCwIcon,
  UploadIcon,
} from "lucide-react";
import { useCallback, useState } from "react";

import { isElectron } from "~/env";
import { ensureLocalApi } from "~/localApi";
import {
  getM3CodeInstallCwdConfirmationMessage,
  graphiteCreateCommand,
  M3_CODE_DESKTOP_DEV_COMMAND,
  M3_CODE_GRAPHITE_SUBMIT_COMMAND,
  M3_CODE_GRAPHITE_SYNC_COMMAND,
} from "~/m3CodeActions.logic";
import { stackedThreadToast, toastManager } from "./ui/toast";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "./ui/dialog";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "./ui/menu";
import { Textarea } from "./ui/textarea";

export interface M3CodeTerminalCommandOptions {
  readonly preferNewTerminal?: boolean;
}

interface M3CodeActionsControlProps {
  cwd: string | null;
  candidatePaths: ReadonlyArray<string>;
  onRunCommand: (command: string, options?: M3CodeTerminalCommandOptions) => void;
}

const dropdownItemClassName =
  "data-highlighted:bg-transparent data-highlighted:text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground data-highlighted:hover:bg-accent data-highlighted:hover:text-accent-foreground data-highlighted:focus-visible:bg-accent data-highlighted:focus-visible:text-accent-foreground";

export function M3CodeActionsControl({
  cwd,
  candidatePaths,
  onRunCommand,
}: M3CodeActionsControlProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [createMessage, setCreateMessage] = useState("");

  const runDetachedInstall = useCallback(async () => {
    if (cwd === null) return;
    const bridge = window.desktopBridge;
    const openTerminal = bridge?.openM3CodeLoginTerminal;
    if (typeof openTerminal !== "function") {
      onRunCommand("vp run install:desktop:local", { preferNewTerminal: true });
      return;
    }
    let confirmed = false;
    try {
      confirmed = await ensureLocalApi().dialogs.confirm(
        getM3CodeInstallCwdConfirmationMessage(cwd),
      );
    } catch (error) {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Could not confirm install",
          description: error instanceof Error ? error.message : "Confirmation failed.",
        }),
      );
      return;
    }
    if (!confirmed) return;
    try {
      const result = await openTerminal({
        command: "install-local",
        cwd,
        candidatePaths: [...candidatePaths],
      });
      if (!result.started) {
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: "Could not start local install",
            description: result.error ?? "Terminal did not open.",
          }),
        );
      }
    } catch (error) {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Could not start local install",
          description: error instanceof Error ? error.message : "An unexpected error occurred.",
        }),
      );
    }
  }, [candidatePaths, cwd, onRunCommand]);

  const submitCreate = () => {
    const message = createMessage.trim();
    if (message.length === 0) return;
    setCreateOpen(false);
    setCreateMessage("");
    onRunCommand(graphiteCreateCommand(message));
  };

  if (cwd === null) return null;

  return (
    <>
      <Menu highlightItemOnHover={false}>
        <MenuTrigger
          render={
            <Button
              size="xs"
              variant="outline"
              aria-label="M3 actions"
              data-toolbar-control=""
              className="w-7 px-0 sm:w-6 @3xl/header-actions:w-auto! @3xl/header-actions:px-[calc(--spacing(2)-1px)]"
            />
          }
        >
          <MonitorIcon className="size-3.5" />
          <span className="sr-only @3xl/header-actions:not-sr-only @3xl/header-actions:ml-0.5">
            M3
          </span>
          <ChevronDownIcon className="size-3.5" />
        </MenuTrigger>
        <MenuPopup align="end">
          <MenuGroup>
            <MenuGroupLabel>Graphite</MenuGroupLabel>
            <MenuItem
              className={dropdownItemClassName}
              onClick={() => onRunCommand(M3_CODE_GRAPHITE_SYNC_COMMAND)}
            >
              <RefreshCwIcon className="size-4" />
              Sync
            </MenuItem>
            <MenuItem className={dropdownItemClassName} onClick={() => setCreateOpen(true)}>
              <GitBranchPlusIcon className="size-4" />
              Create branch
            </MenuItem>
            <MenuItem
              className={dropdownItemClassName}
              onClick={() => onRunCommand(M3_CODE_GRAPHITE_SUBMIT_COMMAND)}
            >
              <UploadIcon className="size-4" />
              Submit stack
            </MenuItem>
          </MenuGroup>
          <MenuSeparator />
          <MenuGroup>
            <MenuGroupLabel>Desktop</MenuGroupLabel>
            <MenuItem
              className={dropdownItemClassName}
              onClick={() => onRunCommand(M3_CODE_DESKTOP_DEV_COMMAND, { preferNewTerminal: true })}
            >
              <MonitorIcon className="size-4" />
              Start desktop dev
            </MenuItem>
            <MenuItem
              className={dropdownItemClassName}
              onClick={() => {
                if (isElectron) {
                  void runDetachedInstall();
                  return;
                }
                onRunCommand("vp run install:desktop:local", { preferNewTerminal: true });
              }}
            >
              <DownloadIcon className="size-4" />
              Install local build
            </MenuItem>
          </MenuGroup>
        </MenuPopup>
      </Menu>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateMessage("");
        }}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Create Graphite branch</DialogTitle>
            <DialogDescription>
              Runs <code>gt create</code> in this thread&apos;s directory with the commit message
              below.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <Textarea
              autoFocus
              value={createMessage}
              onChange={(event) => setCreateMessage(event.target.value)}
              placeholder="feat(scope): short why-focused title"
              size="sm"
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  submitCreate();
                }
              }}
            />
          </DialogPanel>
          <DialogFooter variant="bare">
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={createMessage.trim().length === 0} onClick={submitCreate}>
              Create
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  );
}
