import { useStore } from '@nanostores/react';
import { motion, type HTMLMotionProps, type Variants } from 'framer-motion';
import { computed } from 'nanostores';
import { memo, useCallback, useEffect, useState } from 'react';
import { ActionRunner } from '~/lib/runtime/action-runner';
import {
  type OnChangeCallback as OnEditorChange,
  type OnScrollCallback as OnEditorScroll,
} from '~/components/editor/codemirror/CodeMirrorEditor';
import { IconButton } from '~/components/ui/IconButton';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { EditorPanel } from './EditorPanel';
import { Preview } from './Preview';
import useViewport from '~/lib/hooks';
import { usePreviewStore } from '~/lib/stores/previews';
import { chatStore } from '~/lib/stores/chat';

interface WorkspaceProps {
  chatStarted?: boolean;
  isStreaming?: boolean;
  actionRunner: ActionRunner;
  setSelectedElement?: (element: any) => void;
}

const viewTransition = { ease: cubicEasingFn };

const workbenchVariants = {
  closed: {
    width: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    width: '60%',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

export const Workbench = memo(({ chatStarted, isStreaming, actionRunner, setSelectedElement }: WorkspaceProps) => {
  const hasPreview = useStore(computed(workbenchStore.previews, (previews) => previews.length > 0));
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const selectedFile = useStore(workbenchStore.selectedFile);
  const currentDocument = useStore(workbenchStore.currentDocument);
  const unsavedFiles = useStore(workbenchStore.unsavedFiles);
  const files = useStore(workbenchStore.files);
  const { showChat } = useStore(chatStore);

  const isSmallViewport = useViewport(1024);

  // Simple view state - only code and preview
  const [selectedView, setSelectedView] = useState<'code' | 'preview'>('code');

  // Auto-switch to preview when it becomes available
  useEffect(() => {
    if (hasPreview) {
      setSelectedView('preview');
    }
  }, [hasPreview]);

  useEffect(() => {
    workbenchStore.setDocuments(files);
  }, [files]);

  const onEditorChange = useCallback<OnEditorChange>((update) => {
    workbenchStore.setCurrentDocumentContent(update.content);
  }, []);

  const onEditorScroll = useCallback<OnEditorScroll>((position) => {
    workbenchStore.setCurrentDocumentScrollPosition(position);
  }, []);

  const onFileSelect = useCallback((filePath: string | undefined) => {
    workbenchStore.setSelectedFile(filePath);
  }, []);

  const onFileSave = useCallback(() => {
    workbenchStore
      .saveCurrentDocument()
      .then(() => {
        // Explicitly refresh all previews after a file save
        const previewStore = usePreviewStore();
        previewStore.refreshAllPreviews();
      })
      .catch(() => {
        // Handle error silently
      });
  }, []);

  const onFileReset = useCallback(() => {
    workbenchStore.resetCurrentDocument();
  }, []);

  return (
    chatStarted && (
      <motion.div
        initial="closed"
        animate={showWorkbench ? 'open' : 'closed'}
        variants={workbenchVariants}
        className="z-workbench relative h-full"
      >
        <div className="h-full border-l border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 flex flex-col">
          <div className="flex items-center px-3 py-2 border-b border-bolt-elements-borderColor">
            <div className="flex items-center gap-2">
              <button
                className={classNames(
                  'px-3 py-1 rounded-md text-sm font-medium transition-colors',
                  selectedView === 'code'
                    ? 'bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary'
                    : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive'
                )}
                onClick={() => setSelectedView('code')}
              >
                Code
              </button>
              {hasPreview && (
                <button
                  className={classNames(
                    'px-3 py-1 rounded-md text-sm font-medium transition-colors',
                    selectedView === 'preview'
                      ? 'bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary'
                      : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive'
                  )}
                  onClick={() => setSelectedView('preview')}
                >
                  Preview
                </button>
              )}
            </div>
            <IconButton
              icon="i-ph:x-circle"
              className="ml-auto -mr-1"
              size="xl"
              onClick={() => {
                workbenchStore.showWorkbench.set(false);
              }}
            />
          </div>
          <div className="relative flex-1 overflow-hidden">
            <View initial={{ x: '0%' }} animate={{ x: selectedView === 'code' ? '0%' : '-100%' }}>
              <EditorPanel
                editorDocument={currentDocument}
                isStreaming={isStreaming}
                selectedFile={selectedFile}
                files={files}
                unsavedFiles={unsavedFiles}
                onFileSelect={onFileSelect}
                onEditorScroll={onEditorScroll}
                onEditorChange={onEditorChange}
                onFileSave={onFileSave}
                onFileReset={onFileReset}
              />
            </View>
            <View initial={{ x: '100%' }} animate={{ x: selectedView === 'preview' ? '0%' : '100%' }}>
              <Preview setSelectedElement={setSelectedElement} />
            </View>
          </div>
        </div>
      </motion.div>
    )
  );
});

// View component for rendering content with motion transitions
interface ViewProps extends HTMLMotionProps<'div'> {
  children: JSX.Element;
}

const View = memo(({ children, className, ...props }: ViewProps) => {
  return (
    <motion.div className={classNames('absolute inset-0', className)} transition={viewTransition} {...props}>
      {children}
    </motion.div>
  );
});
