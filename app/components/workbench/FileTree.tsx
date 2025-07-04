import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { FileMap } from '~/lib/stores/files';
import { classNames } from '~/utils/classNames';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { workbenchStore } from '~/lib/stores/workbench';
import { toast } from 'react-toastify';
import { path } from '~/utils/path';

const NODE_PADDING_LEFT = 8;
const DEFAULT_HIDDEN_FILES = [/\/node_modules\//, /\/\.next/, /\/\.astro/];

interface Props {
  files?: FileMap;
  selectedFile?: string;
  onFileSelect?: (filePath: string) => void;
  rootFolder?: string;
  hideRoot?: boolean;
  collapsed?: boolean;
  allowFolderSelection?: boolean;
  hiddenFiles?: Array<string | RegExp>;
  unsavedFiles?: Set<string>;
  className?: string;
}

interface FileNode {
  id: string;
  depth: number;
  name: string;
  fullPath: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

export const FileTree = memo(
  ({
    files = {},
    selectedFile,
    onFileSelect,
    rootFolder,
    hideRoot = false,
    collapsed = false,
    allowFolderSelection = false,
    hiddenFiles,
    unsavedFiles,
    className,
  }: Props) => {
    const computedHiddenFiles = hiddenFiles ?? DEFAULT_HIDDEN_FILES;
    const [collapsedFolders, setCollapsedFolders] = useState(() => new Set<string>());

    const fileList = useMemo(() => {
      return buildFileList(files, rootFolder, hideRoot, computedHiddenFiles);
    }, [files, rootFolder, hideRoot, computedHiddenFiles]);

    const filteredFileList = useMemo(() => {
      const list = [];

      let lastDepth = Number.MAX_SAFE_INTEGER;

      for (const fileNode of fileList) {
        const depth = fileNode.depth;

        // if the depth is equal we reached the end of the collaped group
        if (lastDepth === depth) {
          lastDepth = Number.MAX_SAFE_INTEGER;
        }

        // ignore collapsed folders
        if (collapsedFolders.has(fileNode.id)) {
          lastDepth = Math.min(lastDepth, depth);
        }

        // ignore files and folders below the collapsed folder
        if (lastDepth < depth) {
          continue;
        }

        list.push(fileNode);
      }

      return list;
    }, [fileList, collapsedFolders]);

    const toggleCollapseState = useCallback((id: string) => {
      setCollapsedFolders((prevSet) => {
        const newSet = new Set(prevSet);

        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }

        return newSet;
      });
    }, []);

    useEffect(() => {
      if (collapsed) {
        setCollapsedFolders(() => new Set(fileList.filter((item) => item.type === 'folder').map((item) => item.id)));
      }
    }, [fileList, collapsed]);

    const handleFileSelect = useCallback(
      (filePath: string, type: 'file' | 'folder') => {
        if (type === 'folder' && !allowFolderSelection) {
          toggleCollapseState(filePath);
        } else if (type === 'file') {
          onFileSelect?.(filePath);
        }
      },
      [onFileSelect, toggleCollapseState, allowFolderSelection],
    );

    return (
      <div className={classNames('text-sm', className)}>
        {filteredFileList.map((fileNode) => {
          switch (fileNode.type) {
            case 'file': {
              return (
                <File
                  key={fileNode.id}
                  file={fileNode}
                  selected={selectedFile === fileNode.fullPath}
                  unsavedChanges={unsavedFiles?.has(fileNode.fullPath)}
                  onClick={() => {
                    handleFileSelect(fileNode.fullPath, fileNode.type);
                  }}
                  onCopyPath={() => {
                    navigator.clipboard.writeText(fileNode.fullPath);
                    toast.success('Path copied to clipboard');
                  }}
                  onCopyRelativePath={() => {
                    const relativePath = path.relative(rootFolder || '', fileNode.fullPath);
                    navigator.clipboard.writeText(relativePath);
                    toast.success('Relative path copied to clipboard');
                  }}
                />
              );
            }
            case 'folder': {
              return (
                <Folder
                  key={fileNode.id}
                  folder={fileNode}
                  collapsed={collapsedFolders.has(fileNode.id)}
                  onClick={() => {
                    handleFileSelect(fileNode.fullPath, fileNode.type);
                  }}
                />
              );
            }
          }
        })}
      </div>
    );
  },
);

interface FolderProps {
  folder: FileNode;
  collapsed: boolean;
  onClick: () => void;
}

function Folder({ folder, collapsed, onClick }: FolderProps) {
  const { depth, name } = folder;

  return (
    <div
      className="flex items-center gap-2 w-full py-1 px-2 text-bolt-elements-item-contentDefault hover:text-bolt-elements-item-contentActive hover:bg-bolt-elements-item-backgroundActive cursor-pointer"
      style={{ paddingLeft: depth * NODE_PADDING_LEFT + 'px' }}
      onClick={onClick}
    >
      <div
        className={classNames(
          'shrink-0 text-bolt-elements-textTertiary',
          collapsed ? 'i-ph:folder' : 'i-ph:folder-open',
        )}
      />
      <div className="truncate">{name}</div>
    </div>
  );
}

interface FileProps {
  file: FileNode;
  selected: boolean;
  unsavedChanges?: boolean;
  onClick: () => void;
  onCopyPath: () => void;
  onCopyRelativePath: () => void;
}

function File({ file, onClick, onCopyPath, onCopyRelativePath, selected, unsavedChanges = false }: FileProps) {
  const { depth, name, fullPath } = file;

  // Check if the file is locked
  const { locked } = workbenchStore.isFileLocked(fullPath);

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          className={classNames(
            'group flex items-center gap-2 w-full py-1 px-2 text-bolt-elements-item-contentDefault hover:text-bolt-elements-item-contentActive cursor-pointer',
            {
              'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent': selected,
              'hover:bg-bolt-elements-item-backgroundActive': !selected,
            },
          )}
          style={{ paddingLeft: depth * NODE_PADDING_LEFT + 'px' }}
          onClick={onClick}
        >
          <div className="shrink-0 text-bolt-elements-textTertiary">
            <div className="i-ph:file" />
          </div>
          <div className="flex-1 truncate pr-2">{name}</div>
          {unsavedChanges && <div className="shrink-0 text-orange-500 i-ph:circle-fill text-xs" />}
          {locked && <div className="shrink-0 text-red-500 i-ph:lock" />}
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg shadow-lg p-1 z-50">
          <ContextMenu.Item
            className="flex items-center gap-2 px-2 py-1 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive rounded cursor-pointer"
            onClick={onCopyPath}
          >
            <div className="i-ph:clipboard" />
            Copy Path
          </ContextMenu.Item>
          <ContextMenu.Item
            className="flex items-center gap-2 px-2 py-1 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive rounded cursor-pointer"
            onClick={onCopyRelativePath}
          >
            <div className="i-ph:clipboard" />
            Copy Relative Path
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

function buildFileList(
  files: FileMap,
  rootFolder = '',
  hideRoot: boolean,
  hiddenFiles: Array<string | RegExp>,
): FileNode[] {
  const folderPaths = new Set<string>();
  const fileList: FileNode[] = [];

  let defaultDepth = 0;

  if (rootFolder && !hideRoot) {
    defaultDepth = 1;
    fileList.push({ name: rootFolder, fullPath: rootFolder, depth: 0, type: 'folder', id: rootFolder });
  }

  for (const [filePath, dirent] of Object.entries(files)) {
    if (dirent?.type === 'file') {
      const segments = filePath.split('/').filter((segment) => segment);
      const fileName = segments.at(-1);

      if (!fileName || isHiddenFile(filePath, hiddenFiles)) {
        continue;
      }

      let currentPath = '';
      let depth = 0;

      for (const segment of segments.slice(0, -1)) {
        currentPath += `/${segment}`;

        if (!folderPaths.has(currentPath)) {
          if (!isHiddenFile(currentPath, hiddenFiles)) {
            folderPaths.add(currentPath);

            fileList.push({
              id: currentPath,
              name: segment,
              fullPath: currentPath,
              depth: depth + defaultDepth,
              type: 'folder',
            });
          }
        }

        depth++;
      }

      fileList.push({
        id: filePath,
        name: fileName,
        fullPath: filePath,
        depth: depth + defaultDepth,
        type: 'file',
      });
    }
  }

  return sortFileList(rootFolder, fileList, hideRoot);
}

function isHiddenFile(filePath: string, hiddenFiles: Array<string | RegExp>) {
  return hiddenFiles.some((pathOrRegex) => {
    if (typeof pathOrRegex === 'string') {
      return filePath === pathOrRegex;
    }

    return pathOrRegex.test(filePath);
  });
}

function sortFileList(rootFolder: string, fileList: FileNode[], hideRoot: boolean): FileNode[] {
  const sortedFileList = [...fileList];

  sortedFileList.sort((a, b) => {
    const aIsRoot = a.depth === 0 && a.fullPath === rootFolder;
    const bIsRoot = b.depth === 0 && b.fullPath === rootFolder;

    if (aIsRoot && bIsRoot) {
      return 0;
    } else if (aIsRoot) {
      return -1;
    } else if (bIsRoot) {
      return 1;
    }

    if (a.depth !== b.depth) {
      return a.depth - b.depth;
    }

    const aParent = a.fullPath.slice(0, a.fullPath.lastIndexOf('/'));
    const bParent = b.fullPath.slice(0, b.fullPath.lastIndexOf('/'));

    if (aParent !== bParent) {
      return aParent.localeCompare(bParent);
    }

    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }

    return a.name.localeCompare(b.name);
  });

  return sortedFileList;
}
